// Payments contract + adapters (2026-10-12 directive, Wave 1.2–1.6). Pure unit
// tests — no DB, no network. Real-Postgres ingestion tests live in
// database/__tests__/payments_ingest.integration.test.ts.
import { expect } from 'chai';
import { createHmac } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { ethers } from 'ethers';
import {
  canonicalEvent, assertAdapter, decimalToMinor, minorToDecimal, PaymentError, sha256Hex, PAYMENT_STATUSES,
} from '../src/payments/contract.mjs';
import { createPayramAdapter, PAYRAM_STATUS_MAP } from '../src/payments/adapters/payram.mjs';
import { createOnchainNativeAdapter, baseUnitsToUsdtString } from '../src/payments/adapters/onchain_native.mjs';
import { createRazorpayAdapter } from '../src/payments/adapters/razorpay.mjs';
import { createDodoAdapter } from '../src/payments/adapters/dodo.mjs';
import { createCashfreeAdapter } from '../src/payments/adapters/cashfree.mjs';
import { createPaymentWebhookRouter } from '../src/payments/webhook_router.mjs';
import { RazorpayGateway } from '../src/trading_agent/billing/razorpay.mjs';

const PAYRAM_KEY = 'payram_test_key_0123456789';
const payramOn = { PAYMENT_PAYRAM: 'true' };
const payram = (env = payramOn, fetch = async () => { throw new Error('no network in tests'); }) =>
  createPayramAdapter({ baseUrl: 'https://pay.example.test', apiKey: async () => PAYRAM_KEY, fetch, env });

// Recorded fixture: shape copied from docs.payram.com/api-integration/payments-api/webhook.md
const payramFixture = (over = {}) => JSON.stringify({
  customer_id: 'acct_cust_1', invoice_id: 'inv_001', reference_id: 'c80f5363-0397-4761-aa1a-3155c3a21470',
  status: 'FILLED', amount: '19', currency: 'USDT', filled_amount: '19', filled_amount_in_usd: '19',
  sponsored_amount: '0', sponsored_amount_in_usd: '0', timestamp: 1760227200,
  payment_info: [{ source_address: 'TXyz', transaction_hash: 'abc', destination_address: 'TAbc', block_number: 1 }],
  confirmation_current: 0, confirmation_required: 19, ...over,
});
const sign = (raw, key = PAYRAM_KEY) => `sha256=${createHmac('sha256', key).update(raw).digest('hex')}`;

describe('payments contract', () => {
  it('decimalToMinor is exact and refuses excess precision (never rounds money)', () => {
    expect(decimalToMinor('19', 'USDT')).to.equal(19_000_000n);
    expect(decimalToMinor('0.000030', 'USDT')).to.equal(30n);
    expect(decimalToMinor('10.50', 'INR')).to.equal(1050n);
    expect(() => decimalToMinor('0.0000001', 'USDT')).to.throw(PaymentError);
    expect(() => decimalToMinor('-1', 'USDT')).to.throw(PaymentError);
    expect(() => decimalToMinor('1', 'BTC')).to.throw(/unsupported currency/);
    expect(minorToDecimal(1050n, 'INR')).to.equal('10.50');
    expect(minorToDecimal(30n, 'USDT')).to.equal('0.000030');
  });

  it('canonicalEvent refuses malformed events instead of guessing', () => {
    const ok = { provider: 'p', providerEventId: 'e', providerPaymentId: 'x', amountMinor: 1n, currency: 'USDT', status: 'succeeded', occurredAt: new Date(), raw_hash: sha256Hex('x') };
    expect(canonicalEvent(ok).status).to.equal('succeeded');
    expect(() => canonicalEvent({ ...ok, amountMinor: 1.5 })).to.throw(/BigInt/);
    expect(() => canonicalEvent({ ...ok, status: 'paid' })).to.throw(/unknown status/);
    expect(() => canonicalEvent({ ...ok, currency: 'DOGE' })).to.throw(/unsupported currency/);
    expect(() => canonicalEvent({ ...ok, providerPaymentId: null })).to.throw(/canonicalRef or providerPaymentId/);
    expect(PAYMENT_STATUSES).to.have.members(['pending', 'succeeded', 'failed', 'expired', 'refunded', 'disputed', 'partially_paid', 'overpaid', 'dispute_open', 'dispute_won']);
  });

  it('every adapter satisfies the contract', () => {
    const gw = new RazorpayGateway({ keyId: 'rzp_test_abcdef12', keySecret: async () => 's', webhookSecret: async () => 'w', fetch: async () => ({}) });
    for (const a of [payram(), createOnchainNativeAdapter(), createRazorpayAdapter({ gateway: gw }), createDodoAdapter({ secret: () => 'whsec_dGVzdA==' }), createCashfreeAdapter()]) {
      expect(() => assertAdapter(a), a.id).not.to.throw();
    }
    expect(() => assertAdapter({ id: 'x', capabilities: () => ({}) })).to.throw(/lacks/);
  });
});

