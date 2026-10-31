/**
 * Backtest metrics. Money inputs are bigint; return/ratio statistics (Sharpe,
 * Sortino, win rate, Brier) are dimensionless and computed as numbers. No money
 * amount is ever converted to a float — netReturnBps/maxDrawdownBps are integers.
 */
import type { BacktestResult } from './engine.js';
import { Signal } from '../strategy/types.js';
import type { Candle } from '../market/market-data.js';

export interface Metrics {
  /** (final − initial) / initial in basis points, integer (floor toward −∞). */
  readonly netReturnBps: bigint;
  /** Largest peak-to-trough fall of the equity curve, bps, integer ≥ 0. */
  readonly maxDrawdownBps: bigint;
  readonly sharpe: number;
  readonly sortino: number;
  /** Completed round trips. */
  readonly tradeCount: number;
  /** Share of round trips with positive PnL after fees; 0 when no trades. */
  readonly winRate: number;
  /** Share of bars holding a position. */
  readonly exposure: number;
  /** Traded notional / initial capital. */
  readonly turnover: number;
  readonly feesPaidMinor: bigint;
  readonly finalEquityMinor: bigint;
  readonly bars: number;
  /** Calibration of directional confidence vs next-bar outcome (null when no directional signals). */
  readonly calibration: { readonly brier: number; readonly n: number } | null;
}

const floorDiv = (a: bigint, b: bigint) => (a >= 0n ? a / b : -((-a + b - 1n) / b));

export function computeMetrics(r: BacktestResult, candles: readonly Candle[], periodsPerYear: number): Metrics {
  const init = r.initialCashMinor;
  const netReturnBps = floorDiv((r.finalEquityMinor - init) * 10_000n, init);
  let peak = init;
  let maxDd = 0n;
  for (const e of r.equityMinor) {
    if (e > peak) peak = e;
    if (peak > 0n) {
      const dd = ((peak - e) * 10_000n) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  // Per-bar simple returns as ratios of bigints (scaled to 1e-12 before Number()).
  const rets: number[] = [];
  let prev = init;
  for (const e of r.equityMinor) {
    rets.push(prev === 0n ? 0 : Number(((e - prev) * 1_000_000_000_000n) / prev) / 1e12);
    prev = e;
  }
  const mean = rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  const downside = Math.sqrt(rets.reduce((a, b) => a + Math.min(0, b) ** 2, 0) / Math.max(1, rets.length));
  const ann = Math.sqrt(periodsPerYear);
  const sharpe = sd > 0 ? (mean / sd) * ann : 0;
  const sortino = downside > 0 ? (mean / downside) * ann : 0;
  const wins = r.roundTrips.filter((t) => t.pnlMinor > 0n).length;
  const traded = r.fills.reduce((a, f) => a + f.notionalMinor, 0n);

  let brierSum = 0;
  let n = 0;
  for (const s of r.signals) {
    if (s.signal === Signal.HOLD) continue;
    const now = candles[s.barIndex];
    const next = candles[s.barIndex + 1];
    if (!now || !next || s.barIndex + 1 >= r.end) continue;
    const up = next.closeMinor > now.closeMinor ? 1 : 0;
    const c = Math.max(0, Math.min(1, Number.isFinite(s.confidence) ? s.confidence : 0));
    const pUp = s.signal === Signal.BUY ? 0.5 + c / 2 : 0.5 - c / 2;
    brierSum += (pUp - up) ** 2;
    n++;
  }

  return Object.freeze({
    netReturnBps,
    maxDrawdownBps: maxDd,
    sharpe: round6(sharpe),
    sortino: round6(sortino),
    tradeCount: r.roundTrips.length,
    winRate: r.roundTrips.length ? round6(wins / r.roundTrips.length) : 0,
    exposure: r.inPosition.length ? round6(r.inPosition.reduce((a, b) => a + b, 0) / r.inPosition.length) : 0,
    turnover: round6(Number((traded * 1_000_000n) / init) / 1e6),
    feesPaidMinor: r.feesPaidMinor,
    finalEquityMinor: r.finalEquityMinor,
    bars: r.equityMinor.length,
    calibration: n > 0 ? { brier: round6(brierSum / n), n } : null,
  });
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}
