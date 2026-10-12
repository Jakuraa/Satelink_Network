// PaymentAdapter contract (2026-10-12 platform directive, Wave 1.2).
//
// Every payment provider — the in-house on-chain rail, Razorpay, PayRam, Dodo,
// Cashfree — sits behind this one interface, and every event it produces is a
// CanonicalPaymentEvent. Ingestion (./ingest.mjs) is provider-agnostic: it only
// ever sees canonical events, so swapping a provider never touches the ledger
// path. Money is ALWAYS integer minor units (BigInt) + a currency code; no
// float ever represents an amount here, and unlike currencies are never summed.
//
// PaymentAdapter {
//   id                                   'onchain-native' | 'razorpay' | 'payram' | 'dodo' | 'cashfree'
//   capabilities()                       → { oneTime, recurring, refunds, currencies[], networks[], hostedCheckout, requiresKyb }
//   createCheckout(input) / createIntent(input)
//                                        → { canonicalRef, providerPaymentId?, checkoutUrl? | invoice? }
//   getPayment(providerPaymentId)        → CanonicalPaymentEvent-shaped snapshot (no providerEventId)
//   verifyWebhook(rawBody, headers)      → boolean (constant-time; raw body only, never re-serialised JSON)
//   normalizeEvent(rawBody, headers)     → CanonicalPaymentEvent | null (null = an event type we ignore)
//   refund(input)                        → provider refund handle (only where capabilities().refunds)
//   reconcile(window)                    → [{ providerPaymentId, providerEventId?, status, amountMinor, currency }]
// }
// Methods a provider cannot support throw PaymentError('UNSUPPORTED').
import { createHash } from 'node:crypto';

export const PAYMENT_STATUSES = Object.freeze([
  'pending', 'succeeded', 'failed', 'expired', 'refunded', 'disputed', 'partially_paid', 'overpaid',
  'dispute_open', 'dispute_won',
]);

/** Statuses that recognise money (post to the ledger + may grant an entitlement). */
export const SETTLED_STATUSES = Object.freeze(['succeeded', 'overpaid']);
/** Statuses that reverse a previously settled payment (post a reversal, revoke the entitlement).
 * 'disputed' means the dispute was LOST — an opened dispute is 'dispute_open' (inert). */
export const REVERSAL_STATUSES = Object.freeze(['refunded', 'disputed']);
/** Statuses that never move money or entitlements. partially_paid is held for support (no grant);
 * dispute_open / dispute_won are recorded for support/alerting only — money only moves if the dispute is lost. */
export const INERT_STATUSES = Object.freeze(['pending', 'failed', 'expired', 'partially_paid', 'dispute_open', 'dispute_won']);

export const ADAPTER_METHODS = Object.freeze([
  'capabilities', 'getPayment', 'verifyWebhook', 'normalizeEvent', 'refund', 'reconcile',
]);

/** Minor-unit exponent per currency. An unknown currency is refused, never defaulted. */
export const CURRENCY_DECIMALS = Object.freeze({ USDT: 6, USDC: 6, USD: 2, INR: 2 });

export class PaymentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PaymentError';
    this.code = code; // UNSUPPORTED | INVALID | BAD_SIGNATURE | NOT_CONFIGURED | DISABLED | GATEWAY
  }
}

export function decimalsFor(currency) {
  const d = CURRENCY_DECIMALS[currency];
  if (d === undefined) throw new PaymentError('INVALID', `unsupported currency: ${currency}`);
  return d;
}

/**
 * Decimal string (e.g. "12.5", "0.000030") → BigInt minor units, exactly.
 * Refuses more fractional digits than the currency carries (never rounds money).
 */
export function decimalToMinor(value, currency) {
  const decimals = decimalsFor(currency);
  const s = typeof value === 'number' ? String(value) : value;
  if (typeof s !== 'string' || !/^\d+(\.\d+)?$/.test(s.trim())) {
    throw new PaymentError('INVALID', `not a non-negative decimal amount: ${value}`);
  }
  const [whole, frac = ''] = s.trim().split('.');
  if (frac.length > decimals && /[1-9]/.test(frac.slice(decimals))) {
    throw new PaymentError('INVALID', `${value} has more precision than ${currency} (${decimals} dp)`);
  }
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((frac.slice(0, decimals) || '0').padEnd(decimals, '0'));
}

