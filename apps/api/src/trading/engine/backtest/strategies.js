/**
 * Baselines and evaluated candidates for the backtest harness.
 *
 * Baselines (every candidate must beat the best of them out of sample):
 *   - no-trade       always HOLD (net return 0)
 *   - buy-and-hold   BUY on the first decision, never sell (liquidated at window end)
 *   - SMA crossover  the existing SMAcrossoverStrategy at its default 10/30
 * Candidates: SMA crossover (parameters selected in-sample) and Donchian breakout.
 */
import { Signal, StrategyHorizon } from '../strategy/types.js';
import { SMAcrossoverStrategy } from '../strategy/sma-crossover.js';
const sig = (signal, confidence, rationale, version) => ({
    signal, confidence, rationale, strategyVersion: version, generatedAt: '1970-01-01T00:00:00.000Z',
});
export class NoTradeStrategy {
    id = 'baseline-no-trade';
    version = '1.0.0';
    horizon = StrategyHorizon.POSITION;
    evaluate() { return sig(Signal.HOLD, 0, 'no-trade baseline', this.version); }
}
export class BuyAndHoldStrategy {
    id = 'baseline-buy-and-hold';
    version = '1.0.0';
    horizon = StrategyHorizon.POSITION;
    evaluate() { return sig(Signal.BUY, 1, 'buy-and-hold baseline', this.version); }
}
/**
 * Donchian channel breakout (trend following). BUY when the close exceeds the highest
 * high of the previous `entry` bars; SELL when it falls below the lowest low of the
 * previous `exit` bars. Integer comparisons only.
 */
export class DonchianBreakoutStrategy {
    params;
    static VERSION = '1.0.0';
    id;
    version = DonchianBreakoutStrategy.VERSION;
    horizon = StrategyHorizon.SWING;
    constructor(params) {
        this.params = params;
        if (!(params.entry >= 2 && params.exit >= 2))
            throw new RangeError('entry and exit must be >= 2');
        this.id = `donchian-${params.entry}-${params.exit}`;
    }
    evaluate(input) {
        const c = input.recentCandles;
        const need = Math.max(this.params.entry, this.params.exit) + 1;
        if (c.length < need)
            return sig(Signal.HOLD, 0, `insufficient candles (${c.length}/${need})`, this.version);
        const last = c[c.length - 1];
        let hi = 0n;
        for (const x of c.slice(-this.params.entry - 1, -1))
            if (x.highMinor > hi)
                hi = x.highMinor;
        let lo = -1n;
        for (const x of c.slice(-this.params.exit - 1, -1))
            if (lo < 0n || x.lowMinor < lo)
                lo = x.lowMinor;
        if (last.closeMinor > hi)
            return sig(Signal.BUY, 0.6, `close above ${this.params.entry}-bar high`, this.version);
        if (last.closeMinor < lo)
            return sig(Signal.SELL, 0.6, `close below ${this.params.exit}-bar low`, this.version);
        return sig(Signal.HOLD, 0.3, 'inside channel', this.version);
    }
}
export const SMA_FAMILY = {
    id: 'sma-crossover',
    version: '1.0.0',
    grid: [5, 10, 20].flatMap((fastPeriod) => [30, 50, 100].map((slowPeriod) => ({ fastPeriod, slowPeriod }))),
    build: (p) => new SMAcrossoverStrategy({ ...p, horizon: StrategyHorizon.SWING }),
};
export const DONCHIAN_FAMILY = {
    id: 'donchian-breakout',
    version: DonchianBreakoutStrategy.VERSION,
    grid: [20, 55].flatMap((entry) => [10, 20].map((exit) => ({ entry, exit }))),
    build: (p) => new DonchianBreakoutStrategy(p),
};
export const BASELINES = [
    { id: 'no-trade', build: () => new NoTradeStrategy() },
    { id: 'buy-and-hold', build: () => new BuyAndHoldStrategy() },
    { id: 'sma-crossover-10-30', build: () => new SMAcrossoverStrategy({ fastPeriod: 10, slowPeriod: 30, horizon: StrategyHorizon.SWING }) },
];
//# sourceMappingURL=strategies.js.map