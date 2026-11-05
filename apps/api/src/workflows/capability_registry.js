// The ONE capability registry (Release A, P2.2; R1/R9). Every customer surface — assistant discovery,
// planner, Explore, API docs, MCP tools, A2A card, /.well-known files, llms.txt — reads THIS module, which
// reads the `capability_registry` table. The table is seeded from:
//   - config/capabilities.preview.json   (mandate-shaped entries, e.g. shop.digital_goods.purchase)
//   - config/supplier_catalog.v1.json    (#609 offers become providers[] of derived entries)
// #582's pricing_v2/capability_registry.mjs stays the RPC price-rule source; it is not a second catalog of
// purchasable task capabilities.
//
// Planner/assistant code never names a supplier: candidates come only from search() (R9).
// Eulerpool data is internal-only and never appears on a customer surface.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSupportedSchema } from './schema_lite.js';

const CONFIG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'config');
export const RELEASE_STATUSES = Object.freeze(['LIVE', 'PREVIEW', 'SIMULATED', 'COMING_SOON']);
export const CONNECTOR_TYPES = Object.freeze(['native', 'mcp', 'a2a', 'rest', 'plugin', 'webhook', 'payment_adapter']);
/** Release statuses a preview task may EXECUTE (COMING_SOON is listed, never planned). */
export const EXECUTABLE_IN_PREVIEW = Object.freeze(['SIMULATED', 'PREVIEW']);

const REQUIRED = ['id', 'version', 'name', 'description', 'category', 'tags', 'intents', 'input_schema', 'output_schema',
  'providers', 'connector_type', 'interface_meta', 'skill_refs', 'credential_requirements', 'permission_scope', 'markets',
  'currencies', 'price_model', 'fee_policy_id', 'commercial_rights', 'security_class', 'timeout_ms', 'idempotency', 'retry',
  'verification', 'refund_policy', 'availability', 'release_status', 'environment', 'internal_only', 'last_verified_at',
  'last_verified_evidence'];
const INTERNAL_PROVIDER = /eulerpool/i;

export function validateEntry(e) {
  const bad = (m) => { throw new Error(`capability ${e?.id ?? '?'}: ${m}`); };
  for (const k of REQUIRED) if (!(k in (e || {}))) bad(`missing field ${k}`);
  if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(e.id)) bad('id must be dotted lower_snake');
  if (!Number.isSafeInteger(e.version) || e.version < 1) bad('version must be a positive integer');
  if (!RELEASE_STATUSES.includes(e.release_status)) bad('release_status');
  if (!CONNECTOR_TYPES.includes(e.connector_type)) bad('connector_type');
  if (!Array.isArray(e.providers) || e.providers.length === 0) bad('providers must be non-empty');
  for (const p of e.providers) {
    if (!p.id || !p.name) bad('provider id/name');
    if (p.kind === 'mock' && !/\(MOCK(?: — [^)]+)?\)$/.test(p.name)) bad(`mock provider must be named "<name> (MOCK)": ${p.name}`);
  }
  if (typeof e.internal_only !== 'boolean') bad('internal_only must be boolean');
  if (!Number.isSafeInteger(e.timeout_ms) || e.timeout_ms <= 0) bad('timeout_ms');
  assertSupportedSchema(e.input_schema, `${e.id}.input_schema`);
  assertSupportedSchema(e.output_schema, `${e.id}.output_schema`);
  return e;
}

/** Derive registry entries from #609's supplier catalog (its capabilities + offers). */
export function entriesFromSupplierCatalog(catalog) {
  return (catalog.capabilities || []).map((cap) => {
    const offers = catalog.offers.filter((o) => o.capability === cap.id);
    const props = {}; const required = [];
    for (const [k, v] of Object.entries(cap.input || {})) {
      props[k] = { type: v.type === 'number' ? 'number' : v.type || 'string', ...(v.pattern ? { pattern: v.pattern } : {}) };
      if (v.required) required.push(k);
    }
    const providers = offers.map((o) => ({
      id: o.id, name: o.provider.name, kind: o.provider.kind, connector: o.connector?.type || null,
      offer_status: o.status, payment_method: o.payment?.method || null,
      internal_only: INTERNAL_PROVIDER.test(o.provider.name) || INTERNAL_PROVIDER.test(o.id),
    }));
    const live = offers.some((o) => o.status === 'preview');
    return validateEntry({
      id: cap.id, version: 1, name: cap.name, description: cap.summary, category: cap.category,
      tags: [cap.category, ...cap.id.split('.')].map((t) => String(t).toLowerCase()), intents: [],
      input_schema: { type: 'object', required, properties: props },
      output_schema: { type: 'object' },
      providers,
      connector_type: offers.some((o) => o.payment?.method === 'x402') ? 'payment_adapter' : 'rest',
      interface_meta: { supplier_catalog: { version: catalog.version } },
      skill_refs: [], credential_requirements: [], permission_scope: 'tasks:procure',
      markets: ['GLOBAL'], currencies: ['USD'], price_model: { kind: 'supplier_catalog' },
      fee_policy_id: cap.id === 'market_data.candles' ? 'strategy_eval_flat_100000' : 'procurement_10pct_min_2000',
      commercial_rights: { resale_allowed: null, terms_url: null, evidence: 'See SUPPLIER_INTEGRATION_STATUS.md; no supplier agreement is in place.' },
      security_class: 'untrusted_output', timeout_ms: 15000, idempotency: { required: true }, retry: { max_attempts: 1, on: [] },
      verification: { method: 'result_contract', evidence_fields: [] },
      refund_policy: 'Preview: failed calls are never charged.',
      availability: live ? 'preview_supplier' : 'evaluation_only',
      release_status: live ? 'PREVIEW' : 'COMING_SOON', environment: 'preview',
      internal_only: providers.every((p) => p.internal_only),
      disclaimer: cap.disclaimer || null,
      last_verified_at: null, last_verified_evidence: 'config/supplier_catalog.v1.json',
    });
  });
}

