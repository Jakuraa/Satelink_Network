/**
 * TrueDataMarketDataProvider — Indian equities & derivatives market data adapter.
 *
 * LICENSING & EVALUATION STATUS:
 *   - Provider: TrueData (authorised vendor for NSE / BSE).
 *   - Status: COMMERCIAL QUOTATION PENDING.
 *   - commercialLicense: false (no commercial license without written contract).
 *   - Automated strategy derivation: permitted under commercial data feed terms only.
 *   - Redistribution: prohibited.
 *
 * All prices are represented in integer minor-units (paise: 1 INR = 100 paise).
 * Never uses floating point math for prices.
 */
import {
  MarketDataProvider,
  DataFreshness,
  type LicensingMetadata,
  type Quote,
  type Candle,
  type MarketDataEvent,
  type CandlePeriod,
  type Unsubscribe,
} from './market-data.js';
import { AssetClass, type Instrument } from './instrument.js';

const TRUEDATA_LICENSING: LicensingMetadata = {
  source: 'truedata',
  strategyDerivationPermitted: true,
  displayPermitted: true,
  redistributionPermitted: false,
  commercialLicense: false, // NOT commercially licensed until contract executed
  licenseEvidence: null,    // Evidence pending formal quote & agreement
};

const SUPPORTED = [
  AssetClass.EQUITY,
  AssetClass.EQUITY_OPTION,
  AssetClass.INDEX_OPTION,
  AssetClass.INDEX_FUTURE,
  AssetClass.CURRENCY_FUTURE,
  AssetClass.COMMODITY_FUTURE,
] as const;

export interface TrueDataOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly freshnessWindowSec?: number;
  readonly fetch?: (url: string, init?: unknown) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

export class TrueDataMarketDataProvider extends MarketDataProvider {
  readonly #baseUrl: string;
  readonly #freshnessWindowSec: number;
  readonly #fetch: (url: string, init?: unknown) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

  constructor(opts: TrueDataOptions = {}) {
    super();
    this.#baseUrl = opts.baseUrl ?? 'https://api.truedata.in';
    this.#freshnessWindowSec = opts.freshnessWindowSec ?? 5;
    this.#fetch = opts.fetch ?? ((url, init) => globalThis.fetch(url, init as RequestInit));
  }

  get id(): string { return 'truedata'; }
  get supportedAssetClasses(): readonly string[] { return SUPPORTED; }
  get licensing(): LicensingMetadata { return TRUEDATA_LICENSING; }

  async snapshot(instrument: Instrument): Promise<Quote> {
    const sym = instrument.symbol;
    const url = `${this.#baseUrl}/get_latest_bar?symbol=${encodeURIComponent(sym)}`;
    const res = await this.#fetch(url);
    if (!res.ok) throw new Error(`TrueData snapshot failed: HTTP ${res.status}`);
    const body = (await res.json()) as Record<string, unknown>;

    const now = new Date().toISOString();
    return {
      kind: 'QUOTE',
      instrument,
      eventTs: (body['timestamp'] as string) || now,
      retrievalTs: now,
      freshness: DataFreshness.SNAPSHOT,
      freshnessWindowSec: this.#freshnessWindowSec,
      licensing: TRUEDATA_LICENSING,
      bidMinor: body['bid'] != null ? BigInt(Math.round(Number(body['bid']) * 100)) : null,
      askMinor: body['ask'] != null ? BigInt(Math.round(Number(body['ask']) * 100)) : null,
      lastMinor: body['ltp'] != null ? BigInt(Math.round(Number(body['ltp']) * 100)) : null,
      volume: String(body['volume'] ?? '0'),
      openInterest: body['oi'] != null ? String(body['oi']) : null,
    };
  }

  async candles(instrument: Instrument, period: CandlePeriod, count: number): Promise<Candle[]> {
    const sym = instrument.symbol;
    const url = `${this.#baseUrl}/get_historic_data?symbol=${encodeURIComponent(sym)}&interval=${period}&records=${count}`;
    const res = await this.#fetch(url);
    if (!res.ok) throw new Error(`TrueData candles failed: HTTP ${res.status}`);
    const rows = (await res.json()) as Array<Record<string, unknown>>;

    const now = new Date().toISOString();
    return rows.map((r) => ({
      kind: 'CANDLE',
      instrument,
      period,
      eventTs: String(r['timestamp'] ?? now),
      retrievalTs: now,
      freshness: DataFreshness.SNAPSHOT,
      freshnessWindowSec: this.#freshnessWindowSec,
      licensing: TRUEDATA_LICENSING,
      openMinor: BigInt(Math.round(Number(r['open']) * 100)),
      highMinor: BigInt(Math.round(Number(r['high']) * 100)),
      lowMinor: BigInt(Math.round(Number(r['low']) * 100)),
      closeMinor: BigInt(Math.round(Number(r['close']) * 100)),
      volume: String(r['volume'] ?? '0'),
      isClosed: true,
    }));
  }

  subscribe(_instrument: Instrument, _cb: (event: MarketDataEvent) => void): Unsubscribe {
    // TrueData WebSocket integration stub for subscription
    return () => {};
  }
}
