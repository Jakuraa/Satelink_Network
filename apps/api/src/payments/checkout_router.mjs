// Checkout API for console.satelink.network (2026-10-12 directive, Wave 1.8).
//   GET  /v1/payments/plans/trading-ai        public: plans + prices from config, merchant block
//   POST /v1/payments/checkout/intents        session: { planId, method } → on-chain invoice or hosted URL
//   GET  /v1/payments/checkout/intents/:ref   session, owner only: live status poll + entitlement
// The intro price (Launch $5) is decided SERVER-SIDE from the account's grant history —
// never from the client. Methods: usdt_polygon / usdc_base (onchain-native, live now),
// payram_usdt (flag), razorpay (test mode, INR unpriced until the founder sets it).
// Mutations reuse the console's CSRF guard (x-satelink-console header + trusted Origin).
import express from 'express';
import { randomUUID } from 'node:crypto';
import { csrfGuard, betterAuthSession } from '../console_accounts/router.mjs';
import { loadPlanCatalog, quote, effectivePlan } from './plans.mjs';
import { recordIntent } from './ingest.mjs';
import { minorToDecimal, PaymentError, isAdapterAvailable, sha256Hex } from './contract.mjs';
import { MERCHANT } from './merchant.mjs';
import { refundPolicyStatus } from './refund_policy.mjs';
import { verifyInvoiceTransfer } from './onchain_verify.mjs';
import { ingestCanonicalEvent } from './ingest.mjs';
import { INVOICE_RAILS, onchainConfig } from './adapters/onchain_native.mjs';

export const METHODS = Object.freeze({
  usdt_polygon: { adapter: 'onchain-native', currency: 'USDT', network: 'polygon' },
  usdc_base: { adapter: 'onchain-native', currency: 'USDC', network: 'base' },
  payram_usdt: { adapter: 'payram', currency: 'USD', network: 'tron', payCurrency: 'USDT' },
  transacty_upi: { adapter: 'transacty', currency: 'INR', network: null, payCurrency: 'USDT' },
  razorpay: { adapter: 'razorpay', currency: 'INR', network: null },
});

function publicPlans(catalog) {
  const price = (t) => t && Object.fromEntries(Object.entries(t).filter(([, v]) => v !== null).map(([c, v]) => [c, { amountMinor: String(v), display: minorToDecimal(BigInt(v), c) }]));
  return {
    version: catalog.version, status: catalog.status, periodDays: catalog.periodDays, graceDays: catalog.graceDays,
    note: catalog.status === 'draft' ? 'Prices are drafts pending founder confirmation; checkout runs in test mode only.' : null,
    plans: catalog.plans.map((p) => ({ id: p.id, name: p.name, price: price(p.price), introPrice: price(p.introPrice), renewsAs: p.renewsAs ?? null, limits: p.limits })),
    creditPacks: catalog.creditPacks.map((p) => ({ id: p.id, name: p.name, price: price(p.price) })),
    billing: { crypto: 'prepaid — each payment adds one period; reminders before expiry; never auto-charged', fiat: 'recurring via Razorpay when live' },
    merchant: MERCHANT,
  };
}

