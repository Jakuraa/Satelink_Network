// Supplier catalog — buy-side capability definitions (config/supplier_catalog.v1.json).
//
// This is DATA, not a registry: purchasable offers are loaded into the existing
// vNext SupplierRegistry, which is what the RoutingKernel discovers from. The
// catalog adds what a customer needs to compare suppliers honestly (networks,
// licence, evidence, last verification) and the purchasability rule:
//   an offer can execute only if its status is live/preview AND the requested
//   network/market is 'live'. Everything else is visible, quotable, and refused.
//
// Money is integer micro-USD (BigInt) — never floats.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOG_PATH = path.join(__dirname, '..', '..', 'config', 'supplier_catalog.v1.json');

const OFFER_STATUSES = new Set(['live', 'preview', 'evaluation', 'paused', 'not_authorized']);
const NETWORK_STATUSES = new Set(['live', 'evaluation', 'paused', 'not_authorized']);
const EXECUTABLE = new Set(['live', 'preview']);

/** "0.00003" -> 30n micro-USD. Rejects anything that is not a plain non-negative decimal. */
export function usdToMicros(s) {
  if (s === null || s === undefined) return null;
  const str = String(s);
  if (!/^\d+(\.\d{1,6})?$/.test(str)) throw new RangeError(`invalid USD amount '${str}'`);
  const [whole, frac = ''] = str.split('.');
  return BigInt(whole) * 1_000_000n + BigInt((frac + '000000').slice(0, 6));
}

