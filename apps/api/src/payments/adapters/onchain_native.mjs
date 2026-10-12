// "onchain-native" adapter (Wave 1.3) — the EXISTING in-house rails behind the contract:
//   * Polygon USDT → RevenueVaultV2 (Deposited events, apps/api/src/services/deposit_listener.js)
//   * Base USDC via x402 (CDP facilitator settlement, apps/api/src/payments/x402/settlement.js)
// No provider, no approval wait. This adapter NORMALISES what those rails already
// observe into CanonicalPaymentEvents; it does not replace or re-wire them, so the
// current RPC credit path (DepositListener → creditAccount → api_credits, x402 bundle
// → api_credits) is unchanged. A checkout invoice is matched by canonicalRef.
//
// Status rules (Part A / Wave 1.3):
//   confirmations < threshold         → pending   (no entitlement)
//   received < invoice amount         → partially_paid (no entitlement; held for support)
//   received = invoice amount         → succeeded
//   received > invoice amount         → overpaid  (plan amount is revenue, remainder = customer credit)
//   no invoice (plain top-up)         → succeeded (whole amount = customer credit, not revenue)
//   wrong network / wrong token       → NOT DETECTED — the listener only watches the vault on
//                                       Polygon; see docs/platform/FINANCIAL_OS_PAYMENTS_MAP.md §support.
// There are no webhooks: events come from Satelink's own listener/settlement code,
// so verifyWebhook() always refuses and normalizeEvent() takes an internal record.
import { PaymentError, sha256Hex, unsupported } from '../contract.mjs';

export const ONCHAIN_DEFAULTS = Object.freeze({
  // Mirrors MIN_CONFIRMATIONS (apps/api/src/billing/deposit_validation.mjs) — the
  // DepositListener's DEPOSIT_CONFIRMATIONS stays the single source for crediting.
  polygonConfirmations: 25,
  invoiceTtlMinutes: 60,
});

export function onchainConfig(env = process.env) {
  const n = (v, d) => (v !== undefined && /^\d+$/.test(String(v)) ? Number(v) : d);
  return {
    polygonConfirmations: n(env.PAYMENTS_ONCHAIN_POLYGON_CONFIRMATIONS ?? env.DEPOSIT_CONFIRMATIONS, ONCHAIN_DEFAULTS.polygonConfirmations),
    invoiceTtlMinutes: n(env.PAYMENTS_ONCHAIN_INVOICE_TTL_MINUTES, ONCHAIN_DEFAULTS.invoiceTtlMinutes),
    vaultAddress: env.VAULT_ADDRESS || env.REVENUE_VAULT_ADDRESS || null,
    usdtAddress: env.USDT_ADDRESS || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    x402PayTo: env.X402_PAY_TO || null,
  };
}

function statusFor(received, expected) {
  if (expected === null) return 'succeeded';
  if (received < expected) return 'partially_paid';
  if (received > expected) return 'overpaid';
  return 'succeeded';
}

