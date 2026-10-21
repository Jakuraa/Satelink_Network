// Capability Registry v3 (decision S-6, skeleton). The `capabilities` block of
// config/plan_catalog.v2.json — an extension of the PlanCatalog, not a parallel registry.
// One entry per sellable or listable capability, in the mandate M2 shape, with an integer
// price in micro-USD:
//
//   price.amount_micro  integer ≥ 0 (1 USD = 1,000,000), or null = WITHHELD
//   price.withheld      required reason when amount_micro is null (e.g. "F8": founder has not
//                       confirmed the price); forbidden when a price is present
//
// Behind CAPABILITY_REGISTRY_V3=1 (read per request) discovery surfaces take their RPC prices
// from here instead of `rails` (rails.mjs) and list the public capabilities. The values are the
// same, so turning the flag on changes no live price — test/capability_registry_v3.test.js
// proves it. Enforcement (credit_service, x402/config) is untouched.

export const CAPABILITY_STATUSES = Object.freeze(['live', 'beta', 'paper', 'sandbox', 'planned', 'deprecated']);
export const CAPABILITY_AUDIENCES = Object.freeze(['human', 'developer', 'agent', 'machine']);
const RISK_LEVELS = new Set(['low', 'medium', 'high']);
const APPROVAL_MODES = new Set(['none', 'confirm', 'mandate']);
const COMMERCIAL_RE = /^(sellable|internal|blocked:[a-z0-9_]+)$/;
const ID_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
const INTERFACE_KEYS = ['rest', 'mcp_tool', 'a2a_skill', 'console'];
const NOT_PUBLIC_STATUS = new Set(['planned', 'deprecated']);

export const registryEnabled = (env = process.env) => env.CAPABILITY_REGISTRY_V3 === '1';

export const RPC_CREDITS_CAPABILITY = 'rpc.polygon.call';
export const RPC_X402_BUNDLE_CAPABILITY = 'rpc.polygon.x402_bundle';

const USD_DECIMAL_RE = /^(\d+)(?:\.(\d{1,6}))?$/;
/** "0.25" → 250000 micro-USD, integer arithmetic; undefined unless an exact ≤6-decimal USD amount. */
function usdTextToMicro(text) {
  const m = USD_DECIMAL_RE.exec(String(text ?? '').trim());
  if (!m) return undefined;
  const micro = BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0') || '0');
  return micro <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(micro) : undefined;
}

/**
 * The x402 bundle price as charged: the payment middleware honours X402_BUNDLE_PRICE_USD /
 * X402_BUNDLE_CALLS, so discovery (rails.mjs) shows them — and so must the registry view, or one
 * response would carry two bundle prices.
 */
function chargedBundlePrice(k, env) {
  if (k.id !== RPC_X402_BUNDLE_CAPABILITY || k.price.amount_micro === null) return k.price;
  const micro = env.X402_BUNDLE_PRICE_USD ? usdTextToMicro(env.X402_BUNDLE_PRICE_USD) : k.price.amount_micro;
  const per = env.X402_BUNDLE_CALLS ? Number(env.X402_BUNDLE_CALLS) : k.price.per;
  if (micro === undefined || !Number.isSafeInteger(per) || per < 1) return { ...k.price, amount_micro: null, withheld: 'env_override_unparseable' };
  return { ...k.price, amount_micro: micro, per };
}

const isStrOrNull = (v) => v === null || (typeof v === 'string' && v.length > 0);

