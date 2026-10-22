/**
 * PaperBrokerAdapter — paper execution with fill simulation and audit trail.
 *
 * Simulates order execution WITHOUT any live brokerage connection.
 * Market orders fill immediately at lastMinor; limit orders queue.
 *
 * This is the ONLY path where orders can be placed during development.
 * Live trading is disabled until separate release gates pass.
 *
 * Order lifecycle: PENDING → OPEN → FILLED | CANCELLED | REJECTED
 */
import type { OrderIntent, OrderSide, OrderType } from '../risk/authorization.js';
import { OrderType as OT } from '../risk/authorization.js';

export const OrderStatus = Object.freeze({
  PENDING:   'PENDING',
  OPEN:      'OPEN',
  FILLED:    'FILLED',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  CANCELLED: 'CANCELLED',
  REJECTED:  'REJECTED',
  UNKNOWN:   'UNKNOWN', // submitted but status not confirmed
} as const);
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export interface PaperOrder {
  readonly orderId: string;
  readonly idempotencyKey: string;
  readonly instrumentId: string;
  readonly exchange: string;
  readonly side: OrderSide;
  readonly orderType: OrderType;
  readonly quantity: number;
  readonly limitPriceMinor?: bigint | undefined;
  /** Price at which the order filled (null if not filled). */
  filledPriceMinor: bigint | null;
  /** Quantity filled so far. */
  filledQuantity: number;
  status: OrderStatus;
  readonly submittedAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  readonly orderId: string;
  readonly idempotencyKey: string;
  readonly event: string;
  readonly detail: string;
  readonly timestamp: string;
}

export class PaperBrokerAdapter {
  readonly #orders = new Map<string, PaperOrder>(); // orderId → order
  readonly #idempotencyIndex = new Map<string, string>(); // idempotencyKey → orderId
  readonly #audit: AuditEntry[] = [];
  #marketPriceMinor = new Map<string, bigint>(); // instrumentId → price
  #seq = 0;

  /** Update the simulated market price for an instrument. */
  setMarketPrice(instrumentId: string, priceMinor: bigint): void {
    this.#marketPriceMinor.set(instrumentId, priceMinor);
    // attempt to fill any open limit orders
    for (const order of this.#orders.values()) {
      if (order.status === OrderStatus.OPEN && order.orderType === OT.LIMIT && order.instrumentId === instrumentId) {
        this.#tryFillLimit(order, priceMinor);
      }
    }
  }

  /**
   * Submit an order intent. Returns the PaperOrder.
   * Idempotent: same idempotencyKey always returns the same order.
   */
  submit(intent: OrderIntent): PaperOrder {
    const existing = this.#idempotencyIndex.get(intent.idempotencyKey);
    if (existing) {
      return this.#orders.get(existing)!;
    }

    const orderId = `PAPER-${++this.#seq}-${Date.now()}`;
    const now = new Date().toISOString();

    const order: PaperOrder = {
      orderId,
      idempotencyKey: intent.idempotencyKey,
      instrumentId: intent.instrumentId,
      exchange: intent.exchange,
      side: intent.side,
      orderType: intent.orderType,
      quantity: intent.quantity,
      limitPriceMinor: intent.limitPriceMinor,
      filledPriceMinor: null,
      filledQuantity: 0,
      status: OrderStatus.PENDING,
      submittedAt: now,
      updatedAt: now,
    };

    this.#orders.set(orderId, order);
    this.#idempotencyIndex.set(intent.idempotencyKey, orderId);
    this.#appendAudit(orderId, intent.idempotencyKey, 'SUBMITTED', `side=${intent.side} qty=${intent.quantity} type=${intent.orderType}`);

    // Transition to OPEN
    order.status = OrderStatus.OPEN;
    order.updatedAt = new Date().toISOString();
    this.#appendAudit(orderId, intent.idempotencyKey, 'OPEN', 'order accepted by paper exchange');

    // Market orders fill immediately
    if (intent.orderType === OT.MARKET) {
      const price = this.#marketPriceMinor.get(intent.instrumentId) ?? 0n;
      this.#fill(order, price, intent.quantity);
    } else if (intent.orderType === OT.LIMIT && intent.limitPriceMinor != null) {
      const price = this.#marketPriceMinor.get(intent.instrumentId);
      if (price != null) this.#tryFillLimit(order, price);
    }

    return order;
  }

  cancel(orderId: string): boolean {
    const order = this.#orders.get(orderId);
    if (!order) return false;
    if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PENDING) return false;
    order.status = OrderStatus.CANCELLED;
    order.updatedAt = new Date().toISOString();
    this.#appendAudit(orderId, order.idempotencyKey, 'CANCELLED', 'cancelled by client');
    return true;
  }

  getOrder(orderId: string): PaperOrder | null {
    return this.#orders.get(orderId) ?? null;
  }

  getOrderByIdempotencyKey(key: string): PaperOrder | null {
    const id = this.#idempotencyIndex.get(key);
    return id ? (this.#orders.get(id) ?? null) : null;
  }

  getAuditTrail(): readonly AuditEntry[] {
    return this.#audit;
  }

  /** All orders (for reporting). */
  getAllOrders(): readonly PaperOrder[] {
    return [...this.#orders.values()];
  }

  // ── private ──────────────────────────────────────────────────────────────

  #fill(order: PaperOrder, priceMinor: bigint, qty: number): void {
    const now = new Date().toISOString();
    order.filledPriceMinor = priceMinor;
    order.filledQuantity = qty;
    order.status = OrderStatus.FILLED;
    order.updatedAt = now;
    this.#appendAudit(order.orderId, order.idempotencyKey, 'FILLED', `price=${priceMinor} qty=${qty}`);
  }

  #tryFillLimit(order: PaperOrder, marketPriceMinor: bigint): void {
    if (order.status !== OrderStatus.OPEN || order.limitPriceMinor == null) return;
    const buyFill = order.side === 'BUY' && marketPriceMinor <= order.limitPriceMinor;
    const sellFill = order.side === 'SELL' && marketPriceMinor >= order.limitPriceMinor;
    if (buyFill || sellFill) {
      this.#fill(order, marketPriceMinor, order.quantity - order.filledQuantity);
    }
  }

  #appendAudit(orderId: string, idempotencyKey: string, event: string, detail: string): void {
    this.#audit.push({ orderId, idempotencyKey, event, detail, timestamp: new Date().toISOString() });
  }
}
