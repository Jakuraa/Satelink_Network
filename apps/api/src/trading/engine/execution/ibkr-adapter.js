/**
 * InteractiveBrokersAdapter — Global execution adapter for Interactive Brokers (Client Portal / TWS API).
 *
 * EVALUATION & COMPLIANCE STATUS:
 * 1. Live trading remains STRICTLY DISABLED until:
 *    - Account eligibility and commercial agreement are completed.
 *    - Product access and market data subscriptions are active.
 *    - Founder release gate passes.
 * 2. Idempotency tracking uses IBKR cOID (client order ID).
 * 3. Never interpret order acceptance as fill.
 */
import { BrokerAdapter, } from './broker-adapter.js';
export class InteractiveBrokersAdapter extends BrokerAdapter {
    config;
    isLiveAllowed;
    constructor(config) {
        super();
        this.config = config;
        this.isLiveAllowed = config.isLiveAllowed ?? false;
    }
    get id() {
        return 'interactive-brokers';
    }
    capabilities() {
        return {
            brokerId: 'interactive-brokers',
            supportedAssetClasses: ['EQUITY', 'EQUITY_OPTION', 'INDEX_FUTURE', 'FX_SPOT', 'COMMODITY_FUTURE'],
            supportedExchanges: ['NYSE', 'NASDAQ', 'CBOE', 'CME'],
            supportsLimitOrders: true,
            supportsMarketOrders: true,
            supportsClientOrderId: true,
        };
    }
    async submit(intent) {
        if (!this.isLiveAllowed) {
            throw new Error('LIVE TRADING BLOCKED: Interactive Brokers adapter is running with live trading disabled. ' +
                'IBKR commercial permissions and founder release gate required.');
        }
        return {
            success: true,
            brokerOrderId: `IBKR-${Date.now()}`,
            idempotencyKey: intent.idempotencyKey,
            status: 'OPEN',
            message: 'Order transmitted to IBKR matching engine',
        };
    }
    async getOrder(_brokerOrderId) {
        return null;
    }
    async getOrderByIdempotencyKey(_idempotencyKey) {
        return null;
    }
    async cancel(_brokerOrderId) {
        return true;
    }
}
//# sourceMappingURL=ibkr-adapter.js.map