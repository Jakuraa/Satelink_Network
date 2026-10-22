/**
 * @satelink/trading — SMAcrossoverStrategy tests
 * All arithmetic uses bigint; no float for prices.
 */
import { describe, it, expect } from 'vitest';
import { SMAcrossoverStrategy } from '../strategy/sma-crossover.js';
import { Signal } from '../strategy/types.js';
import { PAPER_INSTRUMENTS } from '../market/instrument.js';
import type { Candle } from '../market/market-data.js';
import { DataFreshness } from '../market/market-data.js';

const BTC = PAPER_INSTRUMENTS.BTC_USDT;

function makeCandle(closeMinor: bigint): Candle {
  const now = new Date().toISOString();
  return {
    kind: 'CANDLE',
    instrument: BTC,
    period: '1h',
    eventTs: now,
    retrievalTs: now,
    freshness: DataFreshness.SNAPSHOT,
    freshnessWindowSec: 60,
    licensing: { source: 'paper', strategyDerivationPermitted: true, displayPermitted: true, redistributionPermitted: false, commercialLicense: false, licenseEvidence: null },
    openMinor: closeMinor,
    highMinor: closeMinor,
    lowMinor: closeMinor,
    closeMinor,
    volume: '1',
    isClosed: true,
  };
}

const strategy = new SMAcrossoverStrategy({ fastPeriod: 3, slowPeriod: 5 });

describe('SMAcrossoverStrategy', () => {
  it('throws if fastPeriod < 1', () => {
    expect(() => new SMAcrossoverStrategy({ fastPeriod: 0, slowPeriod: 5 })).toThrow(RangeError);
  });

  it('throws if slowPeriod <= fastPeriod', () => {
    expect(() => new SMAcrossoverStrategy({ fastPeriod: 5, slowPeriod: 3 })).toThrow(RangeError);
  });

  it('returns HOLD with confidence 0 when insufficient candles', () => {
    const result = strategy.evaluate({ instrument: BTC, latestQuote: null, recentCandles: [makeCandle(100n)] });
    expect(result.signal).toBe(Signal.HOLD);
    expect(result.confidence).toBe(0);
  });

  it('detects BUY crossover', () => {
    // flat at 100, then jumps to 200 on latest candle
    // prev: fast(3)=100, slow(5)=100 -> fast <= slow
    // now: fast(3)=133, slow(5)=120 -> fast > slow
    const prices = [100n, 100n, 100n, 100n, 100n, 100n, 200n];
    const candles = prices.map(makeCandle);
    const result = strategy.evaluate({ instrument: BTC, latestQuote: null, recentCandles: candles });
    expect(result.signal).toBe(Signal.BUY);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('detects SELL crossover', () => {
    // flat at 200, then drops to 100 on latest candle
    // prev: fast(3)=200, slow(5)=200 -> fast >= slow
    // now: fast(3)=166, slow(5)=180 -> fast < slow
    const prices = [200n, 200n, 200n, 200n, 200n, 200n, 100n];
    const candles = prices.map(makeCandle);
    const result = strategy.evaluate({ instrument: BTC, latestQuote: null, recentCandles: candles });
    expect(result.signal).toBe(Signal.SELL);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('returns HOLD when no crossover (flat)', () => {
    const prices = [100n, 100n, 100n, 100n, 100n, 100n, 100n, 100n];
    const candles = prices.map(makeCandle);
    const result = strategy.evaluate({ instrument: BTC, latestQuote: null, recentCandles: candles });
    expect(result.signal).toBe(Signal.HOLD);
    expect(result.confidence).toBe(0.3);
  });

  it('strategyVersion is set', () => {
    const prices = Array(8).fill(100n);
    const result = strategy.evaluate({ instrument: BTC, latestQuote: null, recentCandles: prices.map(makeCandle) });
    expect(result.strategyVersion).toBe('1.0.0');
  });
});
