/**
 * @satelink/trading — Multi-market adapter & release gate tests
 */
import { describe, it, expect } from 'vitest';
import { TrueDataMarketDataProvider } from '../market/truedata-provider.js';
import { ZerodhaKiteBrokerAdapter } from '../execution/zerodha-adapter.js';
import { InteractiveBrokersAdapter } from '../execution/ibkr-adapter.js';
import { PAPER_INSTRUMENTS } from '../market/instrument.js';
import type { AuthorizedOrderIntent } from '../execution/broker-adapter.js';

describe('TrueDataMarketDataProvider', () => {
  const NIFTY = PAPER_INSTRUMENTS.NIFTY50;

  it('declares honest licensing status (commercial quote pending, non-commercial until contract)', () => {
    const provider = new TrueDataMarketDataProvider();
    expect(provider.licensing.commercialLicense).toBe(false);
    expect(provider.licensing.licenseEvidence).toBeNull();
    expect(provider.licensing.source).toBe('truedata');
    expect(provider.licensing.strategyDerivationPermitted).toBe(true);
    expect(provider.licensing.redistributionPermitted).toBe(false);
  });

  it('parses snapshot into exact minor units with custom fetch', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        timestamp: '2026-10-23T09:30:00.000Z',
        bid: 24500.5,
        ask: 24501.0,
        ltp: 24500.75,
        volume: '150000',
        oi: '2500000',
      }),
    });

    const provider = new TrueDataMarketDataProvider({ fetch: mockFetch });
    const quote = await provider.snapshot(NIFTY);

    expect(quote.kind).toBe('QUOTE');
    // 24500.75 * 100 = 2450075n minor paise
    expect(quote.lastMinor).toBe(2450075n);
    expect(quote.bidMinor).toBe(2450050n);
    expect(quote.askMinor).toBe(2450100n);
    expect(quote.volume).toBe('150000');
    expect(quote.openInterest).toBe('2500000');
  });
});

describe('ZerodhaKiteBrokerAdapter Release Gate', () => {
  const dummyIntent: AuthorizedOrderIntent = {
    authorizationId: 'auth-1',
    principalId: 'p-1',
    authorizedAt: new Date().toISOString(),
    idempotencyKey: 'z-idem-1',
    instrumentId: 'NSE:RELIANCE',
    exchange: 'NSE',
    side: 'BUY',
    orderType: 'LIMIT',
    quantity: 1,
    limitPriceMinor: 250000n,
  };

  it('strictly blocks live order submission by default', async () => {
    const adapter = new ZerodhaKiteBrokerAdapter({ apiKey: 'dummy-key' });
    await expect(adapter.submit(dummyIntent)).rejects.toThrow(/LIVE TRADING BLOCKED/);
  });

  it('allows submission only when isLiveAllowed is explicitly true', async () => {
    const adapter = new ZerodhaKiteBrokerAdapter({ apiKey: 'dummy-key', isLiveAllowed: true });
    const res = await adapter.submit(dummyIntent);
    expect(res.success).toBe(true);
    expect(res.brokerOrderId).toContain('KITE-');
    expect(res.status).toBe('OPEN');
  });
});

describe('InteractiveBrokersAdapter Release Gate', () => {
  const dummyIntent: AuthorizedOrderIntent = {
    authorizationId: 'auth-2',
    principalId: 'p-2',
    authorizedAt: new Date().toISOString(),
    idempotencyKey: 'ib-idem-1',
    instrumentId: 'NASDAQ:AAPL',
    exchange: 'NASDAQ',
    side: 'BUY',
    orderType: 'MARKET',
    quantity: 10,
  };

  it('strictly blocks live order submission by default', async () => {
    const adapter = new InteractiveBrokersAdapter({ accountId: 'U1234567' });
    await expect(adapter.submit(dummyIntent)).rejects.toThrow(/LIVE TRADING BLOCKED/);
  });

  it('allows submission only when isLiveAllowed is explicitly true', async () => {
    const adapter = new InteractiveBrokersAdapter({ accountId: 'U1234567', isLiveAllowed: true });
    const res = await adapter.submit(dummyIntent);
    expect(res.success).toBe(true);
    expect(res.brokerOrderId).toContain('IBKR-');
    expect(res.status).toBe('OPEN');
  });
});
