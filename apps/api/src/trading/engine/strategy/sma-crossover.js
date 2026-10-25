/**
 * SMA-Crossover — deterministic baseline strategy.
 *
 * Uses a fast SMA and a slow SMA of close prices.
 * BUY when fast crosses above slow; SELL when fast crosses below slow; else HOLD.
 * All arithmetic on integer minor-units (bigint). No float.
 *
 * This is a BASELINE for comparison against LLM proposals, not a live-trading system.
 */
import { Signal, StrategyHorizon } from './types.js';
export const VERSION = '1.0.0';
export class SMAcrossoverStrategy {
    id;
    version = VERSION;
    horizon;
    #fast;
    #slow;
    constructor(params) {
        if (params.fastPeriod < 1)
            throw new RangeError('fastPeriod must be >= 1');
        if (params.slowPeriod <= params.fastPeriod)
            throw new RangeError('slowPeriod must be > fastPeriod');
        this.#fast = params.fastPeriod;
        this.#slow = params.slowPeriod;
        this.id = params.id ?? `sma-crossover-${this.#fast}-${this.#slow}`;
        this.horizon = params.horizon ?? StrategyHorizon.INTRADAY;
    }
    evaluate(input) {
        const closes = input.recentCandles.map((c) => c.closeMinor);
        const now = new Date().toISOString();
        if (closes.length < this.#slow + 1) {
            return { signal: Signal.HOLD, confidence: 0, rationale: `Insufficient candles: need ${this.#slow + 1}, got ${closes.length}`, strategyVersion: VERSION, generatedAt: now };
        }
        const fastNow = sma(closes.slice(-(this.#fast)), this.#fast);
        const fastPrev = sma(closes.slice(-(this.#fast + 1), -1), this.#fast);
        const slowNow = sma(closes.slice(-(this.#slow)), this.#slow);
        const slowPrev = sma(closes.slice(-(this.#slow + 1), -1), this.#slow);
        // Detect crossover in integer space
        const crossedAbove = fastPrev <= slowPrev && fastNow > slowNow;
        const crossedBelow = fastPrev >= slowPrev && fastNow < slowNow;
        if (crossedAbove) {
            const confidence = Math.min(1, Number(fastNow - slowNow) / Number(slowNow + 1n));
            return { signal: Signal.BUY, confidence, rationale: `Fast SMA(${this.#fast}) crossed above Slow SMA(${this.#slow})`, strategyVersion: VERSION, generatedAt: now };
        }
        if (crossedBelow) {
            const confidence = Math.min(1, Number(slowNow - fastNow) / Number(slowNow + 1n));
            return { signal: Signal.SELL, confidence, rationale: `Fast SMA(${this.#fast}) crossed below Slow SMA(${this.#slow})`, strategyVersion: VERSION, generatedAt: now };
        }
        const trend = fastNow > slowNow ? 'uptrend (fast above slow)' : fastNow < slowNow ? 'downtrend (fast below slow)' : 'flat';
        return { signal: Signal.HOLD, confidence: 0.3, rationale: `No crossover; ${trend}`, strategyVersion: VERSION, generatedAt: now };
    }
}
/** Integer SMA of the last `n` values (bigint). Returns 0n if empty. */
function sma(values, n) {
    const slice = values.slice(-n);
    if (slice.length === 0)
        return 0n;
    return slice.reduce((a, b) => a + b, 0n) / BigInt(slice.length);
}
//# sourceMappingURL=sma-crossover.js.map