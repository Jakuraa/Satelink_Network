/**
 * Look-ahead (leakage) detector.
 *
 * A strategy is built from the full dataset by `factory`, so a feature that reads
 * future bars (directly, or through a precomputed series captured in a closure) can
 * be planted. For each probe bar t the detector perturbs every bar AFTER t, rebuilds
 * the strategy from the perturbed dataset, and evaluates at t with the identical
 * prefix 0..t. A point-in-time strategy cannot change its signal; any change is
 * leakage.
 */
import type { Candle } from '../market/market-data.js';
import type { DeterministicStrategy } from '../strategy/types.js';
import { seededRandom } from './engine.js';

export interface LeakageReport {
  readonly leaks: boolean;
  readonly probes: number;
  readonly violations: ReadonlyArray<{ readonly barIndex: number; readonly original: string; readonly perturbed: string }>;
}

export function detectLookahead(
  factory: (dataset: readonly Candle[]) => DeterministicStrategy,
  candles: readonly Candle[],
  opts: { probes?: number; seed?: number; warmup?: number } = {},
): LeakageReport {
  const probes = opts.probes ?? 25;
  const warmup = opts.warmup ?? Math.min(120, Math.floor(candles.length / 3));
  const rand = seededRandom(opts.seed ?? 7);
  const original = factory(candles);
  const violations: { barIndex: number; original: string; perturbed: string }[] = [];
  const span = candles.length - 1 - warmup;
  if (span <= 0) throw new RangeError('not enough candles for leakage probing');
  for (let k = 0; k < probes; k++) {
    const t = warmup + Math.floor(((k + 0.5) / probes) * span);
    const prefix = candles.slice(0, t + 1);
    // Reverse the future path around bar t's close: any future-dependent feature flips.
    const pivot = candles[t]!.closeMinor;
    const future = candles.slice(t + 1).map((c) => {
      const f = (x: bigint) => { const y = 2n * pivot - x; return y > 0n ? y : 1n; };
      const noise = BigInt(Math.floor(rand() * 3));
      const o = f(c.openMinor) + noise, cl = f(c.closeMinor) + noise;
      const h = (o > cl ? o : cl) + 1n, l = (o < cl ? o : cl) - 1n > 0n ? (o < cl ? o : cl) - 1n : 1n;
      return { ...c, openMinor: o, closeMinor: cl, highMinor: h, lowMinor: l };
    });
    const perturbed = [...prefix, ...future];
    const a = original.evaluate({ instrument: candles[t]!.instrument, latestQuote: null, recentCandles: prefix });
    const b = factory(perturbed).evaluate({ instrument: candles[t]!.instrument, latestQuote: null, recentCandles: prefix });
    if (a.signal !== b.signal || a.confidence !== b.confidence) violations.push({ barIndex: t, original: a.signal, perturbed: b.signal });
  }
  return { leaks: violations.length > 0, probes, violations };
}
