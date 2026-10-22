/**
 * BrokerAdapter — unified execution contract for multi-market trading.
 *
 * MANDATORY CONTROLS:
 * 1. Models propose; deterministic policy authorizes; adapters execute ONLY authorized orders.
 * 2. Idempotent order intents: every order has a client-generated idempotencyKey.
 * 3. Never retry an unknown order submission without first reconciling its status.
 * 4. Never interpret order acceptance as a fill.
 * 5. Live trading is gated; PaperBrokerAdapter is the active development execution path.
 */
import type { OrderIntent, OrderSide, OrderType } from '../risk/authorization.js';
import type { OrderStatus, PaperOrder } from './paper-broker.js';

export interface BrokerCapabilities {
  readonly brokerId: string;
  readonly supportedAssetClasses: readonly string[];
  readonly supportedExchanges: readonly string[];
  readonly supportsLimitOrders: boolean;
  readonly supportsMarketOrders: boolean;
  readonly supportsClientOrderId: boolean;
}

export interface AuthorizedOrderIntent extends OrderIntent {
  readonly authorizationId: string;
  readonly principalId: string;
  readonly authorizedAt: string;
}

export interface OrderSubmissionResult {
  readonly success: boolean;
  readonly brokerOrderId: string | null;
  readonly idempotencyKey: string;
  readonly status: OrderStatus;
  readonly message?: string | undefined;
}

export interface BrokerOrderSnapshot {
  readonly brokerOrderId: string;
  readonly idempotencyKey: string;
  readonly instrumentId: string;
  readonly side: OrderSide;
  readonly orderType: OrderType;
  readonly requestedQuantity: number;
  readonly filledQuantity: number;
  readonly filledPriceMinor: bigint | null;
  readonly status: OrderStatus;
  readonly updatedAt: string;
}

export abstract class BrokerAdapter {
  abstract get id(): string;
  abstract capabilities(): BrokerCapabilities;

  /**
   * Submit an authorized order intent to the broker/exchange.
   * Acceptance does NOT mean fill.
   */
  abstract submit(intent: AuthorizedOrderIntent): Promise<OrderSubmissionResult>;

  /**
   * Check order status by broker order ID.
   */
  abstract getOrder(brokerOrderId: string): Promise<BrokerOrderSnapshot | null>;

  /**
   * Query an order by client idempotencyKey.
   * Essential for unknown-order reconciliation.
   */
  abstract getOrderByIdempotencyKey(idempotencyKey: string): Promise<BrokerOrderSnapshot | null>;

  /**
   * Cancel an open order.
   */
  abstract cancel(brokerOrderId: string): Promise<boolean>;
}

export interface ReconcileDecision {
  readonly action: 'ADOPT_EXISTING' | 'SAFE_TO_RESUBMIT' | 'ABORT_MANUAL_REVIEW';
  readonly existingOrder: BrokerOrderSnapshot | null;
  readonly reason: string;
}

/**
 * UnknownOrderReconciler — handles indeterminate network states.
 *
 * If an order submission fails due to a network timeout, disconnect,
 * or 5xx response, the order MAY or MAY NOT have reached the exchange matching engine.
 *
 * This reconciler queries the exchange before allowing any retry.
 */
export class UnknownOrderReconciler {
  constructor(private readonly broker: BrokerAdapter) {}

  async reconcile(idempotencyKey: string): Promise<ReconcileDecision> {
    try {
      const existing = await this.broker.getOrderByIdempotencyKey(idempotencyKey);
      if (existing) {
        return {
          action: 'ADOPT_EXISTING',
          existingOrder: existing,
          reason: `Found existing order ${existing.brokerOrderId} with status ${existing.status}`,
        };
      }

      return {
        action: 'SAFE_TO_RESUBMIT',
        existingOrder: null,
        reason: 'Order confirmed not present at exchange; safe to retry submission',
      };
    } catch (err) {
      return {
        action: 'ABORT_MANUAL_REVIEW',
        existingOrder: null,
        reason: `Reconciliation query failed: ${err instanceof Error ? err.message : String(err)}. Halting for safety.`,
      };
    }
  }
}
