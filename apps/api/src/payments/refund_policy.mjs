// Refund-policy gate (2026-10-12 directive, Wave 1.8). The merchant's refund policy must be a
// PUBLISHED page before a customer can complete checkout (Dodo-style acceptance requirement).
// The page is https://jakuraa.com/legal/refunds. This module never invents a URL or a
// placeholder: it probes the real page and reports 'published' only on HTTP 200.
//   published      → checkout may complete; receipts/invoices link to it
//   not_published  → page answers non-200 (e.g. 404): show "not yet published", BLOCK completion
//   unreachable    → network error: treated exactly like not_published (fail closed)
export const REFUND_POLICY_URL = 'https://jakuraa.com/legal/refunds';
const TTL_MS = 10 * 60_000;
let cache = null;

export async function refundPolicyStatus({ fetchImpl = globalThis.fetch, url = REFUND_POLICY_URL, now = Date.now(), fresh = false } = {}) {
  if (!fresh && cache && cache.url === url && now - cache.at < TTL_MS) return cache.value;
  let value;
  try {
    const res = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(5_000), headers: { Accept: 'text/html' } });
    value = res.status === 200
      ? { status: 'published', url, httpStatus: 200 }
      : { status: 'not_published', url, httpStatus: res.status };
  } catch (e) {
    value = { status: 'unreachable', url, httpStatus: null, error: e?.name ?? 'fetch_failed' };
  }
  value.checkedAt = new Date(now).toISOString();
  value.completionAllowed = value.status === 'published';
  cache = { url, at: now, value };
  return value;
}

export function __resetRefundPolicyCache() { cache = null; }