describe('payram adapter (flag PAYMENT_PAYRAM, recorded fixtures)', () => {
  it('verifies X-Payram-Signature HMAC-SHA256 of the raw body; rejects tampering, bad format, flag off', async () => {
    const raw = payramFixture();
    const a = payram();
    expect(await a.verifyWebhook(raw, { 'x-payram-signature': sign(raw) })).to.equal(true);
    expect(await a.verifyWebhook(raw.replace('"19"', '"190"'), { 'x-payram-signature': sign(raw) })).to.equal(false);
    expect(await a.verifyWebhook(raw, { 'x-payram-signature': sign(raw, 'other-key') })).to.equal(false);
    expect(await a.verifyWebhook(raw, { 'x-payram-signature': sign(raw).replace('sha256=', '') })).to.equal(false);
    expect(await a.verifyWebhook(raw, {})).to.equal(false);
    expect(await payram({}).verifyWebhook(raw, { 'x-payram-signature': sign(raw) })).to.equal(false);
  });

  it('maps every PayRam status (Part A table)', () => {
    expect(PAYRAM_STATUS_MAP).to.deep.equal({ OPEN: 'pending', PARTIALLY_FILLED: 'partially_paid', FILLED: 'succeeded', OVER_FILLED: 'overpaid', CANCELLED: 'expired' });
    const a = payram();
    expect(a.normalizeEvent(payramFixture({ status: 'PARTIALLY_FILLED', filled_amount: '5' })).status).to.equal('partially_paid');
    expect(a.normalizeEvent(payramFixture({ status: 'OVER_FILLED', filled_amount: '25' })).amountMinor).to.equal(25_000_000n);
    expect(a.normalizeEvent(payramFixture({ status: 'OPEN', filled_amount: null })).amountMinor).to.equal(0n);
    expect(() => a.normalizeEvent(payramFixture({ status: 'PAID' }))).to.throw(/unknown status/);
  });

  it('event id = reference_id + status + filled_amount: retries collapse, real state changes do not', () => {
    const a = payram();
    const e1 = a.normalizeEvent(payramFixture());
    const e2 = a.normalizeEvent(payramFixture());
    const e3 = a.normalizeEvent(payramFixture({ status: 'OVER_FILLED', filled_amount: '20' }));
    expect(e1.providerEventId).to.equal(e2.providerEventId);
    expect(e3.providerEventId).not.to.equal(e1.providerEventId);
    expect(e1).to.include({ provider: 'payram', canonicalRef: 'inv_001', customerAccountId: 'acct_cust_1', currency: 'USDT', status: 'succeeded' });
    expect(() => canonicalEvent(e1)).not.to.throw();
  });

  it('a FILLED delivery still gathering confirmations is pending, never settled', () => {
    expect(payram().normalizeEvent(payramFixture({ confirmation_current: 3, confirmation_required: 19 })).status).to.equal('pending');
  });

  it('createCheckout posts the documented body with API-Key and returns the hosted url', async () => {
    let seen;
    const fetch = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ host: 'h', reference_id: 'ref_1', url: 'https://pay.example.test/payments?reference_id=ref_1' }) }; };
    const r = await payram(payramOn, fetch).createCheckout({ canonicalRef: 'inv_9', customerAccountId: 'c1', customerEmail: 'c@example.test', amountMinor: 1900n, currency: 'USD', network: 'tron', payCurrency: 'USDT' });
    expect(seen.url).to.equal('https://pay.example.test/api/v1/payment');
    expect(seen.init.headers['API-Key']).to.equal(PAYRAM_KEY);
    expect(JSON.parse(seen.init.body)).to.deep.equal({ customerEmail: 'c@example.test', customerID: 'c1', amountInUSD: '19.00', invoiceID: 'inv_9', currency: 'USDT', network: 'TRON' });
    expect(r).to.deep.equal({ canonicalRef: 'inv_9', providerPaymentId: 'ref_1', checkoutUrl: 'https://pay.example.test/payments?reference_id=ref_1' });
  });

  it('refuses to call PayRam while the flag is off', async () => {
    try { await payram({}).createCheckout({ canonicalRef: 'x', customerAccountId: 'c', amountMinor: 1n }); expect.fail('should throw'); }
    catch (e) { expect(e.code).to.equal('DISABLED'); }
  });
});