/** @returns {string[]} errors; empty when the block is valid against the catalog's products. */
export function validateCapabilities(c) {
  const errs = [];
  const caps = c?.capabilities;
  if (caps === undefined) return errs; // optional until v3 is adopted everywhere
  if (!Array.isArray(caps)) return ['capabilities must be an array'];
  const products = new Map((c.products || []).map((p) => [p.id, p]));
  const ids = new Set();
  for (const [i, k] of caps.entries()) {
    const at = `capabilities[${i}]${k?.id ? ` (${k.id})` : ''}`;
    const e = (m) => errs.push(`${at}: ${m}`);
    if (!k || typeof k !== 'object') { e('must be an object'); continue; }
    if (typeof k.id !== 'string' || !ID_RE.test(k.id)) e('id must be dotted lowercase, e.g. rpc.polygon.call');
    else if (ids.has(k.id)) e('duplicate id');
    ids.add(k.id);
    if (!Number.isInteger(k.version) || k.version < 1) e('version must be an integer ≥ 1');
    for (const f of ['name', 'summary', 'owner']) if (typeof k[f] !== 'string' || !k[f]) e(`${f} required`);
    const product = products.get(k.product);
    if (!product) e(`unknown product ${k.product}`);
    if (!CAPABILITY_STATUSES.includes(k.status)) e(`status must be one of ${CAPABILITY_STATUSES.join('|')}`);
    if (!Array.isArray(k.audience) || k.audience.length === 0 || !k.audience.every((a) => CAPABILITY_AUDIENCES.includes(a))) e(`audience ⊆ ${CAPABILITY_AUDIENCES.join('|')}`);
    if (!k.interfaces || typeof k.interfaces !== 'object' || Object.keys(k.interfaces).some((x) => !INTERFACE_KEYS.includes(x))
      || !INTERFACE_KEYS.every((x) => isStrOrNull(k.interfaces[x]))) e(`interfaces must have exactly ${INTERFACE_KEYS.join(', ')} (string or null)`);
    else if (k.interfaces.mcp_tool && product && !(product.mcp_tools || []).includes(k.interfaces.mcp_tool)) e(`mcp_tool ${k.interfaces.mcp_tool} is not in product ${product.id}.mcp_tools`);
    if (typeof k.pricing_rule_ref !== 'string' || !k.pricing_rule_ref) e('pricing_rule_ref required');
    if (!RISK_LEVELS.has(k.risk_level)) e('risk_level must be low|medium|high');
    if (!APPROVAL_MODES.has(k.approval_mode)) e('approval_mode must be none|confirm|mandate');
    if (typeof k.commercial_status !== 'string' || !COMMERCIAL_RE.test(k.commercial_status)) e('commercial_status must be sellable|internal|blocked:<reason>');
    if (!isStrOrNull(k.resale_rights_ref)) e('resale_rights_ref must be a string or null');
    if (!isStrOrNull(k.docs_url)) e('docs_url must be a string or null');
    const p = k.price;
    if (!p || typeof p !== 'object') { e('price required'); continue; }
    if (p.currency !== 'USD') e('price.currency must be USD (amounts are micro-USD)');
    if (!Number.isInteger(p.per) || p.per < 1) e('price.per must be an integer ≥ 1');
    if (typeof p.metering_unit !== 'string' || !p.metering_unit) e('price.metering_unit required');
    if (p.amount_micro === null) {
      if (typeof p.withheld !== 'string' || !p.withheld) e('price.amount_micro null requires price.withheld (reason)');
      if (k.commercial_status === 'sellable') e('a withheld price cannot be sellable');
    } else {
      if (!Number.isSafeInteger(p.amount_micro) || p.amount_micro < 0) e('price.amount_micro must be an integer ≥ 0 (micro-USD) or null');
      if (p.withheld !== undefined) e('price.withheld only allowed when amount_micro is null');
    }
  }
  // Discovery reads these two whenever CAPABILITY_REGISTRY_V3=1: a block without them must fail at
  // load (boot), never as a 500 on /v1/pricing at request time.
  for (const id of [RPC_CREDITS_CAPABILITY, RPC_X402_BUNDLE_CAPABILITY]) {
    const k = caps.find((x) => x?.id === id);
    if (!k) errs.push(`capabilities: ${id} required (discovery prices come from it)`);
    else if (k.price?.amount_micro === null) errs.push(`capabilities: ${id} cannot be withheld (discovery lists it)`);
  }
  return errs;
}

const byId = (c) => new Map((c.capabilities || []).map((k) => [k.id, k]));

/**
 * micro-USD (integer) → the USD number the existing discovery fields carry. One correctly rounded
 * division, so it equals the decimal literal (30 → 0.00003, 100000 → 0.1). Display only.
 */
export const microToUsd = (micro) => micro / 1_000_000;


/**
 * The RPC rail prices as the registry states them, in the units rails.mjs reports:
 * { rpc_credits: { price_usd_per_call }, rpc_x402_bundle: { price_usd, calls } }.
 * Throws if a capability that discovery relies on is missing or withheld.
 */
export function registryRpcPrices(c) {
  const caps = byId(c);
  const need = (id) => {
    const k = caps.get(id);
    if (!k) throw new Error(`capability registry: ${id} missing`);
    if (k.price.amount_micro === null) throw new Error(`capability registry: ${id} is withheld but discovery lists it`);
    return k.price;
  };
  const credit = need(RPC_CREDITS_CAPABILITY);
  const bundle = need(RPC_X402_BUNDLE_CAPABILITY);
  return {
    rpc_credits: { price_usd_per_call: microToUsd(credit.amount_micro) / credit.per },
    rpc_x402_bundle: { price_usd: microToUsd(bundle.amount_micro), calls: bundle.per },
  };
}

/**
 * Public view for discovery: capabilities whose product is not internal and whose status is
 * not planned/deprecated. A withheld price is shown as { withheld: reason } — never a number.
 */
export function publicCapabilities(c, env = process.env) {
  const products = new Map((c.products || []).map((p) => [p.id, p]));
  return (c.capabilities || [])
    .filter((k) => products.get(k.product)?.audience !== 'internal' && !NOT_PUBLIC_STATUS.has(k.status))
    .map((k) => ({ ...k, price: chargedBundlePrice(k, env) }))
    .map((k) => ({
      id: k.id,
      version: k.version,
      name: k.name,
      summary: k.summary,
      product: k.product,
      status: k.status,
      audience: [...k.audience],
      interfaces: { ...k.interfaces },
      price: k.price.amount_micro === null
        ? { withheld: k.price.withheld }
        : { amount_micro: k.price.amount_micro, currency: k.price.currency, per: k.price.per, metering_unit: k.price.metering_unit },
      docs_url: k.docs_url,
    }));
}
