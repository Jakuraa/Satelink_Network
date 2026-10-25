/**
 * Versioned trading strategy types.
 *
 * A Strategy is a pure function: given market data (signals), it returns
 * a SignalResult (BUY / SELL / HOLD with confidence and rationale).
 * Strategies NEVER submit orders. They produce signals; the risk engine
 * and paper/live execution layers decide what to do with them.
 */
import type { Instrument } from '../market/instrument.js';
import type { Quote, Candle } from '../market/market-data.js';

export const StrategyHorizon = Object.freeze({
  INTRADAY: 'INTRADAY',  // opens and closes within one session
  SWING:    'SWING',     // holds for days to weeks
  POSITION: 'POSITION',  // holds for weeks to months
} as const);
export type StrategyHorizon = typeof StrategyHorizon[keyof typeof StrategyHorizon];

export const Signal = Object.freeze({
  BUY:  'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD',
} as const);
export type Signal = typeof Signal[keyof typeof Signal];

export interface SignalResult {
  readonly signal: Signal;
  /** Confidence 0–1. Must be a finite number. */
  readonly confidence: number;
  /** Human-readable rationale. Required. */
  readonly rationale: string;
  /** Strategy version that produced this signal. */
  readonly strategyVersion: string;
  /** ISO 8601 timestamp. */
  readonly generatedAt: string;
}

export interface StrategyInput {
  readonly instrument: Instrument;
  readonly latestQuote: Quote | null;
  readonly recentCandles: readonly Candle[];
}

/** A deterministic strategy is a pure function: no I/O, no randomness. */
export interface DeterministicStrategy {
  readonly id: string;
  readonly version: string;
  readonly horizon: StrategyHorizon;
  evaluate(input: StrategyInput): SignalResult;
}

/** An AI strategy uses a language model to propose a signal. */
export interface AIStrategy {
  readonly id: string;
  readonly version: string;
  readonly horizon: StrategyHorizon;
  evaluate(input: StrategyInput): Promise<SignalResult>;
}

export type Strategy = DeterministicStrategy | AIStrategy;
