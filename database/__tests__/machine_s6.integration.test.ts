/**
 * Release A · Slice S6 — machine commerce over the x402 V2 PREVIEW: 402 + PAYMENT-REQUIRED → mock-signed
 * PAYMENT-SIGNATURE → LOCAL mock facilitator /verify → the one task engine → PAYMENT-RESPONSE + receipt.
 * Real Postgres; the mock Data API and the mock facilitator as separate processes. Never /settle, never the vault.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freshMigratedDb } from './fresh-db.js';
import { Pool } from 'pg';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { TaskService } from '../../apps/api/src/workflows/task_service.js';
import { CapabilityRegistry } from '../../apps/api/src/workflows/capability_registry.js';
import { createModelRouter } from '../../apps/api/src/workflows/model_router.js';
import { loadPricing } from '../../apps/api/src/workflows/pricing.js';
import { DeveloperKeys } from '../../apps/api/src/workflows/developer_keys.js';
import { createOpenApiDataConnector } from '../../apps/api/src/workflows/connectors/rest_openapi_driver.js';
import { createTasksRouter } from '../../apps/api/src/routes/tasks_route.js';
import { createX402PreviewRouter, loadX402PreviewConfig } from '../../apps/api/src/routes/x402_preview_route.js';
import { PgDurableStore } from '../../apps/api/src/vnext/reliability/pg_durable_store.js';
import { PgRunStore } from '../../apps/api/src/workflows/run_store.js';
import { mockSignature } from '../../tools/mock-x402-facilitator/mock_sig.mjs';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ROOT = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', '..');
const DPORT = 6000 + Math.floor(Math.random() * 200); const FPORT = DPORT + 300;
const DATA = `http://127.0.0.1:${DPORT}`; const FAC = `http://127.0.0.1:${FPORT}`;
const OWNER = { id: 'user:machine-owner', via: 'session' };
let db: Awaited<ReturnType<typeof freshMigratedDb>>; let pool: Pool; let procs: ChildProcess[] = []; let svc: Any; let keys: DeveloperKeys;
let server: Server; let BASE = '';

const up = async (url: string) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(`${url}/health`)).ok) return; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); } };
beforeAll(async () => {
  db = await freshMigratedDb('s6machine', join(ROOT, 'database', 'migrations'));
  pool = new Pool({ connectionString: db.url, max: 8 });
  procs = [
    spawn(process.execPath, [join(ROOT, 'tools', 'mock-data-api', 'server.mjs')], { env: { ...process.env, MOCK_DATA_PORT: String(DPORT), MOCK_DATA_STATE: join(mkdtempSync(join(tmpdir(), 'data-')), 'j.json') }, stdio: 'ignore' }),
    spawn(process.execPath, [join(ROOT, 'tools', 'mock-x402-facilitator', 'server.mjs')], { env: { ...process.env, MOCK_FACILITATOR_PORT: String(FPORT) }, stdio: 'ignore' }),
  ];
  await up(DATA); await up(FAC);
  svc = await TaskService.create({
    pool, registry: new CapabilityRegistry(pool), router: createModelRouter({ env: {} }), pricing: loadPricing(),
    connectors: { rest_openapi_data: createOpenApiDataConnector({ baseUrl: DATA }) },
    workflowOptions: { store: new PgDurableStore(pool, { prefix: 'wf_' }), runStore: new PgRunStore(pool), env: {} },
  });
  keys = new DeveloperKeys({ pool });
  const resolvePrincipal = async (req: Any) => {
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') || '')?.[1] || '';
    if (bearer) { const k = await keys.authenticate(bearer); return k ? { id: k.principal, via: 'api_key', actor_type: 'developer', scopes: k.scopes, key_id: k.key_id } : null; }
    return req.get('X-Test-Session') === OWNER.id ? OWNER : null;
  };
  const app = express();
  await new Promise<void>((r) => { server = app.listen(0, '127.0.0.1', () => r()); });
  BASE = `http://127.0.0.1:${(server.address() as Any).port}`;
  app.use('/v1', createX402PreviewRouter(svc, { resolvePrincipal, facilitatorUrl: FAC, publicBaseUrl: BASE, pollMs: 50 }));
  app.use('/dead/v1', createX402PreviewRouter(svc, { resolvePrincipal, facilitatorUrl: 'http://127.0.0.1:9', publicBaseUrl: BASE, pollMs: 50 }));
  app.use('/v1', createTasksRouter(svc, { resolvePrincipal, developerKeys: keys }));
}, 180_000);
afterAll(async () => { server?.close(); for (const p of procs) p.kill(); await pool?.end(); await db?.stop(); });

const Q = (s: string) => `?q=${encodeURIComponent(s)}`;
const get = (path: string, headers: Record<string, string>, base = `${BASE}/v1`) => fetch(`${base}${path}`, { headers });
function sign(required: Any, over: Any = {}) {
  const req = required.accepts[0]; const now = Math.floor(Date.now() / 1000);
  const authorization = { from: `0x${randomBytes(20).toString('hex')}`, to: req.payTo, value: req.amount, validAfter: String(now - 5), validBefore: String(now + 60), nonce: `0x${randomBytes(32).toString('hex')}`, ...over.authorization };
  const payload = { x402Version: 2, resource: required.resource, accepted: { ...req, ...over.accepted }, payload: { signature: over.signature ?? mockSignature(authorization), authorization } };
  return encodePaymentSignatureHeader(payload);
}
async function quote402(idem: string, text = 'Extract the emails from: m1@example.com', headers: Record<string, string> = {}) {
  const r = await get(`/x402/preview/dev.data.extract${Q(text)}`, { 'Idempotency-Key': idem, ...headers });
  expect(r.status).toBe(402);
  return { required: decodePaymentRequiredHeader(r.headers.get('PAYMENT-REQUIRED')!), body: (await r.json()) as Any };
}
const captures = async (runId: string) => Number((await pool.query("SELECT count(*) FROM ledger_txns WHERE kind = 'capture' AND ref_id LIKE $1", [`%${runId.slice(4)}%`])).rows[0].count);

describe('x402 preview configuration', () => {
  it('is testnet-only with a placeholder payTo; the facilitator must be loopback', () => {
    const cfg = loadX402PreviewConfig();
    expect(cfg).toMatchObject({ x402Version: 2, scheme: 'exact', network: 'eip155:84532', pay_to_placeholder: '0x0000000000000000000000000000000000000000' });
    expect(() => createX402PreviewRouter(svc, { resolvePrincipal: async () => null, facilitatorUrl: 'https://x402.org/facilitator', publicBaseUrl: BASE })).toThrow(/LOCAL mock/);
  });
});

describe('402 → PAYMENT-SIGNATURE → PAYMENT-RESPONSE (keyless machine)', () => {
  it('402 carries a V2 PaymentRequired: exact, testnet CAIP-2, asset, amount = Satelink credit charge, placeholder payTo, resource, extra.simulated', async () => {
    const { required, body } = await quote402('machine-k-0001');
    expect(required).toMatchObject({ x402Version: 2, resource: { url: `${BASE}/v1/x402/preview/dev.data.extract`, mimeType: 'application/json' } });
    const req = required.accepts[0];
    expect(req).toMatchObject({ scheme: 'exact', network: 'eip155:84532', asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', payTo: '0x0000000000000000000000000000000000000000', maxTimeoutSeconds: 120 });
    expect(req.extra).toMatchObject({ simulated: true, simulation_label: 'SIMULATED — NO MONEY MOVED', fees: 'PROPOSED — NOT APPROVED', name: 'USDC', version: '2', capability_id: 'dev.data.extract' });
    const t = await svc.getTask({ id: (await pool.query('SELECT principal FROM workflow_runs WHERE run_id = $1', [body.task_id])).rows[0].principal }, body.task_id);
    expect(req.amount).toBe(t.quote.credit_charge_minor); // Satelink fee only — never the supplier's amount
    expect(BigInt(req.amount)).toBeLessThan(BigInt(t.quote.total_minor));
    expect(body.accepts[0]).toEqual(req); // body mirrors the header
  });

  it('a valid mock payment executes once; replaying the same payment returns the same receipt; a different payment is refused', async () => {
    const { required } = await quote402('machine-k-0002', 'Extract the emails from: paid@example.com');
    const sig = sign(required);
    const paid = await get(`/x402/preview/dev.data.extract${Q('Extract the emails from: paid@example.com')}`, { 'Idempotency-Key': 'machine-k-0002', 'PAYMENT-SIGNATURE': sig });
    expect(paid.status).toBe(200);
    const resp = decodePaymentResponseHeader(paid.headers.get('PAYMENT-RESPONSE')!);
    expect(resp).toMatchObject({ success: true, transaction: '', network: 'eip155:84532', extra: { simulated: true, settled: false } });
    const body = await paid.json() as Any;
    expect(body.task.output.result.emails).toEqual(['paid@example.com']);
    expect(body.receipt).toMatchObject({ outcome: 'succeeded', simulation_label: 'SIMULATED — NO MONEY MOVED', origin: 'simulated', payment: { rail: 'x402', network: 'eip155:84532', settlement: 'none — preview (no /settle call, no transaction)', simulated: true } });
    expect(resp.payer).toBe(body.receipt.payment.payer);
    const again = await get(`/x402/preview/dev.data.extract${Q('Extract the emails from: paid@example.com')}`, { 'Idempotency-Key': 'machine-k-0002', 'PAYMENT-SIGNATURE': sig });
    expect(again.status).toBe(200); expect(((await again.json()) as Any).receipt.receipt_id).toBe(body.receipt.receipt_id);
    expect(await captures(body.task.id)).toBe(1);
    const other = await get(`/x402/preview/dev.data.extract${Q('Extract the emails from: paid@example.com')}`, { 'Idempotency-Key': 'machine-k-0002', 'PAYMENT-SIGNATURE': sign(required) });
    expect(other.status).toBe(409);
    // Keyless machines get no promotional credit; the x402 deposit is fully captured; nothing is revenue.
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM ledger_txns t JOIN ledger_entries e USING (txn_id) WHERE t.ref_type = 'promotion' AND e.account_id IN (SELECT customer_account FROM workflow_reservations WHERE run_id = $1)", [body.task.id]);
    expect(rows[0].n).toBe(0);
    expect((await pool.query("SELECT DISTINCT origin FROM ledger_txns WHERE ref_type = 'x402_payment'")).rows.map((r: Any) => r.origin)).toEqual(['simulated']);
    expect((await pool.query('SELECT COALESCE(SUM(revenue_minor), 0)::text AS r FROM revenue_truth')).rows[0].r).toBe('0');
  });

  it('tampered, expired, wrong-amount and reused-nonce payments are rejected with a new 402 and charge nothing', async () => {
    const text = 'Extract the emails from: tamper@example.com';
    const { required, body } = await quote402('machine-k-0003', text);
    const pay = async (sig: string) => get(`/x402/preview/dev.data.extract${Q(text)}`, { 'Idempotency-Key': 'machine-k-0003', 'PAYMENT-SIGNATURE': sig });
    const reason = async (r: Response) => { expect(r.status).toBe(402); return decodePaymentRequiredHeader(r.headers.get('PAYMENT-REQUIRED')!).error; };
    expect(await reason(await pay(sign(required, { signature: `0x${'ab'.repeat(32)}` })))).toBe('invalid_exact_evm_payload_signature');
    expect(await reason(await pay(sign(required, { accepted: { amount: '1' } })))).toBe('requirements_mismatch');
    expect(await reason(await pay(sign(required, { authorization: { value: '1' } })))).toBe('invalid_exact_evm_payload_authorization_value');
    expect(await reason(await pay(sign(required, { authorization: { validBefore: String(Math.floor(Date.now() / 1000) - 1) } })))).toBe('invalid_exact_evm_payload_authorization_valid_before');
    expect(await reason(await pay('not base64 !!'))).toBe('invalid_payment_signature_header');
    const nonce = `0x${randomBytes(32).toString('hex')}`;
    const { required: r2 } = await quote402('machine-k-0004', 'Extract the emails from: nonce@example.com');
    expect((await get(`/x402/preview/dev.data.extract${Q('Extract the emails from: nonce@example.com')}`, { 'Idempotency-Key': 'machine-k-0004', 'PAYMENT-SIGNATURE': sign(r2, { authorization: { nonce } }) })).status).toBe(200);
    expect(await reason(await pay(sign(required, { authorization: { nonce } })))).toBe('invalid_exact_evm_payload_authorization_nonce_used');
    const { rows: [run] } = await pool.query('SELECT state FROM workflow_runs WHERE run_id = $1', [body.task_id]);
    expect(run.state).toBe('AWAITING_APPROVAL');
    expect((await pool.query('SELECT count(*)::int AS n FROM workflow_reservations WHERE run_id = $1', [body.task_id])).rows[0].n).toBe(0);
  });

  it('facilitator down → 503, nothing charged; the mock facilitator never saw /settle', async () => {
    const text = 'Extract the emails from: down@example.com';
    const r = await get(`/x402/preview/dev.data.extract${Q(text)}`, { 'Idempotency-Key': 'machine-k-0005' }, `${BASE}/dead/v1`);
    const required = decodePaymentRequiredHeader(r.headers.get('PAYMENT-REQUIRED')!);
    const down = await get(`/x402/preview/dev.data.extract${Q(text)}`, { 'Idempotency-Key': 'machine-k-0005', 'PAYMENT-SIGNATURE': sign(required) }, `${BASE}/dead/v1`);
    expect(down.status).toBe(503);
    expect(((await down.json()) as Any).error.code).toBe('FACILITATOR_UNAVAILABLE');
    const log = ((await (await fetch(`${FAC}/requests`)).json()) as Any).requests as string[];
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l === 'POST /verify')).toBe(true);
  });

  it('validation: Idempotency-Key required, unknown capability 404, mismatched plan 409', async () => {
    expect((await get(`/x402/preview/dev.data.extract${Q('x y z')}`, {})).status).toBe(400);
    expect((await get(`/x402/preview/no.such.cap${Q('x y z')}`, { 'Idempotency-Key': 'machine-k-0006' })).status).toBe(404);
    expect((await get(`/x402/preview/trading.strategy.evaluate${Q('Extract the emails from: a@b.co')}`, { 'Idempotency-Key': 'machine-k-0007' })).status).toBe(409);
  });
});

describe('x402 with a developer key: the receipt lands in the owner\'s usage', () => {
  it('pays via x402 and shows up in /v1/usage for the key owner', async () => {
    const key = (await keys.create(OWNER.id, { name: 'machine', scopes: ['tasks:create', 'tasks:read', 'receipts:read', 'usage:read'] })).secret;
    const text = 'Extract the emails from: owner-machine@example.com';
    const { required } = await quote402('machine-k-0008', text, { Authorization: `Bearer ${key}` });
    const paid = await get(`/x402/preview/dev.data.extract${Q(text)}`, { 'Idempotency-Key': 'machine-k-0008', Authorization: `Bearer ${key}`, 'PAYMENT-SIGNATURE': sign(required) });
    expect(paid.status).toBe(200);
    const rid = ((await paid.json()) as Any).receipt.receipt_id;
    const usage = ((await (await fetch(`${BASE}/v1/usage`, { headers: { 'X-Test-Session': OWNER.id } })).json()) as Any).usage;
    expect(usage.receipts.map((r: Any) => r.receipt_id)).toContain(rid);
  });
});

describe('the preview never reaches the live payment rail', () => {
  it('no module reachable from the preview server is the live x402 middleware, the vault/deposit code or the RPC credit path', () => {
    const entry = join(ROOT, 'apps', 'api', 'scripts', 'preview_release_a.mjs');
    const seen = new Set<string>(); const stack = [entry];
    while (stack.length) {
      const f = stack.pop()!; if (seen.has(f)) continue; seen.add(f);
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
        const p = resolve(dirname(f), m[1] || m[2]);
        if (existsSync(p)) stack.push(p);
      }
    }
    const rel = [...seen].map((f) => f.slice(ROOT.length + 1));
    expect(rel).toContain('apps/api/src/routes/x402_preview_route.js');
    const forbidden = rel.filter((f) => /^apps\/api\/(app_factory\.mjs|src\/payments\/|src\/services\/deposit_listener|src\/routes\/credits\.js|src\/utils\/payment_required|src\/vnext\/adapters\/x402\/|src\/middleware\/(credit_gate|free_tier_gate))/.test(f));
    expect(forbidden).toEqual([]);
    for (const f of seen) expect(readFileSync(f, 'utf8'), f).not.toMatch(/VAULT_ADDRESS|REVENUE_VAULT_ADDRESS|\/settle['"`]|api\.cdp\.coinbase\.com|x402\.org\/facilitator/);
  });
});
