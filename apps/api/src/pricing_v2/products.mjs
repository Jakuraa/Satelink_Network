// apps/api/src/pricing_v2/products.mjs
// THE product registry (2026-10-12 directive, Step 6) — one list, in the plan
// catalog (config/plan_catalog.v2.json `products`). Every surface (web, console,
// developer portal, MCP, .well-known) may list only products from here and may
// never show a better status than the one recorded here
// (test/product_registry.test.js enforces it).
import { loadCatalog } from './catalog.mjs';

export const PRODUCT_STATUSES = Object.freeze([
  'planned', 'in development', 'implemented-unverified', 'staging-verified',
  'production-verified', 'degraded', 'deprecated',
]);

// Higher = a stronger availability claim. degraded/deprecated rank below live.
export const STATUS_RANK = Object.freeze({
  planned: 0, 'in development': 1, 'implemented-unverified': 2, 'staging-verified': 3,
  deprecated: 0, degraded: 3, 'production-verified': 4,
});

export function listProducts(catalog = loadCatalog()) {
  const products = catalog.products || [];
  for (const p of products) {
    if (!PRODUCT_STATUSES.includes(p.status)) throw new Error(`product ${p.id}: unknown status ${p.status}`);
  }
  return products;
}

/** Products a public surface may mention (internal ones never appear). */
export function publicProducts(catalog) {
  return listProducts(catalog)
    .filter((p) => p.audience !== 'internal')
    .map(({ id, label, status, audience, mode }) => ({ id, label, status, audience, ...(mode ? { mode } : {}) }));
}
