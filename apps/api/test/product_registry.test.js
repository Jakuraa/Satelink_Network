// Product registry (2026-10-12 directive, Step 6) — ONE list in
// config/plan_catalog.v2.json `products`. Fails CI when satelink.network, the
// console, the developer portal, MCP or .well-known lists something not in the
// registry, or shows a better status than the registry. Hermetic: no DB/network.
//
// r1 registry is well-formed (known statuses, unique ids, evidence for every entry)
// r2 .well-known/satelink.json lists exactly the registry's public products, same status
// r3 MCP advertises only tools of registry products that are public + not deprecated/planned;
//    internal tools appear only on explicit opt-in; every MCP tool maps to a registry product
// r4 web / console / corporate / developer-portal copy never claims a product is live or
//    purchasable unless the registry says production-verified, and never mentions a product
//    whose registry audience is internal as something to buy
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { listProducts, publicProducts, PRODUCT_STATUSES } from '../src/pricing_v2/products.mjs';
import { createWellKnownSatelinkRouter } from '../src/routes/machine_onboarding.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..');
const SURFACE_DIRS = ['apps/web/src', 'apps/console/src', 'apps/corporate/app', 'apps/corporate/content', 'packages/content'];
const LIVE_CLAIM = /\b(now live|is live|live now|generally available|available now|buy now|subscribe now|start (your )?subscription)\b/i;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|mdx?|json)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

describe('Product registry (Step 6): one list, no surface over-claims', () => {
  const products = listProducts();
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  it('r1: registry is well-formed', () => {
    assert.ok(products.length >= 4);
    assert.equal(new Set(products.map((p) => p.id)).size, products.length, 'unique ids');
    for (const p of products) {
      assert.ok(PRODUCT_STATUSES.includes(p.status), `${p.id} status`);
      assert.ok(typeof p.evidence === 'string' && p.evidence.length > 10, `${p.id} evidence`);
      assert.ok(['public', 'beta', 'internal'].includes(p.audience), `${p.id} audience`);
    }
    // the honest inventory this round (founder directive): no personal agent code exists
    assert.equal(byId.personal_ai_agent?.status, 'planned');
    assert.equal(byId.trading_intelligence?.audience, 'internal');
  });

  it('r2: .well-known lists exactly the public registry products with the same status', async () => {
    const app = express(); app.use('/.well-known', createWellKnownSatelinkRouter());
    const m = (await request(app).get('/.well-known/satelink.json')).body;
    assert.deepEqual(m.products.items, publicProducts());
    for (const it of m.products.items) assert.equal(it.status, byId[it.id].status);
    assert.ok(!m.products.items.some((p) => byId[p.id].audience === 'internal'));
  });

  it('r3: MCP tool list is derived from the registry', async () => {
    const { advertisedTools, TOOL_PRODUCTS } = await import('../../mcp-server/src/server-factory.mjs');
    for (const [tool, pid] of Object.entries(TOOL_PRODUCTS)) {
      assert.ok(byId[pid], `MCP tool ${tool} → unknown product ${pid}`);
      assert.ok((byId[pid].mcp_tools || []).includes(tool), `registry ${pid}.mcp_tools must list ${tool}`);
    }
    const listed = advertisedTools({ includeInternal: false }).map((t) => t.name);
    assert.ok(listed.length > 0);
    for (const tool of listed) {
      const p = byId[TOOL_PRODUCTS[tool]];
      assert.notEqual(p.audience, 'internal', `${tool}: internal product advertised by default`);
      assert.ok(!['deprecated', 'planned'].includes(p.status), `${tool}: ${p.status} product advertised`);
    }
    assert.ok(advertisedTools({ includeInternal: true }).length > listed.length, 'internal tools only on opt-in');
    // the default description must not promise free calls (no free RPC)
    const desc = advertisedTools({ includeInternal: false }).map((t) => t.description).join(' ');
    assert.doesNotMatch(desc, /\bfree\b/i);
  });

  it('r4: no web/console/portal copy claims a better status than the registry', () => {
    const offenders = [];
    for (const dir of SURFACE_DIRS) {
      for (const file of walk(path.join(ROOT, dir))) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          for (const p of products) {
            if (!line.includes(p.label)) continue;
            const liveOk = p.status === 'production-verified';
            if (!liveOk && LIVE_CLAIM.test(line)) offenders.push(`${path.relative(ROOT, file)}:${i + 1} "${p.label}" claims live (registry: ${p.status})`);
          }
        });
      }
    }
    assert.deepEqual(offenders, []);
  });
});
