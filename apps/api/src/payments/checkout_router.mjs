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
import { minorToDecimal, PaymentError } from './contract.mjs';
import { MERCHANT } from './merchant.mjs';

export const METHODS = Object.freeze({
  usdt_polygon: { adapter: 'onchain-native', currency: 'USDT', network: 'polygon' },
  usdc_base: { adapter: 'onchain-native', currency: 'USDC', network: 'base' },
  payram_usdt: { adapter: 'payram', currency: 'USD', network: 'tron', payCurrency: 'USDT' },
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
} = {}) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  router.get('/plans/trading-ai', (req, res) => res.json({ ok: true, data: publicPlans(catalog) }));

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

  authed.post('/checkout/intents', async (req, res) => {
    try {
      const { planId, method } = req.body ?? {};
      const m = METHODS[method];
      if (!m) return res.status(400).json({ ok: false, error: 'unknown_method', methods: Object.keys(METHODS) });
      const adapter = adapters[m.adapter];
      if (!adapter) return res.status(409).json({ ok: false, error: 'method_unavailable', message: `${method} is not enabled` });
      if (mode === 'live' && !MERCHANT.links.refundPolicy) return res.status(409).json({ ok: false, error: 'refund_policy_missing' });
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
        invoice: created.invoice ?? null, checkoutUrl: created.checkoutUrl ?? null, statusUrl: `/v1/payments/checkout/intents/${canonicalRef}`,
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

  authed.get('/checkout/intents/:ref', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT canonical_ref, product_id, status, amount_minor::text, currency, network, expires_at, created_at, updated_at
           FROM payment_intents WHERE canonical_ref = $1 AND customer_account_id = $2`,
        [req.params.ref, req.account.accountId]);
      if (!r.rows[0]) return res.status(404).json({ ok: false, error: 'not_found' }); // never reveals other accounts' refs
      const i = r.rows[0];
      const plan = await effectivePlan(pool, req.account.accountId, { catalog });
      return res.json({ ok: true, data: {
        canonicalRef: i.canonical_ref, planId: i.product_id, status: i.status,
        amount: { amountMinor: i.amount_minor, currency: i.currency, display: minorToDecimal(BigInt(i.amount_minor), i.currency) },
        network: i.network, expiresAt: i.expires_at, updatedAt: i.updated_at,
        entitlement: { planId: plan.plan.id, periodEnd: plan.periodEnd, inGrace: plan.inGrace },
        receiptReady: ['succeeded', 'overpaid'].includes(i.status), merchant: MERCHANT,
      } });
    } catch (err) {
      logger.error?.('[payments-checkout] status failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  });

  router.use(authed);
  return router;
}
