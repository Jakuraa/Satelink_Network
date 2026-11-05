// REST/OpenAPI driver for the connector gateway (Release A, Slice S4 — the slice's one new infrastructure piece).
// Loads a provider's OpenAPI 3.x document and calls ONLY operations it declares (by operationId). Request and response
// bodies are validated against the document's schemas (schema_lite subset); anything undeclared is refused.
// Supplier output stays UNTRUSTED (R7): callers get schema-checked JSON and decide nothing based on free text.

import { validate, assertSupportedSchema } from '../schema_lite.js';
import { TaskError } from '../errors.js';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function strip(schema) {
  // OpenAPI-only keywords the subset validator does not need.
  if (!schema || typeof schema !== 'object') return schema;
  const { format, example, examples, nullable, ...rest } = schema; void format; void example; void examples; void nullable;
  if (rest.properties) rest.properties = Object.fromEntries(Object.entries(rest.properties).map(([k, v]) => [k, strip(v)]));
  if (rest.items) rest.items = strip(rest.items);
  return rest;
}

export async function loadOpenApi({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 10_000 }) {
  const u = new URL(baseUrl);
  if (!LOOPBACK.has(u.hostname)) throw new Error('OpenAPI provider must be a loopback URL in the preview');
  const res = await fetchImpl(`${u.origin}/openapi.json`, { signal: AbortSignal.timeout(timeoutMs) });
  const doc = await res.json();
  if (!res.ok || !/^3\./.test(String(doc?.openapi || ''))) throw new Error('not an OpenAPI 3.x document');
  const ops = new Map();
  for (const [path, item] of Object.entries(doc.paths || {})) {
    for (const m of METHODS) {
      const op = item?.[m];
      if (!op?.operationId) continue;
      const okCode = Object.keys(op.responses || {}).find((c) => /^2\d\d$/.test(c));
      const resSchema = okCode ? strip(op.responses[okCode]?.content?.['application/json']?.schema) : null;
      const reqSchema = strip(op.requestBody?.content?.['application/json']?.schema) || null;
      if (resSchema) assertSupportedSchema(resSchema, `${op.operationId}.response`);
      if (reqSchema) assertSupportedSchema(reqSchema, `${op.operationId}.request`);
      ops.set(op.operationId, { method: m.toUpperCase(), path, params: op.parameters || [], reqSchema, resSchema, okCode: Number(okCode) });
    }
  }
  return {
    title: doc.info?.title, operations: [...ops.keys()],
    /** Call a declared operation. path/header params by name; body validated before sending; response validated after. */
    async call(operationId, { params = {}, body } = {}) {
      const op = ops.get(operationId);
      if (!op) throw new TaskError('SUPPLIER_FAILED', `Operation ${operationId} is not declared by the provider.`, { status: 502 });
      let path = op.path; const headers = { accept: 'application/json' };
      for (const p of op.params) {
        const v = params[p.name];
        if (p.required && (v === undefined || v === null || v === '')) throw new TaskError('VALIDATION_FAILED', `Missing ${p.in} parameter ${p.name}.`, { status: 400 });
        if (v === undefined) continue;
        if (p.in === 'path') path = path.replace(`{${p.name}}`, encodeURIComponent(String(v)));
        else if (p.in === 'header') headers[p.name.toLowerCase()] = String(v);
      }
      if (op.reqSchema) {
        const errs = validate(op.reqSchema, body);
        if (errs.length) throw new TaskError('VALIDATION_FAILED', `Request does not match the provider schema: ${errs[0].path} ${errs[0].message}.`, { status: 400 });
        headers['content-type'] = 'application/json';
      }
      let res;
      try { res = await fetchImpl(`${u.origin}${path}`, { method: op.method, headers, body: op.reqSchema ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) }); } catch (e) {
        throw new TaskError(e?.name === 'TimeoutError' ? 'UPSTREAM_TIMEOUT' : 'SUPPLIER_UNAVAILABLE', 'The provider did not answer.', { status: 504, retryable: true });
      }
      if (res.status === 404) return null;
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new TaskError('SUPPLIER_FAILED', 'The provider could not complete the request. Nothing was charged.', { status: 502 });
      if (op.resSchema) {
        const errs = validate(op.resSchema, json);
        if (errs.length) throw new TaskError('SUPPLIER_FAILED', `Provider response failed its own schema (${errs[0].path} ${errs[0].message}).`, { status: 502 });
      }
      return json;
    },
  };
}

/** dev.data.extract over the provider's OpenAPI — the generic task-step interface. */
export function createOpenApiDataConnector({ baseUrl, fetchImpl }) {
  let api = null;
  const client = async () => (api ||= await loadOpenApi({ baseUrl, fetchImpl }));
  return {
    type: 'rest_openapi_data',
    configured: () => true,
    async quoteStep({ inputs }) {
      const a = await client();
      const p = await a.call('getPricing');
      return { supplier_cost_minor: BigInt(p.price_per_call_usd_minor), description: `${a.title}: extract emails, dates, amounts and links (${String(inputs.source_text).length} characters)`,
        offer: { sku: 'createExtraction', title: `${a.title} — 1 extraction call`, price_usd_minor: p.price_per_call_usd_minor, text: String(inputs.source_text) } };
    },
    async executeStep({ offer, idempotencyKey }) {
      const job = await (await client()).call('createExtraction', { params: { 'Idempotency-Key': idempotencyKey }, body: { text: offer.text } });
      return { job_id: job.job_id, status: job.status, result: job.result, price_usd_minor: job.price_usd_minor };
    },
    async verifyStep({ idempotencyKey, offer }) {
      const job = await (await client()).call('getExtraction', { params: { idempotency_key: idempotencyKey } });
      if (!job) return { verified: false, found: false, reason: 'no_job_for_key' };
      const ok = job.status === 'completed' && job.price_usd_minor === offer.price_usd_minor;
      return { verified: ok, found: true, reason: ok ? null : 'job_mismatch', evidence: { order_id: job.job_id, status: job.status, sku: offer.sku, price_usd_minor: job.price_usd_minor } };
    },
  };
}
