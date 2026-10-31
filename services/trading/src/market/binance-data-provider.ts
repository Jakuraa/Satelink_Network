/**
 * BinanceSpotDataProvider — public market-data via Binance REST + WebSocket.
 *
 * Uses ONLY public endpoints: no API key required for market data.
 *
 * Licensing:
 *   - Public Binance data: display-permitted (on Binance's terms), strategy-derivation-permitted.
 *   - Redistribution to third parties: NOT permitted.
 *   - Commercial license: not required for consuming public data internally.
 *   - No commercialLicense until a written Binance commercial data agreement is obtained.
 *
 * All prices returned as integer minor-units (USDT with 2 decimal places → divide by 100 for display).
 * Never uses float math for prices.
 */
import { MarketDataProvider, DataFreshness, type LicensingMetadata, type Quote, type Candle, type OrderBookSnapshot, type MarketDataEvent, type CandlePeriod, type Unsubscribe, type BookLevel } from './market-data.js';
import { AssetClass, type Instrument } from './instrument.js';

const BINANCE_REST = 'https://api.binance.com';
const BINANCE_WS   = 'wss://stream.binance.com:9443/ws';

const BINANCE_LICENSING: LicensingMetadata = {
  source: 'binance',
  strategyDerivationPermitted: true,
  displayPermitted: true,
  redistributionPermitted: false,
  commercialLicense: false,
  licenseEvidence: null, // evidence pending written commercial agreement
};

const SUPPORTED = [AssetClass.CRYPTO_SPOT, AssetClass.CRYPTO_PERP] as const;

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
export type WsFactory = (url: string) => BinanceWs;

export interface BinanceWs {
  onmessage: ((data: string) => void) | null;
  onerror: ((err: unknown) => void) | null;
  onclose: (() => void) | null;
  close(): void;
}

export interface BinanceDataProviderOptions {
  readonly fetch?: FetchLike;
  readonly wsFactory?: WsFactory;
  readonly freshnessWindowSec?: number;
}

export class BinanceSpotDataProvider extends MarketDataProvider {
  readonly #fetch: FetchLike;
  readonly #wsFactory: WsFactory;
  readonly #freshnessWindowSec: number;
  readonly #subs = new Map<string, BinanceWs>();

  constructor(opts: BinanceDataProviderOptions = {}) {
    super();
    this.#fetch = opts.fetch ?? ((url) => globalThis.fetch(url));
    this.#wsFactory = opts.wsFactory ?? defaultWsFactory;
    this.#freshnessWindowSec = opts.freshnessWindowSec ?? 10;
  }

  get id(): string { return 'binance'; }
  get supportedAssetClasses(): readonly string[] { return SUPPORTED; }
  get licensing(): LicensingMetadata { return BINANCE_LICENSING; }

  async snapshot(instrument: Instrument): Promise<Quote> {
    const sym = binanceSymbol(instrument);
    const url = `${BINANCE_REST}/api/v3/ticker/bookTicker?symbol=${sym}`;
    const res = await this.#fetch(url);
    if (!res.ok) throw new Error(`Binance bookTicker failed: HTTP ${res.status}`);
    const body = await res.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    return {
      kind: 'QUOTE',
      instrument,
      eventTs: now,
      retrievalTs: now,
      freshness: DataFreshness.SNAPSHOT,
      freshnessWindowSec: this.#freshnessWindowSec,
      licensing: BINANCE_LICENSING,
      bidMinor: parseDecimalToMinor(body['bidPrice'] as string, instrument.pricePrecision),
      askMinor: parseDecimalToMinor(body['askPrice'] as string, instrument.pricePrecision),
      lastMinor: null, // bookTicker does not include last trade
      volume: '0',
      openInterest: null,
    };
  }

  async candles(instrument: Instrument, period: CandlePeriod, count: number): Promise<Candle[]> {
    const sym = binanceSymbol(instrument);
    const interval = toKlineInterval(period);
    const url = `${BINANCE_REST}/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${Math.min(count, 1000)}`;
    const res = await this.#fetch(url);
    if (!res.ok) throw new Error(`Binance klines failed: HTTP ${res.status}`);
    const rows = await res.json() as unknown[][];
    const now = new Date().toISOString();
    return rows.map((r) => {
      const openTime = Number(r[0]);
      const closeTime = Number(r[6]);
      const isClosed = Date.now() > closeTime;
      return {
        kind: 'CANDLE',
        instrument,
        period,
        eventTs: new Date(openTime).toISOString(),
        retrievalTs: now,
        freshness: DataFreshness.SNAPSHOT,
        freshnessWindowSec: this.#freshnessWindowSec,
        licensing: BINANCE_LICENSING,
        openMinor: parseDecimalToMinor(r[1] as string, instrument.pricePrecision),
        highMinor: parseDecimalToMinor(r[2] as string, instrument.pricePrecision),
        lowMinor: parseDecimalToMinor(r[3] as string, instrument.pricePrecision),
        closeMinor: parseDecimalToMinor(r[4] as string, instrument.pricePrecision),
        volume: String(r[5]),
        isClosed,
      } satisfies Candle;
    });
  }

