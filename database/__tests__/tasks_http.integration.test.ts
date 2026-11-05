/**
 * Release A P2 — the /v1 task API over HTTP (supertest) on real Postgres + the mock store process.
 * Typed errors (R11), CSRF on session mutations, tenant isolation, SSE timeline, CSV receipt, and a
 * recursive label-contract walk over every response (R10).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freshMigratedDb } from './fresh-db.js';
import { Pool } from 'pg';
import express from 'express';
import request from 'supertest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { TaskService } from '../../apps/api/src/workflows/task_service.js';
import { CapabilityRegistry } from '../../apps/api/src/workflows/capability_registry.js';
import { createModelRouter } from '../../apps/api/src/workflows/model_router.js';
import { loadPricing } from '../../apps/api/src/workflows/pricing.js';
import { createMockStoreConnector } from '../../apps/api/src/workflows/mock_store_connector.js';
import { PgDurableStore } from '../../apps/api/src/vnext/reliability/pg_durable_store.js';
import { PgRunStore } from '../../apps/api/src/workflows/run_store.js';
import { createTasksRouter } from '../../apps/api/src/routes/tasks_route.js';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ROOT = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', '..');
const PORT = 4800 + Math.floor(Math.random() * 300);
let db: Awaited<ReturnType<typeof freshMigratedDb>>; let pool: Pool; let store: ChildProcess; let svc: Any; let app: express.Express;

// Test auth: X-Test-User=<id> with X-Test-Via=session|api_key (the preview server resolves real sessions).
const resolvePrincipal = async (req: Any) => (req.get('X-Test-User') ? { id: `user:${req.get('X-Test-User')}`, via: req.get('X-Test-Via') || 'api_key' } : null);
const as = (u: string, via = 'api_key') => ({ 'X-Test-User': u, 'X-Test-Via': via, ...(via === 'session' ? { 'X-Satelink-Console': '1' } : {}) });

/** R10: any object that is (or carries) an order/payment/receipt/reservation/quote must be labelled. */
function assertLabelled(node: Any, path = '$'): void {
  if (Array.isArray(node)) { node.forEach((n, i) => assertLabelled(n, `${path}[${i}]`)); return; }
  if (!node || typeof node !== 'object') return;
  if (['quote_id', 'receipt_id', 'reservation_id'].some((k) => k in node && node[k] && typeof node[k] === 'string' && /^(q_|rcpt_|rsv_)/.test(node[k]) && path.split('.').length <= 3)) {
    expect(node, `${path} must be labelled`).toHaveProperty('simulated', true);
    expect(node, path).toHaveProperty('simulation_label', 'SIMULATED — NO MONEY MOVED');
  }
  for (const [k, v] of Object.entries(node)) assertLabelled(v, `${path}.${k}`);
}

