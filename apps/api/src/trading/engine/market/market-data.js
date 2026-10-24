export const DataFreshness = Object.freeze({
    LIVE: 'LIVE', // streaming tick; eventTs matches exchange timestamp
    DELAYED: 'DELAYED', // exchange-imposed delay (e.g. 15 min)
    SNAPSHOT: 'SNAPSHOT', // periodic snapshot; may be seconds old
    STALE: 'STALE', // freshness window exceeded; do NOT trade on this
});
/**
 * Typed market-data provider interface.
 * Implementations: BinanceSpotDataProvider, PaperDataProvider, etc.
 * All must be constructed with explicitly injected credentials and fetch — never read env.
 */
export class MarketDataProvider {
    /** Returns true if the instrument is supported by this provider. */
    supportsInstrument(instrument) {
        return this.supportedAssetClasses.includes(instrument.assetClass);
    }
    /**
     * Validates that a market data event is fresh enough to trade on.
     * Returns STALE freshness if the event is too old.
     */
    checkFreshness(event, nowMs) {
        const now = nowMs ?? Date.now();
        const retrievedAt = new Date(event.retrievalTs).getTime();
        const ageMs = now - retrievedAt;
        if (ageMs > event.freshnessWindowSec * 1000)
            return DataFreshness.STALE;
        return event.freshness;
    }
}
//# sourceMappingURL=market-data.js.map