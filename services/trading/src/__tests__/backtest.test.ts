/**
 * @satelink/trading — backtest engine, leakage gate, walk-forward evaluation, store.
 */
import { describe, it, expect } from 'vitest';
import { PAPER_INSTRUMENTS } from '../market/instrument.js';
import { DataFreshness, type Candle } from '../market/market-data.js';
import { Signal, StrategyHorizon, type DeterministicStrategy, type StrategyInput } from '../strategy/types.js';
import { SMAcrossoverStrategy } from '../strategy/sma-crossover.js';
import { runBacktest, seededRandom, DEFAULT_COSTS, ZERO_COSTS } from '../backtest/engine.js';
import { compileFilters, validateOrder, roundPriceToTick, FilterError, DEFAULT_SPOT_FILTERS } from '../backtest/exchange-filters.js';
import { computeMetrics } from '../backtest/metrics.js';
import { detectLookahead } from '../backtest/leakage.js';
import { evaluateStrategy, isUsablePass, canonicalJson, datasetHash } from '../backtest/evaluation.js';
import { SMA_FAMILY, DONCHIAN_FAMILY, BuyAndHoldStrategy, NoTradeStrategy, type CandidateFamily } from '../backtest/strategies.js';
import { InMemoryEvaluationStore, DuplicateEvaluationError, reviveEvaluation } from '../backtest/evaluation-store.js';

const BTC = PAPER_INSTRUMENTS.BTC_USDT;
const FILTERS = compileFilters(DEFAULT_SPOT_FILTERS['BTCUSDT']!, BTC.pricePrecision);
const CASH = 1_000_00n; // 1,000.00 USDT
const LIC = { source: 'test', strategyDerivationPermitted: true, displayPermitted: false, redistributionPermitted: false, commercialLicense: false, licenseEvidence: null };

/** Deterministic synthetic daily series: price = base · (1 + amp·sin(2πt/period)) + drift + noise. */
function series(n: number, opts: { seed?: number; base?: number; amp?: number; period?: number; drift?: number } = {}): Candle[] {
  const r = seededRandom(opts.seed ?? 1);
  const base = opts.base ?? 30_000, amp = opts.amp ?? 0.25, period = opts.period ?? 120, drift = opts.drift ?? 0;
  const out: Candle[] = [];
  let prevClose = BigInt(Math.round(base * 100));
  for (let t = 0; t < n; t++) {
    const px = base * (1 + amp * Math.sin((2 * Math.PI * t) / period)) + drift * t + (r() - 0.5) * base * 0.01;
    const close = BigInt(Math.max(100, Math.round(px * 100)));
    const open = prevClose;
    const hi = (open > close ? open : close) + BigInt(Math.round(r() * base));
    const lo = (open < close ? open : close) - BigInt(Math.round(r() * base));
    out.push({ kind: 'CANDLE', instrument: BTC, period: '1d', eventTs: new Date(Date.UTC(2020, 0, 1) + t * 86_400_000).toISOString(), retrievalTs: '2026-10-31T00:00:00.000Z', freshness: DataFreshness.SNAPSHOT, freshnessWindowSec: 86_400, licensing: LIC, openMinor: open, highMinor: hi, lowMinor: lo > 0n ? lo : 1n, closeMinor: close, volume: '1', isClosed: true });
    prevClose = close;
  }
  return out;
}

class SpyStrategy implements DeterministicStrategy {
  readonly id = 'spy'; readonly version = '1'; readonly horizon = StrategyHorizon.INTRADAY;
  maxLen = 0;
  evaluate(i: StrategyInput) {
    this.maxLen = Math.max(this.maxLen, i.recentCandles.length);
    const n = i.recentCandles.length;
    return { signal: n % 10 === 0 ? Signal.BUY : n % 10 === 5 ? Signal.SELL : Signal.HOLD, confidence: 0.5, rationale: '', strategyVersion: '1', generatedAt: '' };
  }
}

