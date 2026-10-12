/**
 * Regression (2026-10-12, founder-approved fix): the on-chain DepositListener credits
 * through creditAccount(pool, …). With a pg Pool every pool.query autocommits, so the
 * api_deposits INSERT and the api_credits UPDATE were independent: a crash between them
 * left the deposit recorded (its tx_hash then blocks every retry as "already used") but
 * the balance never credited. creditAccount now wraps both in one transaction when it is
 * handed a Pool. Real Postgres (testcontainer, or LEDGER_TEST_DB without Docker).
 */
import { describe, it, expect, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client, Pool, type PoolClient } from 'pg';
import { creditAccount } from '../../apps/api/src/billing/credit_service.mjs';

let container: StartedPostgreSqlContainer | undefined;
let adminUrl = '';
const created: string[] = [];
const pools: Pool[] = [];
const WALLET = '0x' + 'ab'.repeat(20);
const TX = '0x' + '77'.repeat(32);

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
  const pool = new Pool({ connectionString: u.toString() });
  // Same shapes as apps/api/src/billing/api_keys_route.mjs / credit_system.mjs.
  await pool.query(`
    CREATE TABLE api_credits (api_key VARCHAR(100) PRIMARY KEY, wallet_address VARCHAR(42), tier VARCHAR(20) DEFAULT 'free',
      daily_limit INTEGER, credits_usdt NUMERIC(18,6) DEFAULT 0, total_deposited NUMERIC(18,6) DEFAULT 0, status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE api_deposits (id SERIAL PRIMARY KEY, api_key VARCHAR(100) NOT NULL, tx_hash VARCHAR(66) UNIQUE NOT NULL,
      amount_usdt NUMERIC(18,6) NOT NULL, credited_usdt NUMERIC(18,6), from_address VARCHAR(42), tier_before VARCHAR(20),
      tier_after VARCHAR(20), is_test_data BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW());
    INSERT INTO api_credits (api_key, wallet_address, tier, daily_limit) VALUES ('sl_live_atomic_1', '${WALLET}', 'basic', 10000);`);
  pools.push(pool);
  return pool;
}

/** A pool whose connections die on the api_credits UPDATE (crash between the two writes). */
function crashOnCreditUpdate(real: Pool): Pool {
  const wrap = (c: PoolClient | Pool) => (sql: unknown, ...rest: unknown[]) => {
    if (typeof sql === 'string' && /^\s*UPDATE api_credits/i.test(sql)) return Promise.reject(new Error('process killed mid-credit'));
    return (c.query as (...a: unknown[]) => unknown).call(c, sql, ...rest);
  };
  return new Proxy(real, {
    get(target, prop) {
      if (prop === 'query') return wrap(target);
      if (prop === 'connect') {
        return async () => {
          const client = await target.connect();
          return new Proxy(client, { get: (c, p) => (p === 'query' ? wrap(c) : Reflect.get(c, p, c)) });
        };
      }
      return Reflect.get(target, prop, target);
    },
  }) as Pool;
}

afterAll(async () => {
  for (const p of pools) await p.end().catch(() => undefined);
  if (adminUrl && !container) {
    const c = new Client({ connectionString: adminUrl }); await c.connect();
    for (const db of created) await c.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    await c.end();
  }
  await container?.stop().catch(() => undefined);
});

describe('DepositListener credit atomicity (creditAccount with a Pool)', () => {
  it('a crash between the deposit insert and the credit update leaves NOTHING recorded, and the retry credits once', async () => {
    const pool = await freshPool('dep_crash');
    await expect(creditAccount(crashOnCreditUpdate(pool), { wallet: WALLET, amountUsdt: 5, txHash: TX, fromAddress: WALLET })).rejects.toThrow('process killed');
    expect((await pool.query(`SELECT COUNT(*)::int n FROM api_deposits`)).rows[0].n).toBe(0); // old code: 1 (orphaned deposit)
    expect((await pool.query(`SELECT credits_usdt::text c FROM api_credits`)).rows[0].c).toBe('0.000000');

    // the listener's re-scan retries the same tx: it must credit, not be blocked as "already used"
    const retry = await creditAccount(pool, { wallet: WALLET, amountUsdt: 5, txHash: TX, fromAddress: WALLET });
    expect(retry).toMatchObject({ ok: true, credited: 5, balance: 5 });
    const again = await creditAccount(pool, { wallet: WALLET, amountUsdt: 5, txHash: TX, fromAddress: WALLET });
    expect(again).toMatchObject({ ok: false, code: 'tx_already_used' });
    expect((await pool.query(`SELECT credits_usdt::text c FROM api_credits`)).rows[0].c).toBe('5.000000');
    expect((await pool.query(`SELECT COUNT(*)::int n FROM api_deposits`)).rows[0].n).toBe(1);
  });

  it('a caller-owned client keeps control of its own transaction (Dodo /credit path unchanged)', async () => {
    const pool = await freshPool('dep_client');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await creditAccount(client, { wallet: WALLET, amountUsdt: 2, txHash: TX, fromAddress: WALLET });
      expect(r.ok).toBe(true);
      await client.query('ROLLBACK'); // the caller decides — creditAccount must not have committed on its own
    } finally { client.release(); }
    expect((await pool.query(`SELECT COUNT(*)::int n FROM api_deposits`)).rows[0].n).toBe(0);
    expect((await pool.query(`SELECT credits_usdt::text c FROM api_credits`)).rows[0].c).toBe('0.000000');
  });
});
