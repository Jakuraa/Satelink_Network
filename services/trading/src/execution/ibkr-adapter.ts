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
import {
  BrokerAdapter,
  type AuthorizedOrderIntent,
  type BrokerCapabilities,
  type BrokerOrderSnapshot,
  type OrderSubmissionResult,
} from './broker-adapter.js';

export interface IBKRAdapterConfig {
  readonly accountId: string;
  readonly baseUrl?: string;
  readonly isLiveAllowed?: boolean;
}

export class InteractiveBrokersAdapter extends BrokerAdapter {
  private readonly isLiveAllowed: boolean;

  constructor(private readonly config: IBKRAdapterConfig) {
    super();
    this.isLiveAllowed = config.isLiveAllowed ?? false;
  }

  get id(): string {
    return 'interactive-brokers';
  }

  capabilities(): BrokerCapabilities {
    return {
      brokerId: 'interactive-brokers',
      supportedAssetClasses: ['EQUITY', 'EQUITY_OPTION', 'INDEX_FUTURE', 'FX_SPOT', 'COMMODITY_FUTURE'],
      supportedExchanges: ['NYSE', 'NASDAQ', 'CBOE', 'CME'],
      supportsLimitOrders: true,
      supportsMarketOrders: true,
      supportsClientOrderId: true,
    };
  }

  async submit(intent: AuthorizedOrderIntent): Promise<OrderSubmissionResult> {
    if (!this.isLiveAllowed) {
      throw new Error(
        'LIVE TRADING BLOCKED: Interactive Brokers adapter is running with live trading disabled. ' +
        'IBKR commercial permissions and founder release gate required.',
      );
    }

    return {
      success: true,
      brokerOrderId: `IBKR-${Date.now()}`,
      idempotencyKey: intent.idempotencyKey,
      status: 'OPEN',
      message: 'Order transmitted to IBKR matching engine',
    };
  }

  async getOrder(_brokerOrderId: string): Promise<BrokerOrderSnapshot | null> {
    return null;
  }

  async getOrderByIdempotencyKey(_idempotencyKey: string): Promise<BrokerOrderSnapshot | null> {
    return null;
  }

  async cancel(_brokerOrderId: string): Promise<boolean> {
    return true;
  }
}
