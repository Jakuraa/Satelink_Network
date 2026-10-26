// "razorpay" adapter (Wave 1.4) — the Stage 27 RazorpayGateway behind the contract.
// STILL TEST MODE ONLY: RazorpayGateway refuses rzp_live_ keys at construction,
// and this adapter adds nothing that could bypass that. Webhook verification is
// the gateway's own constant-time HMAC over the raw body (X-Razorpay-Signature);
// x-razorpay-event-id is the idempotency key (Razorpay docs).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, sha256Hex, header } from '../contract.mjs';

const BASE = 'https://api.razorpay.com/v1';

export class RazorpayGateway {
  #keyId; #secret; #webhookSecret; #fetch;

  constructor({ keyId, keySecret, webhookSecret, fetch: fetchFn }) {
    if (typeof keyId !== 'string' || keyId.startsWith('rzp_live_')) {
      throw new PaymentError('FORBIDDEN', 'live Razorpay keys are refused: test mode only');
    }
    if (!/^rzp_test_[A-Za-z0-9]{6,}$/.test(keyId)) {
      throw new PaymentError('CONFIG', 'a Razorpay TEST key id (rzp_test_…) is required');
    }
    if (typeof keySecret !== 'function' || typeof webhookSecret !== 'function' || typeof fetchFn !== 'function') {
      throw new PaymentError('CONFIG', 'RazorpayGateway needs keySecret(), webhookSecret() and fetch');
    }
    this.#keyId = keyId;
    this.#secret = keySecret;
    this.#webhookSecret = webhookSecret;
    this.#fetch = fetchFn;
  }

  get id() { return 'razorpay'; }
  get mode() { return 'test'; }

  async #call(method, path, body) {
    const auth = Buffer.from(`${this.#keyId}:${await this.#secret()}`).toString('base64');
    let res;
    try {
      res = await this.#fetch(`${BASE}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      throw new PaymentError(method === 'GET' ? 'GATEWAY_UNAVAILABLE' : 'GATEWAY_AMBIGUOUS', `razorpay ${method} ${path}: ${e?.name ?? 'network error'}`);
    }
    const json = await res.json().catch(() => null);
    if (res.ok) return json;
    const code = res.status >= 500 ? (method === 'GET' ? 'GATEWAY_UNAVAILABLE' : 'GATEWAY_AMBIGUOUS') : res.status === 401 ? 'GATEWAY_AUTH' : 'GATEWAY_REJECTED';
    throw new PaymentError(code, `razorpay ${res.status}: ${json?.error?.description ?? 'error'}`);
  }

  async ensurePlan(plan) {
    if (plan.amountMinor <= 0n) throw new PaymentError('INVALID', 'free plans are not gateway plans');
    const r = await this.#call('POST', '/plans', {
      period: plan.period,
      interval: plan.interval,
      item: { name: plan.name, amount: Number(plan.amountMinor), currency: 'INR', description: plan.id },
      notes: { satelink_plan: plan.id },
    });
    return { gatewayPlanId: r.id };
  }

  async createSubscription({ gatewayPlanId, subscriptionId, principalId, totalCount = 120 }) {
    const r = await this.#call('POST', '/subscriptions', {
      plan_id: gatewayPlanId,
      total_count: totalCount,
      quantity: 1,
      customer_notify: 1,
      notes: { satelink_subscription: subscriptionId, satelink_principal: principalId },
    });
    return { gatewaySubscriptionId: r.id, status: r.status, authenticateUrl: r.short_url ?? null };
  }

  async changePlan({ gatewaySubscriptionId, gatewayPlanId, scheduleChangeAt }) {
    if (!['now', 'cycle_end'].includes(scheduleChangeAt)) throw new PaymentError('INVALID', 'scheduleChangeAt must be now or cycle_end');
    const r = await this.#call('PATCH', `/subscriptions/${encodeURIComponent(gatewaySubscriptionId)}`, {
      plan_id: gatewayPlanId,
      schedule_change_at: scheduleChangeAt,
    });
    return { status: r.status, hasScheduledChanges: Boolean(r.has_scheduled_changes) };
  }

  async cancelSubscription({ gatewaySubscriptionId, atCycleEnd = true }) {
    const r = await this.#call('POST', `/subscriptions/${encodeURIComponent(gatewaySubscriptionId)}/cancel`, {
      cancel_at_cycle_end: atCycleEnd ? 1 : 0,
    });
    return { status: r.status };
  }

  async verifyWebhook(rawBody, signature) {
    if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') throw new PaymentError('INVALID', 'raw webhook body required');
    if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
    const want = Buffer.from(createHmac('sha256', await this.#webhookSecret()).update(rawBody).digest('hex'), 'utf8');
    const got = Buffer.from(signature, 'utf8');
    return want.length === got.length && timingSafeEqual(want, got);
  }

  parseWebhook(rawBody, eventId) {
    const e = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody);
    const sub = e?.payload?.subscription?.entity ?? null;
    const pay = e?.payload?.payment?.entity ?? null;
    return Object.freeze({
      eventId,
      type: String(e?.event ?? ''),
      createdAt: Number(e?.created_at ?? 0),
      subscription: sub && {
        gatewaySubscriptionId: sub.id,
        status: sub.status,
        gatewayPlanId: sub.plan_id,
        currentStart: sub.current_start ?? null,
        currentEnd: sub.current_end ?? null,
        notes: sub.notes ?? {},
        authAttempts: sub.auth_attempts ?? 0,
      },
      payment: pay && {
        gatewayPaymentId: pay.id,
        amountMinor: BigInt(pay.amount),
        currency: pay.currency,
        status: pay.status,
        gatewayInvoiceId: pay.invoice_id ?? null,
        createdAt: pay.created_at,
      },
    });
  }
}

