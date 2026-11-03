// Workload adapters registered into the vNext RoutingKernel for customer workflows.
//
//   trading.strategy_evaluation  walk-forward backtest of a compiled strategy spec
//   procurement.capability       one call to a catalog capability offer
//
// Both settle POST (after a verified result): a failed or unverified execution
// throws, the kernel compensates and never reaches SETTLE — nothing is charged.
// Settlement is WithheldSettlement until pricing is approved: it records what
// would be charged/paid, moves no money and marks every record `withheld`.

import { WorkloadAdapter, SettlementAdapter, SettlementMode, ExecutionSafety } from '../vnext/kernel/interfaces.js';
import {
  BinanceSpotDataProvider, PAPER_INSTRUMENTS, StrategyHorizon, SMAcrossoverStrategy,
  DonchianBreakoutStrategy, DEFAULT_COSTS, DEFAULT_SPOT_FILTERS, compileFilters, evaluateStrategy,
} from '../trading/engine/index.js';
import { verifyResult, ConnectorError } from './connectors.js';
import { microsToUsd } from './supplier_catalog.js';
import { validateSpec } from './strategy_compiler.js';

export const WORKLOADS = Object.freeze({ STRATEGY: 'trading.strategy_evaluation' });
/** One procurement workload per capability, so DISCOVER only sees offers for it. */
export const procurementWorkload = (capability) => `procurement:${capability}`;

export const SIMULATION_LABEL = 'SIMULATED / BACKTEST — NOT ACTUAL RETURNS';

/** Deep-convert bigint to string so results are JSON/journal safe. */
export function plain(v) {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (k !== 'instrument' && k !== 'licensing') o[k] = plain(x);
    return o;
  }
  return v;
}

const INSTRUMENTS = { 'BINANCE:BTCUSDT': PAPER_INSTRUMENTS.BTC_USDT, 'BINANCE:ETHUSDT': PAPER_INSTRUMENTS.ETH_USDT };

/**
 * Closed daily candles with a small in-process cache (1h TTL). Not a dataset
 * store: every evaluation records the dataset hash/range it actually used.
 */
export function createCandleSource({ provider = new BinanceSpotDataProvider(), clock = () => Date.now(), ttlMs = 3_600_000, maxEntries = 8 } = {}) {
  const cache = new Map(); // insertion-ordered → oldest evicted first (bounded)
  return {
    async load(instrumentId, startIso) {
      const inst = Object.hasOwn(INSTRUMENTS, instrumentId) ? INSTRUMENTS[instrumentId] : null;
      if (!inst) throw new ConnectorError('bad_input', `unsupported market ${instrumentId}`);
      const startMs = Date.parse(startIso);
      if (!Number.isFinite(startMs)) throw new ConnectorError('bad_input', 'invalid evaluation start');
      const key = `${instrumentId}|${new Date(startMs).toISOString().slice(0, 10)}`;
      const hit = cache.get(key);
      if (hit && clock() - hit.at < ttlMs) return hit.candles;
      let candles;
      try {
        candles = await provider.historicalCandles(inst, '1d', startMs, clock());
      } catch (e) {
        const msg = String(e?.message || e);
        throw new ConnectorError(/451/.test(msg) ? 'data_geo_restricted' : 'data_unavailable', `market data unavailable: ${msg}`);
      }
      cache.delete(key);
      cache.set(key, { at: clock(), candles });
      while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
      return candles;
    },
  };
}

function familyFor(spec) {
  if (spec.family === 'sma-crossover') {
    return { id: 'sma-crossover', version: '1.0.0', grid: [spec.params], build: (p) => new SMAcrossoverStrategy({ ...p, horizon: StrategyHorizon.SWING }) };
  }
  return { id: 'donchian-breakout', version: DonchianBreakoutStrategy.VERSION, grid: [spec.params], build: (p) => new DonchianBreakoutStrategy(p) };
}