export function createPaymentsCheckoutRouter(pool, {
  adapters = {}, catalog = loadPlanCatalog(), resolveSession = (req) => betterAuthSession(pool, req),
  mode = 'test', logger = console, newRef = () => `inv_${randomUUID()}`,
  refundPolicy = () => refundPolicyStatus(),
  chainProvider = () => null, // (network) → ethers-shaped provider; mount.mjs supplies real RPCs
  env = process.env,
} = {}) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  router.get('/plans/trading-ai', (req, res) => res.json({ ok: true, data: publicPlans(catalog) }));

  // Merchant of record + live refund-policy state (the UI never assumes it is published).
  router.get('/merchant', async (req, res) => res.json({ ok: true, data: { merchant: MERCHANT, refundPolicy: await refundPolicy() } }));

  // Which payment methods this deployment offers (Razorpay only when its adapter is on).
  router.get('/checkout/methods', (req, res) => res.json({ ok: true, data: {
    testMode: mode !== 'live',
    methods: Object.entries(METHODS).filter(([, m]) => isAdapterAvailable(adapters[m.adapter])).map(([id, m]) => ({ id, adapter: m.adapter, currency: m.currency, network: m.network })),
  } }));

  const authed = express.Router();
  authed.use(express.json({ limit: '8kb' }));
  authed.use(csrfGuard);
  authed.use(async (req, res, next) => {
    try {
      const s = await resolveSession(req);
      if (!s) return res.status(401).json({ ok: false, error: 'sign_in_required' });
      req.account = s; return next();
    } catch (err) {
      logger.error?.('[payments-checkout] session error:', err.message);
      return res.status(503).json({ ok: false, error: 'accounts_unavailable' });
    }
  });

  // Invoice PREVIEW: the exact amount (intro price decided server-side) with no side effects —
  // no intent, no payment address. Shown even while the refund policy is unpublished.
  authed.post('/checkout/quote', async (req, res) => {
    try {
      const { planId, method } = req.body ?? {};
      const m = METHODS[method];
      if (!m || !isAdapterAvailable(adapters[m.adapter])) return res.status(400).json({ ok: false, error: 'unknown_method' });
      const prior = await pool.query(`SELECT 1 FROM payment_entitlement_grants WHERE customer_account_id = $1 AND product_id LIKE 'trading_ai_%' LIMIT 1`, [req.account.accountId]);
      const q = quote(catalog, planId, m.currency, { firstPeriod: prior.rowCount === 0, mode });
      return res.json({ ok: true, data: {
        planId, method, amount: { amountMinor: String(q.amountMinor), currency: m.currency, display: minorToDecimal(q.amountMinor, m.currency) },
        introApplied: prior.rowCount === 0 && q.amountMinor !== quote(catalog, planId, m.currency, { mode }).amountMinor,
        periodDays: q.periodDays, merchant: MERCHANT, refundPolicy: await refundPolicy(), testMode: mode !== 'live',
      } });
    } catch (err) {
      if (err instanceof PaymentError) return res.status(err.code === 'INVALID' ? 400 : 409).json({ ok: false, error: err.code.toLowerCase(), message: err.message });
      logger.error?.('[payments-checkout] quote failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  authed.post('/checkout/intents', async (req, res) => {
    try {
      // Checkout COMPLETION is blocked until the refund policy is a published page (any mode).
      const policy = await refundPolicy();
      if (!policy.completionAllowed) {
        return res.status(409).json({ ok: false, error: 'refund_policy_unpublished', message: 'Checkout cannot complete until the refund policy is published.', refundPolicy: policy });
      }
      const { planId, method } = req.body ?? {};
      const m = METHODS[method];
      if (!m) return res.status(400).json({ ok: false, error: 'unknown_method', methods: Object.keys(METHODS) });
      const adapter = adapters[m.adapter];
      if (!adapter) return res.status(409).json({ ok: false, error: 'method_unavailable', message: `${method} is not enabled` });
      if (!isAdapterAvailable(adapter)) {
        return res.status(409).json({ ok: false, error: 'method_unavailable', reason: adapter.capabilities().unavailableReason, message: `${method} is not available` });
      }
      const prior = await pool.query(
        `SELECT 1 FROM payment_entitlement_grants WHERE customer_account_id = $1 AND product_id LIKE 'trading_ai_%' LIMIT 1`,
        [req.account.accountId]);
      const q = quote(catalog, planId, m.currency, { firstPeriod: prior.rowCount === 0, mode });
      const canonicalRef = newRef();
      const created = adapter.createIntent
        ? await adapter.createIntent({ canonicalRef, amountMinor: q.amountMinor, currency: m.currency, network: m.network })
        : await adapter.createCheckout({ canonicalRef, customerAccountId: req.account.accountId, customerEmail: req.account.email, amountMinor: q.amountMinor, currency: m.currency, network: m.network, payCurrency: m.payCurrency });
      // intent currency = what the ledger will receive (PayRam settles USD-pegged USDT)
      const ledgerCurrency = m.payCurrency === 'USDT' ? 'USDT' : m.currency;
      const ledgerAmount = ledgerCurrency === m.currency ? q.amountMinor : q.amountMinor * 10_000n; // USD cents → USDT 6dp
      await recordIntent(pool, {
        canonicalRef, provider: m.adapter, providerPaymentId: created.providerPaymentId ?? null,
        customerAccountId: req.account.accountId, productId: planId, intentKind: q.intentKind,
        amountMinor: ledgerAmount, currency: ledgerCurrency, network: m.network, periodDays: q.periodDays,
        expiresAt: created.invoice?.expiresAt ?? null,
        metadata: { method, catalogVersion: q.catalogVersion, firstPeriod: prior.rowCount === 0, renewalPlanId: q.renewalPlanId },
      });
      return res.status(201).json({ ok: true, data: {
        canonicalRef, planId, method, amount: { amountMinor: String(q.amountMinor), currency: m.currency, display: minorToDecimal(q.amountMinor, m.currency) },
        introApplied: prior.rowCount === 0 && q.amountMinor !== quote(catalog, planId, m.currency, { mode }).amountMinor,
        invoice: created.invoice ?? null, checkoutUrl: created.checkoutUrl ?? null, upiId: created.upiId ?? null, statusUrl: `/v1/payments/checkout/intents/${canonicalRef}`,
        merchant: MERCHANT, testMode: mode !== 'live',
      } });
    } catch (err) {
      if (err instanceof PaymentError) {
        const http = { INVALID: 400, UNSUPPORTED: 409, DISABLED: 409, NOT_CONFIGURED: 409, GATEWAY: 502 }[err.code] ?? 400;
        return res.status(http).json({ ok: false, error: err.code.toLowerCase(), message: err.message });
      }
      logger.error?.('[payments-checkout] create failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  // The customer paid an on-chain invoice: submit the tx hash. The API re-reads the chain and
  // ingests what it finds (pending / partially_paid / succeeded / overpaid) — never the client's word.
  authed.post('/checkout/intents/:ref/onchain-tx', async (req, res) => {
    try {
      const policy = await refundPolicy();
      if (!policy.completionAllowed) return res.status(409).json({ ok: false, error: 'refund_policy_unpublished', refundPolicy: policy });
      const r = await pool.query(
        `SELECT canonical_ref, network, currency, status FROM payment_intents
          WHERE canonical_ref = $1 AND customer_account_id = $2 AND provider = 'onchain-native'`,
        [req.params.ref, req.account.accountId]);
      const intent = r.rows[0];
      if (!intent) return res.status(404).json({ ok: false, error: 'not_found' });
      const rail = INVOICE_RAILS[intent.network];
      const provider = chainProvider(intent.network);
      if (!rail || !provider) return res.status(409).json({ ok: false, error: 'chain_unavailable' });
      const cfg = onchainConfig(env);
      const v = await verifyInvoiceTransfer(provider, { txHash: String(req.body?.txHash ?? ''), token: rail.token, to: cfg.invoiceAddress ?? '' });
      if (!v.found) return res.status(422).json({ ok: false, error: v.reason });
      const event = await adapters['onchain-native'].normalizeEvent({
        kind: 'invoice_transfer', network: intent.network, txHash: String(req.body.txHash), amountRaw: v.amountRaw,
        confirmations: v.confirmations, blockTime: v.blockTime, canonicalRef: intent.canonical_ref, customerAccountId: req.account.accountId,
      });
      // a tx already used for ANOTHER invoice is refused (one payment settles one invoice)
      const used = await pool.query(`SELECT canonical_ref FROM payment_events WHERE provider_payment_id = $1 AND canonical_ref IS DISTINCT FROM $2 LIMIT 1`, [event.providerPaymentId, intent.canonical_ref]);
      if (used.rowCount) return res.status(409).json({ ok: false, error: 'tx_already_used' });
      const out = await ingestCanonicalEvent(pool, event);
      return res.json({ ok: true, data: { status: event.status, confirmations: v.confirmations, confirmationsRequired: cfg[rail.confKey], duplicate: out.duplicate } });
    } catch (err) {
      if (err instanceof PaymentError) return res.status(err.code === 'INVALID' ? 400 : 409).json({ ok: false, error: err.code.toLowerCase(), message: err.message });
      logger.error?.('[payments-checkout] onchain-tx failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  // Transacty India UPI: customer submits bank UTR after completing UPI transfer.
  authed.post('/checkout/intents/:ref/transacty-utr', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT canonical_ref, provider, provider_payment_id, status FROM payment_intents
          WHERE canonical_ref = $1 AND customer_account_id = $2 AND provider = 'transacty'`,
        [req.params.ref, req.account.accountId]);
      const intent = r.rows[0];
      if (!intent) return res.status(404).json({ ok: false, error: 'not_found' });
      const utr = String(req.body?.utr ?? '').trim();
      if (!/^[0-9A-Za-z]{6,35}$/.test(utr)) {
        return res.status(400).json({ ok: false, error: 'invalid_utr', message: 'A valid bank UTR reference number is required' });
      }
      const adapter = adapters['transacty'];
      if (!adapter) return res.status(409).json({ ok: false, error: 'adapter_unavailable' });
      const conf = await adapter.confirmUtr({ transactionId: intent.provider_payment_id, utr });
      return res.json({ ok: true, data: { status: 'pending', utr, confirmed: true, result: conf } });
    } catch (err) {
      if (err instanceof PaymentError) {
        return res.status(err.code === 'INVALID' ? 400 : 409).json({ ok: false, error: err.code.toLowerCase(), message: err.message });
      }
      logger.error?.('[payments-checkout] transacty-utr failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  async function resolveIntentStatus(ref, accountId) {
    const r = await pool.query(
      `SELECT canonical_ref, provider, provider_payment_id, product_id, status, amount_minor::text, currency, network, expires_at, created_at, updated_at
         FROM payment_intents WHERE canonical_ref = $1 AND customer_account_id = $2`,
      [ref, accountId]);
    if (!r.rows[0]) return null;
    let i = r.rows[0];

    // Status recovery: if webhook was delayed, actively query provider if getPayment is supported
    if (i.status === 'pending' && i.provider_payment_id && adapters[i.provider]?.getPayment) {
      try {
        const remote = await adapters[i.provider].getPayment(i.provider_payment_id);
        if (remote && remote.status && remote.status !== 'pending') {
          const event = {
            provider: i.provider,
            providerEventId: `recovery:${i.provider}:${i.provider_payment_id}:${remote.status}`,
            providerPaymentId: i.provider_payment_id,
            canonicalRef: i.canonical_ref,
            customerAccountId: accountId,
            productId: i.product_id,
            amountMinor: remote.amountMinor && remote.amountMinor > 0n ? remote.amountMinor : BigInt(i.amount_minor),
            currency: remote.currency ?? i.currency,
            network: i.network,
            status: remote.status,
            occurredAt: new Date(),
            raw_hash: sha256Hex(JSON.stringify(remote, (k, v) => (typeof v === 'bigint' ? v.toString() : v))),
          };
          await ingestCanonicalEvent(pool, event);
          const refreshed = await pool.query(
            `SELECT canonical_ref, provider, provider_payment_id, product_id, status, amount_minor::text, currency, network, expires_at, created_at, updated_at
               FROM payment_intents WHERE canonical_ref = $1`, [ref]);
          if (refreshed.rows[0]) i = refreshed.rows[0];
        }
      } catch (pollErr) {
        logger.warn?.(`[payments-checkout] status recovery poll failed for ${i.canonical_ref}: ${pollErr.message}`);
      }
    }

    const plan = await effectivePlan(pool, accountId, { catalog });
    return {
      canonicalRef: i.canonical_ref, planId: i.product_id, status: i.status, provider: i.provider,
      amount: { amountMinor: i.amount_minor, currency: i.currency, display: minorToDecimal(BigInt(i.amount_minor), i.currency) },
      network: i.network, expiresAt: i.expires_at, updatedAt: i.updated_at,
      entitlement: { planId: plan.plan.id, periodEnd: plan.periodEnd, inGrace: plan.inGrace },
      receiptReady: ['succeeded', 'overpaid'].includes(i.status), merchant: MERCHANT, refundPolicy: await refundPolicy(),
    };
  }

  authed.get('/checkout/intents/:ref', async (req, res) => {
    try {
      const data = await resolveIntentStatus(req.params.ref, req.account.accountId);
      if (!data) return res.status(404).json({ ok: false, error: 'not_found' });
      return res.json({ ok: true, data });
    } catch (err) {
      logger.error?.('[payments-checkout] status failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  authed.post('/checkout/intents/:ref/refresh', async (req, res) => {
    try {
      const data = await resolveIntentStatus(req.params.ref, req.account.accountId);
      if (!data) return res.status(404).json({ ok: false, error: 'not_found' });
      return res.json({ ok: true, data });
    } catch (err) {
      logger.error?.('[payments-checkout] refresh failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  router.use(authed);
  return router;
}