beforeAll(async () => {
  db = await freshMigratedDb('p2http', join(ROOT, 'database', 'migrations'));
  const url = db.url;
  pool = new Pool({ connectionString: url, max: 8 });
  store = spawn(process.execPath, [join(ROOT, 'tools', 'mock-digital-store', 'server.mjs')], {
    env: { ...process.env, MOCK_STORE_PORT: String(PORT), MOCK_STORE_STATE: join(mkdtempSync(join(tmpdir(), 'mstore-')), 'o.json') }, stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  svc = await TaskService.create({
    pool, registry: new CapabilityRegistry(pool), router: createModelRouter({ env: {} }), pricing: loadPricing(),
    connectors: { mock_store: createMockStoreConnector({ baseUrl: `http://127.0.0.1:${PORT}` }) },
    workflowOptions: { store: new PgDurableStore(pool, { prefix: 'wf_' }), runStore: new PgRunStore(pool), env: {} },
  });
  app = express();
  app.use('/v1', createTasksRouter(svc, { resolvePrincipal }));
}, 180_000);
afterAll(async () => { store?.kill(); await pool?.end(); await db?.stop(); });

describe('/v1 task API (P2)', () => {
  it('typed errors: 401 without auth, 400 validation, 404 unknown — each with code/message/retryable/correlation_id', async () => {
    for (const [res, status, code] of [
      [await request(app).get('/v1/tasks'), 401, 'UNAUTHENTICATED'],
      [await request(app).post('/v1/tasks').set(as('val')).send({ text: 'x' }), 400, 'VALIDATION_FAILED'],
      [await request(app).get('/v1/tasks/run_0000000000000000').set(as('val')), 404, 'NOT_FOUND'],
    ] as const) {
      expect(res.status).toBe(status);
      expect(res.body.error).toMatchObject({ code, retryable: expect.any(Boolean), correlation_id: expect.stringMatching(/^[0-9a-f-]{36}$/), message: expect.any(String) });
    }
  });

  it('CSRF: a session mutation without X-Satelink-Console is refused (403); API keys are exempt', async () => {
    const r = await request(app).post('/v1/tasks').set({ 'X-Test-User': 'csrf', 'X-Test-Via': 'session' }).send({ text: 'buy a gift card under $20', idempotency_key: 'csrf-0000001' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('CSRF');
  });

  it('full journey over HTTP: onboarding → assistant → quote → approve → SUCCEEDED → receipt JSON + CSV → usage', async () => {
    const H = as('http1', 'session');
    expect((await request(app).post('/v1/onboarding').set(H).send({ actor_type: 'human' })).body.onboarding).toMatchObject({ simulated: true, available_usd: '1.000000' });
    const chat = await request(app).post('/v1/assistant/messages').set(H).send({ text: 'hello' });
    expect(chat.body).toMatchObject({ kind: 'reply', fixture: true, served_by: expect.stringMatching(/^fixture\//), model_badge: 'Model: fixture (no live key)' });
    const c = await request(app).post('/v1/assistant/messages').set(H).send({ text: 'Buy a sci-fi e-book gift code under $12', idempotency_key: 'http-000001' });
    expect(c.status).toBe(201);
    expect(c.body.task.state).toBe('AWAITING_APPROVAL');
    assertLabelled(c.body);
    const t = c.body.task;
    const a = await request(app).post(`/v1/tasks/${t.id}/approve`).set(H).send({ quote_id: t.quote.quote_id, quote_version: t.quote.version, idempotency_key: 'appr-000001' });
    expect(a.status).toBe(200);
    await svc.drain();
    const d = await request(app).get(`/v1/tasks/${t.id}`).set(H);
    expect(d.body.task.state).toBe('SUCCEEDED');
    assertLabelled(d.body);
    const rc = await request(app).get(`/v1/receipts/${d.body.task.receipt_id}`).set(H);
    expect(rc.body.receipt).toMatchObject({ outcome: 'succeeded', simulation_label: 'SIMULATED — NO MONEY MOVED' });
    assertLabelled(rc.body);
    const csv = await request(app).get(`/v1/receipts/${d.body.task.receipt_id}?format=csv`).set(H);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('SIMULATED — NO MONEY MOVED');
    expect(csv.text).toMatch(/"ledger_hash","[0-9a-f]{64}"/);
    const u = await request(app).get('/v1/usage').set(H);
    expect(u.body.usage).toMatchObject({ simulated: true, external_revenue_usd: '0.000000', simulated_spend_usd: '0.999000' });
    assertLabelled(u.body);
    const list = await request(app).get('/v1/tasks').set(H);
    assertLabelled(list.body);
  });

  it('SSE timeline streams the state events for the owner only', async () => {
    const [t] = (await request(app).get('/v1/tasks').set(as('http1'))).body.tasks;
    const other = await request(app).get(`/v1/tasks/${t.id}/events`).set(as('intruder'));
    expect(other.status).toBe(404);
    const sse = await new Promise<string>((done) => {
      const req = request(app).get(`/v1/tasks/${t.id}/events`).set(as('http1')).buffer(false).parse((res: Any, cb: Any) => {
        let buf = ''; res.on('data', (c: Buffer) => { buf += c.toString(); if (buf.includes('event: task')) { (res as Any).destroy(); done(buf); } });
        res.on('end', () => cb(null, buf)); res.on('error', () => cb(null, buf));
      });
      req.end(() => {});
    });
    expect(sse).toContain('event: state');
    expect(sse).toContain('"to":"SUCCEEDED"');
  });

  it('tenant isolation over HTTP: task, events and receipt are 404 for another user', async () => {
    const [t] = (await request(app).get('/v1/tasks').set(as('http1'))).body.tasks;
    expect((await request(app).get(`/v1/tasks/${t.id}`).set(as('intruder'))).status).toBe(404);
    expect((await request(app).get(`/v1/receipts/${t.receipt_id}`).set(as('intruder'))).status).toBe(404);
    expect((await request(app).post(`/v1/tasks/${t.id}/cancel`).set(as('intruder'))).status).toBe(404);
  });

  it('capabilities endpoint is registry-driven and never exposes internal entries or Eulerpool', async () => {
    const all = (await request(app).get('/v1/capabilities')).body.capabilities;
    expect(all.map((c: Any) => c.id)).toContain('shop.digital_goods.purchase');
    expect(JSON.stringify(all)).not.toMatch(/eulerpool|ai\.model\.inference/i);
    expect((await request(app).get('/v1/capabilities/ai.model.inference')).status).toBe(404);
    expect((await request(app).get('/v1/capabilities?status=SIMULATED')).body.capabilities.every((c: Any) => c.release_status === 'SIMULATED')).toBe(true);
  });

  it('receipt CSV neutralises spreadsheet formulas in user-controlled text', async () => {
    const H = as('csvuser');
    const c = await request(app).post('/v1/tasks').set(H).send({ text: '=HYPERLINK("x") buy a cookbook e-book gift code under $8', idempotency_key: 'csv-0000001' });
    const t = c.body.task;
    await request(app).post(`/v1/tasks/${t.id}/approve`).set(H).send({ quote_id: t.quote.quote_id, quote_version: t.quote.version });
    await svc.drain();
    const d = (await request(app).get(`/v1/tasks/${t.id}`).set(H)).body.task;
    const csv = (await request(app).get(`/v1/receipts/${d.receipt_id}?format=csv`).set(H)).text;
    expect(csv).toContain(`"intent","'=HYPERLINK`);
  });
});
