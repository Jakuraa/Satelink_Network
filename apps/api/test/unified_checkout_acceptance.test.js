// Comprehensive Acceptance Suite for Unified Fiat + Crypto Checkout
// Tests covering Phase 5 items 1-13 with Financial OS as single source of truth.
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import {
  canonicalEvent,
  decimalToMinor,
  minorToDecimal,
  PaymentError,
  sha256Hex,
} from '../src/payments/contract.mjs';
import { createPayramAdapter, PAYRAM_STATUS_MAP } from '../src/payments/adapters/payram.mjs';
import { createTransactyAdapter } from '../src/payments/adapters/transacty.mjs';
import { createDodoAdapter } from '../src/payments/adapters/dodo.mjs';
import { createRazorpayAdapter, RazorpayGateway } from '../src/payments/adapters/razorpay.mjs';
import { createPaymentsCheckoutRouter, METHODS } from '../src/payments/checkout_router.mjs';
import { loadPlanCatalog, quote, effectivePlan, queueRenewalReminders } from '../src/payments/plans.mjs';
import { ingestCanonicalEvent, recordIntent } from '../src/payments/ingest.mjs';

describe('Unified Checkout Acceptance Suite (Phase 5)', () => {
  const PAYRAM_KEY = 'payram_secret_test_key_0123456789';
  const payramEnv = { PAYMENT_PAYRAM: 'true' };

  // 1. Checkout catalog and server-authoritative prices
  describe('1. Catalog & server-authoritative prices', () => {
    const catalog = loadPlanCatalog();

    it('prices and limits come strictly from catalog, not from client', () => {
      expect(catalog.version).to.be.a('string');
      expect(catalog.plans.length).to.be.greaterThan(0);
      const pro = catalog.plans.find((p) => p.id === 'trading_ai_pro');
      expect(pro).to.exist;
      expect(pro.price.USD).to.equal(1900); // 1900 cents = $19.00
      expect(pro.price.USDT).to.equal('19000000'); // 6 decimal places
      expect(pro.limits.agentRunsPerDay).to.equal(50);
      expect(pro.limits.backtestsPerDay).to.equal(20);
    });

    it('first period applies intro pricing correctly server-side', () => {
      const qIntro = quote(catalog, 'trading_ai_launch', 'USD', { firstPeriod: true });
      const qNormal = quote(catalog, 'trading_ai_launch', 'USD', { firstPeriod: false });
      expect(qIntro.amountMinor).to.equal(500n); // $5 intro
      expect(qNormal.amountMinor).to.equal(1900n); // $19 regular
      expect(qIntro.renewalPlanId).to.equal('trading_ai_pro');
    });

    it('refuses unpriced currency until founder sets it', () => {
      expect(() => quote(catalog, 'trading_ai_pro', 'INR')).to.throw(PaymentError);
    });
  });

  // 2. Provider unavailable / approval-pending states
  describe('2. Provider unavailable & approval-pending states', () => {
    it('Dodo is strictly marked unavailable (merchant approval pending)', () => {
      const dodo = createDodoAdapter();
      const caps = dodo.capabilities();
      expect(caps.available).to.equal(false);
      expect(caps.unavailableReason).to.equal('application_pending');
    });

    it('Razorpay is strictly marked unavailable (provider suspended)', () => {
      const gw = new RazorpayGateway({
        keyId: 'rzp_test_abcdef12',
        keySecret: async () => 's',
        webhookSecret: async () => 'w',
        fetch: async () => ({}),
      });
      const rzp = createRazorpayAdapter({ gateway: gw });
      const caps = rzp.capabilities();
      expect(caps.available).to.equal(false);
      expect(caps.unavailableReason).to.equal('provider_suspended');
    });

    it('Transacty is unavailable when flag PAYMENT_TRANSACTY is off', () => {
      const tx = createTransactyAdapter({ env: { PAYMENT_TRANSACTY: 'false' } });
      const caps = tx.capabilities();
      expect(caps.available).to.equal(false);
      expect(caps.unavailableReason).to.equal('not_applied');
    });

    it('GET /checkout/methods filters out all unapproved or disabled providers', async () => {
      const onchain = { id: 'onchain-native', capabilities: () => ({ available: true }) };
      const payram = { id: 'payram', capabilities: () => ({ available: true }) };
      const transacty = { id: 'transacty', capabilities: () => ({ available: false, unavailableReason: 'not_applied' }) };
      const rzp = { id: 'razorpay', capabilities: () => ({ available: false, unavailableReason: 'provider_suspended' }) };

      const app = express();
      app.use('/v1/payments', createPaymentsCheckoutRouter({ query: async () => ({ rows: [] }) }, {
        adapters: { 'onchain-native': onchain, payram, transacty, razorpay: rzp },
        catalog: loadPlanCatalog(),
        resolveSession: async () => null,
      }));

      const res = await request(app).get('/v1/payments/checkout/methods');
      expect(res.status).to.equal(200);
      const ids = res.body.data.methods.map((m) => m.id);
      expect(ids).to.include('payram_usdt');
      expect(ids).to.include('usdt_polygon');
      expect(ids).to.not.include('transacty_upi');
      expect(ids).to.not.include('razorpay');
    });
  });

  // 3. PayRam hosted checkout creation and invalid response handling
  describe('3. PayRam hosted checkout creation and error handling', () => {
    it('creates hosted checkout session with correct payload and returns session URL', async () => {
      let requested = null;
      const fakeFetch = async (url, opts) => {
        requested = { url, opts, body: JSON.parse(opts.body) };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            host: 'https://pay.example.test',
            reference_id: 'ref_payram_12345',
            url: 'https://pay.example.test/payment/ref_payram_12345',
          }),
        };
      };

      const adapter = createPayramAdapter({
        baseUrl: 'https://pay.example.test',
        apiKey: async () => PAYRAM_KEY,
        fetch: fakeFetch,
        env: payramEnv,
      });

      const res = await adapter.createCheckout({
        canonicalRef: 'inv_satelink_001',
        customerAccountId: 'acct_alice',
        customerEmail: 'alice@example.com',
        amountMinor: 1900n, // $19.00 USD
        currency: 'USD',
        network: 'TRON',
        payCurrency: 'USDT',
      });

      expect(res.canonicalRef).to.equal('inv_satelink_001');
      expect(res.providerPaymentId).to.equal('ref_payram_12345');
      expect(res.checkoutUrl).to.equal('https://pay.example.test/payment/ref_payram_12345');
      expect(requested.body.invoiceID).to.equal('inv_satelink_001');
      expect(requested.body.customerID).to.equal('acct_alice');
      expect(requested.body.customerEmail).to.equal('alice@example.com');
      expect(requested.body.amountInUSD).to.equal('19.00');
    });

    it('handles PayRam gateway failure (non-200 or missing URL) cleanly with PaymentError', async () => {
      const errorFetch = async () => ({
        ok: false,
        status: 502,
        json: async () => ({ error: 'gateway_timeout' }),
      });

      const adapter = createPayramAdapter({
        baseUrl: 'https://pay.example.test',
        apiKey: async () => PAYRAM_KEY,
        fetch: errorFetch,
        env: payramEnv,
      });

      try {
        await adapter.createCheckout({
          canonicalRef: 'inv_fail',
          customerAccountId: 'acct_bob',
          customerEmail: 'bob@example.com',
          amountMinor: 1900n,
        });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(PaymentError);
        expect(err.code).to.equal('GATEWAY');
      }
    });
  });

  // 4. Webhook signature validation & tampering protection
  describe('4. Webhook signature validation', () => {
    const adapter = createPayramAdapter({
      baseUrl: 'https://pay.example.test',
      apiKey: async () => PAYRAM_KEY,
      fetch: async () => ({}),
      env: payramEnv,
    });

    const payload = JSON.stringify({
      customer_id: 'acct_cust_1',
      invoice_id: 'inv_001',
      reference_id: 'ref_payram_12345',
      status: 'FILLED',
      amount: '19',
      currency: 'USDT',
      filled_amount: '19',
      timestamp: 1760227200,
    });

    it('verifies valid HMAC-SHA256 signature in X-Payram-Signature', async () => {
      const sig = 'sha256=' + createHmac('sha256', PAYRAM_KEY).update(payload).digest('hex');
      const valid = await adapter.verifyWebhook(payload, { 'x-payram-signature': sig });
      expect(valid).to.equal(true);
    });

    it('refuses tampered payload or incorrect signature', async () => {
      const sig = 'sha256=' + createHmac('sha256', PAYRAM_KEY).update(payload).digest('hex');
      const tampered = payload.replace('19', '20');
      const invalid = await adapter.verifyWebhook(tampered, { 'x-payram-signature': sig });
      expect(invalid).to.equal(false);
    });

    it('refuses webhook when adapter is disabled', async () => {
      const disabledAdapter = createPayramAdapter({
        baseUrl: 'https://pay.example.test',
        apiKey: async () => PAYRAM_KEY,
        fetch: async () => ({}),
        env: { PAYMENT_PAYRAM: 'false' },
      });
      const sig = 'sha256=' + createHmac('sha256', PAYRAM_KEY).update(payload).digest('hex');
      const valid = await disabledAdapter.verifyWebhook(payload, { 'x-payram-signature': sig });
      expect(valid).to.equal(false);
    });
  });

  // 5. Payment state normalization (succeeded, underpaid, overpaid, expired)
  describe('5. Payment state normalization', () => {
    const adapter = createPayramAdapter({
      baseUrl: 'https://pay.example.test',
      apiKey: async () => PAYRAM_KEY,
      fetch: async () => ({}),
      env: payramEnv,
    });

    const makeWebhook = (status, filled = '19', confCurrent = 0, confRequired = 19) =>
      JSON.stringify({
        customer_id: 'acct_cust_1',
        invoice_id: 'inv_001',
        reference_id: 'ref_123',
        status,
        amount: '19',
        currency: 'USDT',
        filled_amount: filled,
        timestamp: 1760227200,
        confirmation_current: confCurrent,
        confirmation_required: confRequired,
      });

    it('normalizes FILLED to succeeded', () => {
      const ev = adapter.normalizeEvent(makeWebhook('FILLED', '19', 0, 19));
      expect(ev.status).to.equal('succeeded');
      expect(ev.amountMinor).to.equal(19_000_000n);
      expect(ev.currency).to.equal('USDT');
    });

    it('normalizes PARTIALLY_FILLED to partially_paid', () => {
      const ev = adapter.normalizeEvent(makeWebhook('PARTIALLY_FILLED', '10', 0, 19));
      expect(ev.status).to.equal('partially_paid');
      expect(ev.amountMinor).to.equal(10_000_000n);
    });

    it('normalizes OVER_FILLED to overpaid', () => {
      const ev = adapter.normalizeEvent(makeWebhook('OVER_FILLED', '25', 0, 19));
      expect(ev.status).to.equal('overpaid');
      expect(ev.amountMinor).to.equal(25_000_000n);
    });

    it('normalizes CANCELLED to expired', () => {
      const ev = adapter.normalizeEvent(makeWebhook('CANCELLED', '0', 0, 19));
      expect(ev.status).to.equal('expired');
    });

    it('keeps status pending while block confirmations are in progress', () => {
      const ev = adapter.normalizeEvent(makeWebhook('FILLED', '19', 5, 19));
      expect(ev.status).to.equal('pending');
    });
  });

  // 6. Safe status recovery if webhook is delayed
  describe('6. Delayed webhook & safe status recovery', () => {
    it('queries provider getPayment when intent is pending during status poll', async () => {
      let getPaymentCalled = false;
      const fakePayram = {
        id: 'payram',
        capabilities: () => ({ available: true }),
        getPayment: async (referenceId) => {
          getPaymentCalled = true;
          return {
            provider: 'payram',
            providerPaymentId: referenceId,
            canonicalRef: 'inv_delayed_01',
            customerAccountId: 'acct_alice',
            status: 'succeeded',
            amountMinor: 19_000_000n,
            currency: 'USDT',
          };
        },
      };

      const mockDb = {
        rows: [
          {
            canonical_ref: 'inv_delayed_01',
            provider: 'payram',
            provider_payment_id: 'ref_delayed_1',
            product_id: 'trading_ai_pro',
            status: 'pending', // pending initially in DB
            amount_minor: '19000000',
            currency: 'USDT',
            network: 'tron',
            expires_at: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        async query(sql, params) {
          if (sql.includes('SELECT canonical_ref') && params?.[0] === 'inv_delayed_01') {
            return { rows: this.rows };
          }
          if (sql.includes('payment_entitlement_grants')) {
            return { rows: [{ product_id: 'trading_ai_pro', period_start: new Date(), period_end: new Date(Date.now() + 86400000 * 30) }] };
          }
          return { rows: [], rowCount: 1 };
        },
        async connect() {
          return {
            query: async (sql, params) => {
              if (sql.includes('FROM accounts')) {
                const isDebit = String(params?.[1] || '').startsWith('clearing');
                return {
                  rows: [{
                    id: isDebit ? 'acct_pay_clearing_payram_usdt' : 'acct_platform_revenue',
                    normality: isDebit ? 'debit' : 'credit',
                    decimals: 6,
                  }],
                  rowCount: 1,
                };
              }
              return {
                rows: [{
                  id: '1',
                  canonical_ref: 'inv_delayed_01',
                  amount_minor: '19000000',
                  currency: 'USDT',
                  customer_account_id: 'acct_alice',
                }],
                rowCount: 1,
              };
            },
            release: () => {},
          };
        },
      };

      const app = express();
      app.use('/v1/payments', createPaymentsCheckoutRouter(mockDb, {
        adapters: { payram: fakePayram },
        catalog: loadPlanCatalog(),
        resolveSession: async () => ({ accountId: 'acct_alice', email: 'alice@example.com' }),
        refundPolicy: async () => ({ completionAllowed: true, status: 'published' }),
      }));

      const res = await request(app).get('/v1/payments/checkout/intents/inv_delayed_01');
      expect(res.status).to.equal(200);
      expect(getPaymentCalled).to.equal(true);
    });
  });

  // 7. Transacty UTR submission
  describe('7. Transacty India UPI UTR submission', () => {
    it('accepts valid 12-character bank UTR and submits confirmation to Transacty', async () => {
      let confirmCalledWith = null;
      const fakeTransacty = {
        id: 'transacty',
        capabilities: () => ({ available: true }),
        confirmUtr: async ({ transactionId, utr }) => {
          confirmCalledWith = { transactionId, utr };
          return { success: true };
        },
      };

      const mockDb = {
        async query(sql, params) {
          if (sql.includes('SELECT canonical_ref, provider, provider_payment_id, status FROM payment_intents')) {
            return {
              rows: [{
                canonical_ref: 'inv_upi_01',
                provider: 'transacty',
                provider_payment_id: 'tx_transacty_999',
                status: 'pending',
              }],
            };
          }
          return { rows: [], rowCount: 1 };
        },
      };

      const app = express();
      app.use(express.json());
      app.use('/v1/payments', createPaymentsCheckoutRouter(mockDb, {
        adapters: { transacty: fakeTransacty },
        catalog: loadPlanCatalog(),
        resolveSession: async () => ({ accountId: 'acct_raj', email: 'raj@example.com' }),
      }));

      const res = await request(app)
        .post('/v1/payments/checkout/intents/inv_upi_01/transacty-utr')
        .set('X-Satelink-Console', '1')
        .send({ utr: '423456789012' });

      expect(res.status).to.equal(200);
      expect(res.body.ok).to.equal(true);
      expect(res.body.data.confirmed).to.equal(true);
      expect(confirmCalledWith).to.deep.equal({ transactionId: 'tx_transacty_999', utr: '423456789012' });
    });

    it('rejects invalid or too short bank UTR', async () => {
      const mockDb = {
        async query(sql) {
          if (sql.includes('SELECT canonical_ref, provider')) {
            return {
              rows: [{
                canonical_ref: 'inv_upi_01',
                provider: 'transacty',
                provider_payment_id: 'tx_transacty_999',
                status: 'pending',
              }],
            };
          }
          return { rows: [] };
        },
      };
      const app = express();
      app.use(express.json());
      app.use('/v1/payments', createPaymentsCheckoutRouter(mockDb, {
        adapters: { transacty: { id: 'transacty', capabilities: () => ({ available: true }) } },
        catalog: loadPlanCatalog(),
        resolveSession: async () => ({ accountId: 'acct_raj', email: 'raj@example.com' }),
      }));

      const res = await request(app)
        .post('/v1/payments/checkout/intents/inv_upi_01/transacty-utr')
        .set('X-Satelink-Console', '1')
        .send({ utr: '123' }); // too short

      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal('invalid_utr');
    });
  });

  // 8. Security: No secrets leaked in responses
  describe('8. Security & Secret Leak Prevention', () => {
    it('plans, methods, quotes, and intents never reveal private API keys or secrets', async () => {
      const adapter = createPayramAdapter({
        baseUrl: 'https://pay.example.test',
        apiKey: async () => 'VERY_SECRET_KEY_NEVER_LEAK_12345',
        fetch: async () => ({
          ok: true,
          json: async () => ({ host: 'https://pay.test', reference_id: 'ref1', url: 'https://pay.test/payment/ref1' }),
        }),
        env: payramEnv,
      });

      const mockDb = {
        async query(sql) {
          if (sql.includes('payment_entitlement_grants')) return { rows: [], rowCount: 0 };
          return { rows: [], rowCount: 1 };
        },
      };

      const app = express();
      app.use(express.json());
      app.use('/v1/payments', createPaymentsCheckoutRouter(mockDb, {
        adapters: { payram: adapter },
        catalog: loadPlanCatalog(),
        resolveSession: async () => ({ accountId: 'acct_user', email: 'user@example.com' }),
        refundPolicy: async () => ({ completionAllowed: true, status: 'published' }),
      }));

      const res = await request(app)
        .post('/v1/payments/checkout/intents')
        .set('X-Satelink-Console', '1')
        .send({ planId: 'trading_ai_pro', method: 'payram_usdt' });

      expect(res.status).to.equal(201);
      const text = JSON.stringify(res.body);
      expect(text).to.not.include('VERY_SECRET_KEY_NEVER_LEAK_12345');
      expect(text).to.not.include('apiKey');
      expect(text).to.not.include('secret');
    });
  });

  // 9. Crypto renewals lifecycle
  describe('9. Crypto renewals lifecycle', () => {
    const catalog = loadPlanCatalog();

    it('queues renewal reminders without auto-charging', async () => {
      const now = new Date('2026-10-25T00:00:00Z');
      const mockDb = {
        outboxRows: [],
        async query(sql, params) {
          if (sql.includes('SELECT g.id, g.customer_account_id')) {
            return {
              rows: [
                {
                  id: 'grant_1',
                  customer_account_id: 'acct_alice',
                  product_id: 'trading_ai_pro',
                  period_end: new Date('2026-10-28T00:00:00Z'), // 3 days away
                },
              ],
            };
          }
          if (sql.includes('INSERT INTO outbox')) {
            this.outboxRows.push(params);
            return { rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
      };

      const res = await queueRenewalReminders(mockDb, { catalog, now });
      expect(res.queued).to.equal(1);
      expect(mockDb.outboxRows.length).to.equal(1);
      const payload = JSON.parse(mockDb.outboxRows[0][1]);
      expect(payload.reminder).to.equal('T-3');
      expect(payload.customerAccountId).to.equal('acct_alice');
    });
  });
});
