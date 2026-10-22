/**
 * PaperDataProvider — in-memory provider for paper trading and tests.
 * Never makes network calls. Prices are set programmatically.
 * All amounts in integer minor-units.
 */
import { MarketDataProvider, DataFreshness, type LicensingMetadata, type Quote, type Candle, type MarketDataEvent, type CandlePeriod, type Unsubscribe } from './market-data.js';
import type { Instrument } from './instrument.js';

const PAPER_LICENSING: LicensingMetadata = {
  source: 'paper',
  strategyDerivationPermitted: true,
  displayPermitted: true,
  redistributionPermitted: false,
  commercialLicense: false,
  licenseEvidence: 'paper-trading-only',
};

export class PaperDataProvider extends MarketDataProvider {
  readonly #prices = new Map<string, bigint>(); // instrumentId → lastMinor
  readonly #subscribers = new Map<string, Set<(e: MarketDataEvent) => void>>();

  get id(): string { return 'paper'; }
  get supportedAssetClasses(): readonly string[] { return ['EQUITY','EQUITY_OPTION','CRYPTO_SPOT','CRYPTO_PERP','FX_SPOT','INDEX_FUTURE','CURRENCY_FUTURE']; }
  get licensing(): LicensingMetadata { return PAPER_LICENSING; }

  /** Set the current price for an instrument (test / paper scenario setup). */
  setPrice(instrument: Instrument, priceMinor: bigint): void {
    this.#prices.set(instrument.id, priceMinor);
    // notify subscribers
    const subs = this.#subscribers.get(instrument.id);
    if (subs) {
      const now = new Date().toISOString();
      const event: Quote = {
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
      for (const cb of subs) cb(event);
    }
  }

  async snapshot(instrument: Instrument): Promise<Quote> {
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

  async candles(instrument: Instrument, period: CandlePeriod, count: number): Promise<Candle[]> {
    const priceMinor = this.#prices.get(instrument.id) ?? 100_00n;
    const now = new Date().toISOString();
    return Array.from({ length: count }, (_, i): Candle => ({
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

  subscribe(instrument: Instrument, cb: (event: MarketDataEvent) => void): Unsubscribe {
    if (!this.#subscribers.has(instrument.id)) this.#subscribers.set(instrument.id, new Set());
    this.#subscribers.get(instrument.id)!.add(cb);
    return () => this.#subscribers.get(instrument.id)?.delete(cb);
  }
}
