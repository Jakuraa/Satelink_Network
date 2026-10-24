/**
 * PaperDataProvider — in-memory provider for paper trading and tests.
 * Never makes network calls. Prices are set programmatically.
 * All amounts in integer minor-units.
 */
import { MarketDataProvider, DataFreshness } from './market-data.js';
const PAPER_LICENSING = {
    source: 'paper',
    strategyDerivationPermitted: true,
    displayPermitted: true,
    redistributionPermitted: false,
    commercialLicense: false,
    licenseEvidence: 'paper-trading-only',
};
export class PaperDataProvider extends MarketDataProvider {
    #prices = new Map(); // instrumentId → lastMinor
    #subscribers = new Map();
    #candleHistory = new Map();
    get id() { return 'paper'; }
    get supportedAssetClasses() { return ['EQUITY', 'EQUITY_OPTION', 'CRYPTO_SPOT', 'CRYPTO_PERP', 'FX_SPOT', 'INDEX_FUTURE', 'CURRENCY_FUTURE']; }
    get licensing() { return PAPER_LICENSING; }
    /** Set custom historical candles for an instrument (for scenario/signal testing). */
    setCandles(instrument, candles) {
        this.#candleHistory.set(instrument.id, [...candles]);
    }
    /** Set the current price for an instrument (test / paper scenario setup). */
    setPrice(instrument, priceMinor) {
        this.#prices.set(instrument.id, priceMinor);
        // notify subscribers
        const subs = this.#subscribers.get(instrument.id);
        if (subs) {
            const now = new Date().toISOString();
            const event = {
                kind: 'QUOTE', instrument,
                eventTs: now, retrievalTs: now,
                freshness: DataFreshness.LIVE,
                freshnessWindowSec: 3600,
                licensing: PAPER_LICENSING,
                bidMinor: priceMinor - 1n,
                askMinor: priceMinor + 1n,
                lastMinor: priceMinor,
                volume: '1',
                openInterest: null,
            };
            for (const cb of subs)
                cb(event);
        }
    }
    async snapshot(instrument) {
        const priceMinor = this.#prices.get(instrument.id) ?? 0n;
        const now = new Date().toISOString();
        return {
            kind: 'QUOTE', instrument,
            eventTs: now, retrievalTs: now,
            freshness: DataFreshness.SNAPSHOT,
            freshnessWindowSec: 3600,
            licensing: PAPER_LICENSING,
            bidMinor: priceMinor - 1n,
            askMinor: priceMinor + 1n,
            lastMinor: priceMinor,
            volume: '1',
            openInterest: null,
        };
    }
    async candles(instrument, period, count) {
        const custom = this.#candleHistory.get(instrument.id);
        if (custom && custom.length > 0) {
            return custom.slice(-count);
        }
        const priceMinor = this.#prices.get(instrument.id) ?? 10000n;
        const now = new Date().toISOString();
        return Array.from({ length: count }, (_, i) => ({
            kind: 'CANDLE', instrument, period,
            eventTs: now, retrievalTs: now,
            freshness: DataFreshness.SNAPSHOT,
            freshnessWindowSec: 3600,
            licensing: PAPER_LICENSING,
            openMinor: priceMinor, highMinor: priceMinor, lowMinor: priceMinor, closeMinor: priceMinor,
            volume: '1',
            isClosed: i < count - 1,
        }));
    }
    subscribe(instrument, cb) {
        if (!this.#subscribers.has(instrument.id))
            this.#subscribers.set(instrument.id, new Set());
        this.#subscribers.get(instrument.id).add(cb);
        return () => this.#subscribers.get(instrument.id)?.delete(cb);
    }
}
//# sourceMappingURL=paper-data-provider.js.map