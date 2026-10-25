/**
 * Typed market-data provider interfaces.
 * All prices are in integer minor-units of the instrument's currency.
 * Never use float for prices. Use bigint or Decimal strings.
 */
import type { Instrument } from './instrument.js';

export const DataFreshness = Object.freeze({
  LIVE:    'LIVE',    // streaming tick; eventTs matches exchange timestamp
  DELAYED: 'DELAYED', // exchange-imposed delay (e.g. 15 min)
  SNAPSHOT: 'SNAPSHOT', // periodic snapshot; may be seconds old
  STALE:   'STALE',  // freshness window exceeded; do NOT trade on this
} as const);
export type DataFreshness = typeof DataFreshness[keyof typeof DataFreshness];

/** Legal / licensing metadata attached to every data event. */
export interface LicensingMetadata {
  /** Provider identifier: 'binance', 'truedata', 'polygon', etc. */
  readonly source: string;
  /** True if the provider permits using this data for automated strategy decisions. */
  readonly strategyDerivationPermitted: boolean;
  /** True if this data may be displayed to end users (display-usage rights). */
  readonly displayPermitted: boolean;
  /** True if this data may be redistributed to third parties. */
  readonly redistributionPermitted: boolean;
  /** True when this is a commercial (non-individual) licensed feed. */
  readonly commercialLicense: boolean;
  /** Free-text evidence reference (e.g. quote ID, contract date). Null until evidence recorded. */
  readonly licenseEvidence: string | null;
}

/** Base fields present on every market-data event. */
export interface MarketDataEventBase {
  readonly instrument: Instrument;
  /** Timestamp of the event as reported by the exchange (ISO 8601, milliseconds). */
  readonly eventTs: string;
  /** Timestamp when Satelink retrieved this event (ISO 8601, milliseconds). */
  readonly retrievalTs: string;
  /** How fresh this data is considered to be. */
  readonly freshness: DataFreshness;
  /** Maximum age in seconds before this event becomes STALE. */
  readonly freshnessWindowSec: number;
  readonly licensing: LicensingMetadata;
}

/** Level-1 quote: best bid/ask, last trade. All prices in integer minor-units. */
export interface Quote extends MarketDataEventBase {
  readonly kind: 'QUOTE';
  /** Best bid price in minor-units. Null if no bid. */
  readonly bidMinor: bigint | null;
  /** Best ask price in minor-units. Null if no ask. */
  readonly askMinor: bigint | null;
  /** Last trade price in minor-units. Null if no trades yet. */
  readonly lastMinor: bigint | null;
  /** Volume in the instrument's native unit (shares, contracts, base currency). */
  readonly volume: string;  // Decimal string to avoid float
  /** Open interest (derivatives only). Null for spot. */
  readonly openInterest: string | null;
}

export type CandlePeriod = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

/** OHLCV candle. All prices in integer minor-units. */
export interface Candle extends MarketDataEventBase {
  readonly kind: 'CANDLE';
  readonly period: CandlePeriod;
  readonly openMinor: bigint;
  readonly highMinor: bigint;
  readonly lowMinor: bigint;
  readonly closeMinor: bigint;
  readonly volume: string;  // Decimal string
  readonly isClosed: boolean;  // false if candle is still forming
}

/** Order book level. Price in minor-units, quantity as decimal string. */
export interface BookLevel {
  readonly priceMinor: bigint;
  readonly quantity: string;
}

/** Level-2 order book snapshot. */
export interface OrderBookSnapshot extends MarketDataEventBase {
  readonly kind: 'ORDER_BOOK';
  readonly bids: readonly BookLevel[];
  readonly asks: readonly BookLevel[];
  readonly depth: number;
}

export type MarketDataEvent = Quote | Candle | OrderBookSnapshot;

export type Unsubscribe = () => void;

/**
 * Typed market-data provider interface.
 * Implementations: BinanceSpotDataProvider, PaperDataProvider, etc.
 * All must be constructed with explicitly injected credentials and fetch — never read env.
 */
export abstract class MarketDataProvider {
  /** Provider identifier matching LicensingMetadata.source */
  abstract get id(): string;
  abstract get supportedAssetClasses(): readonly string[];
  abstract get licensing(): LicensingMetadata;

  /**
   * Subscribe to real-time quotes for an instrument.
   * The callback is called on every tick; call the returned function to unsubscribe.
   */
  abstract subscribe(
    instrument: Instrument,
    cb: (event: MarketDataEvent) => void,
  ): Unsubscribe;

  /**
   * Fetch a single latest quote (REST snapshot, not streaming).
   */
  abstract snapshot(instrument: Instrument): Promise<Quote>;

  /**
   * Fetch historical candles. Returns at most `count` candles, newest last.
   */
  abstract candles(
    instrument: Instrument,
    period: CandlePeriod,
    count: number,
  ): Promise<Candle[]>;

  /** Returns true if the instrument is supported by this provider. */
  supportsInstrument(instrument: Instrument): boolean {
    return this.supportedAssetClasses.includes(instrument.assetClass);
  }

  /**
   * Validates that a market data event is fresh enough to trade on.
   * Returns STALE freshness if the event is too old.
   */
  checkFreshness(event: MarketDataEventBase, nowMs?: number): DataFreshness {
    const now = nowMs ?? Date.now();
    const retrievedAt = new Date(event.retrievalTs).getTime();
    const ageMs = now - retrievedAt;
    if (ageMs > event.freshnessWindowSec * 1000) return DataFreshness.STALE;
    return event.freshness;
  }
}