  /**
   * Closed historical klines in [startMs, endMs), oldest first, paginated 1000 at a time.
   * Point-in-time: eventTs is the bar open; only bars whose close time is before `nowMs`
   * are returned, so a still-forming bar never enters a backtest dataset.
   */
  async historicalCandles(instrument: Instrument, period: CandlePeriod, startMs: number, endMs: number, nowMs: number = Date.now()): Promise<Candle[]> {
    const sym = binanceSymbol(instrument);
    const interval = toKlineInterval(period);
    const out: Candle[] = [];
    let cursor = startMs;
    for (let page = 0; page < 1000 && cursor < endMs; page++) {
      const url = `${BINANCE_REST}/api/v3/klines?symbol=${sym}&interval=${interval}&startTime=${cursor}&endTime=${endMs - 1}&limit=1000`;
      const res = await this.#fetch(url);
      if (!res.ok) throw new Error(`Binance klines failed: HTTP ${res.status}`);
      const rows = await res.json() as unknown[][];
      if (!Array.isArray(rows) || rows.length === 0) break;
      const retrievedAt = new Date().toISOString();
      for (const r of rows) {
        const openTime = Number(r[0]);
        const closeTime = Number(r[6]);
        if (!(closeTime < nowMs) || openTime < cursor) continue;
        out.push({
          kind: 'CANDLE', instrument, period,
          eventTs: new Date(openTime).toISOString(),
          retrievalTs: retrievedAt,
          freshness: DataFreshness.SNAPSHOT,
          freshnessWindowSec: this.#freshnessWindowSec,
          licensing: BINANCE_LICENSING,
          openMinor: parseDecimalToMinor(r[1] as string, instrument.pricePrecision),
          highMinor: parseDecimalToMinor(r[2] as string, instrument.pricePrecision),
          lowMinor: parseDecimalToMinor(r[3] as string, instrument.pricePrecision),
          closeMinor: parseDecimalToMinor(r[4] as string, instrument.pricePrecision),
          volume: String(r[5]),
          isClosed: true,
        } satisfies Candle);
      }
      const lastOpen = Number(rows[rows.length - 1]![0]);
      if (!(lastOpen + 1 > cursor) || rows.length < 1000) break; // short page = last page
      cursor = lastOpen + 1;
    }
    return out;
  }

  subscribe(instrument: Instrument, cb: (event: MarketDataEvent) => void): Unsubscribe {
    const sym = binanceSymbol(instrument).toLowerCase();
    const url = `${BINANCE_WS}/${sym}@bookTicker`;
    const ws = this.#wsFactory(url);
    this.#subs.set(instrument.id, ws);

    ws.onmessage = (data: string) => {
      try {
        const msg = JSON.parse(data) as Record<string, unknown>;
        const now = new Date().toISOString();
        const event: Quote = {
          kind: 'QUOTE',
          instrument,
          eventTs: now,
          retrievalTs: now,
          freshness: DataFreshness.LIVE,
          freshnessWindowSec: this.#freshnessWindowSec,
          licensing: BINANCE_LICENSING,
          bidMinor: parseDecimalToMinor(msg['b'] as string, instrument.pricePrecision),
          askMinor: parseDecimalToMinor(msg['a'] as string, instrument.pricePrecision),
          lastMinor: null,
          volume: '0',
          openInterest: null,
        };
        cb(event);
      } catch {
        // parse errors are swallowed; provider stays open
      }
    };

    ws.onerror = () => { /* re-connect logic omitted for MVP */ };
    ws.onclose = () => { this.#subs.delete(instrument.id); };

    return () => {
      ws.close();
      this.#subs.delete(instrument.id);
    };
  }

  /** Fetch a depth-5 order book snapshot. */
  async orderBook(instrument: Instrument): Promise<OrderBookSnapshot> {
    const sym = binanceSymbol(instrument);
    const url = `${BINANCE_REST}/api/v3/depth?symbol=${sym}&limit=5`;
    const res = await this.#fetch(url);
    if (!res.ok) throw new Error(`Binance depth failed: HTTP ${res.status}`);
    const body = await res.json() as { bids: [string, string][]; asks: [string, string][] };
    const now = new Date().toISOString();
    return {
      kind: 'ORDER_BOOK',
      instrument,
      eventTs: now,
      retrievalTs: now,
      freshness: DataFreshness.SNAPSHOT,
      freshnessWindowSec: this.#freshnessWindowSec,
      licensing: BINANCE_LICENSING,
      bids: body.bids.map(([p, q]) => ({
        priceMinor: parseDecimalToMinor(p, instrument.pricePrecision),
        quantity: q,
      } satisfies BookLevel)),
      asks: body.asks.map(([p, q]) => ({
        priceMinor: parseDecimalToMinor(p, instrument.pricePrecision),
        quantity: q,
      } satisfies BookLevel)),
      depth: 5,
    };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function binanceSymbol(instrument: Instrument): string {
  return instrument.brokerSymbols?.['binance'] ?? instrument.symbol;
}

function toKlineInterval(period: CandlePeriod): string {
  const map: Record<CandlePeriod, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w' };
  return map[period] ?? '1m';
}

/**
 * Parse a decimal price string (e.g. '42000.53') to integer minor-units.
 * precision=2 → multiply by 100 using only integer math.
 * Never uses parseFloat.
 */
export function parseDecimalToMinor(raw: string, precision: number): bigint {
  if (typeof raw !== 'string' || raw === '') throw new Error(`Invalid price: '${raw}'`);
  const [intPart = '0', fracPart = ''] = raw.split('.');
  const frac = (fracPart + '0'.repeat(precision)).slice(0, precision);
  return BigInt(intPart) * 10n ** BigInt(precision) + BigInt(frac);
}

function defaultWsFactory(url: string): BinanceWs {
  // In a Node/browser environment with native WebSocket:
  const ws = new WebSocket(url) as unknown as WebSocket;
  // Wrap for our interface
  const adapter: BinanceWs = {
    onmessage: null,
    onerror: null,
    onclose: null,
    close: () => ws.close(),
  };
  ws.addEventListener('message', (ev: MessageEvent) => {
    adapter.onmessage?.(typeof ev.data === 'string' ? ev.data : '');
  });
  ws.addEventListener('error', (err: unknown) => adapter.onerror?.(err));
  ws.addEventListener('close', () => adapter.onclose?.());
  return adapter;
}
