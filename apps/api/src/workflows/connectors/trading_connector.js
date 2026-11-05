// Trading AI on the shared engine (Release A, Slice S3). Education and simulation only — not investment advice.
//
//   trading.strategy.evaluate  NL → validated spec (#609 compiler) → walk-forward backtest (#609 engine:
//                              IS/OOS windows, fees, slippage, drawdown, trades, look-ahead check) on a SYNTHETIC
//                              RECORDED dataset → deterministic risk decision GO / WAIT / REJECT with a rule trace
//   trading.paper.order        allowed only if the referenced evaluation re-computes to GO → InternalPaperBroker
//                              (deterministic simulated fill) → report
//
// The new infrastructure piece of S3 is the market adapter: `createRecordedCandleSource` (no network, labelled,
// hashed). Models may explain; they never decide — `decide()` is pure and deterministic.
// No live broker host is ever reachable from here; Indian broker adapters are never constructed (paper only).

import crypto from 'node:crypto';
import { TaskError } from '../errors.js';
import { canonicalJSON } from '../../utils/canonical_json.js';
import { compileStrategy, validateSpec, specId } from '../strategy_compiler.js';
import { INSTRUMENTS, familyFor, toScorecard } from '../workload_adapters.js';
import { DEFAULT_COSTS, DEFAULT_SPOT_FILTERS, compileFilters, evaluateStrategy, datasetHash } from '../../trading/engine/index.js';

export const TRADING_LABEL = 'SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS';
export const DATASET_LABEL = 'SYNTHETIC RECORDED DATASET — generated in-repo, not real market history';
export const ADVICE_NOTICE = 'Education and simulation only. Not investment advice. No real orders are placed.';
export const RISK_POLICY = Object.freeze({ version: 'risk-v1', max_worst_drawdown_pct: 25, min_total_trades: 4 });
const DATA_SOURCE = Object.freeze({ id: 'synthetic.recorded.v1', provider: { name: 'Synthetic recorded dataset (labelled)' }, license: { evidence: 'Generated in-repo by a seeded generator; contains no third-party data.', resale: 'not_applicable' } });

