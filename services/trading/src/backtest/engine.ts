/**
 * Event-driven bar-replay backtest engine. Long-only spot, one instrument.
 *
 * No look-ahead by construction:
 *   - at bar t the strategy receives only candles[0..t] (a frozen prefix copy);
 *   - a signal produced at bar t fills at bar t+1's OPEN, plus half-spread and slippage;
 *   - equity is marked at each bar's close.
 * All money is bigint minor units of the quote currency; quantities are atoms (8 dp).
 * The only randomness is a seeded slippage jitter, so a run is a pure function of
 * (data, strategy, config, seed).
 */
import type { Candle } from '../market/market-data.js';
import type { DeterministicStrategy } from '../strategy/types.js';
import { Signal } from '../strategy/types.js';
import { FilterError, QTY_SCALE, notionalMinor, roundPriceToTick, roundQtyDown, validateOrder, type SymbolFilters } from './exchange-filters.js';

export interface CostModel {
  /** Taker fee in basis points (Binance spot default tier 0.1% = 10). */
  readonly feeBps: bigint;
  /** Half the quoted spread, bps, paid on every fill. */
  readonly halfSpreadBps: bigint;
  /** Fixed slippage, bps. */
  readonly slippageBps: bigint;
  /** Additional uniform jitter 0..slippageJitterBps (seeded). */
  readonly slippageJitterBps: number;
}

export const DEFAULT_COSTS: CostModel = Object.freeze({ feeBps: 10n, halfSpreadBps: 1n, slippageBps: 2n, slippageJitterBps: 3 });
export const ZERO_COSTS: CostModel = Object.freeze({ feeBps: 0n, halfSpreadBps: 0n, slippageBps: 0n, slippageJitterBps: 0 });

export function isZeroCost(c: CostModel): boolean {
  return c.feeBps === 0n && c.halfSpreadBps === 0n && c.slippageBps === 0n && c.slippageJitterBps === 0;
}

export interface BacktestConfig {
  readonly candles: readonly Candle[];
  readonly strategy: DeterministicStrategy;
  /** Trading window [start, end) as candle indices. Bars before start are history only. */
  readonly start: number;
  readonly end: number;
  readonly initialCashMinor: bigint;
  /** Share of cash committed on entry, bps (10000 = all-in). */
  readonly allocationBps: bigint;
  readonly costs: CostModel;
  readonly filters: SymbolFilters;
  readonly seed: number;
  /** Close any open position at the last bar's close (with costs). Default true. */
  readonly liquidateAtEnd?: boolean;
}

export interface Fill {
  readonly barIndex: number;
  readonly eventTs: string;
  readonly side: 'BUY' | 'SELL';
  readonly qtyAtoms: bigint;
  readonly priceMinor: bigint;
  readonly notionalMinor: bigint;
  readonly feeMinor: bigint;
  readonly signalBarIndex: number;
}

export interface RoundTrip {
  readonly entryBar: number;
  readonly exitBar: number;
  readonly pnlMinor: bigint; // after fees on both legs
}

export interface SignalRecord {
  readonly barIndex: number;
  readonly signal: Signal;
  readonly confidence: number;
}

export interface BacktestResult {
  readonly start: number;
  readonly end: number;
  readonly initialCashMinor: bigint;
  readonly finalEquityMinor: bigint;
  /** Equity at each bar close in [start, end). */
  readonly equityMinor: readonly bigint[];
  /** 1 if holding a position at that bar's close, else 0. */
  readonly inPosition: readonly number[];
  readonly fills: readonly Fill[];
  readonly roundTrips: readonly RoundTrip[];
  readonly signals: readonly SignalRecord[];
  readonly feesPaidMinor: bigint;
  readonly rejectedByFilters: number;
  readonly maxBarIndexSeen: number;
}

