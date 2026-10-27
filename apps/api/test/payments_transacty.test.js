// Transacty adapter (Step 7) — contract tests on recorded/constructed FIXTURES only.
// Never calls the live API (every fetch is a stub that records the request).
import { expect } from 'chai';
import { createHmac } from 'node:crypto';
import { createTransactyAdapter, signTransactyRequest, settledUsdt, TRANSACTY_STATUS_MAP } from '../src/payments/adapters/transacty.mjs';
import { assertAdapter, canonicalEvent, isAdapterAvailable } from '../src/payments/contract.mjs';

const ON = { PAYMENT_TRANSACTY: 'true' };
const WH = 'whsec_transacty_fixture';
const sign = (raw) => createHmac('sha256', WH).update(raw).digest('hex');

function stubFetch(reply) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, ...init }); return { ok: reply.status < 300, status: reply.status, json: async () => reply.body }; };
  return { fetch, calls };
}
const make = (o = {}) => createTransactyAdapter({
  apiKey: async () => 'tk_fixture', apiSecret: async () => 'ts_fixture', webhookSecret: async () => WH,
  now: () => 1_760_300_000_123, env: ON, ...o,
});

describe('transacty adapter (code only, PAYMENT_TRANSACTY off by default)', () => {
  it('t0: implements the contract; OFF by default → unavailable (not_applied) and refuses every call', async () => {
    const off = createTransactyAdapter({ apiKey: async () => 'k', apiSecret: async () => 's', webhookSecret: async () => WH, fetch: async () => { throw new Error('must not be called'); }, env: {} });
    expect(() => assertAdapter(off)).to.not.throw();
    expect(off.capabilities()).to.include({ available: false, unavailableReason: 'not_applied', requiresKyb: true });
    expect(isAdapterAvailable(off)).to.equal(false);
    for (const p of [off.createCheckout({ canonicalRef: 'inv_1', customerEmail: 'a@b.co', amountMinor: 50_000n }), off.getPayment('t'), off.confirmUtr({ transactionId: 't', utr: '123456789012' })]) {
      let err; try { await p; } catch (e) { err = e; } expect(err?.code).to.equal('DISABLED');
    }
    const raw = '{"event":"payin.completed"}';
    expect(await off.verifyWebhook(raw, { 'x-transacty-webhook-signature': sign(raw) })).to.equal(false);
  });

  it('t1: signs HMAC-SHA256 over "{timestamp}.{rawBody}" with unix-second timestamps', () => {
    const want = createHmac('sha256', 'sec').update('1760300000.{"a":1}').digest('hex');
    expect(signTransactyRequest('sec', '1760300000', '{"a":1}')).to.equal(want);
    expect(signTransactyRequest('sec', '1760300000')).to.equal(createHmac('sha256', 'sec').update('1760300000.').digest('hex'));
  });

  it('t2: create pay-in → POST /v1/h2h/payin-instances, signed, Idempotency-Key = canonicalRef', async () => {
    const { fetch, calls } = stubFetch({ status: 200, body: { transactionId: 'd562be7c-00d4-4d63-bf50-93f72b437222', instanceId: 'tlp_inst_8f21c0', status: 'pending', amount: '500', paymentDetails: { upiId: 'merchant@upi', qr: 'upi://pay?pa=merchant@upi&am=500&cu=INR' } } });
    const a = make({ fetch });
    const r = await a.createCheckout({ canonicalRef: 'inv_t2', customerEmail: 'payer@example.com', amountMinor: 50_000n, currency: 'INR' });
    expect(r).to.deep.include({ canonicalRef: 'inv_t2', providerPaymentId: 'd562be7c-00d4-4d63-bf50-93f72b437222', checkoutUrl: 'upi://pay?pa=merchant@upi&am=500&cu=INR', upiId: 'merchant@upi' });
    const c = calls[0];
    expect(c.url).to.equal('https://api.transacty.ai/v1/h2h/payin-instances');
    expect(c.method).to.equal('POST');
    expect(JSON.parse(c.body)).to.deep.equal({ amount: '500.00', currencySymbol: 'INR', userDetails: { email: 'payer@example.com' } });
    expect(c.headers['Idempotency-Key']).to.equal('inv_t2');
    expect(c.headers['X-Transacty-Key']).to.equal('tk_fixture');
    expect(c.headers['X-Transacty-Timestamp']).to.equal('1760300000');
    expect(c.headers['X-Transacty-Signature']).to.equal(signTransactyRequest('ts_fixture', '1760300000', c.body));
  });

  it('t3: UTR confirm → POST /v1/h2h/buyer-confirms-payment {transactionId, utr}; 403 = market not enabled', async () => {
    const { fetch, calls } = stubFetch({ status: 200, body: { ok: true } });
    await make({ fetch }).confirmUtr({ transactionId: 'tx1', utr: '412345678901' });
    expect(calls[0].url).to.match(/\/v1\/h2h\/buyer-confirms-payment$/);
    expect(JSON.parse(calls[0].body)).to.deep.equal({ transactionId: 'tx1', utr: '412345678901' });
    expect(calls[0].headers['Idempotency-Key']).to.equal(undefined);
    const forbidden = stubFetch({ status: 403, body: {} });
    let err; try { await make({ fetch: forbidden.fetch }).getPayment('tx1'); } catch (e) { err = e; }
    expect(err.code).to.equal('NOT_CONFIGURED');
  });

  it('t4: webhook signature over the raw body; tampering or wrong secret is refused', async () => {
    const a = make({ fetch: async () => { throw new Error('no network'); } });
    const raw = JSON.stringify({ event: 'payin.completed', transactionId: 'tx4', status: 'success', amount: '25.00', paidAmount: '25.00', currency: 'USDT', platformOrderId: 'inv_4', timestamp: '2026-10-13T10:00:00.000Z' });
    expect(await a.verifyWebhook(raw, { 'x-transacty-webhook-signature': sign(raw) })).to.equal(true);
    expect(await a.verifyWebhook(raw + ' ', { 'x-transacty-webhook-signature': sign(raw) })).to.equal(false);
    expect(await a.verifyWebhook(raw, { 'x-transacty-webhook-signature': createHmac('sha256', 'other').update(raw).digest('hex') })).to.equal(false);
    expect(await a.verifyWebhook(raw, {})).to.equal(false);
  });

  it('t5: status mapping pending/success/failed; payin.failed always failed; disputed (tradeEventId 5) stays pending', () => {
    const a = make({ fetch: async () => ({}) });
    expect(TRANSACTY_STATUS_MAP).to.deep.equal({ pending: 'pending', success: 'succeeded', failed: 'failed' });
    const ev = (o) => canonicalEvent(a.normalizeEvent(JSON.stringify({ event: 'payin.completed', transactionId: 'tx5', currency: 'USDT', paidAmount: '10', platformOrderId: 'inv_5', timestamp: '2026-10-13T00:00:00Z', ...o })));
    expect(ev({ status: 'success' }).status).to.equal('succeeded');
    expect(ev({ status: 'pending' }).status).to.equal('pending');
    expect(ev({ status: 'success', tradeEventId: 5 }).status).to.equal('pending');
    expect(ev({ event: 'payin.failed', status: 'failed' }).status).to.equal('failed');
    expect(() => a.normalizeEvent(JSON.stringify({ event: 'payout.completed', transactionId: 'x', status: 'success' }))).to.throw(/unsupported event/);
  });

  it('t6: settlement is recorded as USDT in its own pocket; INR is never posted or summed', () => {
    const a = make({ fetch: async () => ({}) });
    const usdt = a.normalizeEvent(JSON.stringify({ event: 'payin.completed', transactionId: 'tx6', status: 'success', amount: '25.00', paidAmount: '24.50', currency: 'USDT', timestamp: '2026-10-13T00:00:00Z' }));
    expect(usdt).to.include({ currency: 'USDT', status: 'succeeded' });
    expect(usdt.amountMinor).to.equal(24_500_000n);
    // INR pay-in, documented payload states no USDT amount → held, zero, USDT pocket
    const inr = a.normalizeEvent(JSON.stringify({ event: 'payin.completed', transactionId: 'tx7', status: 'success', amount: '2000', paidAmount: '2000', currency: 'INR', timestamp: '2026-10-13T00:00:00Z' }));
    expect(inr).to.include({ currency: 'USDT', status: 'pending' });
    expect(inr.amountMinor).to.equal(0n);
    // …and once the settled USDT amount is stated, it is that USDT (not the INR) that is recorded
    const settled = a.normalizeEvent(JSON.stringify({ event: 'payin.completed', transactionId: 'tx7', status: 'success', amount: '2000', currency: 'INR', settlementAmount: '22.71', settlementCurrency: 'USDT', timestamp: '2026-10-13T00:00:00Z' }));
    expect(settled).to.include({ currency: 'USDT', status: 'succeeded' });
    expect(settled.amountMinor).to.equal(22_710_000n);
    expect(settled.providerEventId).to.not.equal(inr.providerEventId); // the settled state is a distinct, ingestible event
    expect(settledUsdt({ currency: 'INR', amount: '2000' })).to.equal(null);
  });
});