/** Customer-facing scorecard from a StrategyEvaluation (all numbers from the engine). */
export function toScorecard(spec, evaluation, offer) {
  const e = plain(evaluation);
  const pct = (bps) => Number(bps) / 100;
  return {
    label: SIMULATION_LABEL,
    verdict: e.verdict,
    verdict_reasons: e.verdictReasons,
    evaluation_id: e.evaluationId,
    result_hash: e.resultHash,
    strategy: { id: spec.id, family: spec.family, family_version: spec.family_version, params: spec.params, market: spec.market.instrument_id },
    method: {
      kind: 'walk-forward out-of-sample',
      windows: e.params.windows, train_bars: e.params.trainBars, test_bars: e.params.testBars,
      execution: 'signal on bar close, fill at next bar open (t+1)',
      costs_bps: { fee: Number(e.params.costs.feeBps), half_spread: Number(e.params.costs.halfSpreadBps), slippage: Number(e.params.costs.slippageBps) },
      baselines: ['no-trade', 'buy-and-hold', 'sma-crossover 10/30'],
      pass_rule: 'beat the best baseline in ≥ 3 of 4 OOS windows AND worst drawdown ≤ buy-and-hold; no leakage/zero-cost flags',
      leakage_check: e.flags.includes('LEAKAGE') ? 'FAILED' : 'passed',
    },
    summary: {
      windows_beaten: e.summary.windowsBeaten,
      candidate_total_return_pct: pct(e.summary.candidateTotalReturnBps),
      best_baseline_total_return_pct: pct(e.summary.bestBaselineTotalReturnBps),
      candidate_worst_drawdown_pct: pct(e.summary.candidateWorstDrawdownBps),
      buy_and_hold_worst_drawdown_pct: pct(e.summary.buyAndHoldWorstDrawdownBps),
    },
    windows: e.windows.map((w) => ({
      index: w.index,
      test_from: w.test.from, test_to: w.test.to,
      candidate_return_pct: pct(w.candidate.netReturnBps),
      candidate_drawdown_pct: pct(w.candidate.maxDrawdownBps),
      trades: w.candidate.tradeCount,
      win_rate: w.candidate.winRate,
      sharpe: w.candidate.sharpe,
      best_baseline: w.bestBaselineId,
      best_baseline_return_pct: pct(w.baselines[w.bestBaselineId].netReturnBps),
      beat_best_baseline: w.beatBestBaseline,
    })),
    flags: e.flags,
    data: {
      provider: offer.provider.name,
      offer_id: offer.id,
      ...e.datasets[0],
      licence: offer.license.evidence,
      commercial_licence: offer.license.resale,
    },
    created_at: e.createdAt,
    expires_at: e.expiresAt,
  };
}

export class StrategyEvaluationAdapter extends WorkloadAdapter {
  constructor({ catalog, candleSource, evaluationStore = null, clock }) {
    super();
    this.catalog = catalog;
    this.candles = candleSource;
    this.evaluations = evaluationStore; // append-only trading_strategy_evaluations (040) when wired
    this.clock = clock || (() => Date.now());
  }
  capabilities() { return { key: WORKLOADS.STRATEGY, resourceTypes: ['strategy_spec'], settlementMode: SettlementMode.POST, executionSafety: ExecutionSafety.IDEMPOTENT }; }
  async discover() { return []; } // candidates come from the SupplierRegistry
  // Kernel contract: quote.cost is what SETTLE pays the supplier. The customer charge
  // travels separately and is never confused with supplier cost.
  async quote(_req, s) {
    const offer = this.catalog.offer(s.supplierId);
    const p = this.catalog.price(offer);
    return { cost: p.supplierCostMicros.toString(), customerCharge: p.chargeMicros.toString(), unit: 'uUSD', supplierId: s.supplierId };
  }
  async execute(req, s) {
    const spec = req.payload?.spec;
    const problems = validateSpec(spec);
    if (problems.length) throw new ConnectorError('invalid_spec', problems.join('; '));
    const offer = this.catalog.offer(s.supplierId);
    const candles = await this.candles.load(spec.market.instrument_id, spec.evaluation.start);
    const need = spec.evaluation.train_bars + spec.evaluation.windows * spec.evaluation.test_bars;
    if (candles.length < need) throw new ConnectorError('data_insufficient', `need ${need} daily bars, have ${candles.length}`);
    const inst = INSTRUMENTS[spec.market.instrument_id];
    const evaluation = evaluateStrategy({
      family: familyFor(spec), candles,
      dataset: { source: 'binance-spot-klines', instrumentId: inst.id, period: '1d' },
      costs: DEFAULT_COSTS,
      filters: compileFilters(DEFAULT_SPOT_FILTERS[spec.market.symbol], inst.pricePrecision),
      initialCashMinor: 1_000_00n,
      allocationBps: BigInt(spec.risk.allocation_pct * 100),
      trainBars: spec.evaluation.train_bars, testBars: spec.evaluation.test_bars, windows: spec.evaluation.windows,
      seed: 20261103, periodsPerYear: 365,
      now: () => new Date(this.clock()),
    });
    if (this.evaluations) {
      try { await this.evaluations.append(evaluation); } catch (e) {
        if (e?.name !== 'DuplicateEvaluationError') throw new ConnectorError('evaluation_store_failed', 'the evaluation could not be recorded');
      }
    }
    const scorecard = toScorecard(spec, evaluation, offer);
    // Result verification: the engine's own invariants, re-checked at the boundary.
    if (!['PASS', 'FAIL'].includes(scorecard.verdict) || scorecard.windows.length !== spec.evaluation.windows) {
      throw new ConnectorError('invalid_result', 'evaluation result failed verification');
    }
    return { kind: 'scorecard', scorecard, served_by: offer.id };
  }
}

