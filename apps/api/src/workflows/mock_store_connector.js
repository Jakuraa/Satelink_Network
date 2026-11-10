// Connector for the local "Demo Digital Store (MOCK)" (tools/mock-digital-store). Supplier output is
// UNTRUSTED data (R7): every response is shape-checked here and nothing in it can change a plan,
// approve, or pay. The base URL must be a loopback address (SSRF guard).

import { TaskError, ERR } from './errors.js';

import { assertEgressUrl, egressFetch } from './connectors/egress_guard.js';

export function createMockStoreConnector({ baseUrl = process.env.MOCK_STORE_URL || 'http://127.0.0.1:4410', fetchImpl = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  const u = assertEgressUrl(baseUrl, { what: 'mock store' });
  fetchImpl = egressFetch(fetchImpl, { what: 'mock store' });
  const base = u.origin;

  async function call(path, init = {}) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}${path}`, { ...init, signal: ctrl.signal, headers: { 'content-type': 'application/json' } });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    } catch (e) {
      if (e?.name === 'AbortError') throw new TaskError(ERR.UPSTREAM_TIMEOUT, 'The store did not answer in time.', { status: 504, retryable: true });
      throw new TaskError('SUPPLIER_UNAVAILABLE', 'The store is unavailable.', { status: 503, retryable: true });
    } finally { clearTimeout(t); }
  }

  const isOrder = (o) => o && typeof o.order_id === 'string' && typeof o.sku === 'string' && Number.isSafeInteger(o.price_usd_minor) && o.price_usd_minor >= 0 && typeof o.status === 'string';

  return {
    type: 'mock_store',
    configured: () => true,

    /** Cheapest product matching the query within the price cap, or null. */
    async findProduct({ product_query, max_price_usd_minor }) {
      const q = new URLSearchParams({ q: String(product_query || '').slice(0, 120), max_price_usd_minor: String(max_price_usd_minor) });
      const { status, body } = await call(`/products?${q}`);
      if (status !== 200 || !Array.isArray(body.products)) throw new TaskError('SUPPLIER_UNAVAILABLE', 'The store returned an invalid catalogue.', { status: 502 });
      const p = body.products.find((x) => typeof x.sku === 'string' && Number.isSafeInteger(x.price_usd_minor) && x.price_usd_minor <= max_price_usd_minor);
      return p ? { sku: p.sku, title: String(p.title).slice(0, 120), price_usd_minor: p.price_usd_minor } : null;
    },

    /** Place an order. Idempotent on `idempotencyKey` at the store. */
    async placeOrder({ sku, idempotencyKey, recipient_email }) {
      const { status, body } = await call('/orders', { method: 'POST', body: JSON.stringify({ sku, idempotency_key: idempotencyKey, ...(recipient_email ? { recipient_email } : {}) }) });
      if (status === 502 || status === 503) throw new TaskError('SUPPLIER_FAILED', 'The store could not complete the order. Nothing was charged.', { status: 502 });
      if (status >= 400 || !isOrder(body)) throw new TaskError('SUPPLIER_FAILED', 'The store returned an invalid order.', { status: 502 });
      return { order_id: body.order_id, status: body.status, sku: body.sku, price_usd_minor: body.price_usd_minor, delivery: String(body.delivery || '').slice(0, 200) };
    },

    // ── Generic task-step interface (task_service.js calls only these) ──────────────────────────────
    async quoteStep({ inputs }) {
      const p = await this.findProduct(inputs);
      if (!p) return null;
      return { supplier_cost_minor: BigInt(p.price_usd_minor), offer: p, description: `${p.title} (${p.sku})` };
    },
    async executeStep({ inputs, offer, idempotencyKey }) {
      return this.placeOrder({ sku: offer.sku, idempotencyKey, recipient_email: inputs.recipient_email });
    },
    /** Verified only if the store holds a confirmed order for this key matching the quoted sku and price. */
    async verifyStep({ idempotencyKey, offer }) {
      const o = await this.lookupOrder(idempotencyKey);
      if (!o) return { verified: false, found: false, reason: 'no_order_for_key' };
      const ok = o.status === 'confirmed' && o.sku === offer.sku && o.price_usd_minor === offer.price_usd_minor;
      // result: the supplier's record in executeStep's shape, so a crash-recovered task still shows what was bought.
      return { verified: ok, found: true, reason: ok ? null : 'order_mismatch', evidence: o, ...(ok ? { result: o } : {}) };
    },

    /** Verification lookup by idempotency key (null if the store has no such order). */
    async lookupOrder(idempotencyKey) {
      const { status, body } = await call(`/orders/by-key/${encodeURIComponent(idempotencyKey)}`);
      if (status === 404) return null;
      if (status !== 200 || !isOrder(body)) throw new TaskError('SUPPLIER_UNAVAILABLE', 'The store returned an invalid order record.', { status: 502 });
      return { order_id: body.order_id, status: body.status, sku: body.sku, price_usd_minor: body.price_usd_minor, delivery: String(body.delivery || '').slice(0, 200) };
    },
  };
}
