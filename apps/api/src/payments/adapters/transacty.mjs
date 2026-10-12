// Transacty adapter (Step 7, 2026-10-12) — CODE ONLY, flag PAYMENT_TRANSACTY (default OFF).
// The founder has NOT applied to Transacty: nothing here has ever called the live
// API. Prerequisites: docs/platform/TRANSACTY_READINESS.md.
//
// Implemented against docs.transacty.ai (read 2026-10-13):
//   auth     every request: X-Transacty-Key, X-Transacty-Timestamp (unix SECONDS),
//            X-Transacty-Signature = HMAC-SHA256("{timestamp}.{rawBody}", apiSecret)
//            (encoding not stated in the docs — hex assumed; READINESS item R3)
//   create   POST /v1/h2h/payin-instances   Idempotency-Key REQUIRED
//            { amount: "500", currencySymbol: "INR"|"USDT", userDetails: { email }, returnUrl? }
//            → { transactionId, instanceId, status: "pending", amount, paymentDetails: { upiId, qr } }
//   status   GET  /v1/h2h/payin-instances/:transactionId
//            → { transactionId, status: pending|success|failed, amount, currency, settlementCurrency: "USDT",
//                rail: "india", railLabel, tradeEventId }   (5 = disputed → keep PENDING; 9 = expired)
//   confirm  POST /v1/h2h/buyer-confirms-payment  { transactionId, utr }
//   webhook  X-Transacty-Webhook-Signature = HMAC-SHA256(rawBody, webhookSecret)
//            events payin.completed | payin.failed
//            { event, transactionId, status, amount, paidAmount, currency, platformOrderId, timestamp }
//   money    customer always pays INR via UPI; merchant is always credited USDT.
//
// CURRENCY POCKETS: the canonical event is ALWAYS the USDT we were credited, in
// the USDT pocket. The customer's INR amount is never posted and never summed
// with USDT. If a delivery does not state the settled USDT amount (an INR pay-in
// webhook per the documented payload), the event is held as `pending` — it never
// grants and never posts — until the USDT amount is known (READINESS item R4).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, decimalToMinor, minorToDecimal, sha256Hex, header, unsupported } from '../contract.mjs';

export const TRANSACTY_STATUS_MAP = Object.freeze({ pending: 'pending', success: 'succeeded', failed: 'failed' });
const DISPUTED_TRADE_EVENT = 5;
const DEFAULT_BASE_URL = 'https://api.transacty.ai';

export function transactyEnabled(env = process.env) {
  return env.PAYMENT_TRANSACTY === 'true' || env.PAYMENT_TRANSACTY === '1';
}