/** A planted future-data feature: peeks at the next bar of the dataset it was built with. */
const plantedFamily: CandidateFamily<{ k: number }> = {
  id: 'planted-future', version: '0.0.1', grid: [{ k: 1 }],
  build: (_p, dataset) => ({
    id: 'planted-future', version: '0.0.1', horizon: StrategyHorizon.INTRADAY,
    evaluate: (i) => {
      const t = i.recentCandles.length - 1;
      const next = dataset[t + 1];
      const up = next ? next.closeMinor > dataset[t]!.closeMinor : false;
      return { signal: up ? Signal.BUY : Signal.SELL, confidence: 0.9, rationale: 'tomorrow', strategyVersion: '0.0.1', generatedAt: '' };
    },
  }),
};

describe('exchange filters (bigint)', () => {
  it('enforces PRICE_FILTER, LOT_SIZE and MIN_NOTIONAL', () => {
    expect(() => validateOrder(100_000n, 3_000_000n, FILTERS)).not.toThrow(); // 0.001 BTC @ 30,000.00
    expect(() => validateOrder(100_001n, 3_000_000n, FILTERS)).toThrow(/LOT_SIZE/); // off step
    expect(() => validateOrder(999n, 3_000_000n, FILTERS)).toThrow(/LOT_SIZE/); // < minQty
    expect(() => validateOrder(1_000n, 3_000_000n, FILTERS)).toThrow(FilterError); // 0.00001 BTC = 0.30 USDT < 5
    expect(roundPriceToTick(3_000_001n, compileFilters({ ...DEFAULT_SPOT_FILTERS['BTCUSDT']!, tickSize: '0.10' }, 2), 'BUY')).toBe(3_000_010n);
    expect(roundPriceToTick(3_000_009n, compileFilters({ ...DEFAULT_SPOT_FILTERS['BTCUSDT']!, tickSize: '0.10' }, 2), 'SELL')).toBe(3_000_000n);
  });
});

describe('backtest engine', () => {
  const candles = series(300);

  it('gives the strategy only bars 0..t and fills at bar t+1 open plus costs', () => {
    const spy = new SpyStrategy();
    const r = runBacktest({ candles, strategy: spy, start: 50, end: 200, initialCashMinor: CASH, allocationBps: 10_000n, costs: { ...DEFAULT_COSTS, slippageJitterBps: 0 }, filters: FILTERS, seed: 1 });
    expect(r.maxBarIndexSeen).toBe(198); // decisions stop at end-2; never sees bar 199+ while deciding
    expect(spy.maxLen).toBe(199);
    expect(r.fills.length).toBeGreaterThan(4);
    // Every entry, and every exit except the end-of-window liquidation, fills on the bar after its signal.
    const liquidation = r.fills.filter((x) => x.side === 'SELL' && x.barIndex === 199 && x.signalBarIndex === 199);
    expect(liquidation.length).toBeLessThanOrEqual(1);
    for (const f of r.fills.filter((x) => !liquidation.includes(x))) {
      expect(f.barIndex).toBe(f.signalBarIndex + 1);
      const open = candles[f.barIndex]!.openMinor;
      if (f.side === 'BUY') expect(f.priceMinor).toBe((open * 10_003n + 9_999n) / 10_000n); // +1 spread +2 slip bps, ceil
      else expect(f.priceMinor).toBe((open * 9_997n) / 10_000n);
      expect(f.feeMinor).toBe((f.notionalMinor * 10n + 9_999n) / 10_000n);
    }
  });

  it('never spends more cash than it has, and no-trade equity is exactly constant', () => {
    const bh = runBacktest({ candles, strategy: new BuyAndHoldStrategy(), start: 0, end: 300, initialCashMinor: CASH, allocationBps: 10_000n, costs: DEFAULT_COSTS, filters: FILTERS, seed: 3 });
    const buy = bh.fills[0]!;
    expect(buy.notionalMinor + buy.feeMinor).toBeLessThanOrEqual(CASH);
    expect(bh.fills.at(-1)!.side).toBe('SELL'); // liquidated at window end
    const nt = runBacktest({ candles, strategy: new NoTradeStrategy(), start: 0, end: 300, initialCashMinor: CASH, allocationBps: 10_000n, costs: DEFAULT_COSTS, filters: FILTERS, seed: 3 });
    expect(new Set(nt.equityMinor).size).toBe(1);
    expect(computeMetrics(nt, candles, 365).netReturnBps).toBe(0n);
  });

  it('rejects orders below MIN_NOTIONAL instead of filling them', () => {
    const r = runBacktest({ candles, strategy: new BuyAndHoldStrategy(), start: 0, end: 100, initialCashMinor: 400n, allocationBps: 10_000n, costs: DEFAULT_COSTS, filters: FILTERS, seed: 1 });
    expect(r.fills).toHaveLength(0);
    expect(r.rejectedByFilters).toBeGreaterThan(0);
  });

  it('costs strictly reduce the result versus a zero-cost run', () => {
    const s = new SMAcrossoverStrategy({ fastPeriod: 5, slowPeriod: 30 });
    const a = computeMetrics(runBacktest({ candles, strategy: s, start: 40, end: 300, initialCashMinor: CASH, allocationBps: 10_000n, costs: DEFAULT_COSTS, filters: FILTERS, seed: 9 }), candles, 365);
    const b = computeMetrics(runBacktest({ candles, strategy: s, start: 40, end: 300, initialCashMinor: CASH, allocationBps: 10_000n, costs: ZERO_COSTS, filters: FILTERS, seed: 9 }), candles, 365);
    expect(a.tradeCount).toBeGreaterThan(0);
    expect(a.netReturnBps).toBeLessThan(b.netReturnBps);
    expect(b.feesPaidMinor).toBe(0n);
  });
});

