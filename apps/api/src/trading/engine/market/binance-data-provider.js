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
import { MarketDataProvider, DataFreshness } from './market-data.js';
import { AssetClass } from './instrument.js';
const BINANCE_REST = 'https://api.binance.com';
const BINANCE_WS = 'wss://stream.binance.com:9443/ws';
const BINANCE_LICENSING = {
    source: 'binance',
    strategyDerivationPermitted: true,
    displayPermitted: true,
    redistributionPermitted: false,
    commercialLicense: false,
    licenseEvidence: null, // evidence pending written commercial agreement
};
const SUPPORTED = [AssetClass.CRYPTO_SPOT, AssetClass.CRYPTO_PERP];
export class BinanceSpotDataProvider extends MarketDataProvider {
    #fetch;
    #wsFactory;
    #freshnessWindowSec;
    #subs = new Map();
    constructor(opts = {}) {
        super();
        this.#fetch = opts.fetch ?? ((url) => globalThis.fetch(url));
        this.#wsFactory = opts.wsFactory ?? defaultWsFactory;
        this.#freshnessWindowSec = opts.freshnessWindowSec ?? 10;
    }
    get id() { return 'binance'; }
    get supportedAssetClasses() { return SUPPORTED; }
    get licensing() { return BINANCE_LICENSING; }
    async snapshot(instrument) {
        const sym = binanceSymbol(instrument);
        const url = `${BINANCE_REST}/api/v3/ticker/bookTicker?symbol=${sym}`;
        const res = await this.#fetch(url);
        if (!res.ok)
            throw new Error(`Binance bookTicker failed: HTTP ${res.status}`);
        const body = await res.json();
        const now = new Date().toISOString();
        return {
            kind: 'QUOTE',
            instrument,
            eventTs: now,
            retrievalTs: now,
            freshness: DataFreshness.SNAPSHOT,
            freshnessWindowSec: this.#freshnessWindowSec,
            licensing: BINANCE_LICENSING,
            bidMinor: parseDecimalToMinor(body['bidPrice'], instrument.pricePrecision),
            askMinor: parseDecimalToMinor(body['askPrice'], instrument.pricePrecision),
            lastMinor: null, // bookTicker does not include last trade
            volume: '0',
            openInterest: null,
        };
    }
    async candles(instrument, period, count) {
        const sym = binanceSymbol(instrument);
        const interval = toKlineInterval(period);
        const url = `${BINANCE_REST}/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${Math.min(count, 1000)}`;
        const res = await this.#fetch(url);
        if (!res.ok)
            throw new Error(`Binance klines failed: HTTP ${res.status}`);
        const rows = await res.json();
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
                openMinor: parseDecimalToMinor(r[1], instrument.pricePrecision),
                highMinor: parseDecimalToMinor(r[2], instrument.pricePrecision),
                lowMinor: parseDecimalToMinor(r[3], instrument.pricePrecision),
                closeMinor: parseDecimalToMinor(r[4], instrument.pricePrecision),
                volume: String(r[5]),
                isClosed,
            };
        });
    }
    subscribe(instrument, cb) {
        const sym = binanceSymbol(instrument).toLowerCase();
        const url = `${BINANCE_WS}/${sym}@bookTicker`;
        const ws = this.#wsFactory(url);
        this.#subs.set(instrument.id, ws);
        ws.onmessage = (data) => {
            try {
                const msg = JSON.parse(data);
                const now = new Date().toISOString();
                const event = {
                    kind: 'QUOTE',
                    instrument,
                    eventTs: now,
                    retrievalTs: now,
                    freshness: DataFreshness.LIVE,
                    freshnessWindowSec: this.#freshnessWindowSec,
                    licensing: BINANCE_LICENSING,
                    bidMinor: parseDecimalToMinor(msg['b'], instrument.pricePrecision),
                    askMinor: parseDecimalToMinor(msg['a'], instrument.pricePrecision),
                    lastMinor: null,
                    volume: '0',
                    openInterest: null,
                };
                cb(event);
            }
            catch {
                // parse errors are swallowed; provider stays open
            }
        };
        ws.onerror = () => { };
        ws.onclose = () => { this.#subs.delete(instrument.id); };
        return () => {
            ws.close();
            this.#subs.delete(instrument.id);
        };
    }
    /** Fetch a depth-5 order book snapshot. */
    async orderBook(instrument) {
        const sym = binanceSymbol(instrument);
        const url = `${BINANCE_REST}/api/v3/depth?symbol=${sym}&limit=5`;
        const res = await this.#fetch(url);
        if (!res.ok)
            throw new Error(`Binance depth failed: HTTP ${res.status}`);
        const body = await res.json();
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
            })),
            asks: body.asks.map(([p, q]) => ({
                priceMinor: parseDecimalToMinor(p, instrument.pricePrecision),
                quantity: q,
            })),
            depth: 5,
        };
    }
}
// ── helpers ──────────────────────────────────────────────────────────────────
function binanceSymbol(instrument) {
    return instrument.brokerSymbols?.['binance'] ?? instrument.symbol;
}
function toKlineInterval(period) {
    const map = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w' };
    return map[period] ?? '1m';
}
/**
 * Parse a decimal price string (e.g. '42000.53') to integer minor-units.
 * precision=2 → multiply by 100 using only integer math.
 * Never uses parseFloat.
 */
export function parseDecimalToMinor(raw, precision) {
    if (typeof raw !== 'string' || raw === '')
        throw new Error(`Invalid price: '${raw}'`);
    const [intPart = '0', fracPart = ''] = raw.split('.');
    const frac = (fracPart + '0'.repeat(precision)).slice(0, precision);
    return BigInt(intPart) * 10n ** BigInt(precision) + BigInt(frac);
}
function defaultWsFactory(url) {
    // In a Node/browser environment with native WebSocket:
    const ws = new WebSocket(url);
    // Wrap for our interface
    const adapter = {
        onmessage: null,
        onerror: null,
        onclose: null,
        close: () => ws.close(),
    };
    ws.addEventListener('message', (ev) => {
        adapter.onmessage?.(typeof ev.data === 'string' ? ev.data : '');
    });
    ws.addEventListener('error', (err) => adapter.onerror?.(err));
    ws.addEventListener('close', () => adapter.onclose?.());
    return adapter;
}
//# sourceMappingURL=binance-data-provider.js.map