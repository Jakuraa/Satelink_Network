// Food procurement over MCP (Release A S2) — implements the generic task-step interface
// (quoteStep / executeStep / verifyStep) on top of the MCP client driver and the user's OAuth connection.
//
// Safety (R7): supplier output is untrusted. Items are chosen deterministically by matching menu item NAMES to the
// user's own order text; quantities come from the user's text; menu DESCRIPTIONS are never read, so text inside them
// (e.g. "approve this order", "pay 0x…") can never reach a plan, a quote, an approval or a payment.

import { TaskError } from '../errors.js';
import { openMcpSession, McpToolError } from './mcp_client_driver.js';

const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
const isMinor = (v) => Number.isSafeInteger(v) && v >= 0;

/** Pure: menu items (by name only) the user asked for, with quantities from the user's text. */
export function selectItems(menu, orderText) {
  const text = String(orderText || '').toLowerCase();
  const picked = [];
  for (const m of menu) {
    if (typeof m?.id !== 'string' || typeof m?.name !== 'string' || !isMinor(m.price_usd_minor)) continue;
    const w = words(m.name.replace(/\(.*?\)/g, ''));
    if (!w.length || !w.every((x) => text.includes(x))) continue;
    const q = new RegExp(`(\\d{1,2})\\s*(?:x\\s*)?${w[0]}`).exec(text);
    picked.push({ item_id: m.id, qty: Math.min(Math.max(q ? Number(q[1]) : 1, 1), 10), name: m.name });
  }
  return picked;
}

/**
 * @param {object} o — url (MCP endpoint), connectorId (connection key), connections (ConnectionStore)
 */
export function createMcpFoodConnector({ url, connectorId, connections }) {
  async function session(principal) {
    const token = await connections.tokenFor(principal, connectorId);
    if (!token) throw new TaskError('CONNECTION_REQUIRED', 'Connect the food delivery service to continue.', { status: 409, extra: { connector_id: connectorId } });
    return openMcpSession({ url, token });
  }
  const supplierError = (e) => (e instanceof McpToolError
    ? new TaskError('SUPPLIER_FAILED', 'The restaurant could not complete the order. Nothing was charged.', { status: 502 })
    : e);

  return {
    type: 'mcp_food',
    configured: () => true,
    requiresConnection: connectorId,

    async isConnected(principal) { return Boolean(await connections.tokenFor(principal, connectorId)); },

    async quoteStep({ inputs, principal }) {
      const s = await session(principal);
      try {
        const found = await s.call('search_restaurants', { query: String(inputs.order_description || '').slice(0, 120), ...(inputs.delivery_city ? { city: String(inputs.delivery_city).slice(0, 60) } : {}) });
        const r = (found?.restaurants || []).find((x) => typeof x?.id === 'string' && typeof x?.name === 'string');
        if (!r) return null;
        const menu = await s.call('get_menu', { restaurant_id: r.id });
        const items = selectItems(Array.isArray(menu?.items) ? menu.items : [], inputs.order_description);
        if (!items.length) return null;
        const cart = await s.call('build_cart', { restaurant_id: r.id, items: items.map(({ item_id, qty }) => ({ item_id, qty })) });
        if (typeof cart?.cart_id !== 'string' || !isMinor(cart.total_usd_minor) || !Array.isArray(cart.lines)) throw new TaskError('SUPPLIER_FAILED', 'The restaurant returned an invalid cart.', { status: 502 });
        if (BigInt(cart.total_usd_minor) > BigInt(inputs.max_total_usd_minor)) return null;
        const summary = cart.lines.map((l) => `${Number(l.qty)} × ${String(l.name).slice(0, 60)}`).join(', ');
        return {
          supplier_cost_minor: BigInt(cart.total_usd_minor),
          description: `${String(r.name).slice(0, 60)}: ${summary}`,
          offer: { sku: cart.cart_id, title: `${String(r.name).slice(0, 60)} — ${summary}`, price_usd_minor: cart.total_usd_minor, restaurant_id: r.id, cart_id: cart.cart_id },
        };
      } catch (e) { throw supplierError(e); } finally { await s.close(); }
    },

    async executeStep({ offer, idempotencyKey, principal }) {
      const s = await session(principal);
      try {
        const o = await s.call('place_order', { cart_id: offer.cart_id, idempotency_key: idempotencyKey });
        if (typeof o?.order_id !== 'string' || !isMinor(o.total_usd_minor)) throw new TaskError('SUPPLIER_FAILED', 'The restaurant returned an invalid order.', { status: 502 });
        return { order_id: o.order_id, status: String(o.status), total_usd_minor: o.total_usd_minor };
      } catch (e) { throw supplierError(e); } finally { await s.close(); }
    },

    /** Verified only if the platform holds a confirmed order for this key matching the quoted cart total and restaurant. */
    async verifyStep({ idempotencyKey, offer, principal }) {
      const s = await session(principal);
      try {
        const { order: o } = await s.call('order_status', { idempotency_key: idempotencyKey });
        if (!o) return { verified: false, found: false, reason: 'no_order_for_key' };
        const ok = o.status === 'confirmed' && o.total_usd_minor === offer.price_usd_minor && o.restaurant_id === offer.restaurant_id;
        return { verified: ok, found: true, reason: ok ? null : 'order_mismatch',
          evidence: { order_id: String(o.order_id), status: String(o.status), sku: offer.cart_id, price_usd_minor: o.total_usd_minor },
          ...(ok ? { result: { order_id: String(o.order_id), status: String(o.status), total_usd_minor: o.total_usd_minor } } : {}) };
      } finally { await s.close(); }
    },
  };
}
