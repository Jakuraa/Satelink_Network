#!/usr/bin/env node
// Demo Digital Store (MOCK) — a LOCAL stand-in supplier for the Release A preview. Not a real store, no
// real products, no payments. Binds to 127.0.0.1 only.
//
//   GET  /health
//   GET  /products?q=<text>&max_price_usd_minor=<int>   → matching products (cheapest first)
//   POST /orders  { sku, idempotency_key, recipient_email? }  → order (idempotent on idempotency_key)
//   GET  /orders/by-key/:idempotency_key                → order | 404   (verification lookup)
//
// Failure injection (tests/E2E): a product whose title contains "Unavailable" always fails at checkout
// (HTTP 502), and MOCK_STORE_FAIL_ALL=1 fails every order. MOCK_STORE_ORDER_DELAY_MS delays order completion. Orders persist to MOCK_STORE_STATE (JSON file)
// so a restarted API can still verify them.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_STORE_PORT || 4410);
const STATE = process.env.MOCK_STORE_STATE || '';
const PRODUCTS = [
  { sku: 'EBOOK-SCIFI-10', title: 'Sci-fi e-book gift code', category: 'ebook', price_usd_minor: 9_990_000 },
  { sku: 'EBOOK-COOK-8', title: 'Cookbook e-book gift code', category: 'ebook', price_usd_minor: 7_500_000 },
  { sku: 'GIFT-MUSIC-15', title: 'Music streaming gift card', category: 'gift card', price_usd_minor: 15_000_000 },
  { sku: 'GIFT-GAME-25', title: 'Game store gift card', category: 'gift card', price_usd_minor: 25_000_000 },
  { sku: 'SW-NOTES-12', title: 'Note-taking app licence (1 year)', category: 'software licence', price_usd_minor: 12_000_000 },
  { sku: 'GIFT-UNAVAILABLE-5', title: 'Unavailable test voucher', category: 'voucher', price_usd_minor: 5_000_000 },
];
let orders = new Map();
if (STATE && fs.existsSync(STATE)) orders = new Map(Object.entries(JSON.parse(fs.readFileSync(STATE, 'utf8'))));
const save = () => { if (STATE) fs.writeFileSync(STATE, JSON.stringify(Object.fromEntries(orders))); };

function search(q, max) {
  const words = String(q || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return PRODUCTS
    .map((p) => ({ p, s: words.filter((w) => `${p.title} ${p.category}`.toLowerCase().includes(w)).length }))
    .filter((x) => x.s > 0 && (max == null || x.p.price_usd_minor <= max))
    .sort((a, b) => b.s - a.s || a.p.price_usd_minor - b.p.price_usd_minor)
    .map((x) => x.p);
}
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, name: 'Demo Digital Store (MOCK)' });
  if (req.method === 'GET' && url.pathname === '/products') {
    const max = url.searchParams.get('max_price_usd_minor');
    return send(res, 200, { products: search(url.searchParams.get('q'), max == null ? null : Number(max)) });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/orders/by-key/')) {
    const o = orders.get(decodeURIComponent(url.pathname.slice('/orders/by-key/'.length)));
    return o ? send(res, 200, o) : send(res, 404, { error: 'not_found' });
  }
  if (req.method === 'POST' && url.pathname === '/orders') {
    let raw = ''; for await (const c of req) raw += c;
    let b; try { b = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad_json' }); }
    if (typeof b.idempotency_key !== 'string' || b.idempotency_key.length < 8) return send(res, 400, { error: 'idempotency_key required' });
    const existing = orders.get(b.idempotency_key);
    if (existing) return send(res, 200, existing);
    // Restart drill: hold the order open so the caller can be killed mid-request; the order still completes.
    if (Number(process.env.MOCK_STORE_ORDER_DELAY_MS) > 0) await new Promise((r) => setTimeout(r, Number(process.env.MOCK_STORE_ORDER_DELAY_MS)));
    const p = PRODUCTS.find((x) => x.sku === b.sku);
    if (!p) return send(res, 404, { error: 'unknown_sku' });
    if (process.env.MOCK_STORE_FAIL_ALL === '1' || /Unavailable/.test(p.title)) return send(res, 502, { error: 'checkout_failed', detail: 'The mock store could not complete this order.' });
    const o = {
      order_id: `MOCK-${crypto.createHash('sha256').update(b.idempotency_key).digest('hex').slice(0, 12).toUpperCase()}`,
      status: 'confirmed', sku: p.sku, title: p.title, price_usd_minor: p.price_usd_minor,
      delivery: 'Simulated delivery — no real code is issued.', idempotency_key: b.idempotency_key,
      store: 'Demo Digital Store (MOCK)', simulated: true, created_at: new Date().toISOString(),
    };
    orders.set(b.idempotency_key, o); save();
    return send(res, 201, o);
  }
  send(res, 404, { error: 'not_found' });
});
server.listen(PORT, '127.0.0.1', () => console.log(`[mock-store] Demo Digital Store (MOCK) on http://127.0.0.1:${PORT}`));
