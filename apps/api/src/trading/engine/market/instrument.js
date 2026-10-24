/**
 * Canonical multi-asset Instrument. Immutable value object.
 * All monetary minimums are in integer minor-units of the instrument currency.
 * Never add float fields.
 */
export const AssetClass = Object.freeze({
    EQUITY: 'EQUITY', // Cash equity (NSE, BSE, NYSE, etc.)
    EQUITY_OPTION: 'EQUITY_OPTION',
    INDEX_OPTION: 'INDEX_OPTION',
    INDEX_FUTURE: 'INDEX_FUTURE',
    CURRENCY_FUTURE: 'CURRENCY_FUTURE',
    COMMODITY_FUTURE: 'COMMODITY_FUTURE',
    FX_SPOT: 'FX_SPOT',
    CRYPTO_SPOT: 'CRYPTO_SPOT',
    CRYPTO_PERP: 'CRYPTO_PERP', // perpetual future
});
export const Exchange = Object.freeze({
    NSE: 'NSE',
    BSE: 'BSE',
    NFO: 'NFO', // NSE F&O
    BFO: 'BFO', // BSE F&O
    NYSE: 'NYSE',
    NASDAQ: 'NASDAQ',
    CBOE: 'CBOE',
    CME: 'CME',
    BINANCE: 'BINANCE',
    BYBIT: 'BYBIT',
    OKX: 'OKX',
    PAPER: 'PAPER', // paper-trading only
});
/** Construct a canonical Instrument id. */
export function instrumentId(exchange, symbol, expiry) {
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
        tradingHours: null, // 24/7
        brokerSymbols: { binance: 'BTCUSDT' },
    },
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
        tradingHours: { open: '09:15:00', close: '15:30:00', timezone: 'Asia/Kolkata', tradingDays: [1, 2, 3, 4, 5] },
    },
};
//# sourceMappingURL=instrument.js.map