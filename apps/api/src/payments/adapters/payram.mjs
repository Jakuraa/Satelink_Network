// PayRam adapter (Wave 1.5) — CODE ONLY, flag PAYMENT_PAYRAM (default OFF).
// PayRam is self-hosted: nothing here installs or runs it (see
// docs/platform/PAYRAM_DEPLOY_PLAN.md — the founder executes that plan).
//
// Implemented against docs.payram.com (read 2026-10-12):
//   create   POST {BASE}/api/v1/payment                      header API-Key; body
//            { customerEmail, customerID, amountInUSD, invoiceID?, expire?, currency?, network? }
//            → { host, reference_id, url }
//   status   GET  {BASE}/api/v1/payment/reference/<reference_id>   → { referenceID, invoiceID, customerID, amountInUSD, paymentState, … }
//   webhook  X-Payram-Signature: sha256=<hex> = HMAC-SHA256(raw body, project API key)
//            payload { customer_id, invoice_id, reference_id, status, amount, currency, filled_amount,
//                      filled_amount_in_usd, timestamp, payment_info[], confirmation_current, confirmation_required }
//            statuses OPEN | PARTIALLY_FILLED | FILLED | OVER_FILLED | CANCELLED (link expired)
//   No subscription/recurring API exists (verified absent) → crypto plans are prepaid invoices.
//
// reference_id identifies the PAYMENT, not the delivery: PayRam re-sends the same
// reference_id on every status/confirmation update and retries for up to 48h. The
// event id is therefore reference_id + status + filled_amount, so each distinct
// state is ingested once and plain retries are no-ops.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, decimalToMinor, minorToDecimal, sha256Hex, header, unsupported } from '../contract.mjs';

export const PAYRAM_STATUS_MAP = Object.freeze({
  OPEN: 'pending',
  PARTIALLY_FILLED: 'partially_paid',
  FILLED: 'succeeded',
  OVER_FILLED: 'overpaid',
  CANCELLED: 'expired',
});

// PayRam's network names (docs: supported-networks-and-coins) → ours.
const NETWORKS = Object.freeze({ ETH: 'ethereum', BASE: 'base', POLYGON: 'polygon', TRX: 'tron', TRON: 'tron', BTC: 'bitcoin' });

export function payramEnabled(env = process.env) {
  return env.PAYMENT_PAYRAM === 'true' || env.PAYMENT_PAYRAM === '1';
}

/**
 * @param {object} o
 * @param {string} o.baseUrl         the founder's PayRam server, e.g. https://pay.satelink.network
 * @param {() => Promise<string>} o.apiKey  loader (KMS/env at the edge); never logged
 * @param {typeof fetch} o.fetch
 * @param {object} [o.env]
 */
