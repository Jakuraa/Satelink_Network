/**
 * Baselines and evaluated candidates for the backtest harness.
 *
 * Baselines (every candidate must beat the best of them out of sample):
 *   - no-trade       always HOLD (net return 0)
 *   - buy-and-hold   BUY on the first decision, never sell (liquidated at window end)
 *   - SMA crossover  the existing SMAcrossoverStrategy at its default 10/30
 * Candidates: SMA crossover (parameters selected in-sample) and Donchian breakout.
 */
import { Signal, StrategyHorizon, type DeterministicStrategy, type SignalResult, type StrategyInput } from '../strategy/types.js';
import { SMAcrossoverStrategy } from '../strategy/sma-crossover.js';
import type { Candle } from '../market/market-data.js';

const sig = (signal: Signal, confidence: number, rationale: string, version: string): SignalResult => ({
  signal, confidence, rationale, strategyVersion: version, generatedAt: '1970-01-01T00:00:00.000Z',
});

export class NoTradeStrategy implements DeterministicStrategy {
  readonly id = 'baseline-no-trade';
  readonly version = '1.0.0';
  readonly horizon = StrategyHorizon.POSITION;
  evaluate(): SignalResult { return sig(Signal.HOLD, 0, 'no-trade baseline', this.version); }
}

export class BuyAndHoldStrategy implements DeterministicStrategy {
  readonly id = 'baseline-buy-and-hold';
  readonly version = '1.0.0';
  readonly horizon = StrategyHorizon.POSITION;
  evaluate(): SignalResult { return sig(Signal.BUY, 1, 'buy-and-hold baseline', this.version); }
}

export interface DonchianParams { readonly entry: number; readonly exit: number }

/**
 * Donchian channel breakout (trend following). BUY when the close exceeds the highest
 * high of the previous `entry` bars; SELL when it falls below the lowest low of the
 * previous `exit` bars. Integer comparisons only.
 */
export class DonchianBreakoutStrategy implements DeterministicStrategy {
  static readonly VERSION = '1.0.0';
  readonly id: string;
  readonly version = DonchianBreakoutStrategy.VERSION;
  readonly horizon = StrategyHorizon.SWING;
  constructor(readonly params: DonchianParams) {
    if (!(params.entry >= 2 && params.exit >= 2)) throw new RangeError('entry and exit must be >= 2');
    this.id = `donchian-${params.entry}-${params.exit}`;
  }
  evaluate(input: StrategyInput): SignalResult {
    const c = input.recentCandles;
    const need = Math.max(this.params.entry, this.params.exit) + 1;
    if (c.length < need) return sig(Signal.HOLD, 0, `insufficient candles (${c.length}/${need})`, this.version);
    const last = c[c.length - 1]!;
    let hi = 0n;
    for (const x of c.slice(-this.params.entry - 1, -1)) if (x.highMinor > hi) hi = x.highMinor;
    let lo = -1n;
    for (const x of c.slice(-this.params.exit - 1, -1)) if (lo < 0n || x.lowMinor < lo) lo = x.lowMinor;
    if (last.closeMinor > hi) return sig(Signal.BUY, 0.6, `close above ${this.params.entry}-bar high`, this.version);
    if (last.closeMinor < lo) return sig(Signal.SELL, 0.6, `close below ${this.params.exit}-bar low`, this.version);
    return sig(Signal.HOLD, 0.3, 'inside channel', this.version);
  }
}

/** A strategy family evaluated by walk-forward: id/version plus a parameter grid. */
export interface CandidateFamily<P = unknown> {
  readonly id: string;
  readonly version: string;
  readonly grid: readonly P[];
  /**
   * Build one strategy instance. `dataset` is the full series the harness holds; a
   * point-in-time strategy must ignore it (the leakage gate fails any that does not).
   */
  build(params: P, dataset: readonly Candle[]): DeterministicStrategy;
}

export const SMA_FAMILY: CandidateFamily<{ fastPeriod: number; slowPeriod: number }> = {
  id: 'sma-crossover',
  version: '1.0.0',
  grid: [5, 10, 20].flatMap((fastPeriod) => [30, 50, 100].map((slowPeriod) => ({ fastPeriod, slowPeriod }))),
  build: (p) => new SMAcrossoverStrategy({ ...p, horizon: StrategyHorizon.SWING }),
};

export const DONCHIAN_FAMILY: CandidateFamily<DonchianParams> = {
  id: 'donchian-breakout',
  version: DonchianBreakoutStrategy.VERSION,
  grid: [20, 55].flatMap((entry) => [10, 20].map((exit) => ({ entry, exit }))),
  build: (p) => new DonchianBreakoutStrategy(p),
};

export const BASELINES: ReadonlyArray<{ readonly id: string; build(): DeterministicStrategy }> = [
  { id: 'no-trade', build: () => new NoTradeStrategy() },
  { id: 'buy-and-hold', build: () => new BuyAndHoldStrategy() },
  { id: 'sma-crossover-10-30', build: () => new SMAcrossoverStrategy({ fastPeriod: 10, slowPeriod: 30, horizon: StrategyHorizon.SWING }) },
];
