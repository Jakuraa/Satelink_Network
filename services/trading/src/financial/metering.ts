/**
 * Financial OS Metering & Trade Receipts.
 *
 * MANDATORY INVARIANTS:
 * 1. Money is bigint in integer minor units. NEVER a float.
 * 2. Separate customer trading capital from Satelink revenue.
 * 3. Exact arithmetic: floor(notional * bps / 10000n).
 * 4. Immutable trade receipts for every executed fill.
 */
import type { OrderSide } from '../risk/authorization.js';

export interface CustomerTradingAccount {
  readonly principalId: string;
  readonly currency: string;
  tradingCapitalMinor: bigint;
  realizedPnLMinor: bigint;
}

export interface SatelinkRevenueAccount {
  readonly currency: string;
  revenueBalanceMinor: bigint;
}

export interface TradeFill {
  readonly orderId: string;
  readonly idempotencyKey: string;
  readonly instrumentId: string;
  readonly side: OrderSide;
  readonly fillPriceMinor: bigint;
  readonly filledQuantity: number;
  readonly currency: string;
  readonly exchangeFeeMinor: bigint;
  readonly timestamp: string;
}

export interface TradeReceipt {
  readonly receiptId: string;
  readonly orderId: string;
  readonly idempotencyKey: string;
  readonly principalId: string;
  readonly instrumentId: string;
  readonly side: OrderSide;
  readonly quantity: number;
  readonly fillPriceMinor: bigint;
  readonly notionalMinor: bigint;
  readonly exchangeFeeMinor: bigint;
  readonly satelinkFeeMinor: bigint;
  readonly currency: string;
  readonly issuedAt: string;
}

export interface TradeSettlementResult {
  readonly receipt: TradeReceipt;
  readonly updatedCustomerCapitalMinor: bigint;
  readonly updatedSatelinkRevenueMinor: bigint;
}

export class FinancialOSMetering {
  private readonly receipts: TradeReceipt[] = [];
  private seq = 0;

  constructor(
    private readonly platformFeeBps: bigint = 10n, // 10 bps default platform fee (0.1%)
  ) {
    if (platformFeeBps < 0n || platformFeeBps > 10_000n) {
      throw new RangeError('platformFeeBps must be between 0 and 10000');
    }
  }

  /**
   * Exact integer notional value: quantity * fillPriceMinor.
   */
  static calculateNotional(quantity: number, fillPriceMinor: bigint): bigint {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new RangeError(`quantity must be a positive safe integer, got ${quantity}`);
    }
    if (fillPriceMinor < 0n) {
      throw new RangeError(`fillPriceMinor must be non-negative, got ${fillPriceMinor}`);
    }
    return BigInt(quantity) * fillPriceMinor;
  }

  /**
   * Exact integer platform fee: floor(notionalMinor * bps / 10000n).
   */
  calculatePlatformFee(notionalMinor: bigint): bigint {
    if (notionalMinor < 0n) throw new RangeError('notionalMinor must be non-negative');
    return (notionalMinor * this.platformFeeBps) / 10_000n;
  }

  /**
   * Settle an executed fill and record Financial OS metering.
   * Customer trading capital is separated strictly from Satelink revenue.
   */
  settleFill(
    customerAccount: CustomerTradingAccount,
    satelinkRevenue: SatelinkRevenueAccount,
    fill: TradeFill,
  ): TradeSettlementResult {
    if (customerAccount.currency !== fill.currency) {
      throw new Error(`Currency mismatch: customer has ${customerAccount.currency}, trade in ${fill.currency}`);
    }
    if (satelinkRevenue.currency !== fill.currency) {
      throw new Error(`Currency mismatch: satelink revenue has ${satelinkRevenue.currency}, trade in ${fill.currency}`);
    }

    const notionalMinor = FinancialOSMetering.calculateNotional(fill.filledQuantity, fill.fillPriceMinor);
    const satelinkFeeMinor = this.calculatePlatformFee(notionalMinor);
    const totalFeesMinor = fill.exchangeFeeMinor + satelinkFeeMinor;

    // Capital accounting:
    // If BUY: customer expends notional + totalFees
    // If SELL: customer receives notional - totalFees
    if (fill.side === 'BUY') {
      const required = notionalMinor + totalFeesMinor;
      if (customerAccount.tradingCapitalMinor < required) {
        throw new Error(`Insufficient customer capital: need ${required}, have ${customerAccount.tradingCapitalMinor}`);
      }
      customerAccount.tradingCapitalMinor -= required;
    } else {
      // SELL: adds notional less fees to customer capital
      const netProceeds = notionalMinor > totalFeesMinor ? notionalMinor - totalFeesMinor : 0n;
      customerAccount.tradingCapitalMinor += netProceeds;
    }

    // Satelink revenue strictly collects only its own platform fee
    satelinkRevenue.revenueBalanceMinor += satelinkFeeMinor;

    const receipt: TradeReceipt = {
      receiptId: `RCPT-${++this.seq}-${Date.now()}`,
      orderId: fill.orderId,
      idempotencyKey: fill.idempotencyKey,
      principalId: customerAccount.principalId,
      instrumentId: fill.instrumentId,
      side: fill.side,
      quantity: fill.filledQuantity,
      fillPriceMinor: fill.fillPriceMinor,
      notionalMinor,
      exchangeFeeMinor: fill.exchangeFeeMinor,
      satelinkFeeMinor,
      currency: fill.currency,
      issuedAt: new Date().toISOString(),
    };

    this.receipts.push(receipt);

    return {
      receipt,
      updatedCustomerCapitalMinor: customerAccount.tradingCapitalMinor,
      updatedSatelinkRevenueMinor: satelinkRevenue.revenueBalanceMinor,
    };
  }

  getReceipt(receiptId: string): TradeReceipt | null {
    return this.receipts.find((r) => r.receiptId === receiptId) ?? null;
  }

  getReceiptsForPrincipal(principalId: string): readonly TradeReceipt[] {
    return this.receipts.filter((r) => r.principalId === principalId);
  }
}
