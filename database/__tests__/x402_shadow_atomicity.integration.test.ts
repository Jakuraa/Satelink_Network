/**
 * Regression (2026-10-12, founder-approved fix): x402 settlement used to fire its
 * shadow-ledger writes (revenue + draw) BEFORE its own COMMIT, on separate
 * connections. A settlement that then failed to commit left an ORPHANED shadow
 * ledger txn for revenue that was never recorded. The writes now fire only after
 * COMMIT. Real Postgres (testcontainer, or LEDGER_TEST_DB without Docker).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client, Pool, type PoolClient } from 'pg';
import { resolve } from 'node:path';
import { applyMigrationsForTest } from './apply-migrations.js';
import { recordX402Settlement } from '../../apps/api/src/payments/x402/settlement.js';

const MIGRATIONS_DIR = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', 'migrations');
let container: StartedPostgreSqlContainer | undefined;
let adminUrl = '';
const created: string[] = [];
const pools: Pool[] = [];

async function freshPool(name: string): Promise<Pool> {
  if (!adminUrl) {
    if (process.env.LEDGER_TEST_DB) adminUrl = process.env.LEDGER_TEST_DB;
    else { container = await new PostgreSqlContainer('postgres:16-alpine').start(); adminUrl = container.getConnectionUri(); }
  }
  const db = `${name}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const c = new Client({ connectionString: adminUrl });
  await c.connect(); await c.query(`CREATE DATABASE ${db}`); await c.end();
  created.push(db);
  const u = new URL(adminUrl); u.pathname = `/${db}`;
  await applyMigrationsForTest(u.toString(), MIGRATIONS_DIR);
  const pool = new Pool({ connectionString: u.toString() });
  // the two api-owned tables recordX402Settlement writes when bundleCalls = 0
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_sources (id BIGSERIAL PRIMARY KEY, source TEXT, amount_usd NUMERIC, token TEXT, network TEXT,
      tx_hash TEXT UNIQUE, payer TEXT, credited_api_key TEXT, is_test_data BOOLEAN);
    ALTER TABLE revenue_events_v2 ADD COLUMN IF NOT EXISTS op_type TEXT, ADD COLUMN IF NOT EXISTS client_id TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT, ADD COLUMN IF NOT EXISTS request_id TEXT UNIQUE, ADD COLUMN IF NOT EXISTS chain TEXT,
      ADD COLUMN IF NOT EXISTS method TEXT, ADD COLUMN IF NOT EXISTS source TEXT, ADD COLUMN IF NOT EXISTS demand_source TEXT;
    ALTER TABLE revenue_events_v2 ALTER COLUMN created_at DROP DEFAULT;
    ALTER TABLE revenue_events_v2 ALTER COLUMN created_at TYPE BIGINT USING extract(epoch from created_at)::bigint;`);
  pools.push(pool);
  return pool;
}

/** A pool whose FIRST connection (the settlement's own transaction) dies at COMMIT. */
function crashAtCommit(real: Pool): Pool {
  let first = true;
  return new Proxy(real, {
    get(target, prop) {
      if (prop !== 'connect') return Reflect.get(target, prop, target);
      return async () => {
        const client: PoolClient = await target.connect();
        if (!first) return client;
        first = false;
        return new Proxy(client, {
          get(c, p) {
            if (p !== 'query') return Reflect.get(c, p, c);
            return (sql: unknown, ...rest: unknown[]) => {
              if (typeof sql === 'string' && sql.trim().toUpperCase() === 'COMMIT') {
                return c.query('ROLLBACK').then(() => { throw new Error('connection lost during COMMIT'); });
              }
              return (c.query as (...a: unknown[]) => unknown)(sql, ...rest);
            };
          },
        });
      };
    },
  }) as Pool;
}

const settle = Promise.resolve();
const tick = () => new Promise((r) => setTimeout(r, 300)); // shadow writes are fire-and-forget
const TX = '0x' + 'ef'.repeat(32);
const PAYER = '0x' + '12'.repeat(20);

beforeAll(() => { process.env.LEDGER_SHADOW_WRITE = '1'; process.env.DRAW_SHADOW_WRITE = '1'; });
afterAll(async () => {
  delete process.env.LEDGER_SHADOW_WRITE; delete process.env.DRAW_SHADOW_WRITE;
  for (const p of pools) await p.end().catch(() => undefined);
  if (adminUrl && !container) {
    const c = new Client({ connectionString: adminUrl }); await c.connect();
    for (const db of created) await c.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    await c.end();
  }
  await container?.stop().catch(() => undefined);
});

describe('x402 settlement ⟷ shadow ledger atomicity', () => {
  it('a settlement that fails at COMMIT leaves NO shadow ledger txn and no draw (no orphan)', async () => {
    const pool = await freshPool('x402_crash');
    await expect(recordX402Settlement(crashAtCommit(pool), { txHash: TX, payer: PAYER, network: 'eip155:8453', amountUsd: 0.1 })).rejects.toThrow(/COMMIT/);
    await settle; await tick();
    expect((await pool.query(`SELECT COUNT(*)::int n FROM payment_sources`)).rows[0].n).toBe(0);
    expect((await pool.query(`SELECT COUNT(*)::int n FROM revenue_events_v2`)).rows[0].n).toBe(0);
    expect((await pool.query(`SELECT txn_id FROM ledger_txns WHERE txn_id IN ($1, $2)`, [`shadow:x402:${TX}`, `txn_x402_${TX}`])).rowCount).toBe(0);
    expect((await pool.query(`SELECT COUNT(*)::int n FROM ledger_entries`)).rows[0].n).toBe(0);
  });

  it('a committed settlement still gets its shadow revenue txn (behaviour kept)', async () => {
    const pool = await freshPool('x402_ok');
    await recordX402Settlement(pool, { txHash: TX, payer: PAYER, network: 'eip155:8453', amountUsd: 0.1 });
    await tick();
    expect((await pool.query(`SELECT COUNT(*)::int n FROM revenue_events_v2 WHERE request_id = $1`, [`x402:${TX}`])).rows[0].n).toBe(1);
    expect((await pool.query(`SELECT kind FROM ledger_txns WHERE txn_id = $1`, [`shadow:x402:${TX}`])).rows[0]?.kind).toBe('deposit');
  });
});
