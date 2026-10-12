// "razorpay" adapter (Wave 1.4) — the Stage 27 RazorpayGateway behind the contract.
// STILL TEST MODE ONLY: RazorpayGateway refuses rzp_live_ keys at construction,
// and this adapter adds nothing that could bypass that. Webhook verification is
// the gateway's own constant-time HMAC over the raw body (X-Razorpay-Signature);
// x-razorpay-event-id is the idempotency key (Razorpay docs).
import { RazorpayGateway } from '../../trading_agent/billing/razorpay.mjs';
import { PaymentError, sha256Hex, header } from '../contract.mjs';

// Razorpay webhook event → canonical status. Anything else is ignored (null).
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
    capabilities: () => ({
      oneTime: true, recurring: true, refunds: true,
      currencies: ['INR'], networks: [],
      hostedCheckout: true, requiresKyb: true,
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