/** 30n -> "0.00003" */
export function microsToUsd(m) {
  const v = BigInt(m);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export class CatalogError extends Error {
  constructor(message) { super(message); this.name = 'CatalogError'; }
}

/** Strictly validate a parsed catalog. Throws CatalogError on the first problem. */
export function validateCatalog(raw) {
  const bad = (m) => { throw new CatalogError(`supplier catalog: ${m}`); };
  if (!raw || typeof raw !== 'object') bad('not an object');
  if (!Array.isArray(raw.capabilities) || !Array.isArray(raw.offers)) bad('capabilities and offers must be arrays');
  const caps = new Map();
  for (const c of raw.capabilities) {
    if (!c.id || !c.name) bad('capability missing id/name');
    if (caps.has(c.id)) bad(`duplicate capability '${c.id}'`);
    caps.set(c.id, c);
  }
  const ids = new Set();
  for (const o of raw.offers) {
    if (!o.id || ids.has(o.id)) bad(`offer id missing or duplicate '${o.id}'`);
    ids.add(o.id);
    if (!caps.has(o.capability)) bad(`offer '${o.id}' references unknown capability '${o.capability}'`);
    if (!OFFER_STATUSES.has(o.status)) bad(`offer '${o.id}' has invalid status '${o.status}'`);
    if (!o.provider?.id || !o.provider?.name) bad(`offer '${o.id}' missing provider`);
    if (!o.networks || typeof o.networks !== 'object') bad(`offer '${o.id}' missing networks`);
    for (const [n, s] of Object.entries(o.networks)) {
      if (!NETWORK_STATUSES.has(s)) bad(`offer '${o.id}' network '${n}' has invalid status '${s}'`);
    }
    if (!o.pricing || typeof o.pricing.approved !== 'boolean') bad(`offer '${o.id}' pricing.approved must be boolean`);
    usdToMicros(o.pricing.supplier_cost_usd ?? '0');
    if (o.pricing.customer_price_usd != null) usdToMicros(o.pricing.customer_price_usd);
    if (o.pricing.approved && o.pricing.customer_price_usd == null) bad(`offer '${o.id}' approved pricing needs customer_price_usd`);
    if (!o.license || typeof o.license.resale !== 'boolean') bad(`offer '${o.id}' license.resale must be boolean`);
  }
  return raw;
}

export function loadCatalog(file = DEFAULT_CATALOG_PATH) {
  return validateCatalog(JSON.parse(fs.readFileSync(file, 'utf8')));
}

export class SupplierCatalog {
  constructor(raw) {
    this.raw = validateCatalog(raw);
    this.capabilities = new Map(this.raw.capabilities.map((c) => [c.id, c]));
    this.offers = new Map(this.raw.offers.map((o) => [o.id, o]));
  }

  static fromFile(file) { return new SupplierCatalog(JSON.parse(fs.readFileSync(file || DEFAULT_CATALOG_PATH, 'utf8'))); }

  capability(id) { return this.capabilities.get(id) || null; }
  offer(id) { return this.offers.get(id) || null; }
  offersFor(capabilityId) { return [...this.offers.values()].filter((o) => o.capability === capabilityId); }

  /**
   * Can this offer execute for `network` right now? Returns {ok:true} or
   * {ok:false, reason} with a customer-readable reason. Pure — no I/O.
   */
  purchasability(offer, network) {
    if (!EXECUTABLE.has(offer.status)) {
      return { ok: false, reason: `offer_${offer.status}`, detail: this.raw.statuses?.[offer.status] || offer.status };
    }
    const ns = offer.networks[network];
    if (!ns) return { ok: false, reason: 'network_unsupported', detail: `${offer.provider.name} does not support '${network}'.` };
    if (ns !== 'live') return { ok: false, reason: `network_${ns}`, detail: `${offer.provider.name} reports '${network}' as ${ns}.` };
    return { ok: true };
  }

  /** Customer-facing price per call in micro-USD, and whether it is actually charged. */
  price(offer) {
    const supplierCost = usdToMicros(offer.pricing.supplier_cost_usd ?? '0');
    const listed = offer.pricing.customer_price_usd != null ? usdToMicros(offer.pricing.customer_price_usd) : null;
    const charged = offer.pricing.approved ? listed : 0n;
    return { supplierCostMicros: supplierCost, listPriceMicros: listed, chargeMicros: charged, approved: offer.pricing.approved };
  }

  /** Text/category/network search over capabilities, each with its offers summarised. */
  search({ q = '', network = null, category = null } = {}) {
    const needle = String(q || '').trim().toLowerCase();
    const out = [];
    for (const c of this.capabilities.values()) {
      if (category && c.category !== category) continue;
      const offers = this.offersFor(c.id);
      const hay = [c.id, c.name, c.summary, c.category, ...offers.map((o) => o.provider.name)].join(' ').toLowerCase();
      if (needle && !needle.split(/\s+/).every((t) => hay.includes(t))) continue;
      if (network && !offers.some((o) => network in o.networks)) continue;
      out.push(this.describeCapability(c.id, { network }));
    }
    return out;
  }

  describeOffer(o, network = null) {
    const p = this.price(o);
    const nets = Object.entries(o.networks).map(([name, status]) => ({ name, status }));
    return {
      id: o.id,
      capability: o.capability,
      provider: o.provider,
      status: o.status,
      networks: nets,
      pricing: {
        supplier_cost_usd: microsToUsd(p.supplierCostMicros),
        list_price_usd: p.listPriceMicros == null ? null : microsToUsd(p.listPriceMicros),
        charged_usd: microsToUsd(p.chargeMicros),
        approved: p.approved,
        basis: o.pricing.basis || null,
      },
      payment: o.payment,
      sla: o.sla,
      rate_limit: o.rate_limit,
      license: o.license,
      last_verified: o.last_verified,
      purchasable: network ? this.purchasability(o, network) : null,
    };
  }

  describeCapability(id, { network = null } = {}) {
    const c = this.capability(id);
    if (!c) return null;
    const offers = this.offersFor(id).map((o) => this.describeOffer(o, network));
    const networks = [...new Set(offers.flatMap((o) => o.networks.map((n) => n.name)))];
    const executable = offers.filter((o) => EXECUTABLE.has(o.status) && o.networks.some((n) => n.status === 'live'));
    return {
      ...c,
      networks,
      offer_count: offers.length,
      executable_offer_count: executable.length,
      availability: executable.length > 0 ? 'available' : offers.some((o) => o.status === 'evaluation') ? 'evaluation' : 'unavailable',
      offers,
    };
  }

  /**
   * Register every executable (offer, network) pair into a vNext SupplierRegistry so
   * the RoutingKernel can DISCOVER it. Non-executable offers are never registered.
   */
  registerInto(supplierRegistry, workloadFor) {
    let n = 0;
    for (const o of this.offers.values()) {
      if (!EXECUTABLE.has(o.status)) continue;
      const live = Object.entries(o.networks).filter(([, s]) => s === 'live').map(([k]) => k);
      if (live.length === 0) continue;
      const workload = workloadFor(o);
      if (!workload) continue;
      supplierRegistry.register({
        supplierId: o.id,
        adapterId: o.connector?.type || 'none',
        capabilities: [o.capability],
        supportedWorkloads: [workload],
        supportedSettlementModes: ['POST'],
        supportedPaymentRails: [o.payment?.method || 'none'],
        supportedChains: live,
        basePrice: Number(this.price(o).chargeMicros),
        currency: 'uUSD',
        reputation: o.provider.kind === 'first_party' ? 60 : 50,
      });
      n += 1;
    }
    return n;
  }
}
