export class TradingWorkloadAdapter {
    riskEngine;
    broker;
    metering;
    constructor(riskEngine, broker, metering) {
        this.riskEngine = riskEngine;
        this.broker = broker;
        this.metering = metering;
    }
    capabilities() {
        return {
            key: 'trading',
            resourceTypes: ['crypto', 'equity', 'derivative', 'fx'],
            settlementMode: 'POST',
            executionSafety: 'IDEMPOTENT',
        };
    }
    async discover(_query) {
        return [
            {
                supplierId: 'satelink-paper-execution',
                venue: 'PAPER',
                assetClass: 'MULTI_ASSET',
                healthy: true,
                latencyMs: 1,
            },
            {
                supplierId: 'binance-public-marketdata',
                venue: 'BINANCE',
                assetClass: 'CRYPTO_SPOT',
                healthy: true,
                latencyMs: 35,
            },
        ];
    }
    async probe(supplier) {
        return {
            ok: supplier.healthy,
            latencyMs: supplier.latencyMs ?? 5,
        };
    }
    async quote(request, supplier) {
        const notional = BigInt(request.quantity) * request.estimatedPriceMinor;
        const fee = this.metering.calculatePlatformFee(notional);
        return {
            cost: 0,
            unit: 'platform_fee',
            supplierId: supplier.supplierId,
            estimatedNotionalMinor: notional.toString(),
            estimatedPlatformFeeMinor: fee.toString(),
        };
    }
    async execute(request, supplier, _ctx) {
        const order = this.broker.submit(request.payload);
        return {
            success: order.status === 'FILLED' || order.status === 'OPEN',
            orderId: order.orderId,
            status: order.status,
            filledQuantity: order.filledQuantity,
            filledPriceMinor: order.filledPriceMinor != null ? order.filledPriceMinor.toString() : null,
        };
    }
}
//# sourceMappingURL=trading-workload-adapter.js.map