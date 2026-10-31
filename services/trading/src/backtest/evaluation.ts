/**
 * Walk-forward evaluation → immutable StrategyEvaluation record.
 *
 * For each of N out-of-sample windows: choose the candidate's parameters on the
 * preceding in-sample window (best net return after costs), then run the chosen
 * strategy and every baseline on the out-of-sample window.
 *
 * PASS rule (all required):
 *   1. beats the best baseline on net return after costs in ≥ 3 of 4 OOS windows;
 *   2. worst OOS max drawdown no worse than buy-and-hold's worst OOS max drawdown;
 *   3. no blocking flag: ZERO_COST (costs disabled) or LEAKAGE (look-ahead detected).
 * An evaluation expires 30 days after it is created.
 */
import { createHash } from 'node:crypto';
import type { Candle } from '../market/market-data.js';
import { runBacktest, isZeroCost, type CostModel } from './engine.js';
import { computeMetrics, type Metrics } from './metrics.js';
import { detectLookahead } from './leakage.js';
import { BASELINES, type CandidateFamily } from './strategies.js';
import type { SymbolFilters } from './exchange-filters.js';

export const EVALUATION_TTL_DAYS = 30;
export const REQUIRED_WINDOWS_BEATEN = 3;

export type EvaluationFlag = 'ZERO_COST' | 'LEAKAGE' | 'NO_TRADES';
const BLOCKING: ReadonlySet<EvaluationFlag> = new Set(['ZERO_COST', 'LEAKAGE']);

export interface DatasetRef {
  readonly source: string;
  readonly instrumentId: string;
  readonly period: string;
  readonly from: string;
  readonly to: string;
  readonly bars: number;
  readonly sha256: string;
}

export interface WindowResult {
  readonly index: number;
  readonly train: { readonly from: string; readonly to: string; readonly bars: number };
  readonly test: { readonly from: string; readonly to: string; readonly bars: number };
  readonly selectedParams: unknown;
  readonly candidate: Metrics;
  readonly baselines: Readonly<Record<string, Metrics>>;
  readonly bestBaselineId: string;
  readonly beatBestBaseline: boolean;
}

