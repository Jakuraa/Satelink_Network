/**
 * @satelink/trading — PaperBrokerAdapter tests
 */
import { describe, it, expect } from 'vitest';
import { PaperBrokerAdapter, OrderStatus } from '../execution/paper-broker.js';
import { OrderType, OrderSide } from '../risk/authorization.js';

describe('PaperBrokerAdapter', () => {
  it('fills market order immediately at current price', () => {
    const broker = new PaperBrokerAdapter();
    broker.setMarketPrice('BINANCE:BTCUSDT', 4200000n);

    const order = broker.submit({
      idempotencyKey: 'k1',
      instrumentId: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      side: OrderSide.BUY,
      orderType: OrderType.MARKET,
      quantity: 1,
    });

    expect(order.status).toBe(OrderStatus.FILLED);
    expect(order.filledPriceMinor).toBe(4200000n);
    expect(order.filledQuantity).toBe(1);
  });

  it('market order fills at 0 when no price set', () => {
    const broker = new PaperBrokerAdapter();
    const order = broker.submit({
      idempotencyKey: 'k2',
      instrumentId: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      side: OrderSide.BUY,
      orderType: OrderType.MARKET,
      quantity: 1,
    });
    expect(order.status).toBe(OrderStatus.FILLED);
    expect(order.filledPriceMinor).toBe(0n);
  });

  it('limit buy order queues until price drops to limit', () => {
    const broker = new PaperBrokerAdapter();
    broker.setMarketPrice('BINANCE:BTCUSDT', 4300000n);

    const order = broker.submit({
      idempotencyKey: 'k3',
      instrumentId: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      side: OrderSide.BUY,
      orderType: OrderType.LIMIT,
      quantity: 2,
      limitPriceMinor: 4200000n,
    });

    // price still above limit: should remain OPEN
    expect(order.status).toBe(OrderStatus.OPEN);

    // price drops to limit
    broker.setMarketPrice('BINANCE:BTCUSDT', 4200000n);
    expect(order.status).toBe(OrderStatus.FILLED);
    expect(order.filledPriceMinor).toBe(4200000n);
    expect(order.filledQuantity).toBe(2);
  });

  it('limit sell order fills when price rises to limit', () => {
    const broker = new PaperBrokerAdapter();
    broker.setMarketPrice('BINANCE:BTCUSDT', 4000000n);

    const order = broker.submit({
      idempotencyKey: 'k4',
      instrumentId: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      side: OrderSide.SELL,
      orderType: OrderType.LIMIT,
      quantity: 1,
      limitPriceMinor: 4200000n,
    });

    expect(order.status).toBe(OrderStatus.OPEN);

    broker.setMarketPrice('BINANCE:BTCUSDT', 4200000n);
    expect(order.status).toBe(OrderStatus.FILLED);
  });

  it('is idempotent on duplicate idempotencyKey', () => {
    const broker = new PaperBrokerAdapter();
    broker.setMarketPrice('BINANCE:BTCUSDT', 4200000n);

    const intent = {
      idempotencyKey: 'k5',
      instrumentId: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      side: OrderSide.BUY,
      orderType: OrderType.MARKET,
      quantity: 1,
    };

    const o1 = broker.submit(intent);
    const o2 = broker.submit(intent);
    expect(o1.orderId).toBe(o2.orderId);
    expect(broker.getAllOrders()).toHaveLength(1);
  });

  it('cancel works on OPEN order', () => {
    const broker = new PaperBrokerAdapter();
    const order = broker.submit({
      idempotencyKey: 'k6',
      instrumentId: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      side: OrderSide.BUY,
      orderType: OrderType.LIMIT,
      quantity: 1,
      limitPriceMinor: 100n, // very low limit; won't fill
    });

    expect(order.status).toBe(OrderStatus.OPEN);
    const cancelled = broker.cancel(order.orderId);
    expect(cancelled).toBe(true);
    expect(order.status).toBe(OrderStatus.CANCELLED);
  });

  it('cancel returns false on already-filled order', () => {
    const broker = new PaperBrokerAdapter();
    broker.setMarketPrice('BINANCE:BTCUSDT', 4200000n);
    const order = broker.submit({
      idempotencyKey: 'k7',
      instrumentId: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      side: OrderSide.BUY,
      orderType: OrderType.MARKET,
      quantity: 1,
    });
    expect(order.status).toBe(OrderStatus.FILLED);
    expect(broker.cancel(order.orderId)).toBe(false);
  });

  it('audit trail records lifecycle events', () => {
    const broker = new PaperBrokerAdapter();
    broker.setMarketPrice('BINANCE:BTCUSDT', 4200000n);
    broker.submit({
      idempotencyKey: 'k8',
      instrumentId: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      side: OrderSide.BUY,
      orderType: OrderType.MARKET,
      quantity: 1,
    });

    const audit = broker.getAuditTrail();
    const events = audit.map((e) => e.event);
    expect(events).toContain('SUBMITTED');
    expect(events).toContain('OPEN');
    expect(events).toContain('FILLED');
  });

  it('getOrderByIdempotencyKey returns the order', () => {
    const broker = new PaperBrokerAdapter();
    const order = broker.submit({
      idempotencyKey: 'k9',
      instrumentId: 'BINANCE:BTCUSDT',
      exchange: 'BINANCE',
      side: OrderSide.BUY,
      orderType: OrderType.MARKET,
      quantity: 1,
    });
    expect(broker.getOrderByIdempotencyKey('k9')?.orderId).toBe(order.orderId);
    expect(broker.getOrderByIdempotencyKey('not-found')).toBeNull();
  });
});
