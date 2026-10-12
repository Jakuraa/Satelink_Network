// "dodo" adapter (Wave 1.6) — Dodo behind the contract, UNCHANGED.
// The live Dodo paths keep running exactly as they are (apps/web dodo-webhook →
// /internal/dodo/*, and POST /webhooks/dodo/v2 → pricing_v2/webhooks.mjs). This
// adapter reuses the SAME Standard-Webhooks verifier and only adds a canonical
// view of Dodo events; it is not registered on /webhooks/:provider, so nothing
// is double-ingested. Part A: Dodo's policy prohibits crypto-related offerings —
// use only if Dodo accepts after full disclosure (founder decision).
import { verifyStandardWebhook, webhookSecret as dodoWebhookSecret } from '../../pricing_v2/webhooks.mjs';
import { PaymentError, sha256Hex, header, unsupported } from '../contract.mjs';

export const DODO_EVENT_MAP = Object.freeze({
  'payment.processing': 'pending',
  'payment.succeeded': 'succeeded',
  'payment.failed': 'failed',
  'payment.cancelled': 'failed',
  'refund.succeeded': 'refunded',
  'dispute.opened': 'dispute_open', // inert: no money has moved yet
  'dispute.won': 'dispute_won',     // inert
  'dispute.lost': 'disputed',       // reversal
});

export function createDodoAdapter({ secret = dodoWebhookSecret, now = () => Date.now() } = {}) {
  const id = 'dodo';
  return {
    id,
    capabilities: () => ({
      oneTime: true, recurring: true, refunds: true,
      currencies: ['USD', 'INR'], networks: [],
      hostedCheckout: true, requiresKyb: true,
    }),
    createCheckout: unsupported(id, 'createCheckout'), // checkout stays on the existing Dodo surfaces
    getPayment: unsupported(id, 'getPayment'),
    async verifyWebhook(rawBody, headers) {
      const hdr = { id: header(headers, 'webhook-id'), timestamp: header(headers, 'webhook-timestamp'), signature: header(headers, 'webhook-signature') };
      return verifyStandardWebhook(hdr, Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody, secret(), { now: now() });
    },
    normalizeEvent(rawBody, headers) {
      const raw = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
      const e = JSON.parse(raw);
      const status = DODO_EVENT_MAP[e?.type];
      if (!status) return null;
      const d = e.data ?? {};
      const webhookId = header(headers, 'webhook-id');
      if (!webhookId) throw new PaymentError('INVALID', 'dodo: webhook-id header missing');
      const amount = d.total_amount ?? d.amount ?? 0;
      if (!Number.isInteger(Number(amount))) throw new PaymentError('INVALID', 'dodo: amount must be integer minor units');
      return {
        provider: id, providerEventId: webhookId,
        providerPaymentId: d.payment_id ?? null,
        canonicalRef: d.metadata?.satelink_ref ?? null,
        customerAccountId: d.metadata?.satelink_principal ?? d.customer?.customer_id ?? null,
        productId: d.metadata?.satelink_product ?? null,
        amountMinor: BigInt(amount), currency: String(d.currency ?? 'USD').toUpperCase(), network: null, status,
        occurredAt: new Date(e.timestamp ?? d.created_at ?? Date.now()), raw_hash: sha256Hex(raw),
      };
    },
    refund: unsupported(id, 'refund'),
    reconcile: unsupported(id, 'reconcile'),
  };
}