describe('leakage gate', () => {
  const candles = series(400, { seed: 5 });
  it('detects a planted future-data feature', () => {
    const rep = detectLookahead((ds) => plantedFamily.build({ k: 1 }, ds), candles);
    expect(rep.leaks).toBe(true);
    expect(rep.violations.length).toBeGreaterThan(0);
  });
  it('passes point-in-time strategies (SMA, Donchian)', () => {
    expect(detectLookahead((ds) => SMA_FAMILY.build({ fastPeriod: 10, slowPeriod: 50 }, ds), candles).leaks).toBe(false);
    expect(detectLookahead((ds) => DONCHIAN_FAMILY.build({ entry: 20, exit: 10 }, ds), candles).leaks).toBe(false);
  });
  it('a planted feature fails the whole evaluation even though it looks profitable', () => {
    const e = evaluateStrategy({ family: plantedFamily, candles, dataset: { source: 'synthetic', instrumentId: BTC.id, period: '1d' }, costs: DEFAULT_COSTS, filters: FILTERS, initialCashMinor: CASH, trainBars: 60, testBars: 60, seed: 11, periodsPerYear: 365, now: () => new Date('2026-10-31T00:00:00Z') });
    expect(e.flags).toContain('LEAKAGE');
    expect(e.verdict).toBe('FAIL');
    expect(e.verdictReasons.join(';')).toMatch(/blocking flag LEAKAGE/);
  });
});

