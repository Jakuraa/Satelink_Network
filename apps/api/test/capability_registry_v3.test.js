// Capability Registry v3 skeleton (decision S-6). Hermetic: no DB, no network.
//
// v1 the registry block in config/plan_catalog.v2.json is valid; the validator rejects each malformed shape
// v2 CAPABILITY_REGISTRY_V3=1 changes NO live price: /v1/pricing and /.well-known/satelink.json are identical
//    to flag-off except for the added capability list
// v3 registry ↔ /v1/pricing ↔ MCP tool list agree (prices, tools, products), and withheld prices never surface
// v4 snapshot: the public registry view is pinned in capability_registry_v3.snapshot.json — any price or
//    listing change must update the snapshot in the same PR (visible in review)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import { loadCatalog, validateCatalog } from '../src/pricing_v2/catalog.mjs';
import { railPrices } from '../src/pricing_v2/rails.mjs';
import {
  validateCapabilities, publicCapabilities, registryRpcPrices, microToUsd, RPC_CREDITS_CAPABILITY, RPC_X402_BUNDLE_CAPABILITY,
} from '../src/pricing_v2/capability_registry.mjs';
import { PRICE_PER_CALL_USDT } from '../src/billing/credit_service.mjs';
import { createWellKnownSatelinkRouter, createMachineV1Router } from '../src/routes/machine_onboarding.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.join(here, 'capability_registry_v3.snapshot.json');
const clone = (o) => JSON.parse(JSON.stringify(o));

function withFlag(value, fn) {
  const saved = process.env.CAPABILITY_REGISTRY_V3;
  if (value === undefined) delete process.env.CAPABILITY_REGISTRY_V3; else process.env.CAPABILITY_REGISTRY_V3 = value;
  return Promise.resolve(fn()).finally(() => {
    if (saved === undefined) delete process.env.CAPABILITY_REGISTRY_V3; else process.env.CAPABILITY_REGISTRY_V3 = saved;
  });
}

function app() {
  const a = express();
  a.use('/.well-known', createWellKnownSatelinkRouter());
  a.use('/v1', createMachineV1Router({ query: async () => ({ rows: [], rowCount: 0 }) }));
  return a;
}
// Volatile/best-effort fields (pricing intelligence, timestamps) are not part of the price contract.
const VOLATILE = ['market_position', 'market_median_usd_per_million', 'effective_usd_per_million', 'machine_preference_score', 'why_choose_satelink'];
const stable = (b) => { const o = clone(b); for (const k of VOLATILE) delete o[k]; return o; };

