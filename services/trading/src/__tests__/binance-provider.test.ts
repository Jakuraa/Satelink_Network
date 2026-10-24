/**
 * @satelink/trading — BinanceSpotDataProvider tests (no network; injected fetch/ws)
 */
import { describe, it, expect, vi } from 'vitest';
import { BinanceSpotDataProvider } from '../market/binance-data-provider.js';
import { PAPER_INSTRUMENTS } from '../market/instrument.js';
import { DataFreshness } from '../market/market-data.js';

const BTC = PAPER_INSTRUMENTS.BTC_USDT;

function makeFetch(json: unknown): (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }> {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => json,
  });
}

describe('BinanceSpotDataProvider.snapshot', () => {
  it('parses bookTicker response to Quote', async () => {
    const provider = new BinanceSpotDataProvider({
      fetch: makeFetch({ bidPrice: '42000.53', askPrice: '42001.00' }),
    });

    const q = await provider.snapshot(BTC);
    expect(q.kind).toBe('QUOTE');
    expect(q.bidMinor).toBe(4200053n);
    expect(q.askMinor).toBe(4200100n);
    expect(q.lastMinor).toBeNull();
    expect(q.freshness).toBe(DataFreshness.SNAPSHOT);
    expect(q.licensing.source).toBe('binance');
  });

  it('throws on HTTP error', async () => {
    const provider = new BinanceSpotDataProvider({
      fetch: async () => ({ ok: false, status: 429, json: async () => ({}) }),
    });
    await expect(provider.snapshot(BTC)).rejects.toThrow('HTTP 429');
  });
});

describe('BinanceSpotDataProvider.candles', () => {
  it('parses klines response to Candle array', async () => {
    const now = Date.now();
    const closeTime = now - 60_000; // 1 min ago → closed
    const row = [now - 120_000, '42000.00', '42100.00', '41900.00', '42050.00', '1.5', closeTime];

    const provider = new BinanceSpotDataProvider({ fetch: makeFetch([row]) });
    const candles = await provider.candles(BTC, '1m', 1);

    expect(candles).toHaveLength(1);
    const c = candles[0]!;
    expect(c.kind).toBe('CANDLE');
    expect(c.openMinor).toBe(4200000n);
    expect(c.highMinor).toBe(4210000n);
    expect(c.lowMinor).toBe(4190000n);
    expect(c.closeMinor).toBe(4205000n);
    expect(c.volume).toBe('1.5');
    expect(c.isClosed).toBe(true);
  });
});

describe('BinanceSpotDataProvider.subscribe', () => {
  it('calls callback on ws message', () => {
    let capturedOnmessage: ((data: string) => void) | null = null;
    const mockWs = {
      onmessage: null as ((data: string) => void) | null,
      onerror: null as ((err: unknown) => void) | null,
      onclose: null as (() => void) | null,
      close: vi.fn(),
    };

    const provider = new BinanceSpotDataProvider({
      wsFactory: (url) => {
        void url;
        return mockWs;
      },
    });

    const cb = vi.fn();
    provider.subscribe(BTC, cb);

    // simulate message assignment after subscribe
    capturedOnmessage = mockWs.onmessage;
    capturedOnmessage?.(JSON.stringify({ b: '42000.00', a: '42001.00' }));

    expect(cb).toHaveBeenCalledOnce();
    const event = cb.mock.calls[0]?.[0];
    expect(event?.kind).toBe('QUOTE');
    expect(event?.bidMinor).toBe(4200000n);
  });

  it('unsubscribe closes ws', () => {
    const mockWs = {
      onmessage: null as ((data: string) => void) | null,
      onerror: null as ((err: unknown) => void) | null,
      onclose: null as (() => void) | null,
      close: vi.fn(),
    };

    const provider = new BinanceSpotDataProvider({ wsFactory: () => mockWs });
    const unsub = provider.subscribe(BTC, vi.fn());
    unsub();
    expect(mockWs.close).toHaveBeenCalledOnce();
  });
});