describe('walk-forward evaluation', () => {
  const candles = series(900, { seed: 21, amp: 0.3, period: 160 });
  const base = { candles, dataset: { source: 'synthetic', instrumentId: BTC.id, period: '1d' }, filters: FILTERS, initialCashMinor: CASH, trainBars: 300, testBars: 150, seed: 42, periodsPerYear: 365, now: () => new Date('2026-10-31T00:00:00Z') };

  it('a zero-cost run is flagged and can never PASS', () => {
    const e = evaluateStrategy({ ...base, family: SMA_FAMILY, costs: ZERO_COSTS });
    expect(e.flags).toContain('ZERO_COST');
    expect(e.verdict).toBe('FAIL');
  });

  it('is deterministic for a given seed', () => {
    const a = evaluateStrategy({ ...base, family: DONCHIAN_FAMILY, costs: DEFAULT_COSTS });
    const b = evaluateStrategy({ ...base, family: DONCHIAN_FAMILY, costs: DEFAULT_COSTS, now: () => new Date('2026-11-05T00:00:00Z') });
    expect(b.resultHash).toBe(a.resultHash);
    expect(b.evaluationId).not.toBe(a.evaluationId); // distinct runs, identical results
    expect(canonicalJson(b.windows)).toBe(canonicalJson(a.windows));
  });

  it('applies the PASS rule: ≥3/4 windows beat the best baseline and drawdown ≤ buy-and-hold', () => {
    const e = evaluateStrategy({ ...base, family: SMA_FAMILY, costs: DEFAULT_COSTS });
    expect(e.windows).toHaveLength(4);
    const beaten = e.windows.filter((w) => w.candidate.netReturnBps > w.baselines[w.bestBaselineId]!.netReturnBps).length;
    expect(e.summary.windowsBeaten).toBe(beaten);
    const ddOk = e.summary.candidateWorstDrawdownBps <= e.summary.buyAndHoldWorstDrawdownBps;
    expect(e.verdict).toBe(beaten >= 3 && ddOk && !e.flags.includes('ZERO_COST') && !e.flags.includes('LEAKAGE') ? 'PASS' : 'FAIL');
    for (const w of e.windows) expect(Object.keys(w.baselines).sort()).toEqual(['buy-and-hold', 'no-trade', 'sma-crossover-10-30']);
    expect(e.datasets[0]!.sha256).toBe(datasetHash(candles));
    expect(Object.isFrozen(e) && Object.isFrozen(e.windows[0])).toBe(true);
  });

  it('isUsablePass enforces PASS, matching version and the 30-day expiry', () => {
    const e = evaluateStrategy({ ...base, family: SMA_FAMILY, costs: DEFAULT_COSTS });
    const forged = { ...e, verdict: 'PASS' as const };
    expect(isUsablePass(forged, 'sma-crossover', '1.0.0', BTC.id, new Date('2026-11-29T00:00:00Z')).ok).toBe(true);
    expect(isUsablePass(forged, 'sma-crossover', '1.0.0', BTC.id, new Date('2026-12-01T00:00:01Z')).reason).toMatch(/expired/);
    expect(isUsablePass(forged, 'sma-crossover', '2.0.0', BTC.id, new Date('2026-11-01T00:00:00Z')).ok).toBe(false);
    expect(isUsablePass({ ...e, verdict: 'FAIL' }, 'sma-crossover', '1.0.0', BTC.id, new Date('2026-11-01T00:00:00Z')).ok).toBe(false);
    expect(isUsablePass(null, 'sma-crossover', '1.0.0', BTC.id, new Date()).ok).toBe(false);
    // Review fixes: instrument must match; a missing/malformed or over-long validity window fails closed.
    expect(isUsablePass(forged, 'sma-crossover', '1.0.0', 'BINANCE:ETHUSDT', new Date('2026-11-01T00:00:00Z')).reason).toMatch(/is for BINANCE:BTCUSDT/);
    expect(isUsablePass({ ...forged, expiresAt: undefined as unknown as string }, 'sma-crossover', '1.0.0', BTC.id, new Date('2026-11-01T00:00:00Z')).ok).toBe(false);
    expect(isUsablePass({ ...forged, expiresAt: '2099-01-01T00:00:00Z' }, 'sma-crossover', '1.0.0', BTC.id, new Date('2026-11-01T00:00:00Z')).ok).toBe(false);
  });
});

describe('evaluation store (append-only)', () => {
  it('appends, rejects duplicates, returns latest, and round-trips bigints through JSON', async () => {
    const candles = series(700, { seed: 3 });
    const mk = (d: string) => evaluateStrategy({ family: DONCHIAN_FAMILY, candles, dataset: { source: 'synthetic', instrumentId: BTC.id, period: '1d' }, costs: DEFAULT_COSTS, filters: FILTERS, initialCashMinor: CASH, trainBars: 200, testBars: 120, seed: 1, periodsPerYear: 365, now: () => new Date(d) });
    const s = new InMemoryEvaluationStore();
    const a = mk('2026-10-01T00:00:00Z');
    const b = mk('2026-10-20T00:00:00Z');
    await s.append(a);
    await s.append(b);
    await expect(s.append(a)).rejects.toBeInstanceOf(DuplicateEvaluationError);
    expect((await s.latest('donchian-breakout', '1.0.0', BTC.id))?.evaluationId).toBe(b.evaluationId);
    const revived = reviveEvaluation(JSON.parse(canonicalJson(a)));
    expect(revived.summary.candidateWorstDrawdownBps).toBe(a.summary.candidateWorstDrawdownBps);
    expect(canonicalJson(revived)).toBe(canonicalJson(a));
  });
});
