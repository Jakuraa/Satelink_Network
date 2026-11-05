/**
 * Release A · Slice S4 — developer service procurement: scoped, hashed, revocable API keys; the REST/OpenAPI
 * driver against the local "Demo Data API (MOCK)" (separate process); the task API over HTTP with key auth.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freshMigratedDb } from './fresh-db.js';
import { Pool } from 'pg';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import { TaskService } from '../../apps/api/src/workflows/task_service.js';
import { CapabilityRegistry } from '../../apps/api/src/workflows/capability_registry.js';
import { createModelRouter } from '../../apps/api/src/workflows/model_router.js';
import { loadPricing } from '../../apps/api/src/workflows/pricing.js';
import { DeveloperKeys } from '../../apps/api/src/workflows/developer_keys.js';
import { loadOpenApi, createOpenApiDataConnector } from '../../apps/api/src/workflows/connectors/rest_openapi_driver.js';
import { createTasksRouter } from '../../apps/api/src/routes/tasks_route.js';
import { PgDurableStore } from '../../apps/api/src/vnext/reliability/pg_durable_store.js';
import { PgRunStore } from '../../apps/api/src/workflows/run_store.js';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ROOT = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', '..');
const PORT = 5400 + Math.floor(Math.random() * 300);
const DATA = `http://127.0.0.1:${PORT}`;
const U = { id: 'user:dev-a', via: 'session' };
const TEXT = 'Extract the contacts from: invoice due 2026-12-01 for $40.00, mail billing@example.com, see https://example.com/inv/42';
let db: Awaited<ReturnType<typeof freshMigratedDb>>; let pool: Pool; let mock: ChildProcess; let svc: Any; let keys: DeveloperKeys;
let server: Server; let API = ''; let now = Date.UTC(2026, 10, 5, 12, 0, 0);

beforeAll(async () => {
  db = await freshMigratedDb('s4dev', join(ROOT, 'database', 'migrations'));
  pool = new Pool({ connectionString: db.url, max: 8 });
  mock = spawn(process.execPath, [join(ROOT, 'tools', 'mock-data-api', 'server.mjs')], {
    env: { ...process.env, MOCK_DATA_PORT: String(PORT), MOCK_DATA_STATE: join(mkdtempSync(join(tmpdir(), 'data-')), 'jobs.json') }, stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${DATA}/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  svc = await TaskService.create({
    pool, registry: new CapabilityRegistry(pool), router: createModelRouter({ env: {} }), pricing: loadPricing(),
    connectors: { rest_openapi_data: createOpenApiDataConnector({ baseUrl: DATA }) },
    workflowOptions: { store: new PgDurableStore(pool, { prefix: 'wf_' }), runStore: new PgRunStore(pool), env: {} },
  });
  keys = new DeveloperKeys({ pool, clock: () => now });
  const resolvePrincipal = async (req: Any) => {
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') || '')?.[1] || '';
    if (bearer) { const k = await keys.authenticate(bearer); return k ? { id: k.principal, via: 'api_key', actor_type: 'developer', scopes: k.scopes, key_id: k.key_id, agent_spend_preauth_minor: k.agent_spend_preauth_minor } : null; }
    return req.get('X-Test-Session') === U.id ? U : null; // stands in for the Better Auth session
  };
  const app = express(); app.use('/v1', createTasksRouter(svc, { resolvePrincipal, developerKeys: keys }));
  await new Promise<void>((r) => { server = app.listen(0, '127.0.0.1', () => r()); });
  API = `http://127.0.0.1:${(server.address() as Any).port}/v1`;
}, 180_000);
afterAll(async () => { server?.close(); mock?.kill(); await pool?.end(); await db?.stop(); });

const call = (path: string, { key, session, method = 'GET', body, headers = {} }: Any = {}): Promise<Any> => fetch(`${API}${path}`, {
  method, body: body ? JSON.stringify(body) : undefined,
  headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}), ...(session ? { 'X-Test-Session': U.id, 'X-Satelink-Console': '1' } : {}), ...headers },
});
async function untilState(id: string, key: string, states: string[]) {
  for (let i = 0; i < 100; i++) { const t = (await (await call(`/tasks/${id}`, { key })).json()).task; if (states.includes(t.state)) return t; await new Promise((r) => setTimeout(r, 50)); }
  throw new Error('timeout');
}

describe('developer keys', () => {
  it('stores only a sha256 hash, shows the secret once, and validates scopes', async () => {
    const k = await keys.create(U.id, { name: 'ci', scopes: ['tasks:read'] });
    expect(k.secret).toMatch(/^slk_preview_[A-Za-z0-9_-]{40,64}$/);
    const { rows: [row] } = await pool.query('SELECT * FROM developer_api_keys WHERE key_id = $1', [k.key_id]);
    expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(k.secret.slice(16));
    expect((await keys.list(U.id)).find((x: Any) => x.key_id === k.key_id)).not.toHaveProperty('secret');
    await expect(keys.create(U.id, { name: 'bad', scopes: ['admin:*'] })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(keys.create(U.id, { name: '' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('revocation is immediate and owner-only; usage and last-used are recorded', async () => {
    const k = await keys.create(U.id, { name: 'rev' });
    expect(await keys.authenticate(k.secret)).toMatchObject({ principal: U.id, key_id: k.key_id });
    await expect(keys.revoke('user:someone-else', k.key_id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const listed = (await keys.list(U.id)).find((x: Any) => x.key_id === k.key_id);
    expect(listed).toMatchObject({ status: 'active', requests_total: '1' });
    expect(listed.last_used_at).not.toBeNull();
    await keys.revoke(U.id, k.key_id);
    expect(await keys.authenticate(k.secret)).toBeNull();
    expect(await keys.authenticate('slk_preview_' + 'A'.repeat(48))).toBeNull();
    expect(await keys.authenticate('not-a-key')).toBeNull();
  });

  it('per-key rate limit: the limit+1 request in a window is RATE_LIMITED; the next window resets', async () => {
    const k = await keys.create(U.id, { name: 'rl' });
    await pool.query('UPDATE developer_api_keys SET rate_limit_per_min = 3 WHERE key_id = $1', [k.key_id]);
    for (let i = 0; i < 3; i++) expect(await keys.authenticate(k.secret)).not.toBeNull();
    await expect(keys.authenticate(k.secret)).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    now += 60_000;
    expect(await keys.authenticate(k.secret)).not.toBeNull();
  });
});

describe('REST/OpenAPI driver (Demo Data API (MOCK))', () => {
  it('calls only declared operations, validates requests before sending and responses after', async () => {
    await expect(loadOpenApi({ baseUrl: 'http://example.com' })).rejects.toThrow(/loopback/);
    const api = await loadOpenApi({ baseUrl: DATA });
    expect(api.operations.sort()).toEqual(['createExtraction', 'getExtraction', 'getPricing']);
    await expect(api.call('deleteEverything')).rejects.toMatchObject({ code: 'SUPPLIER_FAILED' });
    await expect(api.call('createExtraction', { params: { 'Idempotency-Key': 'k-00000001' }, body: { text: '' } })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(api.call('createExtraction', { body: { text: 'x' } })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' }); // missing header param
    expect(await api.call('getExtraction', { params: { idempotency_key: 'never-made' } })).toBeNull();
    // A supplier that breaks its own schema is refused (R7).
    const doc = await (await fetch(`${DATA}/openapi.json`)).json();
    const liar = (async (url: string) => url.endsWith('/openapi.json') ? new Response(JSON.stringify(doc)) : new Response(JSON.stringify({ price_per_call_usd_minor: '2000' }))) as Any;
    await expect((await loadOpenApi({ baseUrl: DATA, fetchImpl: liar })).call('getPricing')).rejects.toMatchObject({ code: 'SUPPLIER_FAILED' });
  });

  it('createExtraction is idempotent on the key (one job per key)', async () => {
    const c = createOpenApiDataConnector({ baseUrl: DATA });
    const offer = { sku: 'createExtraction', price_usd_minor: 2000, text: 'a@b.co' };
    const a = await c.executeStep({ offer, idempotencyKey: 'idem-k-000001' } as Any);
    const b = await c.executeStep({ offer, idempotencyKey: 'idem-k-000001' } as Any);
    expect(b.job_id).toBe(a.job_id);
    expect(await c.verifyStep({ idempotencyKey: 'idem-k-000001', offer } as Any)).toMatchObject({ verified: true, found: true });
    expect(await c.verifyStep({ idempotencyKey: 'idem-k-missing', offer } as Any)).toMatchObject({ verified: false, found: false });
  });
});

describe('task API over HTTP with a developer key', () => {
  let full = ''; let readOnly = '';
  beforeAll(async () => {
    const r = await call('/developer/keys', { session: true, method: 'POST', body: { name: 'full', scopes: ['tasks:create', 'tasks:read', 'tasks:approve', 'receipts:read', 'usage:read'] } });
    expect(r.status).toBe(201); full = (await r.json()).key.secret;
    readOnly = (await (await call('/developer/keys', { session: true, method: 'POST', body: { name: 'ro', scopes: ['tasks:create', 'tasks:read'] } })).json()).key.secret;
  });

  it('keys cannot manage keys; the console session can', async () => {
    expect((await call('/developer/keys', { key: full })).status).toBe(403);
    expect((await call('/developer/keys', { key: full, method: 'POST', body: { name: 'x' } })).status).toBe(403);
    const listed = (await (await call('/developer/keys', { session: true })).json()).keys;
    expect(listed.map((k: Any) => k.name)).toEqual(expect.arrayContaining(['full', 'ro']));
    expect(JSON.stringify(listed)).not.toContain(full);
  });

  it('procure: capabilities → task → quote → approve (scope + Idempotency-Key) → output → receipt → usage', async () => {
    const caps = (await (await call('/capabilities?q=extract')).json()).capabilities;
    expect(caps.map((c: Any) => c.id)).toContain('dev.data.extract');
    const created = await (await call('/tasks', { key: full, method: 'POST', body: { text: TEXT, idempotency_key: 'dev-task-0001', actor_type: 'developer' } })).json();
    const t = await untilState(created.task.id, full, ['AWAITING_APPROVAL']);
    expect(t.plan.steps[0]).toMatchObject({ capability_id: 'dev.data.extract', provider_name: 'Demo Data API (MOCK)' });
    expect(t.quote).toMatchObject({ supplier_cost_minor: '2000', simulation_label: 'SIMULATED — NO MONEY MOVED' });
    const body = { quote_id: t.quote.quote_id, quote_version: t.quote.version };
    expect((await call(`/tasks/${t.id}/approve`, { key: readOnly, method: 'POST', body, headers: { 'Idempotency-Key': 'approve-0001' } })).status).toBe(403);
    const noKey = await call(`/tasks/${t.id}/approve`, { key: full, method: 'POST', body });
    expect(noKey.status).toBe(400); expect((await noKey.json()).error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect((await call(`/tasks/${t.id}/approve`, { key: full, method: 'POST', body, headers: { 'Idempotency-Key': 'approve-0001' } })).status).toBe(200);
    expect((await (await call(`/tasks/${t.id}/approve`, { key: full, method: 'POST', body, headers: { 'Idempotency-Key': 'approve-0001' } })).json()).changed).toBe(false);
    await svc.drain();
    const done = await untilState(t.id, full, ['SUCCEEDED', 'FAILED', 'REQUIRES_RECONCILIATION']);
    expect(done.state).toBe('SUCCEEDED');
    expect(done.output.result).toEqual({ emails: ['billing@example.com'], dates: ['2026-12-01'], amounts: ['$40.00'], urls: ['https://example.com/inv/42'] });
    const receipt = (await (await call(`/receipts/${done.receipt_id}`, { key: full })).json()).receipt;
    expect(receipt).toMatchObject({ outcome: 'succeeded', simulation_label: 'SIMULATED — NO MONEY MOVED', origin: 'simulated', environment: 'preview' });
    expect((await call(`/receipts/${done.receipt_id}`, { key: readOnly })).status).toBe(403);
    const usage = (await (await call('/usage', { key: full })).json()).usage;
    expect(usage.receipts.map((r: Any) => r.receipt_id)).toContain(done.receipt_id);
    expect(usage.external_revenue_usd).toBe('0.000000');
    const { rows: [rev] } = await pool.query('SELECT COALESCE(SUM(revenue_minor), 0)::text AS r FROM revenue_truth');
    expect(rev.r).toBe('0');
  });

  it('supplier failure: FAILED with no charge, typed code preserved', async () => {
    const created = await (await call('/tasks', { key: full, method: 'POST', body: { text: 'Extract the data from: FAIL_EXTRACTION ops@example.org', idempotency_key: 'dev-task-0002' } })).json();
    const t = await untilState(created.task.id, full, ['AWAITING_APPROVAL']);
    await call(`/tasks/${t.id}/approve`, { key: full, method: 'POST', body: { quote_id: t.quote.quote_id, quote_version: t.quote.version }, headers: { 'Idempotency-Key': 'approve-0002' } });
    await svc.drain();
    const done = await untilState(t.id, full, ['SUCCEEDED', 'FAILED', 'REFUNDED', 'REQUIRES_RECONCILIATION']);
    expect(done.state).toBe('FAILED');
    expect(done.output).toBeNull();
    const receipt = (await (await call(`/receipts/${done.receipt_id}`, { key: full })).json()).receipt;
    expect(receipt).toMatchObject({ outcome: 'failed' });
    expect(receipt.charges.credits_charged_minor).toBe('0');
  });

  it('another principal\'s key cannot read the task', async () => {
    const other = await keys.create('user:dev-b', { name: 'b', scopes: ['tasks:read'] });
    const { rows: [run] } = await pool.query("SELECT run_id FROM workflow_runs WHERE principal = $1 LIMIT 1", [U.id]);
    expect((await call(`/tasks/${run.run_id}`, { key: other.secret })).status).toBe(404);
  });

  it('generated OpenAPI documents every route, its scope, and the registry capabilities', async () => {
    const doc = await (await call('/openapi.json')).json();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths['/tasks/{id}/approve'].post['x-required-scope']).toBe('tasks:approve');
    expect(doc['x-capabilities'].map((c: Any) => c.id)).toContain('dev.data.extract');
    expect(doc.info.description).toMatch(/PROPOSED — NOT APPROVED/);
  });
});