describe('onchain-native adapter (existing vault + x402 rails)', () => {
  const lookup = (amounts) => async (ref) => amounts[ref] ?? null;
  const tx = '0x' + 'ab'.repeat(32);

  it('underpay → partially_paid, exact → succeeded, overpay → overpaid, unconfirmed → pending', async () => {
    const a = createOnchainNativeAdapter({ env: {}, lookupIntentAmount: lookup({ inv: '19000000' }) });
    const rec = (amountRaw, confirmations = 30) => ({ kind: 'polygon_vault', txHash: tx, logIndex: 1, from: '0xA', amountRaw, confirmations, canonicalRef: 'inv' });
    expect((await a.normalizeEvent(rec('5000000'))).status).to.equal('partially_paid');
    expect((await a.normalizeEvent(rec('19000000'))).status).to.equal('succeeded');
    expect((await a.normalizeEvent(rec('25000000'))).status).to.equal('overpaid');
    expect((await a.normalizeEvent(rec('19000000', 3))).status).to.equal('pending');
  });

  it('confirmation threshold comes from config (defaults to the listener\'s 25)', async () => {
    const strict = createOnchainNativeAdapter({ env: { PAYMENTS_ONCHAIN_POLYGON_CONFIRMATIONS: '64' } });
    expect((await strict.normalizeEvent({ kind: 'polygon_vault', txHash: tx, amountRaw: '1', confirmations: 30 })).status).to.equal('pending');
    expect((await createOnchainNativeAdapter({ env: {} }).normalizeEvent({ kind: 'polygon_vault', txHash: tx, amountRaw: '1', confirmations: 25 })).status).to.equal('succeeded');
  });

  it('x402 accepts Base mainnet only; never a webhook', async () => {
    const a = createOnchainNativeAdapter({ env: {} });
    const e = await a.normalizeEvent({ kind: 'x402', txHash: tx, network: 'eip155:8453', payer: '0xB', amountAtomic: '100000' });
    expect(e).to.include({ currency: 'USDC', network: 'base', status: 'succeeded' });
    try { await a.normalizeEvent({ kind: 'x402', txHash: tx, network: 'eip155:84532', amountAtomic: '1' }); expect.fail('should throw'); } catch (err) { expect(err.code).to.equal('INVALID'); }
    expect(await a.verifyWebhook('{}', {})).to.equal(false);
  });

  it('contract test on the CURRENT deposit path: exact conversion == listener parseFloat(formatUnits) for 6-dp amounts', () => {
    for (const raw of ['1', '30', '1000000', '19000000', '123456789', '5000000000000', '999999999999']) {
      expect(Number(baseUnitsToUsdtString(raw))).to.equal(parseFloat(ethers.formatUnits(BigInt(raw), 6)));
    }
  });

  it('invoice = exact-amount ERC-20 transfer to the DEDICATED invoice address (never vault/treasury); EIP-681 QR data', async () => {
    const INV = '0x' + '5a'.repeat(20);
    const a = createOnchainNativeAdapter({ env: { PAYMENTS_ONCHAIN_INVOICE_ADDRESS: INV, VAULT_ADDRESS: '0x577D3716d6Ad5b676d230f5409deF9838FABaCEF' } });
    const { invoice } = await a.createIntent({ canonicalRef: 'inv', amountMinor: 19_000_000n, currency: 'USDT', network: 'polygon', now: new Date(0) });
    expect(invoice).to.include({ rail: 'erc20_transfer', chainId: 137, payTo: INV, amountMinor: '19000000', amountDisplay: '19.000000', confirmationsRequired: 25 });
    expect(invoice.uri).to.equal(`ethereum:0xc2132D05D31c914a87C6611C10748AEb04B58e8F@137/transfer?address=${INV}&uint256=19000000`);
    const base = await a.createIntent({ canonicalRef: 'inv2', amountMinor: 5_000_000n, currency: 'USDC', network: 'base' });
    expect(base.invoice).to.include({ chainId: 8453, token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', confirmationsRequired: 10 });
    const refuse = async (env) => { try { await createOnchainNativeAdapter({ env }).createIntent({ canonicalRef: 'x', amountMinor: 1n, currency: 'USDT', network: 'polygon' }); return null; } catch (e) { return e.code; } };
    expect(await refuse({})).to.equal('NOT_CONFIGURED');
    expect(await refuse({ PAYMENTS_ONCHAIN_INVOICE_ADDRESS: '0x966E1Ae22996545015b1414B35234b10719d7Ad4' })).to.equal('NOT_CONFIGURED');
    expect(await refuse({ PAYMENTS_ONCHAIN_INVOICE_ADDRESS: '0x577D3716d6Ad5b676d230f5409deF9838FABaCEF', VAULT_ADDRESS: '0x577D3716d6Ad5b676d230f5409deF9838FABaCEF' })).to.equal('NOT_CONFIGURED');
  });
});

describe('razorpay adapter (Stage 27 gateway, test mode only)', () => {
  const secret = 'whsec_rzp_test';
  const gw = new RazorpayGateway({ keyId: 'rzp_test_abcdef12', keySecret: async () => 's', webhookSecret: async () => secret, fetch: async () => ({}) });
  const a = createRazorpayAdapter({ gateway: gw });
  const body = (event, extra = {}) => JSON.stringify({ event, created_at: 1760227200, payload: { payment: { entity: { id: 'pay_1', amount: 159900, currency: 'INR', status: 'captured', notes: { satelink_ref: 'inv_r1', satelink_principal: 'acct_c' } } }, ...extra } });

  it('live keys are still refused', () => {
    expect(() => createRazorpayAdapter({ keyId: 'rzp_live_abcdef12', keySecret: async () => 's', webhookSecret: async () => 'w', fetch: async () => ({}) })).to.throw(/live/);
  });

  it('verifies X-Razorpay-Signature over the raw body', async () => {
    const raw = body('payment.captured');
    const sig = createHmac('sha256', secret).update(raw).digest('hex');
    expect(await a.verifyWebhook(raw, { 'x-razorpay-signature': sig })).to.equal(true);
    expect(await a.verifyWebhook(raw + ' ', { 'x-razorpay-signature': sig })).to.equal(false);
  });

  it('normalises captured / failed / refund / dispute; ignores unrelated events', () => {
    const h = { 'x-razorpay-event-id': 'evt_1' };
    expect(a.normalizeEvent(body('payment.captured'), h)).to.include({ status: 'succeeded', amountMinor: 159900n, currency: 'INR', canonicalRef: 'inv_r1', customerAccountId: 'acct_c' });
    expect(a.normalizeEvent(body('payment.failed'), h).status).to.equal('failed');
    expect(a.normalizeEvent(body('refund.processed', { refund: { entity: { amount: 50000, currency: 'INR', payment_id: 'pay_1' } } }), h)).to.include({ status: 'refunded', amountMinor: 50000n });
    const dispute = { dispute: { entity: { amount: 159900, currency: 'INR', payment_id: 'pay_1' } } };
    // review fix: an OPENED dispute is inert; only a LOST dispute reverses revenue
    expect(a.normalizeEvent(body('payment.dispute.created', dispute), h).status).to.equal('dispute_open');
    expect(a.normalizeEvent(body('payment.dispute.won', dispute), h).status).to.equal('dispute_won');
    expect(a.normalizeEvent(body('payment.dispute.lost', dispute), h).status).to.equal('disputed');
    expect(a.normalizeEvent(body('order.paid'), h)).to.equal(null);
    expect(() => a.normalizeEvent(body('payment.captured'), {})).to.throw(/event-id/);
  });
});

describe('cashfree adapter is a capability stub', () => {
  it('declares capabilities but refuses every operation', async () => {
    const a = createCashfreeAdapter();
    expect(a.capabilities()).to.include({ requiresKyb: true, hostedCheckout: true });
    expect(await a.verifyWebhook('{}', {})).to.equal(false);
    try { await a.createCheckout({}); expect.fail('should throw'); } catch (e) { expect(e.code).to.equal('NOT_CONFIGURED'); }
  });
});

describe('POST /webhooks/:provider', () => {
  const app = (ingest) => {
    const a = express();
    a.use('/webhooks', createPaymentWebhookRouter({}, { adapters: [payram()], ingest, logger: { warn() {}, error() {} }, limiter: (req, res, next) => next() }));
    return a;
  };

  it('bad signature → 401 and nothing is ingested', async () => {
    let called = 0;
    const realIngest = (await import('../src/payments/ingest.mjs')).ingestWebhook;
    const res = await request(app(async (...args) => { called++; return realIngest(...args); }))
      .post('/webhooks/payram').set('Content-Type', 'application/json').set('X-Payram-Signature', 'sha256=' + '0'.repeat(64)).send(payramFixture());
    expect(res.status).to.equal(401);
    expect(called).to.equal(1); // reached ingestWebhook, which refused before any DB call (pool is {})
  });

  it('unknown provider → 404; empty body → 400; ingest crash → 500 (provider retries)', async () => {
    expect((await request(app(async () => ({}))).post('/webhooks/stripe').send('{}')).status).to.equal(404);
    expect((await request(app(async () => ({}))).post('/webhooks/payram')).status).to.equal(400);
    const res = await request(app(async () => { throw new Error('db down'); })).post('/webhooks/payram').set('Content-Type', 'application/json').send(payramFixture());
    expect(res.status).to.equal(500);
  });

  it('passes the exact raw bytes to the adapter', async () => {
    let seen;
    const raw = payramFixture();
    await request(app(async (pool, adapter, body) => { seen = body; return { duplicate: false, status: 'succeeded' }; }))
      .post('/webhooks/payram').set('Content-Type', 'application/json').send(raw);
    expect(Buffer.isBuffer(seen)).to.equal(true);
    expect(seen.toString('utf8')).to.equal(raw);
  });
});
