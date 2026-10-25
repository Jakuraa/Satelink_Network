/**
 * Canonical multi-asset Instrument. Immutable value object.
 * All monetary minimums are in integer minor-units of the instrument currency.
 * Never add float fields.
 */

export const AssetClass = Object.freeze({
  EQUITY:      'EQUITY',       // Cash equity (NSE, BSE, NYSE, etc.)
  EQUITY_OPTION: 'EQUITY_OPTION',
  INDEX_OPTION: 'INDEX_OPTION',
  INDEX_FUTURE: 'INDEX_FUTURE',
  CURRENCY_FUTURE: 'CURRENCY_FUTURE',
  COMMODITY_FUTURE: 'COMMODITY_FUTURE',
  FX_SPOT:     'FX_SPOT',
  CRYPTO_SPOT: 'CRYPTO_SPOT',
  CRYPTO_PERP: 'CRYPTO_PERP',  // perpetual future
} as const);
export type AssetClass = typeof AssetClass[keyof typeof AssetClass];

export const Exchange = Object.freeze({
  NSE:     'NSE',
  BSE:     'BSE',
  NFO:     'NFO',   // NSE F&O
  BFO:     'BFO',   // BSE F&O
  NYSE:    'NYSE',
  NASDAQ:  'NASDAQ',
  CBOE:    'CBOE',
  CME:     'CME',
  BINANCE: 'BINANCE',
  BYBIT:   'BYBIT',
  OKX:     'OKX',
  PAPER:   'PAPER', // paper-trading only
} as const);
export type Exchange = typeof Exchange[keyof typeof Exchange];

/** ISO 4217 currency code (plus USDT). */
export type CurrencyCode = string;

export interface TradingHours {
  /** ISO 8601 time, e.g. '09:15:00' */
  readonly open: string;
  /** ISO 8601 time, e.g. '15:30:00' */
  readonly close: string;
  /** IANA timezone, e.g. 'Asia/Kolkata' */
  readonly timezone: string;
  /** ISO weekday numbers 1–7 (1=Monday) */
  readonly tradingDays: readonly number[];
}

export interface OptionSpec {
  readonly underlying: string;  // symbol of underlying
  readonly strike: bigint;      // minor-units in currency
  readonly expiry: string;      // ISO 8601 date
  readonly optionType: 'CE' | 'PE' | 'CALL' | 'PUT';
  readonly lotSize: number;
}

export interface Instrument {
  /** Stable globally unique ID: '<EXCHANGE>:<SYMBOL>[:<EXPIRY>]' */
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly assetClass: AssetClass;
  readonly exchange: Exchange;
  /** ISO 4217 currency in which prices are quoted */
  readonly currency: CurrencyCode;
  /** Number of decimal places in price (e.g. 2 for INR equities, 8 for BTC/USDT) */
  readonly pricePrecision: number;
  /** Lot size / contract size (1 for cash equities) */
  readonly lotSize: number;
  /** Minimum price movement in minor-units */
  readonly tickSizeMinor: bigint;
  readonly tradingHours: TradingHours | null;
  /** Only for options/futures */
  readonly optionSpec?: OptionSpec;
  /** Broker-specific symbol overrides: { binance: 'BTCUSDT', upstox: 'NSE_EQ|INE002A01018' } */
  readonly brokerSymbols?: Readonly<Record<string, string>>;
}

/** Construct a canonical Instrument id. */
export function instrumentId(exchange: Exchange, symbol: string, expiry?: string): string {
  return expiry ? `${exchange}:${symbol}:${expiry}` : `${exchange}:${symbol}`;
}

/** Well-known instruments for tests and paper trading. */
export const PAPER_INSTRUMENTS = {
  BTC_USDT: {
    id: 'BINANCE:BTCUSDT',
    symbol: 'BTCUSDT',
    name: 'Bitcoin / USDT',
    assetClass: AssetClass.CRYPTO_SPOT,
    exchange: Exchange.BINANCE,
    currency: 'USDT',
    pricePrecision: 2,
    lotSize: 1,
    tickSizeMinor: 100n, // $1.00 in 2-decimal minor-units
    tradingHours: null,  // 24/7
    brokerSymbols: { binance: 'BTCUSDT' },
  } as Instrument,
  NIFTY50: {
    id: 'NSE:NIFTY50',
    symbol: 'NIFTY50',
    name: 'Nifty 50 Index',
    assetClass: AssetClass.EQUITY,
    exchange: Exchange.NSE,
    currency: 'INR',
    pricePrecision: 2,
    lotSize: 1,
    tickSizeMinor: 5n, // ₹0.05 in 2-decimal minor-units
    tradingHours: { open: '09:15:00', close: '15:30:00', timezone: 'Asia/Kolkata', tradingDays: [1,2,3,4,5] },
  } as Instrument,
} as const;
