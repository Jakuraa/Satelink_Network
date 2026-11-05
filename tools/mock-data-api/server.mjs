#!/usr/bin/env node
// "Demo Data API (MOCK)" — a LOCAL REST supplier described by its own OpenAPI document (Release A, Slice S4).
// No real company, no payments. Binds 127.0.0.1.
//   GET  /openapi.json
//   GET  /pricing                                   → { price_per_call_usd_minor }
//   POST /extractions   (Idempotency-Key header)    → 201 extraction (idempotent on the key)
//   GET  /extractions/{idempotency_key}             → extraction | 404 (verification)
// Text containing FAIL_EXTRACTION → 502 (failure-path tests). State persists to MOCK_DATA_STATE.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_DATA_PORT || 4430);
const STATE = process.env.MOCK_DATA_STATE || '';
const PRICE = 2_000; // $0.002 per call, integer micro-USD
let jobs = new Map();
if (STATE && fs.existsSync(STATE)) jobs = new Map(Object.entries(JSON.parse(fs.readFileSync(STATE, 'utf8'))));
const save = () => { if (STATE) fs.writeFileSync(STATE, JSON.stringify(Object.fromEntries(jobs))); };

const Extraction = {
  type: 'object', required: ['job_id', 'status', 'result', 'price_usd_minor'],
  properties: {
    job_id: { type: 'string' }, status: { type: 'string', enum: ['completed'] }, price_usd_minor: { type: 'integer', minimum: 0 },
    result: { type: 'object', required: ['emails', 'dates', 'amounts', 'urls'], properties: {
      emails: { type: 'array', items: { type: 'string' } }, dates: { type: 'array', items: { type: 'string' } },
      amounts: { type: 'array', items: { type: 'string' } }, urls: { type: 'array', items: { type: 'string' } } } },
  },
};
const OPENAPI = {
  openapi: '3.1.0',
  info: { title: 'Demo Data API (MOCK)', version: '1.0.0', description: 'Local mock supplier for the Satelink preview. Not a real service.' },
  servers: [{ url: `http://127.0.0.1:${PORT}` }],
  paths: {
    '/pricing': { get: { operationId: 'getPricing', responses: { 200: { description: 'Price', content: { 'application/json': { schema: { type: 'object', required: ['price_per_call_usd_minor'], properties: { price_per_call_usd_minor: { type: 'integer', minimum: 0 } } } } } } } } },
    '/extractions': { post: { operationId: 'createExtraction',
      parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 8, maxLength: 160 } }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text'], additionalProperties: false, properties: { text: { type: 'string', minLength: 1, maxLength: 5000 } } } } } },
      responses: { 201: { description: 'Extraction', content: { 'application/json': { schema: Extraction } } } } } },
    '/extractions/{idempotency_key}': { get: { operationId: 'getExtraction',
      parameters: [{ name: 'idempotency_key', in: 'path', required: true, schema: { type: 'string' } }],
      responses: { 200: { description: 'Extraction', content: { 'application/json': { schema: Extraction } } } } } },
  },
};

function extract(text) {
  const uniq = (a) => [...new Set(a)];
  return {
    emails: uniq(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []),
    dates: uniq(text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || []),
    amounts: uniq(text.match(/\$\s?\d+(?:[.,]\d{2})?/g) || []),
    urls: uniq(text.match(/https?:\/\/[^\s"'<>]+/g) || []),
  };
}
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, name: 'Demo Data API (MOCK)' });
  if (req.method === 'GET' && url.pathname === '/openapi.json') return send(res, 200, OPENAPI);
  if (req.method === 'GET' && url.pathname === '/pricing') return send(res, 200, { price_per_call_usd_minor: PRICE });
  if (req.method === 'GET' && url.pathname.startsWith('/extractions/')) {
    const j = jobs.get(decodeURIComponent(url.pathname.slice('/extractions/'.length)));
    return j ? send(res, 200, j) : send(res, 404, { error: 'not_found' });
  }
  if (req.method === 'POST' && url.pathname === '/extractions') {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length < 8) return send(res, 400, { error: 'Idempotency-Key required' });
    let raw = ''; for await (const c of req) raw += c;
    let b; try { b = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad_json' }); }
    if (typeof b?.text !== 'string' || !b.text) return send(res, 400, { error: 'text required' });
    const prior = jobs.get(key);
    if (prior) return send(res, 201, prior);
    if (b.text.includes('FAIL_EXTRACTION')) return send(res, 502, { error: 'extraction_failed' });
    const job = { job_id: `job_${crypto.createHash('sha256').update(key).digest('hex').slice(0, 12)}`, status: 'completed', result: extract(b.text), price_usd_minor: PRICE };
    jobs.set(key, job); save();
    return send(res, 201, job);
  }
  send(res, 404, { error: 'not_found' });
}).listen(PORT, '127.0.0.1', () => console.log(`[mock-data-api] Demo Data API (MOCK) on http://127.0.0.1:${PORT}`));
