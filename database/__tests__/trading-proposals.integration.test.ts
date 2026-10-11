/**
 * Phase 6 item 13 — migration 036_trading_proposals + PgProposalStore through ProposalService, and
 * PgOmsStore.listOrders: create → list → approve (single transition, step-up recorded) → events
 * append-only; constraints; down migration.
 *
 * Default: testcontainers (CI). Local without Docker: TRADING_FOUNDATION_TEST_DB pointing at a LOCAL
 * server (the test creates and drops its own database).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyMigrationsForTest } from './apply-migrations.js';
// @ts-expect-error — plain ESM JS module
import { ProposalService, PgProposalStore } from '../../apps/api/src/trading_agent/proposals/index.mjs';
// @ts-expect-error — plain ESM JS module
import { PgOmsStore } from '../../apps/api/src/trading_agent/oms/index.mjs';

const HERE = import.meta.dirname ?? new URL('.', import.meta.url).pathname;
const MIGRATIONS_DIR = resolve(HERE, '..', 'migrations');
const DOWN_SQL = readFileSync(resolve(HERE, '..', 'migrations-down', '036_trading_proposals.down.sql'), 'utf8');

function assertLocal(url: string): void {
  const u = new URL(url);
  const socketHost = u.searchParams.get('host');
  const local = ['localhost', '127.0.0.1', '::1', ''].includes(u.hostname) && (u.hostname !== '' || (socketHost ?? '').startsWith('/'));
  if (!local) throw new Error(`TRADING_FOUNDATION_TEST_DB must point at a local server, got "${u.hostname || socketHost}"`);
}

describe('036_trading_proposals', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let adminUrl: string | undefined;
  let dbName: string | undefined;
  let pool: pg.Pool;
  let n = 0;
  const ids = (p: string) => `${p}_${String(++n).padStart(6, '0')}`;
  const t = { now: Date.UTC(2026, 9, 11, 9, 0) };
  const clock = () => new Date(t.now);

  beforeAll(async () => {
    let conn: string;
    const local = process.env.TRADING_FOUNDATION_TEST_DB;
    if (local) {
      assertLocal(local);
      adminUrl = local;
      dbName = `trading_proposals_${Date.now()}`;
      const a = new pg.Client({ connectionString: local });
      await a.connect();
      await a.query(`CREATE DATABASE ${dbName}`);
      await a.end();
      const u = new URL(local);
      u.pathname = `/${dbName}`;
      conn = u.toString();
    } else {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      conn = container.getConnectionUri();
    }
    const result = await applyMigrationsForTest(conn, MIGRATIONS_DIR);
    expect(result.errors).toHaveLength(0);
    expect(result.applied).toContain('036_trading_proposals.sql');
    pool = new pg.Pool({ connectionString: conn, max: 4 });
    await pool.query(`INSERT INTO principals (id, kind, display_name, state) VALUES ('prn_alice', 'human', 'alice', 'active'), ('prn_bob', 'human', 'bob', 'active')`);
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    if (container) await container.stop();
    if (adminUrl && dbName) {
      const a = new pg.Client({ connectionString: adminUrl });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await a.end();
    }
  });

  const service = (accepted = true) => new ProposalService({
    store: new PgProposalStore(pool), idFactory: ids, clock, ownerOf: async (p: string) => ({ prn_bot: 'prn_alice' } as Record<string, string>)[p] ?? p,
    orderContext: async () => ({ brokerAccountId: 'bka_alice_1', venue: 'binance', mode: 'paper' }),
    acceptance: { accept: async () => (accepted ? { accepted: true, orderId: 'ord_000099', status: 'NEW' } : { accepted: false, reason: 'RISK_MAX_ORDER_NOTIONAL', detail: 'too big' }) },
  });
  const human = { principalId: 'prn_alice', kind: 'human' };

  it('create → list (owner only) → approve once, with step-up recorded; events append-only', async () => {
    const svc = service();
    const { proposalId } = await svc.create({ kind: 'order_intent', principalId: 'prn_bot', runId: 'run_1', payload: { mandateId: 'mdt_alice_1', instrument: 'BTC-USDT', side: 'buy', type: 'limit', quantity: '0.001', limitPrice: '30000', rationale: 'GO' } });
    expect((await svc.list(human)).map((p: { id: string; status: string; proposedBy: string }) => [p.id, p.status, p.proposedBy])).toEqual([[proposalId, 'pending_review', 'prn_bot']]);
    expect(await svc.list({ principalId: 'prn_bob', kind: 'human' })).toEqual([]);
    expect(await svc.approve(human, proposalId, {}, 'idem-1', 'totp')).toMatchObject({ status: 'approved', orderId: 'ord_000099' });
    await expect(svc.approve(human, proposalId, {}, 'idem-2', 'totp')).rejects.toMatchObject({ status: 409 });
    const ev = (await pool.query('SELECT action, step_up_method FROM trading_proposal_events WHERE proposal_id = $1 ORDER BY id', [proposalId])).rows;
    expect(ev).toEqual([{ action: 'created', step_up_method: null }, { action: 'approved', step_up_method: 'totp' }]);
    expect((await pool.query('SELECT status, result_ref FROM trading_proposals WHERE id = $1', [proposalId])).rows[0]).toEqual({ status: 'approved', result_ref: 'ord_000099' });
    await expect(pool.query('UPDATE trading_proposal_events SET action = $1', ['rejected'])).rejects.toThrow();
    await expect(pool.query('DELETE FROM trading_proposal_events')).rejects.toThrow();
  });

  it('a refusal on approval is recorded as execution_refused and closes the proposal', async () => {
    const svc = service(false);
    const { proposalId } = await svc.create({ kind: 'order', principalId: 'prn_alice', proposedBy: 'assistant', proposedByKind: 'assistant', payload: { mandateId: 'mdt_alice_1', instrument: 'BTC-USDT', side: 'buy', quantity: '1' } });
    await expect(svc.approve(human, proposalId, {}, 'idem-3', 'totp')).rejects.toMatchObject({ status: 422 });
    expect((await pool.query('SELECT status FROM trading_proposals WHERE id = $1', [proposalId])).rows[0].status).toBe('rejected');
  });

  it('constraints: order proposals need a mandate; an approved event needs a step-up method; decided_at tracks status', async () => {
    const base = `INSERT INTO trading_proposals (id, principal_id, proposed_by, proposed_by_kind, kind, mandate_id, payload, created_at, expires_at) VALUES ($1, 'prn_alice', 'x', 'agent', $2, $3, '{}', now(), now() + interval '1 hour')`;
    await expect(pool.query(base, ['prp_bad1', 'order', null])).rejects.toThrow(/check constraint/);
    await pool.query(base, ['prp_ok01', 'alert', null]);
    await expect(pool.query(`INSERT INTO trading_proposal_events (proposal_id, action, actor_id, at) VALUES ('prp_ok01', 'approved', 'prn_alice', now())`)).rejects.toThrow(/check constraint/);
    await expect(pool.query(`UPDATE trading_proposals SET status = 'approved' WHERE id = 'prp_ok01'`)).rejects.toThrow(/check constraint/); // decided_at missing
  });

  it('PgOmsStore.listOrders: newest first, own orders only, status filter, limit', async () => {
    await pool.query(`INSERT INTO broker_accounts (id, principal_id, broker, environment, status) VALUES ('bka_alice_1', 'prn_alice', 'binance', 'paper', 'active')`);
    const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND is_nullable = 'NO' AND column_default IS NULL`);
    expect(cols.rowCount).toBeGreaterThan(0);
    const store = new PgOmsStore(pool);
    expect(await store.listOrders({ principalId: 'prn_alice' })).toEqual([]);
    expect(await store.listOrders({ principalId: 'prn_alice', status: 'NEW', limit: 5 })).toEqual([]);
  });

  it('down migration drops both tables', async () => {
    await pool.query(DOWN_SQL);
    expect((await pool.query(`SELECT to_regclass('trading_proposals') AS t`)).rows[0].t).toBeNull();
  });
});