/** HMAC-SHA256 over "{timestamp}.{rawBody}", hex. Exported for fixture tests. */
export function signTransactyRequest(secret, timestamp, rawBody = '') {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

/** The settled USDT amount a delivery states, as a decimal string — or null. */
export function settledUsdt(p) {
  if (p?.settlementAmount != null && String(p.settlementCurrency ?? 'USDT').toUpperCase() === 'USDT') return String(p.settlementAmount);
  if (String(p?.currency ?? '').toUpperCase() === 'USDT') return String(p.paidAmount ?? p.amount ?? '');
  return null;
}

/**
 * @param {object} o
 * @param {() => Promise<string>} o.apiKey        X-Transacty-Key loader (never logged)
 * @param {() => Promise<string>} o.apiSecret     request-signing secret loader
 * @param {() => Promise<string>} o.webhookSecret webhook-signing secret loader
 * @param {typeof fetch} o.fetch
 * @param {string} [o.baseUrl]
 * @param {() => number} [o.now]                  ms clock (tests)
 * @param {object} [o.env]
 */
export function createTransactyAdapter({ apiKey, apiSecret, webhookSecret, fetch: fetchFn, baseUrl = DEFAULT_BASE_URL, now = () => Date.now(), env = process.env } = {}) {
  const id = 'transacty';
  const enabled = () => transactyEnabled(env);
  const requireEnabled = () => { if (!enabled()) throw new PaymentError('DISABLED', 'Transacty adapter is off (PAYMENT_TRANSACTY)'); };
  const requireConfig = () => {
    if (typeof apiKey !== 'function' || typeof apiSecret !== 'function' || typeof fetchFn !== 'function') {
      throw new PaymentError('NOT_CONFIGURED', 'Transacty needs apiKey(), apiSecret() and fetch');
    }
  };

  async function call(method, path, body, { idempotencyKey } = {}) {
    requireEnabled(); requireConfig();
    const raw = body ? JSON.stringify(body) : '';
    const ts = String(Math.floor(now() / 1000));
    const headers = {
      'X-Transacty-Key': await apiKey(),
      'X-Transacty-Timestamp': ts,
      'X-Transacty-Signature': signTransactyRequest(await apiSecret(), ts, raw),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    };
    let res;
    try {
      res = await fetchFn(`${baseUrl.replace(/\/$/, '')}${path}`, { method, headers, body: raw || undefined, signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      throw new PaymentError('GATEWAY', `transacty ${method} ${path}: ${e?.name ?? 'network error'}`);
    }
    const json = await res.json().catch(() => null);
    if (res.status === 403) throw new PaymentError('NOT_CONFIGURED', 'transacty 403: India market not enabled (KYB) or scope missing');
    if (!res.ok) throw new PaymentError('GATEWAY', `transacty ${res.status}`);
    return json;
  }

  const mapStatus = (p) => {
    const s = TRANSACTY_STATUS_MAP[String(p?.status ?? '').toLowerCase()];
    if (!s) return null;
    // Disputed (tradeEventId 5) is NOT final: ops may correct the UTR and complete it.
    return Number(p?.tradeEventId) === DISPUTED_TRADE_EVENT ? 'pending' : s;
  };

  return {
    id,
    mode: 'code_only',
    capabilities: () => ({
      oneTime: true, recurring: false, refunds: false,
      currencies: ['INR', 'USDT'], networks: [],
      hostedCheckout: false, requiresKyb: true,
      // Founder has not applied (2026-10-12): never offered at checkout until the
      // flag is on AND the readiness prerequisites are evidenced.
      ...(enabled() ? { available: true } : { available: false, unavailableReason: 'not_applied' }),
    }),

    /**
     * India UPI H2H pay-in. Idempotency-Key = our canonicalRef, so a retried
     * create never makes a second pay-in. Returns the UPI intent (qr) + VPA.
     */
    async createCheckout({ canonicalRef, customerEmail, amountMinor, currency = 'INR', returnUrl }) {
      if (!['INR', 'USDT'].includes(currency)) throw new PaymentError('INVALID', 'Transacty India pay-in prices in INR or USDT');
      if (!canonicalRef) throw new PaymentError('INVALID', 'canonicalRef is the idempotency key and is required');
      if (!customerEmail) throw new PaymentError('INVALID', 'userDetails.email is required');
      const r = await call('POST', '/v1/h2h/payin-instances', {
        amount: minorToDecimal(amountMinor, currency),
        currencySymbol: currency,
        userDetails: { email: customerEmail },
        ...(returnUrl ? { returnUrl } : {}),
      }, { idempotencyKey: canonicalRef });
      if (!r?.transactionId || !r?.paymentDetails?.qr) throw new PaymentError('GATEWAY', 'transacty create: missing transactionId/paymentDetails');
      return { canonicalRef, providerPaymentId: r.transactionId, checkoutUrl: r.paymentDetails.qr, upiId: r.paymentDetails.upiId ?? null };
    },

    /** Buyer paid via UPI and gave us the bank UTR. */
    async confirmUtr({ transactionId, utr }) {
      if (!transactionId || !/^[0-9A-Za-z]{6,35}$/.test(String(utr ?? ''))) throw new PaymentError('INVALID', 'transactionId and a UTR are required');
      return call('POST', '/v1/h2h/buyer-confirms-payment', { transactionId, utr: String(utr) });
    },

    async getPayment(transactionId) {
      const r = await call('GET', `/v1/h2h/payin-instances/${encodeURIComponent(transactionId)}`);
      const usdt = settledUsdt(r);
      return {
        provider: id, providerPaymentId: r?.transactionId ?? transactionId, canonicalRef: null, customerAccountId: null,
        status: usdt == null ? 'pending' : (mapStatus(r) ?? 'pending'),
        amountMinor: usdt == null ? 0n : decimalToMinor(usdt, 'USDT'), currency: 'USDT',
      };
    },

    /** Constant-time HMAC-SHA256 over the RAW body with the webhook secret. */
    async verifyWebhook(rawBody, headers) {
      if (!enabled() || typeof webhookSecret !== 'function') return false;
      if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') return false;
      const sig = header(headers, 'x-transacty-webhook-signature');
      const m = typeof sig === 'string' ? /^(?:sha256=)?([0-9a-f]{64})$/i.exec(sig.trim()) : null;
      if (!m) return false;
      const want = Buffer.from(createHmac('sha256', await webhookSecret()).update(rawBody).digest('hex'), 'utf8');
      const got = Buffer.from(m[1].toLowerCase(), 'utf8');
      return want.length === got.length && timingSafeEqual(want, got);
    },

    normalizeEvent(rawBody) {
      const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
      const p = JSON.parse(raw);
      if (!['payin.completed', 'payin.failed'].includes(p?.event)) throw new PaymentError('INVALID', `transacty: unsupported event ${p?.event}`);
      if (!p.transactionId) throw new PaymentError('INVALID', 'transacty: transactionId missing');
      let status = mapStatus(p);
      if (!status) throw new PaymentError('INVALID', `transacty: unknown status ${p?.status}`);
      if (p.event === 'payin.failed') status = 'failed';
      const usdt = settledUsdt(p);
      // Success without a stated USDT amount → hold as pending (never post INR as USDT).
      const finalStatus = status === 'succeeded' && usdt == null ? 'pending' : status;
      return {
        provider: id,
        providerEventId: `${p.transactionId}:${finalStatus}${usdt == null ? '' : `:${usdt}`}`,
        providerPaymentId: p.transactionId,
        canonicalRef: p.platformOrderId || null,
        customerAccountId: null, // resolved from the intent (canonicalRef), never from the provider payload
        productId: null,
        amountMinor: usdt == null ? 0n : decimalToMinor(usdt, 'USDT'),
        currency: 'USDT',
        network: null,
        status: finalStatus,
        occurredAt: new Date(p.timestamp ?? now()),
        raw_hash: sha256Hex(raw),
      };
    },

    refund: unsupported(id, 'refund'),

    /** No list endpoint for pay-ins is documented: re-read each known transaction id. */
    async reconcile({ transactionIds = [] } = {}) {
      const out = [];
      for (const t of transactionIds) {
        const r = await this.getPayment(t);
        out.push({ providerPaymentId: r.providerPaymentId, status: r.status, amountMinor: r.amountMinor, currency: 'USDT' });
      }
      return out;
    },
  };
}
