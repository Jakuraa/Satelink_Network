/**
 * Release A P2 — the task engine end to end on real Postgres (testcontainers, full migration chain) with the
 * real "Demo Digital Store (MOCK)" running as a separate local process. Fixture model (no key).
 * Each scenario that spends uses its own user: every user has exactly the $1 promotional credit.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { applyMigrationsForTest } from './apply-migrations.js';
import { TaskService } from '../../apps/api/src/workflows/task_service.js';
import { CapabilityRegistry, loadSeedEntries } from '../../apps/api/src/workflows/capability_registry.js';
import { createModelRouter } from '../../apps/api/src/workflows/model_router.js';
import { loadPricing } from '../../apps/api/src/workflows/pricing.js';
import { createMockStoreConnector } from '../../apps/api/src/workflows/mock_store_connector.js';
import { PgDurableStore } from '../../apps/api/src/vnext/reliability/pg_durable_store.js';
import { PgRunStore } from '../../apps/api/src/workflows/run_store.js';

const ROOT = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', '..');
const MIGRATIONS_DIR = join(ROOT, 'database', 'migrations');
const PORT = 4400 + Math.floor(Math.random() * 400) + 20;
const A = { id: 'user:alice-0001' };
const B = { id: 'user:bob-0002' };
const C = { id: 'user:carol-0003' };
const D = { id: 'user:dave-0004' };

let container: StartedPostgreSqlContainer; let pool: Pool; let store: ChildProcess; let now = Date.parse('2026-11-04T10:00:00Z');
const clock = () => now;
const connector = createMockStoreConnector({ baseUrl: `http://127.0.0.1:${PORT}` });

async function boot() {
  return TaskService.create({
    pool, registry: new CapabilityRegistry(pool), router: createModelRouter({ env: {} }), pricing: loadPricing(),
    connectors: { mock_store: connector }, clock,
    workflowOptions: { store: new PgDurableStore(pool, { prefix: 'wf_' }), runStore: new PgRunStore(pool), clock, env: {} },
  });
}
const SIMKEYS = ['simulated', 'simulation_label'];
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

describe('task engine (P2) on Postgres + mock store', () => {
  let svc: Any;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    expect((await applyMigrationsForTest(url, MIGRATIONS_DIR)).errors).toEqual([]);
    pool = new Pool({ connectionString: url, max: 8 });
    store = spawn(process.execPath, [join(ROOT, 'tools', 'mock-digital-store', 'server.mjs')], {
      env: { ...process.env, MOCK_STORE_PORT: String(PORT), MOCK_STORE_STATE: join(mkdtempSync(join(tmpdir(), 'mstore-')), 'orders.json') }, stdio: 'ignore',
    });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
    svc = await boot();
  }, 180_000);

  afterAll(async () => { store?.kill(); await pool?.end(); await container?.stop(); });

  async function quoted(principal: { id: string }, text: string, key: string) {
    const { task } = await svc.createTask(principal, { text, idempotency_key: key });
    return task;
  }

  it('happy path: NL → plan → quote → approve → reserve → execute → verify → capture → receipt', async () => {
    const t = await quoted(A, 'Buy a sci-fi e-book gift code under $12', 'happy-000001');
    expect(t.state).toBe('AWAITING_APPROVAL');
    expect(t.plan.steps[0]).toMatchObject({ capability_id: 'shop.digital_goods.purchase', provider_name: 'Demo Digital Store (MOCK)' });
    expect(t.plan.model.served_by).toMatch(/^fixture\//);
    // merchant $9.99 paid by the user at checkout; credits pay only Satelink's 10% fee ($0.999); model line $0
    expect(t.quote).toMatchObject({ merchant_paid_by_user_usd: '9.990000', credit_charge_usd: '0.999000', fee_policy_status: 'PROPOSED — NOT APPROVED' });
    const a = await svc.approve(A, t.id, { quote_id: t.quote.quote_id, quote_version: t.quote.version });
    expect(a.task.state).toBe('AUTHORIZED');
    await svc.drain();
    const done = await svc.getTask(A, t.id);
    expect(done.state).toBe('SUCCEEDED');
    expect(done.reservation).toMatchObject({ state: 'captured', captured_usd: '0.999000' });
    const r = await svc.getReceipt(A, done.receipt_id);
    expect(r).toMatchObject({ outcome: 'succeeded', simulated: true, simulation_label: 'SIMULATED — NO MONEY MOVED', served_by: expect.stringMatching(/^fixture\//) });
    expect(r.verification).toMatchObject({ verified: true, evidence: { sku: 'EBOOK-SCIFI-10', status: 'confirmed' } });
    expect(r.ledger.transactions.map((x: Any) => x.kind)).toEqual(['hold', 'capture']);
    expect(r.ledger.ledger_hash).toMatch(/^[0-9a-f]{64}$/);
    const u = await svc.usage(A);
    expect(u).toMatchObject({ simulated_spend_usd: '0.999000', external_revenue_usd: '0.000000', promo_credit: { available_usd: '0.001000' } });
    expect((await pool.query('SELECT * FROM revenue_truth')).rows).toEqual([]);
    const phases = svc.events(t.id).map((e: Any) => e.to);
    expect(phases).toEqual(['CREATED', 'UNDERSTANDING', 'PLANNING', 'QUOTED', 'AWAITING_APPROVAL', 'AUTHORIZED', 'RESERVED', 'EXECUTING', 'VERIFYING', 'SUCCEEDED']);
  });

  it('replayed create returns the same task (no second plan or quote)', async () => {
    const again = await svc.createTask(A, { text: 'anything', idempotency_key: 'happy-000001' });
    expect(again.replayed).toBe(true);
    expect(again.task.state).toBe('SUCCEEDED');
  });

  it('missing value → AWAITING_INPUT question → answer → quote', async () => {
    const t = await quoted(B, 'Buy a cookbook e-book gift code', 'input-000001');
    expect(t.state).toBe('AWAITING_INPUT');
    expect(t.question.field).toBe('max_price_usd_minor');
    const { task } = await svc.provideInput(B, t.id, { field: 'max_price_usd_minor', value: '8.00' });
    expect(task.state).toBe('AWAITING_APPROVAL');
    expect(task.quote.merchant_paid_by_user_usd).toBe('7.500000');
  });

  it('concurrent double approve → exactly one execution, one order, one capture', async () => {
    const t = await quoted(B, 'Buy a cookbook e-book gift code under $8', 'double-000001');
    const args = { quote_id: t.quote.quote_id, quote_version: t.quote.version };
    const res = await Promise.all([svc.approve(B, t.id, args), svc.approve(B, t.id, args), svc.approve(B, t.id, args)]);
    expect(res.filter((r: Any) => r.changed)).toHaveLength(1);
    await svc.drain();
    expect((await svc.getTask(B, t.id)).state).toBe('SUCCEEDED');
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ledger_txns WHERE txn_id LIKE $1`, [`rsv:rsv_${t.id.slice(4)}:%`]);
    expect(rows[0].n).toBe(2); // one hold + one settle
    const steps = await pool.query(`SELECT count(*)::int AS n FROM workflow_run_steps WHERE run_id = $1`, [t.id]);
    expect(steps.rows[0].n).toBe(1);
  });

  it('supplier failure → FAILED, hold released, nothing captured, receipt "failed — no charge"', async () => {
    const t = await quoted(C, 'Buy the unavailable test voucher under $6', 'fail-000001');
    expect(t.state).toBe('AWAITING_APPROVAL');
    await svc.approve(C, t.id, { quote_id: t.quote.quote_id, quote_version: t.quote.version });
    await svc.drain();
    const f = await svc.getTask(C, t.id);
    expect(f.state).toBe('FAILED');
    expect(f.error.code).toBe('SUPPLIER_FAILED');
    expect(f.reservation.state).toBe('released');
    const r = await svc.getReceipt(C, f.receipt_id);
    expect(r).toMatchObject({ outcome: 'failed', outcome_label: 'failed — no charge', simulated: true, charges: { credits_charged_minor: '0' } });
    expect(r.ledger.transactions.map((x: Any) => x.kind)).toEqual(['hold', 'release']);
    expect((await svc.usage(C)).promo_credit.available_usd).toBe('1.000000');
  });

  it('insufficient simulated credit → FAILED before any hold', async () => {
    const t = await quoted(A, 'Buy a game store gift card under $30', 'poor-000001'); // fee $2.50 > remaining promo
    await svc.approve(A, t.id, { quote_id: t.quote.quote_id, quote_version: t.quote.version });
    await svc.drain();
    const f = await svc.getTask(A, t.id);
    expect(f.state).toBe('FAILED');
    expect(f.error.code).toBe('INSUFFICIENT_CREDIT');
    expect(f.reservation).toBeNull();
  });

  it('expired quote: approve after expiry → EXPIRED; sweep expires stale quotes; stale version refused', async () => {
    const t = await quoted(B, 'Buy a music streaming gift card under $16', 'expire-000001');
    await expect(svc.approve(B, t.id, { quote_id: t.quote.quote_id, quote_version: 99 })).rejects.toMatchObject({ code: 'QUOTE_MISMATCH' });
    now += 11 * 60_000;
    await expect(svc.approve(B, t.id, { quote_id: t.quote.quote_id, quote_version: t.quote.version })).rejects.toMatchObject({ code: 'QUOTE_EXPIRED' });
    expect((await svc.getTask(B, t.id)).state).toBe('EXPIRED');
    const t2 = await quoted(B, 'Buy a music streaming gift card under $16', 'expire-000002');
    now += 11 * 60_000;
    expect((await svc.sweep()).expired).toContain(t2.id);
    expect((await svc.getTask(B, t2.id)).state).toBe('EXPIRED');
  });

  it('tenant isolation: another user gets 404 for tasks and receipts', async () => {
    const mine = (await svc.listTasks(A, {})).find((t: Any) => t.receipt_id);
    await expect(svc.getTask(B, mine.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.getReceipt(B, mine.receipt_id)).rejects.toMatchObject({ status: 404 });
    expect((await svc.listTasks(B, {})).every((t: Any) => t.id !== mine.id)).toBe(true);
  });

  it('restart recovery: a task left in EXECUTING is verified, never blindly re-executed (exactly one order)', async () => {
    // Simulate a crash after RESERVED → EXECUTING but before the kernel submit (state written, effect unknown).
    const t2 = await quoted(D, 'Buy a cookbook e-book gift code under $8', 'crash-000002');
    const raw = await svc.store.getInternal(t2.id);
    let r = await svc.store.transition(raw.id, 'AWAITING_APPROVAL', 'AUTHORIZED', raw.version, { approval: { quote_id: t2.quote.quote_id, quote_version: t2.quote.version } });
    const accounts = await svc.sim.ensureCustomer(D.id, 'human');
    await svc.sim.grantDemoCredit(accounts);
    await svc.sim.reserve({ reservationId: `rsv_${t2.id.slice(4)}`, runId: t2.id, quoteId: t2.quote.quote_id, accounts, amount: 750_000n, idempotencyKey: `${t2.id}:reserve` });
    r = await svc.store.transition(r.id, 'AUTHORIZED', 'RESERVED', r.version);
    await svc.store.transition(r.id, 'RESERVED', 'EXECUTING', r.version);
    const fresh = await boot(); // "restart"
    await fresh.drain();
    const rec = await fresh.getTask(D, t2.id);
    expect(rec.state).toBe('SUCCEEDED');
    expect(fresh.events(t2.id).map((e: Any) => e.to)).toContain('UNKNOWN_EXECUTION_OUTCOME');
    const order = await connector.lookupOrder(`step_${t2.id.slice(4)}_1:EXECUTE`);
    expect(order?.status).toBe('confirmed');
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ledger_txns WHERE txn_id = $1`, [`rsv:rsv_${t2.id.slice(4)}:settle`]);
    expect(rows[0].n).toBe(1);
  });

  it('reconcile: ledger ↔ steps ↔ receipts agree for every terminal task', async () => {
    const out = await svc.reconcile();
    expect(out.problems).toEqual([]);
  });

  it('label contract (R10): every order/payment/receipt-like object carries simulated + simulation_label', async () => {
    for (const p of [A, B, C, D]) {
      for (const t of await svc.listTasks(p, {})) {
        for (const k of SIMKEYS) expect(t).toHaveProperty(k);
        if (t.quote) for (const k of SIMKEYS) expect(t.quote).toHaveProperty(k);
        if (t.reservation) for (const k of SIMKEYS) expect(t.reservation).toHaveProperty(k);
        if (t.receipt_id) for (const k of SIMKEYS) expect(await svc.getReceipt(p, t.receipt_id)).toHaveProperty(k);
      }
      for (const k of SIMKEYS) expect(await svc.usage(p)).toHaveProperty(k);
    }
  });

  it('R9 on Postgres: a registry row inserted at runtime is planned and quoted without code changes', async () => {
    const e: Any = structuredClone(loadSeedEntries().find((x: Any) => x.id === 'shop.digital_goods.purchase'));
    Object.assign(e, { id: 'shop.software_licence.purchase', name: 'Buy a software licence', description: 'Buy a software licence key', tags: ['software', 'licence', 'app'], intents: ['buy'] });
    await pool.query(`INSERT INTO capability_registry (id, version, entry, release_status, internal_only) VALUES ($1, 1, $2::jsonb, 'SIMULATED', false)`, [e.id, JSON.stringify(e)]);
    const t = await quoted(A, 'buy a note-taking app software licence under $13', 'r9-000001');
    expect(t.plan.steps[0].capability_id).toBe('shop.software_licence.purchase');
    expect(t.state).toBe('AWAITING_APPROVAL');
  });
});
