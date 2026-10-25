/**
 * @satelink/trading — RiskAuthorizationEngine tests
 * All 10 gates tested: pass path and each individual failure.
 */
import { describe, it, expect } from 'vitest';
import {
  RiskAuthorizationEngine,
  OrderType,
  OrderSide,
  type AuthorizationInput,
  POLICY_VERSION,
} from '../risk/authorization.js';

const engine = new RiskAuthorizationEngine();

const BASE_INPUT: AuthorizationInput = {
  principal: { id: 'user-1', authenticated: true, tradingAuthorized: true },
  account: {
    id: 'acc-1',
    balanceMinor: 1_000_000n, // $10,000.00
    currency: 'USDT',
    eligible: true,
    eligibleMarkets: ['BINANCE'],
  },
  orderIntent: {
    idempotencyKey: 'idem-001',
    instrumentId: 'BINANCE:BTCUSDT',
    exchange: 'BINANCE',
    side: OrderSide.BUY,
    orderType: OrderType.MARKET,
    quantity: 1,
  },
  limits: {
    maxPositionCount: 5,
    maxExposureMinor: 5_000_000n,
    maxDailyLossMinor: 100_000n,
  },
  dataAgeSeconds: 5,
  maxDataAgeSeconds: 10,
  approvedInstruments: new Set(['BINANCE:BTCUSDT']),
  currentPositionCount: 0,
  currentExposureMinor: 0n,
  todaysLossMinor: 0n,
  isDuplicate: false,
  killSwitchEngaged: false,
  orderValueMinor: 500_000n,
};

describe('RiskAuthorizationEngine — happy path', () => {
  it('authorizes a valid order passing all 10 gates', () => {
    const result = engine.authorize(BASE_INPUT);
    expect(result.authorized).toBe(true);
    expect(result.passed).toHaveLength(10);
    expect(result.failedGate).toBeNull();
    expect(result.reason).toBeNull();
    expect(result.policyVersion).toBe(POLICY_VERSION);
  });
});

describe('RiskAuthorizationEngine — gate failures', () => {
  it('G1: fails when not authenticated', () => {
    const r = engine.authorize({ ...BASE_INPUT, principal: { ...BASE_INPUT.principal, authenticated: false } });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G1_PRINCIPAL');
    expect(r.passed).toHaveLength(0);
  });

  it('G2: fails when not trading-authorized', () => {
    const r = engine.authorize({ ...BASE_INPUT, principal: { ...BASE_INPUT.principal, tradingAuthorized: false } });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G2_TRADING_AUTH');
    expect(r.passed).toHaveLength(1); // G1 passed
  });

  it('G3: fails when account not eligible', () => {
    const r = engine.authorize({ ...BASE_INPUT, account: { ...BASE_INPUT.account, eligible: false } });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G3_ACCOUNT_ELIGIBLE');
  });

  it('G3: fails when exchange not in eligibleMarkets', () => {
    const r = engine.authorize({ ...BASE_INPUT, account: { ...BASE_INPUT.account, eligibleMarkets: ['NSE'] } });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G3_ACCOUNT_ELIGIBLE');
  });

  it('G4: fails when data is stale', () => {
    const r = engine.authorize({ ...BASE_INPUT, dataAgeSeconds: 30, maxDataAgeSeconds: 10 });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G4_DATA_FRESH');
  });

  it('G5: fails when instrument not approved', () => {
    const r = engine.authorize({ ...BASE_INPUT, approvedInstruments: new Set(['NSE:NIFTY50']) });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G5_INSTRUMENT_APPROVED');
  });

  it('G5: fails when LIMIT order missing limitPriceMinor', () => {
    const r = engine.authorize({
      ...BASE_INPUT,
      orderIntent: { ...BASE_INPUT.orderIntent, orderType: OrderType.LIMIT, limitPriceMinor: undefined },
    });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G5_INSTRUMENT_APPROVED');
  });

  it('G6: fails when insufficient funds', () => {
    const r = engine.authorize({ ...BASE_INPUT, orderValueMinor: 2_000_000n });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G6_FUNDS');
  });

  it('G7: fails when position count limit reached', () => {
    const r = engine.authorize({ ...BASE_INPUT, currentPositionCount: 5 });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G7_POSITION_LIMIT');
  });

  it('G7: fails when exposure limit would be breached', () => {
    const r = engine.authorize({ ...BASE_INPUT, currentExposureMinor: 4_600_000n, orderValueMinor: 500_000n });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G7_POSITION_LIMIT');
  });

  it('G8: fails when daily loss limit reached', () => {
    const r = engine.authorize({ ...BASE_INPUT, todaysLossMinor: 100_000n });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G8_DAILY_LOSS');
  });

  it('G9: fails on duplicate idempotency key', () => {
    const r = engine.authorize({ ...BASE_INPUT, isDuplicate: true });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G9_DUPLICATE');
  });

  it('G10: fails when kill switch engaged', () => {
    const r = engine.authorize({ ...BASE_INPUT, killSwitchEngaged: true });
    expect(r.authorized).toBe(false);
    expect(r.failedGate).toBe('G10_KILL_SWITCH');
  });
});
