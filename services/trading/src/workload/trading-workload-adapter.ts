/**
 * TradingWorkloadAdapter — maps Trading AI operations into the Satelink Routing Kernel.
 *
 * Implements the 5-phase WorkloadAdapter lifecycle:
 *   DISCOVER -> QUOTE -> ROUTE -> EXECUTE -> SETTLE
 *
 * The RoutingKernel depends only on this contract; it knows nothing of brokers,
 * tickers, or exchanges.
 */
import type { RiskAuthorizationEngine } from '../risk/authorization.js';
import type { PaperBrokerAdapter } from '../execution/paper-broker.js';
import type { FinancialOSMetering } from '../financial/metering.js';

export interface WorkloadCapabilities {
  readonly key: string;
  readonly resourceTypes: readonly string[];
  readonly settlementMode: 'PRE' | 'POST' | 'ESCROW';
  readonly executionSafety: 'IDEMPOTENT' | 'AT_MOST_ONCE';
}

export interface SupplierCandidate {
  readonly supplierId: string;
  readonly venue: string;
  readonly assetClass: string;
  readonly healthy: boolean;
  readonly latencyMs?: number;
}

export interface TradingQuoteRequest {
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantity: number;
  readonly estimatedPriceMinor: bigint;
}

export interface TradingExecutionRequest {
  readonly idempotencyKey: string;
  readonly instrumentId: string;
  readonly exchange: string;
  readonly side: 'BUY' | 'SELL';
  readonly orderType: 'MARKET' | 'LIMIT';
  readonly quantity: number;
  readonly limitPriceMinor?: bigint | undefined;
}

export class TradingWorkloadAdapter {
  constructor(
    private readonly riskEngine: RiskAuthorizationEngine,
    private readonly broker: PaperBrokerAdapter,
    private readonly metering: FinancialOSMetering,
  ) {}

  capabilities(): WorkloadCapabilities {
    return {
      key: 'trading',
      resourceTypes: ['crypto', 'equity', 'derivative', 'fx'],
      settlementMode: 'POST',
      executionSafety: 'IDEMPOTENT',
    };
  }

  async discover(_query?: Record<string, unknown>): Promise<SupplierCandidate[]> {
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

  async probe(supplier: SupplierCandidate): Promise<{ ok: boolean; latencyMs: number }> {
    return {
      ok: supplier.healthy,
      latencyMs: supplier.latencyMs ?? 5,
    };
  }

  async quote(request: TradingQuoteRequest, supplier: SupplierCandidate): Promise<{
    cost: number;
    unit: string;
    supplierId: string;
    estimatedNotionalMinor: string;
    estimatedPlatformFeeMinor: string;
  }> {
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

  async execute(
    request: { payload: TradingExecutionRequest },
    supplier: SupplierCandidate,
    _ctx?: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    orderId: string;
    status: string;
    filledQuantity: number;
    filledPriceMinor: string | null;
  }> {
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