/** Deterministic synthetic daily candles (same series every run; seeded per instrument). */
export function syntheticCandles(instrumentId, n = 1200) {
  const inst = INSTRUMENTS[instrumentId];
  if (!inst) throw new TaskError('VALIDATION_FAILED', `Unsupported market ${instrumentId}.`, { status: 400 });
  let seed = [...instrumentId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const base = instrumentId.includes('ETH') ? 2000 : 30000; const t0 = Date.UTC(2021, 0, 1); const out = [];
  for (let i = 0; i < n; i++) {
    const p = base * (1 + 0.25 * Math.sin(i / 70) + 0.08 * Math.sin(i / 9) + i / 6000) * (1 + (rnd() - 0.5) * 0.01);
    const o = BigInt(Math.round(p * 100)); const c = BigInt(Math.round(p * (1 + (rnd() - 0.5) * 0.02) * 100));
    out.push({ kind: 'CANDLE', instrument: inst, period: '1d', eventTs: new Date(t0 + i * 86_400_000).toISOString(), retrievalTs: new Date(t0).toISOString(),
      freshness: 'SNAPSHOT', freshnessWindowSec: 10, licensing: {}, openMinor: o, highMinor: (o > c ? o : c) + 500n, lowMinor: (o < c ? o : c) - 500n, closeMinor: c, volume: '1', isClosed: true });
  }
  return out;
}

/** The S3 market adapter: recorded/synthetic only, never the network. */
export function createRecordedCandleSource() {
  const cache = new Map();
  return {
    label: DATASET_LABEL,
    async load(instrumentId) { if (!cache.has(instrumentId)) cache.set(instrumentId, syntheticCandles(instrumentId)); return cache.get(instrumentId); },
  };
}

/** Deterministic risk decision with a rule trace. Pure: same scorecard → same decision. */
export function decide(scorecard, policy = RISK_POLICY) {
  const flags = scorecard.flags || [];
  const trades = (scorecard.windows || []).reduce((s, w) => s + Number(w.trades || 0), 0);
  const dd = Number(scorecard.summary?.candidate_worst_drawdown_pct ?? Infinity);
  const trace = [
    { rule: 'L1 no look-ahead leakage', passed: !flags.includes('LEAKAGE'), blocking: true, detail: flags.includes('LEAKAGE') ? 'future data detected in the signal' : 'passed' },
    { rule: 'L2 costs enabled', passed: !flags.includes('ZERO_COST'), blocking: true, detail: flags.includes('ZERO_COST') ? 'evaluation ran without costs' : `fee ${scorecard.method?.costs_bps?.fee} bps, slippage ${scorecard.method?.costs_bps?.slippage} bps` },
    { rule: 'R1 walk-forward verdict PASS', passed: scorecard.verdict === 'PASS', blocking: false, detail: `${scorecard.summary?.windows_beaten}/${scorecard.method?.windows} OOS windows beat the best baseline` },
    { rule: `R2 worst OOS drawdown ≤ ${policy.max_worst_drawdown_pct}%`, passed: dd <= policy.max_worst_drawdown_pct, blocking: false, detail: `${dd}%` },
    { rule: `R3 at least ${policy.min_total_trades} trades`, passed: trades >= policy.min_total_trades, blocking: false, detail: `${trades} trades` },
  ];
  const decision = trace.some((r) => r.blocking && !r.passed) ? 'REJECT' : trace.every((r) => r.passed) ? 'GO' : 'WAIT';
  return { decision, trace, policy_version: policy.version };
}

/** InternalPaperBroker: deterministic simulated fill at the last recorded close (re-computable for verification). */
export function paperFill({ idempotencyKey, instrumentId, side, candles }) {
  const last = candles[candles.length - 1];
  return {
    order_id: `PAPER-${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 12).toUpperCase()}`,
    status: 'filled', instrument_id: instrumentId, side, quantity: '1', fill_price_minor: last.closeMinor.toString(),
    fill_at: last.eventTs, venue: 'InternalPaperBroker', label: TRADING_LABEL,
  };
}

function evaluate(spec, candles, clock) {
  const inst = INSTRUMENTS[spec.market.instrument_id];
  return evaluateStrategy({
    family: familyFor(spec), candles,
    dataset: { source: DATA_SOURCE.id, instrumentId: inst.id, period: '1d' },
    costs: DEFAULT_COSTS, filters: compileFilters(DEFAULT_SPOT_FILTERS[spec.market.symbol], inst.pricePrecision),
    initialCashMinor: 1_000_00n, allocationBps: BigInt(spec.risk.allocation_pct * 100),
    trainBars: spec.evaluation.train_bars, testBars: spec.evaluation.test_bars, windows: spec.evaluation.windows,
    seed: 20261103, periodsPerYear: 365, now: () => new Date(clock()),
  });
}

/**
 * @param {object} o — evaluationStore (PgEvaluationStore — append-only, #609 migration 040), candleSource, clock
 */
export function createTradingConnector({ evaluationStore, candleSource = createRecordedCandleSource(), clock = () => Date.now() }) {
  /** Deterministic evaluation for an evaluation offer (clock anchored to offer.as_of when present). */
  async function evaluationResult(offer) {
    const problems = validateSpec(offer.spec);
    if (problems.length) throw new TaskError('VALIDATION_FAILED', problems.join('; '), { status: 400 });
    const candles = await candleSource.load(offer.spec.market.instrument_id);
    const ev = evaluate(offer.spec, candles, offer.as_of ? () => Date.parse(offer.as_of) : clock);
    const scorecard = toScorecard(offer.spec, ev, DATA_SOURCE);
    return { ev, result: { kind: 'evaluation', evaluation_id: scorecard.evaluation_id, result_hash: scorecard.result_hash, dataset_hash: datasetHash(candles),
      dataset_label: DATASET_LABEL, scorecard, risk: decide(scorecard), label: TRADING_LABEL, notice: ADVICE_NOTICE } };
  }

  async function goEvaluation(evaluationId) {
    const e = evaluationId ? await evaluationStore.get(String(evaluationId)) : null;
    if (!e) throw new TaskError('VALIDATION_FAILED', 'Unknown strategy evaluation.', { status: 400 });
    const sc = toScorecard({ id: e.strategyId, family: e.strategyId, params: {}, market: { instrument_id: e.datasets?.[0]?.instrumentId } }, e, DATA_SOURCE);
    return { e, sc, risk: decide(sc) };
  }

  return {
    type: 'trading_engine',
    configured: () => true,

    async quoteStep({ inputs }) {
      if (inputs.strategy_description) {
        const c = compileStrategy(String(inputs.strategy_description));
        if (c.status !== 'compiled') {
          const why = c.status === 'needs_clarification' ? c.questions.map((q) => q.text).join(' ') : (c.reasons || []).join(' ');
          throw new TaskError('STRATEGY_NOT_SUPPORTED', `I can't evaluate that strategy yet: ${why}`.slice(0, 400), { status: 400 });
        }
        return { supplier_cost_minor: 0n, description: `Walk-forward evaluation of ${c.spec.family} on ${c.spec.market.instrument_id} (synthetic data)`,
          // as_of anchors the evaluation clock to the quote: the same quote always yields the same evaluation id, so a
          // re-execution after a crash is a replay (DuplicateEvaluationError) and recovery can verify without a result.
          offer: { kind: 'evaluation', sku: specId(c.spec), title: `${c.spec.family} ${JSON.stringify(c.spec.params)} on ${c.spec.market.instrument_id}`, price_usd_minor: 0, spec: c.spec, as_of: new Date(clock()).toISOString() } };
      }
      if (inputs.evaluation_id) {
        const { e, risk } = await goEvaluation(inputs.evaluation_id);
        if (risk.decision !== 'GO') throw new TaskError('RISK_NOT_GO', `Paper trading needs a GO evaluation; this one is ${risk.decision}.`, { status: 400 });
        const instrumentId = Object.keys(INSTRUMENTS).find((k) => INSTRUMENTS[k].id === e.datasets?.[0]?.instrumentId) || null;
        if (!instrumentId) throw new TaskError('VALIDATION_FAILED', 'The evaluation has no supported market.', { status: 400 });
        const side = inputs.side === 'sell' ? 'sell' : 'buy';
        return { supplier_cost_minor: 0n, description: `Paper ${side} 1 × ${instrumentId} (InternalPaperBroker, simulated)`,
          offer: { kind: 'paper_order', sku: e.evaluationId, title: `Paper ${side} 1 × ${instrumentId}`, price_usd_minor: 0, evaluation_id: e.evaluationId, instrument_id: instrumentId, side } };
      }
      return null;
    },

    async executeStep({ offer, idempotencyKey }) {
      if (offer.kind === 'evaluation') {
        const problems = validateSpec(offer.spec);
        if (problems.length) throw new TaskError('VALIDATION_FAILED', problems.join('; '), { status: 400 });
        const out = await evaluationResult(offer);
        try { await evaluationStore.append(out.ev); } catch (e) { if (e?.name !== 'DuplicateEvaluationError') throw e; }
        return out.result;
      }
      if (offer.kind === 'paper_order') {
        const { risk } = await goEvaluation(offer.evaluation_id); // re-checked at execution, not only at quote
        if (risk.decision !== 'GO') throw new TaskError('RISK_NOT_GO', 'The evaluation is no longer GO.', { status: 409 });
        const candles = await candleSource.load(offer.instrument_id);
        return { kind: 'paper_order', fill: paperFill({ idempotencyKey, instrumentId: offer.instrument_id, side: offer.side, candles }), label: TRADING_LABEL, notice: ADVICE_NOTICE };
      }
      throw new TaskError('VALIDATION_FAILED', 'Unknown trading step.', { status: 400 });
    },

    /** Independent checks: the evaluation exists in the append-only store with the same hash and decision; a fill re-computes. */
    async verifyStep({ idempotencyKey, offer, result }) {
      if (!result && offer.kind === 'evaluation' && offer.as_of) {
        // Recovery after a crash (no recorded result): recompute the deterministic evaluation and look for it.
        const { ev, result: expected } = await evaluationResult(offer);
        const e = await evaluationStore.get(ev.evaluationId);
        if (!e) return { verified: false, found: false, reason: 'evaluation_not_recorded' };
        const ok = e.resultHash === ev.resultHash;
        return { verified: ok, found: true, reason: ok ? null : 'evaluation_mismatch', result: ok ? expected : undefined,
          evidence: { order_id: e.evaluationId, status: `evaluated:${expected.risk.decision}`, sku: offer.sku, price_usd_minor: 0 } };
      }
      if (!result) return { verified: false, found: false, reason: 'no_result' };
      if (offer.kind === 'evaluation') {
        const e = await evaluationStore.get(String(result.evaluation_id || ''));
        if (!e) return { verified: false, found: false, reason: 'evaluation_not_recorded' };
        const ok = e.resultHash === result.result_hash && decide(result.scorecard).decision === result.risk?.decision;
        return { verified: ok, found: true, reason: ok ? null : 'evaluation_mismatch',
          evidence: { order_id: e.evaluationId, status: `evaluated:${result.risk.decision}`, sku: offer.sku, price_usd_minor: 0 } };
      }
      const candles = await candleSource.load(offer.instrument_id);
      const expected = paperFill({ idempotencyKey, instrumentId: offer.instrument_id, side: offer.side, candles });
      // Canonical comparison: the stored result round-trips through JSONB, which reorders object keys.
      const ok = canonicalJSON(expected) === canonicalJSON(result.fill);
      return { verified: ok, found: true, reason: ok ? null : 'fill_mismatch', evidence: { order_id: expected.order_id, status: 'filled (paper)', sku: offer.sku, price_usd_minor: 0 } };
    },
  };
}