export class CapabilityProcurementAdapter extends WorkloadAdapter {
  constructor({ catalog, connectors, capability }) {
    super();
    this.catalog = catalog;
    this.connectors = connectors; // { [type]: connector }
    this.capability = capability;
  }
  capabilities() { return { key: procurementWorkload(this.capability), resourceTypes: ['capability_call'], settlementMode: SettlementMode.POST, executionSafety: ExecutionSafety.IDEMPOTENT }; }
  async discover() { return []; }
  // Kernel contract: quote.cost is what SETTLE pays the supplier. The customer charge
  // travels separately and is never confused with supplier cost.
  async quote(_req, s) {
    const offer = this.catalog.offer(s.supplierId);
    const p = this.catalog.price(offer);
    return { cost: p.supplierCostMicros.toString(), customerCharge: p.chargeMicros.toString(), unit: 'uUSD', supplierId: s.supplierId };
  }
  async execute(req, s) {
    const offer = this.catalog.offer(s.supplierId);
    const gate = this.catalog.purchasability(offer, req.payload?.network);
    if (!gate.ok) throw new ConnectorError(gate.reason, gate.detail);
    const connector = this.connectors[offer.connector?.type];
    if (!connector) throw new ConnectorError('connector_missing', `no connector for '${offer.connector?.type}'`);
    const raw = await connector.call(offer, req.payload);
    const data = verifyResult(offer.capability, raw);
    return {
      kind: 'capability_result',
      capability: offer.capability,
      served_by: offer.id,
      provider: offer.provider.name,
      verified: true,
      latency_ms: raw.latency_ms ?? null,
      data,
      disclaimer: this.catalog.capability(offer.capability)?.disclaimer || null,
    };
  }
}

/**
 * Records charge and supplier-payment intents without moving money. While
 * pricing is unapproved every amount is 0 and status is `withheld`; it never
 * writes to api_credits, revenue_events or any ledger.
 */
export class WithheldSettlement extends SettlementAdapter {
  constructor() { super(); this.records = []; }
  capabilities() { return { modes: ['POST'], units: ['uUSD'], finality: 'NONE' }; }
  async settleIn(amount, unit, payer, idemKey) { return this._rec('hold', amount, unit, payer, idemKey); }
  async settleOut(amount, unit, payee, idemKey) { return this._rec('supplier_payment', amount, unit, payee, idemKey); }
  async verify(ref) { return { status: 'withheld', ref }; }
  _rec(kind, amount, unit, party, idemKey) {
    const existing = this.records.find((r) => r.idemKey === idemKey);
    if (existing) return existing.ref;
    const ref = { ref: `withheld_${idemKey}`, kind, amount_usd: microsToUsd(BigInt(amount || 0)), unit, party, status: 'withheld', money_moved: false };
    this.records.push({ idemKey, ref });
    return ref;
  }
}