export function loadSeedEntries({
  capabilitiesFile = path.join(CONFIG_DIR, 'capabilities.preview.json'),
  supplierCatalogFile = path.join(CONFIG_DIR, 'supplier_catalog.v1.json'),
} = {}) {
  const own = JSON.parse(fs.readFileSync(capabilitiesFile, 'utf8')).capabilities.map(validateEntry);
  const derived = entriesFromSupplierCatalog(JSON.parse(fs.readFileSync(supplierCatalogFile, 'utf8')));
  const ids = new Set(own.map((e) => e.id));
  return [...own, ...derived.filter((e) => !ids.has(e.id))];
}

/** What a customer surface may see: no internal entries, no internal providers. */
export function customerView(e) {
  if (!e || e.internal_only) return null;
  const providers = e.providers.filter((p) => !p.internal_only).map(({ internal_only, ...p }) => p);
  if (providers.length === 0) return null;
  return { ...e, providers };
}

function score(e, words) {
  if (!words.length) return 1;
  const hay = [e.name, e.description, e.category, ...(e.tags || []), ...(e.intents || []), e.id].join(' ').toLowerCase();
  let s = 0;
  for (const w of words) if (hay.includes(w)) s += (e.tags || []).includes(w) || (e.intents || []).includes(w) ? 3 : 1;
  return s;
}

export class CapabilityRegistry {
  /** pool: pg Pool (production/preview). Without a pool the registry is in-memory (unit tests only, R2). */
  constructor(pool = null) { this.pool = pool; this.mem = new Map(); }

  async seed(entries = loadSeedEntries()) {
    for (const e of entries.map(validateEntry)) {
      if (!this.pool) { this.mem.set(`${e.id}@${e.version}`, e); continue; }
      await this.pool.query(
        `INSERT INTO capability_registry (id, version, entry, release_status, internal_only, updated_at)
         VALUES ($1,$2,$3::jsonb,$4,$5,now())
         ON CONFLICT (id, version) DO UPDATE SET entry = EXCLUDED.entry, release_status = EXCLUDED.release_status,
           internal_only = EXCLUDED.internal_only, updated_at = now()`,
        [e.id, e.version, JSON.stringify(e), e.release_status, e.internal_only],
      );
    }
    return entries.length;
  }

  /** Latest version of every entry (internal ones included — callers pick a view). */
  async all() {
    if (!this.pool) {
      const latest = new Map();
      for (const e of this.mem.values()) if (!latest.has(e.id) || latest.get(e.id).version < e.version) latest.set(e.id, e);
      return [...latest.values()];
    }
    const { rows } = await this.pool.query(
      `SELECT DISTINCT ON (id) entry FROM capability_registry ORDER BY id, version DESC`,
    );
    return rows.map((r) => validateEntry(r.entry));
  }

  /** Customer-facing search (internal entries/providers removed). */
  async search({ q = '', intent = null, market = null, status = null, limit = 20 } = {}) {
    const words = String(q).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
    return (await this.all())
      .map(customerView).filter(Boolean)
      .filter((e) => !intent || (e.intents || []).includes(intent))
      .filter((e) => !market || e.markets.includes(market) || e.markets.includes('GLOBAL'))
      .filter((e) => !status || e.release_status === status)
      .map((e) => ({ e, s: score(e, words) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id))
      .slice(0, limit)
      .map((x) => x.e);
  }

  /** Customer-facing get (null for unknown or internal). */
  async get(id) {
    return customerView((await this.all()).find((e) => e.id === id) || null);
  }

  /** Internal get (planner/router use, e.g. ai.model.inference); never returned to a customer. */
  async getInternal(id) {
    return (await this.all()).find((e) => e.id === id) || null;
  }
}