export function createOnchainNativeAdapter({ env = process.env, lookupIntentAmount = async () => null } = {}) {
  const id = 'onchain-native';
  const cfg = () => onchainConfig(env);

  return {
    id,
    capabilities: () => ({
      oneTime: true, recurring: false, refunds: false,
      currencies: ['USDT', 'USDC'], networks: ['polygon', 'base'],
      hostedCheckout: false, requiresKyb: false,
    }),

    /**
     * On-chain invoice for the checkout page (QR + address + network + amount).
     * Polygon USDT goes through the vault's deposit() (approve + deposit — the same
     * calldata GET /credits/deposit/initiate already serves); Base USDC goes through x402.
     */
    async createIntent({ canonicalRef, amountMinor, currency, network, now = new Date() }) {
      const c = cfg();
      if (network === 'polygon' && currency === 'USDT') {
        if (!c.vaultAddress) throw new PaymentError('NOT_CONFIGURED', 'VAULT_ADDRESS is not set');
        return {
          canonicalRef, providerPaymentId: null,
          invoice: {
            network: 'polygon', chainId: 137, currency: 'USDT', token: c.usdtAddress, payTo: c.vaultAddress,
            amountMinor: BigInt(amountMinor).toString(), decimals: 6,
            // Existing route (GET /credits/deposit/initiate?amount=<usdt>) — returns approve + deposit calldata.
            calldataUrl: `/credits/deposit/initiate?amount=${baseUnitsToUsdtString(amountMinor)}`,
            confirmationsRequired: c.polygonConfirmations,
            expiresAt: new Date(now.getTime() + c.invoiceTtlMinutes * 60_000).toISOString(),
          },
        };
      }
      if (network === 'base' && currency === 'USDC') {
        return {
          canonicalRef, providerPaymentId: null,
          invoice: { network: 'base', chainId: 8453, currency: 'USDC', rail: 'x402', payTo: c.x402PayTo, amountMinor: BigInt(amountMinor).toString(), decimals: 6 },
        };
      }
      throw new PaymentError('UNSUPPORTED', `onchain-native: ${currency} on ${network} is not a supported rail`);
    },

    getPayment: unsupported(id, 'getPayment'),

    /** No webhooks exist for this rail — anything arriving over HTTP is refused. */
    async verifyWebhook() { return false; },

    /**
     * Internal record → CanonicalPaymentEvent.
     *   polygon_vault: { kind:'polygon_vault', txHash, logIndex, from, amountRaw, confirmations, blockTime?, canonicalRef?, customerAccountId? }
     *   x402:          { kind:'x402', txHash, network:'eip155:8453', payer, amountAtomic, canonicalRef?, customerAccountId? }
     * amountRaw/amountAtomic are the token's integer base units as a string (never a float).
     */
    async normalizeEvent(record) {
      if (!record || typeof record !== 'object') throw new PaymentError('INVALID', 'onchain record required');
      const raw = JSON.stringify(record, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
      if (record.kind === 'polygon_vault') {
        if (!/^0x[0-9a-fA-F]{64}$/.test(record.txHash ?? '')) throw new PaymentError('INVALID', 'bad txHash');
        if (!/^\d+$/.test(String(record.amountRaw))) throw new PaymentError('INVALID', 'amountRaw must be integer base units');
        const received = BigInt(record.amountRaw);
        const confirmed = Number(record.confirmations ?? 0) >= cfg().polygonConfirmations;
        const expected = record.canonicalRef ? await lookupIntentAmount(record.canonicalRef) : null;
        const status = confirmed ? statusFor(received, expected === null ? null : BigInt(expected)) : 'pending';
        return {
          provider: id,
          providerEventId: `polygon:${record.txHash.toLowerCase()}:${Number(record.logIndex ?? 0)}:${status}`,
          providerPaymentId: `polygon:${record.txHash.toLowerCase()}:${Number(record.logIndex ?? 0)}`,
          canonicalRef: record.canonicalRef ?? null,
          customerAccountId: record.customerAccountId ?? (record.from ? String(record.from).toLowerCase() : null),
          productId: null, amountMinor: received, currency: 'USDT', network: 'polygon', status,
          occurredAt: record.blockTime ? new Date(record.blockTime) : new Date(), raw_hash: sha256Hex(raw),
        };
      }
      if (record.kind === 'x402') {
        if (record.network !== 'eip155:8453') throw new PaymentError('INVALID', `x402 network ${record.network} is not Base mainnet`);
        if (!/^\d+$/.test(String(record.amountAtomic))) throw new PaymentError('INVALID', 'amountAtomic must be integer base units');
        const received = BigInt(record.amountAtomic);
        const expected = record.canonicalRef ? await lookupIntentAmount(record.canonicalRef) : null;
        // The facilitator only reports a settlement once it is final on-chain.
        const status = statusFor(received, expected === null ? null : BigInt(expected));
        return {
          provider: id,
          providerEventId: `base:${String(record.txHash).toLowerCase()}:${status}`,
          providerPaymentId: `base:${String(record.txHash).toLowerCase()}`,
          canonicalRef: record.canonicalRef ?? null,
          customerAccountId: record.customerAccountId ?? (record.payer ? String(record.payer).toLowerCase() : null),
          productId: null, amountMinor: received, currency: 'USDC', network: 'base', status,
          occurredAt: record.settledAt ? new Date(record.settledAt) : new Date(), raw_hash: sha256Hex(raw),
        };
      }
      throw new PaymentError('INVALID', `onchain record kind ${record.kind} unknown`);
    },

    refund: unsupported(id, 'refund'),

    /** Compares on-chain records the caller already fetched (listener cursor / facilitator list). */
    async reconcile({ records = [] } = {}) {
      const out = [];
      for (const r of records) {
        const e = await this.normalizeEvent(r);
        out.push({ providerPaymentId: e.providerPaymentId, providerEventId: e.providerEventId, status: e.status, amountMinor: e.amountMinor, currency: e.currency });
      }
      return out;
    },
  };
}

/**
 * Contract check for the CURRENT deposit path: the listener credits
 * parseFloat(formatUnits(amount, 6)) USDT. This exact (BigInt) conversion must
 * agree with it for every amount the vault can emit at 6 dp, so wrapping the rail
 * cannot change what an RPC customer is credited.
 */
export function baseUnitsToUsdtString(amountRaw) {
  const s = BigInt(amountRaw).toString().padStart(7, '0');
  return `${s.slice(0, -6)}.${s.slice(-6)}`;
}
