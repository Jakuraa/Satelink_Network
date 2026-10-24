/**
 * @satelink/trading — instrument schema tests
 */
import { describe, it, expect } from 'vitest';
import { AssetClass, Exchange, instrumentId, PAPER_INSTRUMENTS } from '../market/instrument.js';

describe('instrumentId', () => {
  it('builds id without expiry', () => {
    expect(instrumentId(Exchange.NSE, 'NIFTY50')).toBe('NSE:NIFTY50');
  });

  it('builds id with expiry', () => {
    expect(instrumentId(Exchange.NFO, 'NIFTY', '2026-12-26')).toBe('NFO:NIFTY:2026-12-26');
  });
});

describe('PAPER_INSTRUMENTS', () => {
  it('BTC_USDT has correct shape', () => {
    const btc = PAPER_INSTRUMENTS.BTC_USDT;
    expect(btc.id).toBe('BINANCE:BTCUSDT');
    expect(btc.assetClass).toBe(AssetClass.CRYPTO_SPOT);
    expect(btc.exchange).toBe(Exchange.BINANCE);
    expect(btc.pricePrecision).toBe(2);
    expect(btc.tickSizeMinor).toBe(100n);
    expect(btc.tradingHours).toBeNull();
  });

  it('NIFTY50 has correct shape', () => {
    const n = PAPER_INSTRUMENTS.NIFTY50;
    expect(n.id).toBe('NSE:NIFTY50');
    expect(n.assetClass).toBe(AssetClass.EQUITY);
    expect(n.exchange).toBe(Exchange.NSE);
    expect(n.tickSizeMinor).toBe(5n);
    expect(n.tradingHours?.timezone).toBe('Asia/Kolkata');
  });
});

describe('AssetClass and Exchange are frozen', () => {
  it('AssetClass is frozen', () => {
    expect(Object.isFrozen(AssetClass)).toBe(true);
  });
  it('Exchange is frozen', () => {
    expect(Object.isFrozen(Exchange)).toBe(true);
  });
});