/** mulberry32 — small, fast, deterministic PRNG. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BPS = 10_000n;
const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function runBacktest(cfg: BacktestConfig): BacktestResult {
  const { candles, strategy, start, end, costs, filters } = cfg;
  if (!(start >= 0 && end <= candles.length && start < end)) throw new RangeError(`bad window [${start}, ${end}) for ${candles.length} candles`);
  if (cfg.allocationBps <= 0n || cfg.allocationBps > BPS) throw new RangeError('allocationBps must be 1..10000');
  for (let i = 1; i < candles.length; i++) {
    if (Date.parse(candles[i]!.eventTs) <= Date.parse(candles[i - 1]!.eventTs)) throw new RangeError(`candles not strictly increasing at ${i}`);
  }
  const rand = seededRandom(cfg.seed);
  let cash = cfg.initialCashMinor;
  let qty = 0n;
  let entryCost = 0n; // cash spent incl. fee for the open position
  let entryBar = -1;
  let pending: { side: 'BUY' | 'SELL'; signalBar: number } | null = null;
  let fees = 0n;
  let rejected = 0;
  let maxSeen = -1;
  const fills: Fill[] = [];
  const trips: RoundTrip[] = [];
  const equity: bigint[] = [];
  const inPos: number[] = [];
  const signals: SignalRecord[] = [];

  const fillPrice = (side: 'BUY' | 'SELL', ref: bigint): bigint => {
    const jitter = costs.slippageJitterBps > 0 ? BigInt(Math.floor(rand() * (costs.slippageJitterBps + 1))) : 0n;
    const bps = costs.halfSpreadBps + costs.slippageBps + jitter;
    const raw = side === 'BUY' ? ceilDiv(ref * (BPS + bps), BPS) : (ref * (BPS - bps)) / BPS;
    return roundPriceToTick(raw, filters, side);
  };

  const execute = (side: 'BUY' | 'SELL', barIndex: number, ref: bigint, signalBar: number) => {
    const px = fillPrice(side, ref);
    if (side === 'BUY') {
      if (qty > 0n) return;
      const budget = (cash * cfg.allocationBps) / BPS;
      // qty such that notional + fee <= budget
      let q = (budget * BPS * QTY_SCALE) / (px * (BPS + costs.feeBps));
      q = roundQtyDown(q, filters);
      if (filters.maxQtyAtoms !== null && q > filters.maxQtyAtoms) q = roundQtyDown(filters.maxQtyAtoms, filters);
      // The fee rounds up, so shave one step if notional + fee would overspend the budget.
      while (q > 0n && notionalMinor(q, px) + ceilDiv(notionalMinor(q, px) * costs.feeBps, BPS) > budget) q -= filters.stepAtoms;
      try { validateOrder(q, px, filters); } catch (e) { if (e instanceof FilterError) { rejected++; return; } throw e; }
      const n = notionalMinor(q, px);
      const fee = ceilDiv(n * costs.feeBps, BPS);
      cash -= n + fee;
      fees += fee;
      qty = q;
      entryCost = n + fee;
      entryBar = barIndex;
      fills.push({ barIndex, eventTs: candles[barIndex]!.eventTs, side, qtyAtoms: q, priceMinor: px, notionalMinor: n, feeMinor: fee, signalBarIndex: signalBar });
    } else {
      if (qty === 0n) return;
      try { validateOrder(qty, px, filters); } catch (e) { if (e instanceof FilterError) { rejected++; return; } throw e; }
      const n = notionalMinor(qty, px);
      const fee = ceilDiv(n * costs.feeBps, BPS);
      cash += n - fee;
      fees += fee;
      fills.push({ barIndex, eventTs: candles[barIndex]!.eventTs, side, qtyAtoms: qty, priceMinor: px, notionalMinor: n, feeMinor: fee, signalBarIndex: signalBar });
      trips.push({ entryBar, exitBar: barIndex, pnlMinor: n - fee - entryCost });
      qty = 0n;
      entryCost = 0n;
      entryBar = -1;
    }
  };

  for (let t = start; t < end; t++) {
    const bar = candles[t]!;
    // 1. Fill the order decided at the previous bar's close, at this bar's open.
    if (pending) {
      execute(pending.side, t, bar.openMinor, pending.signalBar);
      pending = null;
    }
    // 2. Mark to market at the close.
    equity.push(cash + notionalMinor(qty, bar.closeMinor));
    inPos.push(qty > 0n ? 1 : 0);
    // 3. Decide at the close using only bars 0..t. No new orders on the last bar.
    if (t < end - 1) {
      const view = Object.freeze(candles.slice(0, t + 1));
      maxSeen = Math.max(maxSeen, view.length - 1);
      const s = strategy.evaluate({ instrument: bar.instrument, latestQuote: null, recentCandles: view });
      signals.push({ barIndex: t, signal: s.signal, confidence: s.confidence });
      if (s.signal === Signal.BUY && qty === 0n) pending = { side: 'BUY', signalBar: t };
      else if (s.signal === Signal.SELL && qty > 0n) pending = { side: 'SELL', signalBar: t };
    }
  }

  if ((cfg.liquidateAtEnd ?? true) && qty > 0n) {
    const last = end - 1;
    execute('SELL', last, candles[last]!.closeMinor, last);
    equity[equity.length - 1] = cash;
    inPos[inPos.length - 1] = 0;
  }

  return {
    start, end,
    initialCashMinor: cfg.initialCashMinor,
    finalEquityMinor: equity[equity.length - 1]!,
    equityMinor: equity,
    inPosition: inPos,
    fills, roundTrips: trips, signals,
    feesPaidMinor: fees,
    rejectedByFilters: rejected,
    maxBarIndexSeen: maxSeen,
  };
}