describe('Capability Registry v3 (S-6 skeleton)', () => {
  const c = loadCatalog();

  it('v1: the catalog registry is valid; every malformed shape is rejected', () => {
    assert.deepEqual(validateCapabilities(c), []);
    assert.deepEqual(validateCatalog(c), []);
    const bad = (mutate, re) => {
      const x = clone(c);
      mutate(x);
      const errs = validateCapabilities(x);
      assert.ok(errs.some((e) => re.test(e)), `expected ${re} in ${JSON.stringify(errs)}`);
    };
    const rpc = (x) => x.capabilities.find((k) => k.id === RPC_CREDITS_CAPABILITY);
    const ti = (x) => x.capabilities.find((k) => k.pricing.amount_micro === null);
    bad((x) => { x.capabilities.push(clone(rpc(x))); }, /duplicate id/);
    bad((x) => { rpc(x).id = 'RPC Call'; }, /id must be dotted/);
    bad((x) => { rpc(x).status = 'production-verified'; }, /status must be one of/);
    bad((x) => { rpc(x).product = 'nope'; }, /unknown product nope/);
    bad((x) => { rpc(x).audience = ['robots']; }, /audience/);
    bad((x) => { rpc(x).interfaces.mcp_tool = 'funding_rate_heatmap'; }, /not in product polygon_rpc\.mcp_tools/);
    bad((x) => { delete rpc(x).interfaces.console; }, /interfaces must have exactly/);
    bad((x) => { rpc(x).pricing.amount_micro = 0.5; }, /amount_micro must be an integer/);
    bad((x) => { rpc(x).pricing.amount_micro = -1; }, /amount_micro must be an integer/);
    bad((x) => { rpc(x).pricing.amount_micro = '30'; }, /amount_micro must be an integer/);
    bad((x) => { rpc(x).pricing.currency = 'USDT'; }, /currency must be USD/);
    bad((x) => { rpc(x).pricing.unit = 'bundle'; }, /pricing\.unit/);
    bad((x) => { rpc(x).pricing.quantity = 0; }, /pricing\.quantity/);
    bad((x) => { rpc(x).pricing.basis = 'auction'; }, /pricing\.basis/);
    bad((x) => { rpc(x).pricing.basis = 'cost_plus'; }, /cost_plus needs/);
    bad((x) => { rpc(x).pricing.cost_plus = { markup_bps: 100, floor_micro: 1 }; }, /cost_plus only allowed/);
    bad((x) => { rpc(x).pricing.included_in = ['no_such_plan']; }, /included_in/);
    bad((x) => { rpc(x).pricing.overage = []; }, /overage/);
    bad((x) => { rpc(x).pricing.on_failure = 'keep'; }, /on_failure/);
    bad((x) => { rpc(x).pricing.refund_rule = 'delete'; }, /refund_rule/);
    bad((x) => { rpc(x).pricing.effective_from = '22/10/2026'; }, /effective_from/);
    bad((x) => { rpc(x).pricing.version = 0; }, /pricing\.version/);
    bad((x) => { rpc(x).pricing.status = 'published'; }, /pricing\.status/);
    bad((x) => { rpc(x).pricing.status = 'withheld'; }, /status withheld requires amount_micro null/);
    bad((x) => { ti(x).pricing.status = 'live'; }, /amount_micro null requires status withheld/);
    bad((x) => { delete rpc(x).pricing; }, /pricing required/);
    bad((x) => { ti(x).commercial_status = 'sellable'; }, /withheld price cannot be sellable/);
    bad((x) => { rpc(x).commercial_status = 'for sale'; }, /commercial_status/);
    bad((x) => { rpc(x).approval_mode = 'auto'; }, /approval_mode/);
    bad((x) => { x.capabilities = {}; }, /must be an array/);
    bad((x) => { x.capabilities = x.capabilities.filter((k) => k.id !== RPC_X402_BUNDLE_CAPABILITY); }, /x402_bundle required/);
    bad((x) => { Object.assign(rpc(x).pricing, { amount_micro: null, status: 'withheld' }); rpc(x).commercial_status = 'internal'; }, /rpc\.polygon\.call cannot be withheld/);
    // no registry block at all: valid, and the flag is a no-op (never a 500)
    const { capabilities: _c, ...noBlock } = clone(c);
    assert.deepEqual(validateCapabilities(noBlock), []);
    assert.deepEqual(railPrices(noBlock, { CAPABILITY_REGISTRY_V3: '1' }), railPrices(noBlock, {}));
    assert.ok(validateCatalog({ ...clone(c), capabilities: [{}] }).length > 0, 'loadCatalog rejects an invalid registry');
  });

  it('v2: turning CAPABILITY_REGISTRY_V3 on changes no live price on /v1/pricing or /.well-known/satelink.json', async () => {
    const get = async (p) => (await request(app()).get(p)).body;
    const off = await withFlag(undefined, async () => ({ pricing: await get('/v1/pricing'), manifest: await get('/.well-known/satelink.json') }));
    const on = await withFlag('1', async () => ({ pricing: await get('/v1/pricing'), manifest: await get('/.well-known/satelink.json') }));
    for (const k of ['pricing', 'manifest']) {
      assert.equal(off[k].capabilities, undefined, `${k}: flag off lists no capabilities`);
      const { capabilities, capability_registry_version, ...rest } = on[k];
      assert.ok(Array.isArray(capabilities) && capabilities.length > 0, `${k}: flag on lists capabilities`);
      assert.equal(capability_registry_version, c.version);
      assert.deepEqual(stable(rest), stable(off[k]), `${k}: everything except the capability list is unchanged`);
    }
    assert.equal(on.pricing.price_per_call_usdt, 0.00003);
    assert.equal(on.pricing.rails.rpc_x402_bundle.price_usd, 0.1);
    assert.equal(on.pricing.rails.rpc_x402_bundle.calls, 1000);
    // only the exact value "1" turns it on
    const loose = await withFlag('true', () => get('/v1/pricing'));
    assert.equal(loose.capabilities, undefined);
    // /.well-known/x402 never changes with the flag
    const x402off = await withFlag(undefined, () => get('/.well-known/x402'));
    const x402on = await withFlag('1', () => get('/.well-known/x402'));
    assert.deepEqual(stable(x402on), stable(x402off));
  });

  it('v2b: x402 env overrides (charged price) show identically in rails and in the registry view', async () => {
    const saved = { p: process.env.X402_BUNDLE_PRICE_USD, n: process.env.X402_BUNDLE_CALLS };
    process.env.X402_BUNDLE_PRICE_USD = '0.25';
    process.env.X402_BUNDLE_CALLS = '2000';
    try {
      const body = await withFlag('1', async () => (await request(app()).get('/v1/pricing')).body);
      const cap = body.capabilities.find((k) => k.id === RPC_X402_BUNDLE_CAPABILITY);
      assert.deepEqual([body.rails.rpc_x402_bundle.price_usd, body.rails.rpc_x402_bundle.calls], [0.25, 2000]);
      assert.deepEqual([cap.pricing.amount_micro, cap.pricing.quantity], [250_000, 2000]);
      process.env.X402_BUNDLE_PRICE_USD = '0.1234567'; // > 6 decimals: never shown as a rounded number
      const odd = publicCapabilities(c, process.env).find((k) => k.id === RPC_X402_BUNDLE_CAPABILITY);
      assert.deepEqual(odd.pricing, { status: 'withheld', unit: 'call', currency: 'USD' });
    } finally {
      for (const [k, v] of [['X402_BUNDLE_PRICE_USD', saved.p], ['X402_BUNDLE_CALLS', saved.n]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
  });

  it('v2c: a withheld price on a public, live capability is listed as { status: withheld } with no amount', () => {
    const x = clone(c);
    x.capabilities.push({ ...clone(x.capabilities[0]), id: 'rpc.polygon.trace', commercial_status: 'internal',
      pricing: { ...clone(x.capabilities[0].pricing), amount_micro: null, status: 'withheld' } });
    assert.deepEqual(validateCapabilities(x), []);
    const view = publicCapabilities(x, {}).find((k) => k.id === 'rpc.polygon.trace');
    assert.deepEqual(view.pricing, { status: 'withheld', unit: 'call', currency: 'USD' });
    assert.ok(!JSON.stringify(view).includes('amount_micro'));
  });

  it('v3: registry, rails, /v1/pricing and the MCP tool list agree; withheld prices never surface', async () => {
    // registry ↔ catalog rails ↔ enforcement constant
    const reg = registryRpcPrices(c);
    assert.equal(reg.rpc_credits.price_usd_per_call, c.rails.rpc_credits.price_usd_per_call);
    assert.equal(reg.rpc_credits.price_usd_per_call, PRICE_PER_CALL_USDT);
    assert.deepEqual(reg.rpc_x402_bundle, { price_usd: c.rails.rpc_x402_bundle.price_usd, calls: c.rails.rpc_x402_bundle.calls });
    assert.deepEqual(railPrices(c, { CAPABILITY_REGISTRY_V3: '1' }), railPrices(c, {}));

    // registry ↔ /v1/pricing (flag on): every listed price is the registry's integer micro-USD
    const body = await withFlag('1', async () => (await request(app()).get('/v1/pricing')).body);
    const listed = new Map(body.capabilities.map((k) => [k.id, k]));
    const credit = listed.get(RPC_CREDITS_CAPABILITY);
    const bundle = listed.get(RPC_X402_BUNDLE_CAPABILITY);
    assert.equal(microToUsd(credit.pricing.amount_micro) / credit.pricing.quantity, body.price_per_call_usdt);
    assert.equal(microToUsd(bundle.pricing.amount_micro), body.rails.rpc_x402_bundle.price_usd);
    assert.equal(bundle.pricing.quantity, body.rails.rpc_x402_bundle.calls);

    // registry ↔ MCP tools
    const { TOOL_PRODUCTS, advertisedTools } = await import('../../mcp-server/src/server-factory.mjs');
    const capTools = new Map();
    for (const k of c.capabilities) if (k.interfaces.mcp_tool) capTools.set(k.interfaces.mcp_tool, k.product);
    assert.deepEqual([...capTools.keys()].sort(), Object.keys(TOOL_PRODUCTS).sort(), 'every MCP tool has a capability and vice versa');
    for (const [tool, product] of capTools) assert.equal(TOOL_PRODUCTS[tool], product, `${tool}: same product in registry and MCP`);
    const publicTools = new Set(publicCapabilities(c, {}).map((k) => k.interfaces.mcp_tool).filter(Boolean));
    assert.deepEqual(advertisedTools({ includeInternal: false }).map((t) => t.name).sort(), [...publicTools].sort(),
      'MCP advertises exactly the tools of public capabilities');

    // withheld (F8) entries: internal, never priced on any public surface
    const withheld = c.capabilities.filter((k) => k.pricing.amount_micro === null);
    assert.ok(withheld.length >= 4, 'Trading Intelligence stays withheld until F8');
    const surfaces = await withFlag('1', async () => JSON.stringify([
      (await request(app()).get('/v1/pricing')).body, (await request(app()).get('/.well-known/satelink.json')).body,
    ]));
    for (const k of withheld) {
      assert.equal(k.pricing.status, 'withheld');
      assert.ok(!listed.has(k.id), `${k.id}: withheld capability not listed publicly`);
      assert.ok(!surfaces.includes(`"${k.id}"`), `${k.id}: absent from public surfaces`);
    }
    assert.doesNotMatch(surfaces, /price_usd_per_request|intelligence_credits/);
  });

  it('v4: the public registry view matches the committed snapshot (price changes need a reviewed snapshot update)', () => {
    const view = publicCapabilities(c, {});
    if (process.env.UPDATE_REGISTRY_SNAPSHOT === '1') fs.writeFileSync(SNAPSHOT, `${JSON.stringify(view, null, 2)}\n`);
    assert.deepEqual(view, JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')));
  });
});
