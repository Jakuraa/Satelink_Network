// "cashfree" adapter (Wave 1.6) — CAPABILITY STUB ONLY.
// No code against an account Satelink does not have. Part A: Cashfree prohibits
// "cryptocurrency exchanges and trading platforms" and requires an India-registered
// business; application only (parallel fiat fallback to Razorpay). Every
// operational method refuses until a real account and its docs are in hand.
import { PaymentError } from '../contract.mjs';

export function createCashfreeAdapter() {
  const id = 'cashfree';
  const notConfigured = (m) => async () => { throw new PaymentError('NOT_CONFIGURED', `cashfree.${m}(): no Cashfree account (application pending — founder action)`); };
  return {
    id,
    capabilities: () => ({
      oneTime: true, recurring: true, refunds: true,
      currencies: ['INR'], networks: [],
      hostedCheckout: true, requiresKyb: true,
      // 2026-10-12: merchant application submitted, approval not evidenced.
      available: false, unavailableReason: 'application_pending',
    }),
    createCheckout: notConfigured('createCheckout'),
    getPayment: notConfigured('getPayment'),
    async verifyWebhook() { return false; },
    normalizeEvent: notConfigured('normalizeEvent'),
    refund: notConfigured('refund'),
    reconcile: notConfigured('reconcile'),
  };
}
