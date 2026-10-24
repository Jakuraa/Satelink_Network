export class FinancialOSMetering {
    platformFeeBps;
    receipts = [];
    seq = 0;
    constructor(platformFeeBps = 10n) {
        this.platformFeeBps = platformFeeBps;
        if (platformFeeBps < 0n || platformFeeBps > 10000n) {
            throw new RangeError('platformFeeBps must be between 0 and 10000');
        }
    }
    /**
     * Exact integer notional value: quantity * fillPriceMinor.
     */
    static calculateNotional(quantity, fillPriceMinor) {
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
    calculatePlatformFee(notionalMinor) {
        if (notionalMinor < 0n)
            throw new RangeError('notionalMinor must be non-negative');
        return (notionalMinor * this.platformFeeBps) / 10000n;
    }
    /**
     * Settle an executed fill and record Financial OS metering.
     * Customer trading capital is separated strictly from Satelink revenue.
     */
    settleFill(customerAccount, satelinkRevenue, fill) {
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
        }
        else {
            // SELL: adds notional less fees to customer capital
            const netProceeds = notionalMinor > totalFeesMinor ? notionalMinor - totalFeesMinor : 0n;
            customerAccount.tradingCapitalMinor += netProceeds;
        }
        // Satelink revenue strictly collects only its own platform fee
        satelinkRevenue.revenueBalanceMinor += satelinkFeeMinor;
        const receipt = {
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
    getReceipt(receiptId) {
        return this.receipts.find((r) => r.receiptId === receiptId) ?? null;
    }
    getReceiptsForPrincipal(principalId) {
        return this.receipts.filter((r) => r.principalId === principalId);
    }
}
//# sourceMappingURL=metering.js.map