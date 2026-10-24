/**
 * @satelink/trading — FinancialOSMetering tests
 * Ensures exact money arithmetic and separation of capital from revenue.
 */
import { describe, it, expect } from 'vitest';
import {
  FinancialOSMetering,
  type CustomerTradingAccount,
  type SatelinkRevenueAccount,
  type TradeFill,
} from '../financial/metering.js';

describe('FinancialOSMetering', () => {
  it('calculates exact notional value without floats', () => {
    // 5 shares at ₹2,500.50 (250050 minor units) = 1250250 minor units
    const notional = FinancialOSMetering.calculateNotional(5, 250050n);
    expect(notional).toBe(1250250n);
  });

  it('calculates platform fee in exact integer bps', () => {
    const metering = new FinancialOSMetering(10n); // 10 bps = 0.1%
    // 1,000,000 minor units * 10 / 10000 = 1000 minor units
    const fee = metering.calculatePlatformFee(1_000_000n);
    expect(fee).toBe(1000n);
  });

  it('strictly separates customer trading capital from Satelink revenue on BUY fill', () => {
    const metering = new FinancialOSMetering(10n); // 10 bps

    const customer: CustomerTradingAccount = {
      principalId: 'user-1',
      currency: 'USDT',
      tradingCapitalMinor: 100_000_00n, // $100,000
      realizedPnLMinor: 0n,
    };

    const revenue: SatelinkRevenueAccount = {
      currency: 'USDT',
      revenueBalanceMinor: 5_000_00n, // $5,000 existing
    };

    const fill: TradeFill = {
      orderId: 'ORD-1',
      idempotencyKey: 'IDEM-1',
      instrumentId: 'BINANCE:BTCUSDT',
      side: 'BUY',
      fillPriceMinor: 50_000_00n, // $50,000
      filledQuantity: 1,
      currency: 'USDT',
      exchangeFeeMinor: 20_00n, // $20 exchange fee
      timestamp: new Date().toISOString(),
    };

    const res = metering.settleFill(customer, revenue, fill);

    // notional = 50,000,00n ($50,000)
    // satelinkFee = 50,000,00n * 10 / 10,000 = 50,00n ($50)
    // exchangeFee = 20,00n ($20)
    // total deduction from customer = 50,070,00n
    // remaining customer capital = 100,000,00 - 50,070,00 = 49,930,00n
    expect(res.updatedCustomerCapitalMinor).toBe(49_930_00n);
    expect(customer.tradingCapitalMinor).toBe(49_930_00n);

    // Satelink revenue strictly collects only its platform fee
    expect(res.updatedSatelinkRevenueMinor).toBe(5_050_00n);
    expect(revenue.revenueBalanceMinor).toBe(5_050_00n);

    // Receipt verification
    expect(res.receipt.principalId).toBe('user-1');
    expect(res.receipt.notionalMinor).toBe(50_000_00n);
    expect(res.receipt.satelinkFeeMinor).toBe(50_00n);
    expect(res.receipt.exchangeFeeMinor).toBe(20_00n);
  });

  it('adds net proceeds to customer capital on SELL fill', () => {
    const metering = new FinancialOSMetering(10n); // 10 bps

    const customer: CustomerTradingAccount = {
      principalId: 'user-2',
      currency: 'INR',
      tradingCapitalMinor: 10_000_00n, // ₹10,000
      realizedPnLMinor: 0n,
    };

    const revenue: SatelinkRevenueAccount = {
      currency: 'INR',
      revenueBalanceMinor: 0n,
    };

    const fill: TradeFill = {
      orderId: 'ORD-2',
      idempotencyKey: 'IDEM-2',
      instrumentId: 'NSE:RELIANCE',
      side: 'SELL',
      fillPriceMinor: 2_500_00n, // ₹2,500
      filledQuantity: 10, // notional = ₹25,000 (2,500,000 minor)
      currency: 'INR',
      exchangeFeeMinor: 15_00n, // ₹15 exchange fee
      timestamp: new Date().toISOString(),
    };

    const res = metering.settleFill(customer, revenue, fill);

    // notional = 2,500,000n
    // satelinkFee = 2,500,000n * 10 / 10,000 = 2,500n (₹25)
    // exchangeFee = 1,500n (₹15)
    // total fees = 4,000n
    // net proceeds = 2,500,000 - 4,000 = 2,496,000n
    // customer capital = 1,000,000 + 2,496,000 = 3,496,000n
    expect(res.updatedCustomerCapitalMinor).toBe(3_496_000n);
    expect(res.updatedSatelinkRevenueMinor).toBe(25_00n);
  });

  it('rejects currency mismatch between account and trade', () => {
    const metering = new FinancialOSMetering();
    const customer: CustomerTradingAccount = {
      principalId: 'user-3',
      currency: 'USD',
      tradingCapitalMinor: 10_000n,
      realizedPnLMinor: 0n,
    };
    const revenue: SatelinkRevenueAccount = { currency: 'USD', revenueBalanceMinor: 0n };
    const fill: TradeFill = {
      orderId: 'ORD-3',
      idempotencyKey: 'IDEM-3',
      instrumentId: 'NSE:INFY',
      side: 'BUY',
      fillPriceMinor: 1_500_00n,
      filledQuantity: 1,
      currency: 'INR', // mismatch
      exchangeFeeMinor: 0n,
      timestamp: new Date().toISOString(),
    };

    expect(() => metering.settleFill(customer, revenue, fill)).toThrow(/Currency mismatch/);
  });

  it('rejects BUY if customer capital is insufficient', () => {
    const metering = new FinancialOSMetering();
    const customer: CustomerTradingAccount = {
      principalId: 'user-4',
      currency: 'USDT',
      tradingCapitalMinor: 100_00n, // only $100
      realizedPnLMinor: 0n,
    };
    const revenue: SatelinkRevenueAccount = { currency: 'USDT', revenueBalanceMinor: 0n };
    const fill: TradeFill = {
      orderId: 'ORD-4',
      idempotencyKey: 'IDEM-4',
      instrumentId: 'BINANCE:BTCUSDT',
      side: 'BUY',
      fillPriceMinor: 60_000_00n, // $60,000
      filledQuantity: 1,
      currency: 'USDT',
      exchangeFeeMinor: 0n,
      timestamp: new Date().toISOString(),
    };

    expect(() => metering.settleFill(customer, revenue, fill)).toThrow(/Insufficient customer capital/);
  });
});