export interface StrategyEvaluation {
  readonly evaluationId: string;
  /** sha256 of the deterministic content (everything except id and timestamps). */
  readonly resultHash: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly instrumentId: string;
  readonly datasets: readonly DatasetRef[];
  readonly params: {
    readonly costs: CostModel;
    readonly initialCashMinor: bigint;
    readonly allocationBps: bigint;
    readonly trainBars: number;
    readonly testBars: number;
    readonly windows: number;
    readonly seed: number;
    readonly periodsPerYear: number;
    readonly grid: readonly unknown[];
  };
  readonly windows: readonly WindowResult[];
  readonly summary: {
    readonly windowsBeaten: number;
    readonly candidateWorstDrawdownBps: bigint;
    readonly buyAndHoldWorstDrawdownBps: bigint;
    readonly candidateTotalReturnBps: bigint;
    readonly bestBaselineTotalReturnBps: bigint;
  };
  readonly flags: readonly EvaluationFlag[];
  readonly verdict: 'PASS' | 'FAIL';
  readonly verdictReasons: readonly string[];
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface EvaluateConfig<P> {
  readonly family: CandidateFamily<P>;
  readonly candles: readonly Candle[];
  readonly dataset: Omit<DatasetRef, 'sha256' | 'bars' | 'from' | 'to'>;
  readonly costs: CostModel;
  readonly filters: SymbolFilters;
  readonly initialCashMinor: bigint;
  readonly allocationBps?: bigint;
  readonly trainBars: number;
  readonly testBars: number;
  readonly windows?: number;
  readonly seed: number;
  readonly periodsPerYear: number;
  readonly now?: () => Date;
}

/** sha256 over the canonical OHLCV text of a dataset (timestamps + exact minor units). */
export function datasetHash(candles: readonly Candle[]): string {
  const h = createHash('sha256');
  for (const c of candles) h.update(`${c.eventTs},${c.openMinor},${c.highMinor},${c.lowMinor},${c.closeMinor},${c.volume}\n`);
  return h.digest('hex');
}

export function evaluateStrategy<P>(cfg: EvaluateConfig<P>): StrategyEvaluation {
  const { candles, family, costs, filters } = cfg;
  const nWin = cfg.windows ?? 4;
  const allocationBps = cfg.allocationBps ?? 10_000n;
  const firstTest = candles.length - nWin * cfg.testBars;
  if (firstTest - cfg.trainBars < 0) throw new RangeError(`need ≥ ${cfg.trainBars + nWin * cfg.testBars} candles, have ${candles.length}`);
  const run = (strategy: Parameters<typeof runBacktest>[0]['strategy'], start: number, end: number, seed: number) =>
    computeMetrics(runBacktest({ candles, strategy, start, end, initialCashMinor: cfg.initialCashMinor, allocationBps, costs, filters, seed }), candles, cfg.periodsPerYear);
  const span = (a: number, b: number) => ({ from: candles[a]!.eventTs, to: candles[b - 1]!.eventTs, bars: b - a });

  const windows: WindowResult[] = [];
  let leaks = false;
  for (let w = 0; w < nWin; w++) {
    const testStart = firstTest + w * cfg.testBars;
    const testEnd = testStart + cfg.testBars;
    const trainStart = testStart - cfg.trainBars;
    // In-sample selection. Ties keep the earlier grid entry (deterministic).
    let best: { p: P; ret: bigint } | null = null;
    family.grid.forEach((p, gi) => {
      const m = run(family.build(p, candles), trainStart, testStart, cfg.seed + w * 1000 + gi);
      if (!best || m.netReturnBps > best.ret) best = { p, ret: m.netReturnBps };
    });
    const chosen = (best as { p: P; ret: bigint } | null)!.p;
    const leak = detectLookahead((ds) => family.build(chosen, ds), candles.slice(0, testEnd), { seed: cfg.seed + w });
    leaks ||= leak.leaks;
    const candidate = run(family.build(chosen, candles), testStart, testEnd, cfg.seed + w * 1000 + 500);
    const baselines: Record<string, Metrics> = {};
    BASELINES.forEach((b, bi) => { baselines[b.id] = run(b.build(), testStart, testEnd, cfg.seed + w * 1000 + 900 + bi); });
    const bestId = Object.entries(baselines).reduce((a, b) => (b[1].netReturnBps > a[1].netReturnBps ? b : a))[0];
    windows.push({
      index: w,
      train: span(trainStart, testStart),
      test: span(testStart, testEnd),
      selectedParams: chosen,
      candidate,
      baselines,
      bestBaselineId: bestId,
      beatBestBaseline: candidate.netReturnBps > baselines[bestId]!.netReturnBps,
    });
  }

  const flags: EvaluationFlag[] = [];
  if (isZeroCost(costs)) flags.push('ZERO_COST');
  if (leaks) flags.push('LEAKAGE');
  if (windows.every((x) => x.candidate.tradeCount === 0)) flags.push('NO_TRADES');

  const beaten = windows.filter((x) => x.beatBestBaseline).length;
  const maxBig = (xs: bigint[]) => xs.reduce((a, b) => (b > a ? b : a), 0n);
  const candDd = maxBig(windows.map((x) => x.candidate.maxDrawdownBps));
  const bhDd = maxBig(windows.map((x) => x.baselines['buy-and-hold']!.maxDrawdownBps));
  const compound = (rets: bigint[]) => rets.reduce((acc, r) => (acc * (10_000n + r)) / 10_000n, 10_000n) - 10_000n;
  const candTotal = compound(windows.map((x) => x.candidate.netReturnBps));
  const bestBaseTotal = compound(windows.map((x) => x.baselines[x.bestBaselineId]!.netReturnBps));

  const reasons: string[] = [];
  if (beaten < REQUIRED_WINDOWS_BEATEN) reasons.push(`beat the best baseline in ${beaten}/${nWin} OOS windows (need ≥ ${REQUIRED_WINDOWS_BEATEN})`);
  if (candDd > bhDd) reasons.push(`worst OOS drawdown ${candDd} bps exceeds buy-and-hold ${bhDd} bps`);
  for (const f of flags) if (BLOCKING.has(f)) reasons.push(`blocking flag ${f}`);
  const verdict: 'PASS' | 'FAIL' = reasons.length === 0 ? 'PASS' : 'FAIL';
  if (verdict === 'PASS') reasons.push(`beat best baseline in ${beaten}/${nWin} OOS windows; drawdown ${candDd} ≤ buy-and-hold ${bhDd} bps`);

  const datasets: DatasetRef[] = [{ ...cfg.dataset, from: candles[0]!.eventTs, to: candles[candles.length - 1]!.eventTs, bars: candles.length, sha256: datasetHash(candles) }];
  const body = {
    strategyId: family.id,
    strategyVersion: family.version,
    instrumentId: candles[0]!.instrument.id,
    datasets,
    params: { costs, initialCashMinor: cfg.initialCashMinor, allocationBps, trainBars: cfg.trainBars, testBars: cfg.testBars, windows: nWin, seed: cfg.seed, periodsPerYear: cfg.periodsPerYear, grid: family.grid },
    windows,
    summary: { windowsBeaten: beaten, candidateWorstDrawdownBps: candDd, buyAndHoldWorstDrawdownBps: bhDd, candidateTotalReturnBps: candTotal, bestBaselineTotalReturnBps: bestBaseTotal },
    flags,
    verdict,
    verdictReasons: reasons,
  };
  const resultHash = sha256(canonicalJson(body));
  const created = (cfg.now ?? (() => new Date()))();
  const createdAt = created.toISOString();
  return deepFreeze({
    evaluationId: `eval_${sha256(`${resultHash}:${createdAt}`).slice(0, 32)}`,
    resultHash,
    ...body,
    createdAt,
    expiresAt: new Date(created.getTime() + EVALUATION_TTL_DAYS * 86_400_000).toISOString(),
  });
}

/** True when the evaluation is a PASS for this strategy version and not expired at `now`. */
export function isUsablePass(e: StrategyEvaluation | null, strategyId: string, strategyVersion: string, now: Date): { ok: boolean; reason: string } {
  if (!e) return { ok: false, reason: 'no evaluation on record' };
  if (e.strategyId !== strategyId || e.strategyVersion !== strategyVersion) return { ok: false, reason: `evaluation is for ${e.strategyId}@${e.strategyVersion}` };
  if (e.verdict !== 'PASS') return { ok: false, reason: `evaluation ${e.evaluationId} verdict FAIL` };
  if (now.getTime() > Date.parse(e.expiresAt)) return { ok: false, reason: `evaluation ${e.evaluationId} expired ${e.expiresAt}` };
  return { ok: true, reason: `evaluation ${e.evaluationId} PASS, expires ${e.expiresAt}` };
}

/** Deterministic JSON: sorted keys, bigint as decimal string. */
export function canonicalJson(v: unknown): string {
  if (typeof v === 'bigint') return JSON.stringify(v.toString());
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
