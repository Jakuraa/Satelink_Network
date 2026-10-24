export class BrokerAdapter {
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
    broker;
    constructor(broker) {
        this.broker = broker;
    }
    async reconcile(idempotencyKey) {
        try {
            const existing = await this.broker.getOrderByIdempotencyKey(idempotencyKey);
            if (existing) {
                const orderId = ('brokerOrderId' in existing && existing.brokerOrderId) ||
                    ('orderId' in existing && existing.orderId) ||
                    'UNKNOWN';
                const snapshot = {
                    brokerOrderId: orderId,
                    idempotencyKey: existing.idempotencyKey,
                    instrumentId: existing.instrumentId,
                    side: existing.side,
                    orderType: existing.orderType,
                    requestedQuantity: 'requestedQuantity' in existing ? existing.requestedQuantity : existing.quantity,
                    filledQuantity: existing.filledQuantity,
                    filledPriceMinor: existing.filledPriceMinor,
                    status: existing.status,
                    updatedAt: existing.updatedAt,
                };
                return {
                    action: 'ADOPT_EXISTING',
                    existingOrder: snapshot,
                    reason: `Found existing order ${orderId} with status ${existing.status}`,
                };
            }
            return {
                action: 'SAFE_TO_RESUBMIT',
                existingOrder: null,
                reason: 'Order confirmed not present at exchange; safe to retry submission',
            };
        }
        catch (err) {
            return {
                action: 'ABORT_MANUAL_REVIEW',
                existingOrder: null,
                reason: `Reconciliation query failed: ${err instanceof Error ? err.message : String(err)}. Halting for safety.`,
            };
        }
    }
}
//# sourceMappingURL=broker-adapter.js.map