export function createPayramAdapter({ baseUrl, apiKey, fetch: fetchFn, env = process.env } = {}) {
  const id = 'payram';
  const enabled = () => payramEnabled(env);
  const requireEnabled = () => { if (!enabled()) throw new PaymentError('DISABLED', 'PayRam adapter is off (PAYMENT_PAYRAM)'); };
  const requireConfig = () => {
    if (!baseUrl || typeof apiKey !== 'function' || typeof fetchFn !== 'function') throw new PaymentError('NOT_CONFIGURED', 'PayRam needs baseUrl, apiKey() and fetch');
  };

  async function call(method, path, body) {
    requireEnabled(); requireConfig();
    let res;
    try {
      res = await fetchFn(`${baseUrl.replace(/\/$/, '')}/api/v1${path}`, {
        method,
        headers: { 'API-Key': await apiKey(), 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      throw new PaymentError('GATEWAY', `payram ${method} ${path}: ${e?.name ?? 'network error'}`);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new PaymentError('GATEWAY', `payram ${res.status}`);
    return json;
  }

  return {
    id,
    capabilities: () => ({
      oneTime: true, recurring: false, refunds: false,
      currencies: ['USDT', 'USDC'], networks: ['tron', 'polygon', 'base', 'ethereum'],
      hostedCheckout: true, requiresKyb: false,
    }),

    /** amountMinor/currency must be USD-pegged (PayRam prices in USD). */
    async createCheckout({ canonicalRef, customerAccountId, customerEmail, amountMinor, currency = 'USD', network, payCurrency, expiresAt }) {
      if (!['USD', 'USDT', 'USDC'].includes(currency)) throw new PaymentError('INVALID', 'PayRam prices in USD');
      const r = await call('POST', '/payment', {
        customerEmail, customerID: customerAccountId,
        amountInUSD: minorToDecimal(amountMinor, currency),
        invoiceID: canonicalRef,
        ...(expiresAt ? { expire: new Date(expiresAt).toISOString() } : {}),
        ...(payCurrency ? { currency: payCurrency } : {}),
        ...(network ? { network: String(network).toUpperCase() } : {}),
      });
      if (!r?.reference_id || !r?.url) throw new PaymentError('GATEWAY', 'payram create: missing reference_id/url');
      return { canonicalRef, providerPaymentId: r.reference_id, checkoutUrl: r.url };
    },

    async getPayment(referenceId) {
      const r = await call('GET', `/payment/reference/${encodeURIComponent(referenceId)}`);
      return {
        provider: id, providerPaymentId: r?.referenceID ?? referenceId, canonicalRef: r?.invoiceID ?? null,
        customerAccountId: r?.customerID ?? null, status: PAYRAM_STATUS_MAP[r?.paymentState] ?? 'pending',
        amountMinor: decimalToMinor(String(r?.amountInUSD ?? '0'), 'USD'), currency: 'USD',
      };
    },

    /** Constant-time HMAC-SHA256 over the RAW body, keyed with the project API key. */
    async verifyWebhook(rawBody, headers) {
      if (!enabled()) return false;
      requireConfig();
      if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') return false;
      const sig = header(headers, 'x-payram-signature');
      const m = typeof sig === 'string' ? /^sha256=([0-9a-f]{64})$/i.exec(sig.trim()) : null;
      if (!m) return false;
      const want = Buffer.from(createHmac('sha256', await apiKey()).update(rawBody).digest('hex'), 'utf8');
      const got = Buffer.from(m[1].toLowerCase(), 'utf8');
      return want.length === got.length && timingSafeEqual(want, got);
    },

    normalizeEvent(rawBody) {
      const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
      const p = JSON.parse(raw);
      const status = PAYRAM_STATUS_MAP[p?.status];
      if (!status) throw new PaymentError('INVALID', `payram: unknown status ${p?.status}`);
      if (!p.reference_id) throw new PaymentError('INVALID', 'payram: reference_id missing');
      const currency = String(p.currency ?? '').toUpperCase();
      const filled = p.filled_amount == null || p.filled_amount === '' ? '0' : String(p.filled_amount);
      // Confirmation-progress deliveries (docs: re-sent each poll cycle) are not final yet.
      // UNVERIFIED nuance: the final delivery reports confirmation_current = 0.
      const confirming = (status === 'succeeded' || status === 'overpaid')
        && Number(p.confirmation_required) > 0 && Number(p.confirmation_current) > 0
        && Number(p.confirmation_current) < Number(p.confirmation_required);
      const finalStatus = confirming ? 'pending' : status;
      return {
        provider: id,
        providerEventId: `${p.reference_id}:${finalStatus}:${filled}`,
        providerPaymentId: p.reference_id,
        canonicalRef: p.invoice_id || null,
        customerAccountId: p.customer_id || null,
        productId: null,
        amountMinor: decimalToMinor(filled, currency),
        currency,
        network: null, // the webhook does not carry the chain; the intent's network (if restricted) is authoritative
        status: finalStatus,
        occurredAt: new Date(Number(p.timestamp) * 1000),
        raw_hash: sha256Hex(raw),
      };
    },

    refund: unsupported(id, 'refund'),

    /** PayRam has no list endpoint in the docs: re-read each known reference id. */
    async reconcile({ referenceIds = [] } = {}) {
      const out = [];
      for (const ref of referenceIds) out.push(await this.getPayment(ref));
      return out;
    },

    networkFor: (payramNetwork) => NETWORKS[String(payramNetwork ?? '').toUpperCase()] ?? null,
  };
}