export const RAZORPAY_EVENT_MAP = Object.freeze({
  'payment.authorized': 'pending',
  'payment.captured': 'succeeded',
  'payment.failed': 'failed',
  'subscription.charged': 'succeeded',
  'refund.processed': 'refunded',
  'payment.dispute.created': 'dispute_open', // inert: no money has moved yet
  'payment.dispute.won': 'dispute_won',      // inert
  'payment.dispute.lost': 'disputed',        // reversal
});

/** @param {{ gateway?: RazorpayGateway, keyId?: string, keySecret?: Function, webhookSecret?: Function, fetch?: Function }} o */
export function createRazorpayAdapter(o = {}) {
  const gateway = o.gateway ?? new RazorpayGateway({ keyId: o.keyId, keySecret: o.keySecret, webhookSecret: o.webhookSecret, fetch: o.fetch });
  if (gateway.mode !== 'test') throw new PaymentError('NOT_CONFIGURED', 'razorpay adapter is test-mode only');
  const id = 'razorpay';

  return {
    id,
    mode: gateway.mode,
    // 2026-10-12 founder input: Razorpay SUSPENDED the merchant (Jakuraa
    // Commercial Pvt Ltd, terms of use). Not offered at checkout; code and
    // webhook verification kept (refunds/disputes on past payments may still
    // arrive). Flip only with evidence the suspension is lifted.
    capabilities: () => ({
      oneTime: true, recurring: true, refunds: true,
      currencies: ['INR'], networks: [],
      hostedCheckout: true, requiresKyb: true,
      available: false, unavailableReason: 'provider_suspended',
    }),

    /** Recurring plan checkout → a Razorpay subscription; its short_url is the hosted page. */
    async createCheckout({ canonicalRef, gatewayPlanId, customerAccountId }) {
      const r = await gateway.createSubscription({ gatewayPlanId, subscriptionId: canonicalRef, principalId: customerAccountId });
      return { canonicalRef, providerPaymentId: r.gatewaySubscriptionId, checkoutUrl: r.authenticateUrl };
    },

    async getPayment() { throw new PaymentError('UNSUPPORTED', 'razorpay getPayment: use reconcile() (Stage 27 gateway has no single-payment read)'); },

    async verifyWebhook(rawBody, headers) {
      const sig = header(headers, 'x-razorpay-signature');
      return gateway.verifyWebhook(rawBody, sig ?? '');
    },

    normalizeEvent(rawBody, headers) {
      const eventId = header(headers, 'x-razorpay-event-id');
      if (!eventId) throw new PaymentError('INVALID', 'razorpay: x-razorpay-event-id header missing');
      const e = gateway.parseWebhook(rawBody, eventId);
      const status = RAZORPAY_EVENT_MAP[e.type];
      if (!status) return null;
      const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
      const body = JSON.parse(raw.toString('utf8'));
      const refund = body?.payload?.refund?.entity ?? null;
      const dispute = body?.payload?.dispute?.entity ?? null;
      const pay = e.payment;
      const notes = { ...(e.subscription?.notes ?? {}), ...(body?.payload?.payment?.entity?.notes ?? {}) };
      const amountMinor = refund ? BigInt(refund.amount) : dispute ? BigInt(dispute.amount) : pay ? pay.amountMinor : 0n;
      const currency = String(refund?.currency ?? dispute?.currency ?? pay?.currency ?? 'INR').toUpperCase();
      return {
        provider: id,
        providerEventId: eventId,
        providerPaymentId: pay?.gatewayPaymentId ?? refund?.payment_id ?? dispute?.payment_id ?? e.subscription?.gatewaySubscriptionId ?? null,
        canonicalRef: notes.satelink_ref ?? notes.satelink_subscription ?? null,
        customerAccountId: notes.satelink_principal ?? null,
        productId: notes.satelink_product ?? null,
        amountMinor, currency, network: null, status,
        occurredAt: new Date((e.createdAt || Math.floor(Date.now() / 1000)) * 1000),
        raw_hash: sha256Hex(raw),
      };
    },

    async refund() { throw new PaymentError('UNSUPPORTED', 'razorpay refunds: issue from the Razorpay dashboard (test mode); the refund.processed webhook posts the reversal'); },
    async reconcile() { throw new PaymentError('NOT_CONFIGURED', 'razorpay reconcile needs live API access (founder action: live account)'); },
  };
}
