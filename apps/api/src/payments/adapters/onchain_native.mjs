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
    // DEDICATED receiving address for checkout invoices (founder-provided). It must NOT be
    // the vault (DepositListener auto-credits api_credits) or the treasury 0x966E… (the
    // /api/keys/deposit claim route credits api_credits) — otherwise one payment could be
    // credited twice (RPC balance + plan period). Unset → on-chain invoices are NOT_CONFIGURED.
    invoiceAddress: /^0x[0-9a-fA-F]{40}$/.test(env.PAYMENTS_ONCHAIN_INVOICE_ADDRESS ?? '') ? env.PAYMENTS_ONCHAIN_INVOICE_ADDRESS : null,
    baseConfirmations: n(env.PAYMENTS_ONCHAIN_BASE_CONFIRMATIONS, 10),
  };
}

/** Invoice rails: plain ERC-20 transfer of the exact amount to the invoice address. */
export const INVOICE_RAILS = Object.freeze({
  polygon: { chainId: 137, currency: 'USDT', token: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, confKey: 'polygonConfirmations' },
  base: { chainId: 8453, currency: 'USDC', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, confKey: 'baseConfirmations' },
});

/** EIP-681 ERC-20 transfer URI — what the QR encodes. */
export function eip681Transfer({ token, chainId, to, amountMinor }) {
  return `ethereum:${token}@${chainId}/transfer?address=${to}&uint256=${BigInt(amountMinor)}`;
}

// Every address an EXISTING path auto-credits to api_credits (RPC balances).
// A checkout invoice paid to any of these could be credited twice (RPC balance
// + plan period), so the invoice address must be none of them:
//   - RevenueVault V2 (DepositListener, VAULT_ADDRESS / REVENUE_VAULT_ADDRESS) and
//     its deployed default; RevenueVault V1 (legacy); REVENUE_VAULT_CONTRACT
//   - POST /api/keys/deposit claims USDT transfers to REVENUE_VAULT_ADDRESS
//   - treasury / x402 payTo 0x966E… (TREASURY_ADDRESS, X402_PAY_TO)
export const LISTENER_CREDITED_DEFAULTS = Object.freeze([
  '0x577D3716d6Ad5b676d230f5409deF9838FABaCEF', // RevenueVaultV2
  '0x80AFEaC3B77CbeC1f7B9f24a50319DC72785DdA3', // RevenueVault V1 (legacy)
  '0x966E1Ae22996545015b1414B35234b10719d7Ad4', // treasury / x402 payTo
]);

export function listenerCreditedAddresses(env = process.env) {
  const all = [
    ...LISTENER_CREDITED_DEFAULTS,
    env.VAULT_ADDRESS, env.REVENUE_VAULT_ADDRESS, env.REVENUE_VAULT_CONTRACT,
    env.TREASURY_ADDRESS, env.X402_PAY_TO,
  ];
  return [...new Set(all.filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a ?? '')).map((a) => a.toLowerCase()))];
}

/**
 * Startup validator: invoice payments are refused unless
 * PAYMENTS_ONCHAIN_INVOICE_ADDRESS is a dedicated address (founder-provided —
 * recommended: a Safe multisig on Polygon; address only, never a key).
 * @returns {{ ok: true } | { ok: false, reason: 'invoice_address_unset' | 'invoice_address_unsafe', message: string }}
 */
export function validateInvoiceConfig(env = process.env) {
  const raw = env.PAYMENTS_ONCHAIN_INVOICE_ADDRESS;
  if (!/^0x[0-9a-fA-F]{40}$/.test(raw ?? '')) {
    return { ok: false, reason: 'invoice_address_unset', message: 'PAYMENTS_ONCHAIN_INVOICE_ADDRESS is not set to a 0x address (founder action)' };
  }
  if (listenerCreditedAddresses(env).includes(raw.toLowerCase())) {
    return { ok: false, reason: 'invoice_address_unsafe', message: 'the invoice address is one an existing deposit path auto-credits (vault / treasury / x402 payTo)' };
  }
  return { ok: true };
}

/** Per-invoice guard (kept alongside the startup validator — defence in depth). */
export function assertSafeInvoiceAddress(c, env = process.env) {
  if (!c.invoiceAddress) throw new PaymentError('NOT_CONFIGURED', 'PAYMENTS_ONCHAIN_INVOICE_ADDRESS is not set (founder action)');
  const forbidden = new Set([...listenerCreditedAddresses(env), c.vaultAddress, c.x402PayTo].filter(Boolean).map((x) => x.toLowerCase()));
  if (forbidden.has(c.invoiceAddress.toLowerCase())) {
    throw new PaymentError('NOT_CONFIGURED', 'the invoice address must not be the vault or the treasury (existing paths auto-credit them)');
  }
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
      // Invoice payments are refused (never offered at checkout) until a
      // dedicated, non-listener-credited invoice address is configured.
      ...(() => { const v = validateInvoiceConfig(env); return v.ok ? { available: true } : { available: false, unavailableReason: v.reason }; })(),
    }),

    /**
     * On-chain invoice for the checkout page (QR + address + network + amount).
     * Polygon USDT goes through the vault's deposit() (approve + deposit — the same
     * calldata GET /credits/deposit/initiate already serves); Base USDC goes through x402.
     */
    async createIntent({ canonicalRef, amountMinor, currency, network, now = new Date() }) {
      const c = cfg();
      const rail = INVOICE_RAILS[network];
      if (rail && rail.currency === currency) {
        assertSafeInvoiceAddress(c, env);
        return {
          canonicalRef, providerPaymentId: null,
          invoice: {
            rail: 'erc20_transfer', network, chainId: rail.chainId, currency, token: rail.token, decimals: rail.decimals,
            payTo: c.invoiceAddress, amountMinor: BigInt(amountMinor).toString(), amountDisplay: baseUnitsToUsdtString(amountMinor),
            uri: eip681Transfer({ token: rail.token, chainId: rail.chainId, to: c.invoiceAddress, amountMinor }),
            confirmationsRequired: c[rail.confKey],
            expiresAt: new Date(now.getTime() + c.invoiceTtlMinutes * 60_000).toISOString(),
          },
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
      if (record.kind === 'invoice_transfer') {
        // A verified ERC-20 Transfer to the invoice address (see onchain_verify.mjs).
        const rail = INVOICE_RAILS[record.network];
        if (!rail) throw new PaymentError('INVALID', `invoice network ${record.network} unsupported`);
        if (!/^0x[0-9a-fA-F]{64}$/.test(record.txHash ?? '')) throw new PaymentError('INVALID', 'bad txHash');
        if (!/^\d+$/.test(String(record.amountRaw))) throw new PaymentError('INVALID', 'amountRaw must be integer base units');
        const received = BigInt(record.amountRaw);
        const confirmed = Number(record.confirmations ?? 0) >= cfg()[rail.confKey];
        const expected = record.canonicalRef ? await lookupIntentAmount(record.canonicalRef) : null;
        const status = confirmed ? statusFor(received, expected === null ? null : BigInt(expected)) : 'pending';
        const pid = `${record.network}:${record.txHash.toLowerCase()}`;
        return {
          provider: id, providerEventId: `${pid}:${status}`, providerPaymentId: pid,
          canonicalRef: record.canonicalRef ?? null, customerAccountId: record.customerAccountId ?? null,
          productId: null, amountMinor: received, currency: rail.currency, network: record.network, status,
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
