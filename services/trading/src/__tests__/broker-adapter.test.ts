/**
 * @satelink/trading — BrokerAdapter & UnknownOrderReconciler tests
 */
import { describe, it, expect } from 'vitest';
import {
  BrokerAdapter,
  UnknownOrderReconciler,
  type AuthorizedOrderIntent,
  type BrokerCapabilities,
  type BrokerOrderSnapshot,
  type OrderSubmissionResult,
} from '../execution/broker-adapter.js';

class MockBrokerAdapter extends BrokerAdapter {
  readonly id = 'mock-broker';
  public orders = new Map<string, BrokerOrderSnapshot>();
  public shouldFailQuery = false;

  capabilities(): BrokerCapabilities {
    return {
      brokerId: 'mock-broker',
      supportedAssetClasses: ['CRYPTO_SPOT'],
      supportedExchanges: ['BINANCE'],
      supportsLimitOrders: true,
      supportsMarketOrders: true,
      supportsClientOrderId: true,
    };
  }

  async submit(_intent: AuthorizedOrderIntent): Promise<OrderSubmissionResult> {
    return {
      success: true,
      brokerOrderId: 'mock-1',
      idempotencyKey: _intent.idempotencyKey,
      status: 'OPEN',
    };
  }

  async getOrder(brokerOrderId: string): Promise<BrokerOrderSnapshot | null> {
    return this.orders.get(brokerOrderId) ?? null;
  }

  async getOrderByIdempotencyKey(idempotencyKey: string): Promise<BrokerOrderSnapshot | null> {
    if (this.shouldFailQuery) {
      throw new Error('Broker connection timeout');
    }
    for (const o of this.orders.values()) {
      if (o.idempotencyKey === idempotencyKey) return o;
    }
    return null;
  }

  async cancel(_brokerOrderId: string): Promise<boolean> {
    return true;
  }
}

describe('UnknownOrderReconciler', () => {
  it('adopts existing order when found on broker', async () => {
    const broker = new MockBrokerAdapter();
    const existingOrder: BrokerOrderSnapshot = {
      brokerOrderId: 'BRK-99',
      idempotencyKey: 'idem-123',
      instrumentId: 'BINANCE:BTCUSDT',
      side: 'BUY',
      orderType: 'LIMIT',
      requestedQuantity: 1,
      filledQuantity: 1,
      filledPriceMinor: 50_000_00n,
      status: 'FILLED',
      updatedAt: new Date().toISOString(),
    };
    broker.orders.set('BRK-99', existingOrder);

    const reconciler = new UnknownOrderReconciler(broker);
    const decision = await reconciler.reconcile('idem-123');

    expect(decision.action).toBe('ADOPT_EXISTING');
    expect(decision.existingOrder).toEqual(existingOrder);
    expect(decision.reason).toContain('Found existing order BRK-99 with status FILLED');
  });

  it('declares SAFE_TO_RESUBMIT when order is confirmed missing at exchange', async () => {
    const broker = new MockBrokerAdapter();
    const reconciler = new UnknownOrderReconciler(broker);

    const decision = await reconciler.reconcile('missing-key-456');

    expect(decision.action).toBe('SAFE_TO_RESUBMIT');
    expect(decision.existingOrder).toBeNull();
    expect(decision.reason).toContain('confirmed not present');
  });

  it('aborts for manual review if reconciliation query fails (never retries blind)', async () => {
    const broker = new MockBrokerAdapter();
    broker.shouldFailQuery = true;
    const reconciler = new UnknownOrderReconciler(broker);

    const decision = await reconciler.reconcile('unknown-key-789');

    expect(decision.action).toBe('ABORT_MANUAL_REVIEW');
    expect(decision.existingOrder).toBeNull();
    expect(decision.reason).toContain('Broker connection timeout');
  });
});
