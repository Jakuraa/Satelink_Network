/**
 * @satelink/trading — PaperDataProvider tests
 */
import { describe, it, expect, vi } from 'vitest';
import { PaperDataProvider } from '../market/paper-data-provider.js';
import { PAPER_INSTRUMENTS } from '../market/instrument.js';
import { DataFreshness } from '../market/market-data.js';

const BTC = PAPER_INSTRUMENTS.BTC_USDT;

describe('PaperDataProvider', () => {
  it('returns id = paper', () => {
    const p = new PaperDataProvider();
    expect(p.id).toBe('paper');
  });

  it('snapshot returns 0 price when not set', async () => {
    const p = new PaperDataProvider();
    const q = await p.snapshot(BTC);
    expect(q.kind).toBe('QUOTE');
    expect(q.lastMinor).toBe(0n);
  });

  it('setPrice updates snapshot', async () => {
    const p = new PaperDataProvider();
    p.setPrice(BTC, 4200053n);
    const q = await p.snapshot(BTC);
    expect(q.lastMinor).toBe(4200053n);
    expect(q.bidMinor).toBe(4200052n);
    expect(q.askMinor).toBe(4200054n);
  });

  it('candles returns correct count', async () => {
    const p = new PaperDataProvider();
    const candles = await p.candles(BTC, '1m', 5);
    expect(candles).toHaveLength(5);
    expect(candles[4]?.isClosed).toBe(false); // last candle is open
    expect(candles[0]?.isClosed).toBe(true);
  });

  it('subscribe fires callback on setPrice', () => {
    const p = new PaperDataProvider();
    const cb = vi.fn();
    p.subscribe(BTC, cb);
    p.setPrice(BTC, 5000000n);
    expect(cb).toHaveBeenCalledOnce();
    const event = cb.mock.calls[0]?.[0];
    expect(event?.kind).toBe('QUOTE');
    expect(event?.freshness).toBe(DataFreshness.LIVE);
  });

  it('unsubscribe stops callbacks', () => {
    const p = new PaperDataProvider();
    const cb = vi.fn();
    const unsub = p.subscribe(BTC, cb);
    unsub();
    p.setPrice(BTC, 5000000n);
    expect(cb).not.toHaveBeenCalled();
  });

  it('checkFreshness returns STALE when event is old', async () => {
    const p = new PaperDataProvider();
    const q = await p.snapshot(BTC);
    // freshnessWindowSec=3600 but simulate 2h later
    const future = Date.now() + 7200_000;
    expect(p.checkFreshness(q, future)).toBe(DataFreshness.STALE);
  });

  it('checkFreshness returns SNAPSHOT when event is fresh', async () => {
    const p = new PaperDataProvider();
    const q = await p.snapshot(BTC);
    expect(p.checkFreshness(q, Date.now() + 100)).toBe(DataFreshness.SNAPSHOT);
  });
});
