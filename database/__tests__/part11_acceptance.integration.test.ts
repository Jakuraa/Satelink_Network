/**
 * Part 11 acceptance — items 1–8 (Wave 1.10, 2026-10-12 directive; text in
 * docs/platform/DECISIONS_2026-10-12.md). ONE test per item, named by item,
 * on the #520 adapters/ingest. Real Postgres (testcontainer or LEDGER_TEST_DB).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createHmac } from 'node:crypto';
import { Client, Pool } from 'pg';
import { resolve } from 'node:path';
import { applyMigrationsForTest } from './apply-migrations.js';
import { isLedgerKind } from '../../libs/financial-domain/src/ledger/ledger-kind.js';
import { ingestCanonicalEvent, ingestWebhook, recordIntent } from '../../apps/api/src/payments/ingest.mjs';
import { createPayramAdapter } from '../../apps/api/src/payments/adapters/payram.mjs';
import { sha256Hex } from '../../apps/api/src/payments/contract.mjs';
import express from 'express';
import request from 'supertest';
import { createPaymentsCheckoutRouter } from '../../apps/api/src/payments/checkout_router.mjs';
import { createOnchainNativeAdapter } from '../../apps/api/src/payments/adapters/onchain_native.mjs';
import { reconcileProvider } from '../../apps/api/src/payments/reconcile.mjs';
import { effectivePlan, planGate, queueRenewalReminders, loadPlanCatalog } from '../../apps/api/src/payments/plans.mjs';
import { shadowWriteRevenueLedger } from '../../apps/api/src/ledger/shadow_ledger_write.js';

const MIGRATIONS_DIR = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', 'migrations');

let container: StartedPostgreSqlContainer | undefined;
let adminUrl = '';
const created: string[] = [];
const pools: Pool[] = [];

async function freshPool(name: string): Promise<Pool> {
  if (!adminUrl) {
    if (process.env.LEDGER_TEST_DB) adminUrl = process.env.LEDGER_TEST_DB;
    else {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      adminUrl = container.getConnectionUri();
    }
  }
  const db = `${name}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const c = new Client({ connectionString: adminUrl });
  await c.connect();
  await c.query(`CREATE DATABASE ${db}`);
  await c.end();
  created.push(db);
  const u = new URL(adminUrl);
  u.pathname = `/${db}`;
  await applyMigrationsForTest(u.toString(), MIGRATIONS_DIR);
  const pool = new Pool({ connectionString: u.toString() });
  pools.push(pool);
  return pool;
}

afterAll(async () => {
  for (const p of pools) await p.end().catch(() => undefined);
  if (adminUrl && !container) {
    const c = new Client({ connectionString: adminUrl });
    await c.connect();
    for (const db of created) await c.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    await c.end();
  }
  await container?.stop().catch(() => undefined);
});

const ev = (over: Record<string, unknown> = {}) => ({
  provider: 'payram', providerEventId: 'ref1:succeeded:19', providerPaymentId: 'ref1', canonicalRef: 'inv_1',
  customerAccountId: 'acct_c1', productId: 'trading_ai_pro', amountMinor: 19_000_000n, currency: 'USDT', network: 'tron',
  status: 'succeeded', occurredAt: new Date('2026-10-12T00:00:00Z'), raw_hash: sha256Hex(String(Math.random())), ...over,
});

const intent = (over: Record<string, unknown> = {}) => ({
  canonicalRef: 'inv_1', provider: 'payram', customerAccountId: 'acct_c1', productId: 'trading_ai_pro',
  intentKind: 'subscription_period', amountMinor: 19_000_000n, currency: 'USDT', periodDays: 30, ...over,
});

async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number> {
  return Number((await pool.query(sql, params)).rows[0].n);
}
async function balance(pool: Pool, accountId: string): Promise<bigint> {
  const r = await pool.query(
    `SELECT COALESCE(SUM(amount) FILTER (WHERE direction='credit'),0)::text c, COALESCE(SUM(amount) FILTER (WHERE direction='debit'),0)::text d
       FROM ledger_entries WHERE account_id = $1`, [accountId]);
  return BigInt(r.rows[0].c) - BigInt(r.rows[0].d);
}
async function accountFor(pool: Pool, kind: string, currency: string): Promise<string> {
  return (await pool.query(`SELECT id FROM accounts WHERE principal_id='prn_platform' AND kind=$1 AND currency=$2`, [kind, currency])).rows[0]?.id;
}
async function allBalanced(pool: Pool): Promise<boolean> {
  const r = await pool.query(
    `SELECT txn_id FROM ledger_entries GROUP BY txn_id
      HAVING SUM(amount) FILTER (WHERE direction='debit') <> SUM(amount) FILTER (WHERE direction='credit')`);
  return r.rowCount === 0;
}


const catalog = loadPlanCatalog();
const at = (iso: string) => new Date(iso);

describe('Part 11 acceptance (items 1–8)', () => {
  it('P11-1: a valid payment is associated with the correct customer and product', async () => {
    const pool = await freshPool('p11_1');
    await recordIntent(pool, intent({ canonicalRef: 'inv_a', customerAccountId: 'acct_alice', productId: 'trading_ai_pro' }));
    await recordIntent(pool, intent({ canonicalRef: 'inv_b', customerAccountId: 'acct_bob', productId: 'trading_ai_pro' }));
    await ingestCanonicalEvent(pool, ev({ canonicalRef: 'inv_a', customerAccountId: 'acct_alice', providerEventId: 'a:ok', providerPaymentId: 'a' }), { now: at('2026-10-12T00:00:00Z') });
    const g = (await pool.query(`SELECT customer_account_id, product_id, canonical_ref FROM payment_entitlement_grants`)).rows;
    expect(g).toEqual([{ customer_account_id: 'acct_alice', product_id: 'trading_ai_pro', canonical_ref: 'inv_a' }]);
    expect((await effectivePlan(pool, 'acct_alice', { catalog, now: at('2026-10-13T00:00:00Z') })).plan.id).toBe('trading_ai_pro');
    expect((await effectivePlan(pool, 'acct_bob', { catalog, now: at('2026-10-13T00:00:00Z') })).plan.id).toBe('trading_ai_free');
    // a provider event that names another customer for alice's invoice must not grant bob
    await ingestCanonicalEvent(pool, ev({ canonicalRef: 'inv_a', customerAccountId: 'acct_bob', providerEventId: 'a:ok2', providerPaymentId: 'a2' }), { now: at('2026-10-12T00:00:00Z') }).catch(() => undefined);
    expect((await effectivePlan(pool, 'acct_bob', { catalog, now: at('2026-10-13T00:00:00Z') })).plan.id).toBe('trading_ai_free');
  });

  it('P11-2: a duplicate webhook cannot create duplicate credits or ledger entries', async () => {
    const pool = await freshPool('p11_2');
    await recordIntent(pool, intent());
    for (let i = 0; i < 3; i++) await ingestCanonicalEvent(pool, ev());
    // top-up (credits) path too
    for (let i = 0; i < 3; i++) await ingestCanonicalEvent(pool, ev({ canonicalRef: null, providerEventId: 'tp:ok', providerPaymentId: 'tp', amountMinor: 3_000_000n }));
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_events`)).toBe(2);
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE txn_id LIKE 'pay:%'`)).toBe(2);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants`)).toBe(1);
    expect(await balance(pool, await accountFor(pool, 'customer_credit', 'USDT'))).toBe(3_000_000n);
    expect(await allBalanced(pool)).toBe(true);
  });

  it('P11-3: a failed or pending payment cannot grant (permanent) entitlements', async () => {
    const pool = await freshPool('p11_3');
    await recordIntent(pool, intent());
    for (const [id, status, amt] of [['p', 'pending', 0n], ['pp', 'partially_paid', 5_000_000n], ['f', 'failed', 19_000_000n]] as const) {
      await ingestCanonicalEvent(pool, ev({ providerEventId: id, status, amountMinor: amt }));
    }
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants`)).toBe(0);
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE txn_id LIKE 'pay:%'`)).toBe(0);
    expect((await effectivePlan(pool, 'acct_c1', { catalog })).plan.id).toBe('trading_ai_free');
    // and a succeeded one grants a BOUNDED period, never a permanent entitlement
    await ingestCanonicalEvent(pool, ev({ providerEventId: 'ok' }), { now: at('2026-10-12T00:00:00Z') });
    const g = (await pool.query(`SELECT period_end FROM payment_entitlement_grants`)).rows[0];
    expect(g.period_end).not.toBeNull();
    expect((await effectivePlan(pool, 'acct_c1', { catalog, now: at('2027-01-01T00:00:00Z') })).plan.id).toBe('trading_ai_free');
  });

  it('P11-4: a refund or reversal updates the canonical financial state correctly', async () => {
    const pool = await freshPool('p11_4');
    await recordIntent(pool, intent());
    await ingestCanonicalEvent(pool, ev(), { now: at('2026-10-12T00:00:00Z') });
    const rev = await accountFor(pool, 'revenue', 'USDT');
    expect(await balance(pool, rev)).toBe(19_000_000n);
    await ingestCanonicalEvent(pool, ev({ providerEventId: 'ref1:refunded:19', status: 'refunded' }));
    expect(await balance(pool, rev)).toBe(0n);
    expect((await pool.query(`SELECT status FROM payment_entitlement_grants`)).rows[0].status).toBe('revoked');
    expect((await effectivePlan(pool, 'acct_c1', { catalog, now: at('2026-10-13T00:00:00Z') })).plan.id).toBe('trading_ai_free');
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE txn_id LIKE 'pay:%'`)).toBe(2); // original kept + reversal
    expect(await allBalanced(pool)).toBe(true);
  });

  it('P11-5: provider reconciliation detects discrepancies', async () => {
    const pool = await freshPool('p11_5');
    await recordIntent(pool, intent());
    await ingestCanonicalEvent(pool, ev());
    const r = await reconcileProvider(pool, { id: 'payram', reconcile: async () => [] } as any, {
      windowStart: at('2000-01-01T00:00:00Z'), windowEnd: at('2100-01-01T00:00:00Z'),
      providerRecords: [
        { providerPaymentId: 'ref1', status: 'succeeded', amountMinor: 18_000_000n, currency: 'USDT' }, // amount differs
        { providerPaymentId: 'ghost', status: 'succeeded', amountMinor: 1_000_000n, currency: 'USDT' }, // we never saw it
      ],
    });
    expect(r.status).toBe('mismatch');
    const kinds = new Set(r.mismatches.map((m: { kind: string }) => m.kind));
    expect(kinds.has('amount_mismatch')).toBe(true);
    expect(kinds.has('missing_event')).toBe(true);
  });

  it('P11-6: switching providers does not create a second source of truth', async () => {
    const pool = await freshPool('p11_6');
    const tablesBefore = await count(pool, `SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema='public'`);
    await recordIntent(pool, intent({ canonicalRef: 'inv_p1', provider: 'payram' }));
    await ingestCanonicalEvent(pool, ev({ canonicalRef: 'inv_p1', providerEventId: 'p1', providerPaymentId: 'p1' }), { now: at('2026-10-12T00:00:00Z') });
    await recordIntent(pool, intent({ canonicalRef: 'inv_p2', provider: 'razorpay', currency: 'INR', amountMinor: 159_900n }));
    await ingestCanonicalEvent(pool, ev({ canonicalRef: 'inv_p2', provider: 'razorpay', providerEventId: 'r1', providerPaymentId: 'r1', currency: 'INR', amountMinor: 159_900n, network: null }), { now: at('2026-11-10T00:00:00Z') });
    // one events table, one grants table, one ledger — both providers in the same rows
    expect((await pool.query(`SELECT DISTINCT provider FROM payment_events ORDER BY 1`)).rows.map((r) => r.provider)).toEqual(['payram', 'razorpay']);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants WHERE customer_account_id='acct_c1'`)).toBe(2);
    expect(await count(pool, `SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema='public'`)).toBe(tablesBefore); // no per-provider store
    // the entitlement is continuous across the switch (stacked, one answer)
    expect((await effectivePlan(pool, 'acct_c1', { catalog, now: at('2026-11-20T00:00:00Z') })).plan.id).toBe('trading_ai_pro');
    // currencies stay in their own ledger accounts (never summed) in the SAME ledger
    expect(await balance(pool, await accountFor(pool, 'revenue', 'USDT'))).toBe(19_000_000n);
    expect(await balance(pool, await accountFor(pool, 'revenue', 'INR'))).toBe(159_900n);
    expect(await allBalanced(pool)).toBe(true);
  });

  it('P11-7: metered usage flows through the existing Financial OS accounting pipeline', async () => {
    const pool = await freshPool('p11_7');
    const prev = process.env.LEDGER_SHADOW_WRITE;
    process.env.LEDGER_SHADOW_WRITE = '1';
    try {
      // RPC metered revenue (revenue_events_v2 shadow) and a payment land in the SAME ledger + revenue account
      await shadowWriteRevenueLedger(pool, { requestId: 'rpc_req_1', amountUsdt: '0.00003' });
      await shadowWriteRevenueLedger(pool, { requestId: 'rpc_req_1', amountUsdt: '0.00003' }); // idempotent
      await recordIntent(pool, intent());
      await ingestCanonicalEvent(pool, ev());
      expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE txn_id LIKE '%rpc_req_1%'`)).toBe(1);
      expect(await balance(pool, 'acct_platform_revenue')).toBe(19_000_000n + 30n);
      expect(await allBalanced(pool)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.LEDGER_SHADOW_WRITE; else process.env.LEDGER_SHADOW_WRITE = prev;
    }
  });

  it('P11-8: subscription entitlements are consistent across dashboards and APIs', async () => {
    const pool = await freshPool('p11_8');
    await recordIntent(pool, intent());
    await ingestCanonicalEvent(pool, ev(), { now: at('2026-10-12T00:00:00Z') });
    const usage = { countToday: async () => 0 };
    for (const iso of ['2026-10-13T00:00:00Z', '2026-11-12T12:00:00Z', '2026-11-20T00:00:00Z']) {
      const now = at(iso);
      const dash = await effectivePlan(pool, 'acct_c1', { catalog, now });      // console/checkout status API + dashboards
      const gate = await planGate(pool, { customerAccountId: 'acct_c1', feature: 'agentRuns', usage, catalog, now }); // enforcement
      expect(gate.plan, iso).toBe(dash.plan.id);
    }
    await ingestCanonicalEvent(pool, ev({ providerEventId: 'ref1:refunded:19', status: 'refunded' }));
    const now = at('2026-10-14T00:00:00Z');
    const dash = await effectivePlan(pool, 'acct_c1', { catalog, now });
    const gate = await planGate(pool, { customerAccountId: 'acct_c1', feature: 'agentRuns', usage, catalog, now });
    expect([dash.plan.id, gate.plan]).toEqual(['trading_ai_free', 'trading_ai_free']);
  });
});