/** BigInt minor units → decimal string (display / provider APIs that take decimals). */
export function minorToDecimal(minor, currency) {
  const decimals = decimalsFor(currency);
  const m = BigInt(minor);
  if (m < 0n) throw new PaymentError('INVALID', 'negative amount');
  if (decimals === 0) return m.toString();
  const s = m.toString().padStart(decimals + 1, '0');
  return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}

export function sha256Hex(rawBody) {
  return createHash('sha256').update(rawBody).digest('hex');
}

/**
 * Validate + freeze a CanonicalPaymentEvent. Throws PaymentError('INVALID')
 * with the first problem found — ingestion refuses anything malformed rather
 * than guessing (a mislabelled event must never reach the ledger).
 */
export function canonicalEvent(e) {
  const fail = (m) => { throw new PaymentError('INVALID', `canonical event: ${m}`); };
  if (!e || typeof e !== 'object') fail('not an object');
  for (const k of ['provider', 'providerEventId', 'currency', 'status', 'raw_hash']) {
    if (typeof e[k] !== 'string' || e[k].length === 0) fail(`${k} is required`);
  }
  if (!PAYMENT_STATUSES.includes(e.status)) fail(`unknown status ${e.status}`);
  if (typeof e.amountMinor !== 'bigint' || e.amountMinor < 0n) fail('amountMinor must be a non-negative BigInt');
  decimalsFor(e.currency);
  if (!(e.occurredAt instanceof Date) || Number.isNaN(e.occurredAt.getTime())) fail('occurredAt must be a valid Date');
  if (!/^[0-9a-f]{64}$/.test(e.raw_hash)) fail('raw_hash must be a sha256 hex digest');
  if ([...SETTLED_STATUSES, ...REVERSAL_STATUSES].includes(e.status) && !e.canonicalRef && !e.providerPaymentId) {
    fail('a money-moving event needs canonicalRef or providerPaymentId');
  }
  return Object.freeze({
    provider: e.provider,
    providerEventId: e.providerEventId,
    providerPaymentId: e.providerPaymentId ?? null,
    canonicalRef: e.canonicalRef ?? null,
    customerAccountId: e.customerAccountId ?? null,
    productId: e.productId ?? null,
    amountMinor: e.amountMinor,
    currency: e.currency,
    network: e.network ?? null,
    status: e.status,
    occurredAt: e.occurredAt,
    raw_hash: e.raw_hash,
  });
}

/** Fail fast at registration if an adapter does not implement the contract. */
export function assertAdapter(adapter) {
  if (!adapter || typeof adapter.id !== 'string') throw new PaymentError('INVALID', 'adapter.id is required');
  for (const m of ADAPTER_METHODS) {
    if (typeof adapter[m] !== 'function') throw new PaymentError('INVALID', `adapter ${adapter.id} lacks ${m}()`);
  }
  if (typeof adapter.createCheckout !== 'function' && typeof adapter.createIntent !== 'function') {
    throw new PaymentError('INVALID', `adapter ${adapter.id} needs createCheckout() or createIntent()`);
  }
  const c = adapter.capabilities();
  for (const k of ['oneTime', 'recurring', 'refunds', 'hostedCheckout', 'requiresKyb']) {
    if (typeof c[k] !== 'boolean') throw new PaymentError('INVALID', `adapter ${adapter.id} capabilities().${k} must be boolean`);
  }
  if (!Array.isArray(c.currencies) || !Array.isArray(c.networks)) {
    throw new PaymentError('INVALID', `adapter ${adapter.id} capabilities() needs currencies[] and networks[]`);
  }
  return adapter;
}

export function unsupported(adapterId, method) {
  return async () => { throw new PaymentError('UNSUPPORTED', `${adapterId} does not support ${method}()`); };
}

/** Header lookup that tolerates Express (lower-cased) and plain objects. */
export function header(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  const want = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === want) return Array.isArray(v) ? v[0] : v;
  return undefined;
}
