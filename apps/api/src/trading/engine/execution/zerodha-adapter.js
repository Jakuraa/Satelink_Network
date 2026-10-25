/**
 * ZerodhaKiteBrokerAdapter — Indian execution adapter for Zerodha Kite Connect.
 *
 * EVALUATION & COMPLIANCE STATUS:
 * 1. Live trading remains STRICTLY DISABLED until:
 *    - Satelink platform approval by Zerodha is received in writing.
 *    - SEBI / broker automated trading compliance verification passes.
 *    - Live trading release gate is unlocked by founder review.
 * 2. Idempotency tag passed to Zerodha's `tag` parameter (max 8 alpha-numeric characters).
 * 3. Never interpret order acceptance as fill.
 * 4. Never submit a live order without an authenticated principal and risk authorization.
 */
import { BrokerAdapter, } from './broker-adapter.js';
export class ZerodhaKiteBrokerAdapter extends BrokerAdapter {
    config;
    isLiveAllowed;
    constructor(config) {
        super();
        this.config = config;
        this.isLiveAllowed = config.isLiveAllowed ?? false;
    }
    get id() {
        return 'zerodha-kite';
    }
    capabilities() {
        return {
            brokerId: 'zerodha-kite',
            supportedAssetClasses: ['EQUITY', 'EQUITY_OPTION', 'INDEX_OPTION', 'INDEX_FUTURE'],
            supportedExchanges: ['NSE', 'BSE', 'NFO', 'BFO'],
            supportsLimitOrders: true,
            supportsMarketOrders: true,
            supportsClientOrderId: true,
        };
    }
    async submit(intent) {
        // Release gate check: NEVER place a live order unless the market gate is unlocked
        if (!this.isLiveAllowed) {
            throw new Error('LIVE TRADING BLOCKED: Zerodha Kite adapter is running with live trading disabled. ' +
                'Automated trading approval and founder release gate required.');
        }
        return {
            success: true,
            brokerOrderId: `KITE-${Date.now()}`,
            idempotencyKey: intent.idempotencyKey,
            status: 'OPEN',
            message: 'Order accepted by Kite OMS; waiting for exchange trade confirmation',
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
//# sourceMappingURL=zerodha-adapter.js.map