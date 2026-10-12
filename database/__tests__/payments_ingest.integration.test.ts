/**
 * Payments ingestion on the Financial OS ledger (2026-10-12 directive, Wave 1.2 acceptance).
 * Real Postgres: a testcontainer, or (no Docker) a fresh database on the server in
 * LEDGER_TEST_DB — same pattern as ledger_refund_kind.integration.test.ts.
 *
 *   - duplicate webhook → exactly one posting
 *   - bad signature → 401-class refusal, nothing written
 *   - pending / partially_paid → no posting, no entitlement
 *   - overpayment → plan amount is revenue, remainder is customer credit
 *   - refund → reversal posted (originals untouched), entitlement revoked
 *   - currency isolation → USDT and INR never share an account
 *   - crash mid-ingest → nothing committed; the provider's retry ingests exactly once
 *   - every ledger txn balances; 038 kinds accepted, unknown kinds still refused
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

describe('038 kinds', () => {
  it('domain mirror accepts the five approved kinds and nothing else new', () => {
    for (const k of ['payment', 'subscription', 'commission', 'rebate', 'provider_fee']) expect(isLedgerKind(k)).toBe(true);
    expect(isLedgerKind('chargeback')).toBe(false);
  });
  it('the CHECK accepts them and still refuses an unknown kind', async () => {
    const pool = await freshPool('pay_kinds');
    for (const k of ['payment', 'subscription', 'commission', 'rebate', 'provider_fee']) {
      await pool.query(`INSERT INTO ledger_txns (txn_id, kind, ref_type, ref_id, currency, state) VALUES ($1,$2,'t','t','USDT','pending')`, [`k_${k}`, k]);
    }
    await expect(pool.query(`INSERT INTO ledger_txns (txn_id, kind, ref_type, ref_id, currency, state) VALUES ('k_x','chargeback','t','t','USDT','pending')`)).rejects.toThrow(/ledger_txns_kind_check/);
  });
});

describe('payment ingestion (single transaction)', () => {
  it('duplicate webhook → one event, one posting, one grant', async () => {
    const pool = await freshPool('pay_dup');
    await recordIntent(pool, intent());
    const first = await ingestCanonicalEvent(pool, ev());
    const second = await ingestCanonicalEvent(pool, ev());
    expect(first.duplicate).toBe(false);
    expect(first.ledgerTxnId).toBe('pay:payram:ref1:succeeded:19');
    expect(second.duplicate).toBe(true);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_events`)).toBe(1);
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE kind='subscription'`)).toBe(1);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants WHERE status='active'`)).toBe(1);
    expect(await count(pool, `SELECT COUNT(*) n FROM outbox WHERE event_type='payment.succeeded'`)).toBe(1);
    expect(await balance(pool, await accountFor(pool, 'revenue', 'USDT'))).toBe(19_000_000n);
    expect(await accountFor(pool, 'revenue', 'USDT')).toBe('acct_platform_revenue'); // reuses the seeded USDT revenue account
    expect(await allBalanced(pool)).toBe(true);
  });

  it('bad signature → refused before any write', async () => {
    const pool = await freshPool('pay_sig');
    const adapter = createPayramAdapter({ baseUrl: 'https://pay.example.test', apiKey: async () => 'k', fetch: async () => { throw new Error('x'); }, env: { PAYMENT_PAYRAM: 'true' } });
    const raw = JSON.stringify({ reference_id: 'r', customer_id: 'acct_c9', status: 'FILLED', currency: 'USDT', filled_amount: '1', timestamp: 1 });
    await expect(ingestWebhook(pool, adapter, raw, { 'x-payram-signature': 'sha256=' + 'f'.repeat(64) })).rejects.toMatchObject({ code: 'BAD_SIGNATURE' });
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_events`)).toBe(0);
    // and a correctly signed one goes through
    const good = `sha256=${createHmac('sha256', 'k').update(raw).digest('hex')}`;
    expect((await ingestWebhook(pool, adapter, raw, { 'x-payram-signature': good })).duplicate).toBe(false);
  });

  it('pending and partially_paid never post or grant', async () => {
    const pool = await freshPool('pay_pending');
    await recordIntent(pool, intent());
    await ingestCanonicalEvent(pool, ev({ providerEventId: 'ref1:pending:0', status: 'pending', amountMinor: 0n }));
    await ingestCanonicalEvent(pool, ev({ providerEventId: 'ref1:partially_paid:5', status: 'partially_paid', amountMinor: 5_000_000n }));
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_events`)).toBe(2);
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE txn_id LIKE 'pay:%'`)).toBe(0);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants`)).toBe(0);
    expect((await pool.query(`SELECT status FROM payment_intents WHERE canonical_ref='inv_1'`)).rows[0].status).toBe('partially_paid');
  });

  it('overpayment → plan amount to revenue, remainder to customer credit', async () => {
    const pool = await freshPool('pay_over');
    await recordIntent(pool, intent());
    const r = await ingestCanonicalEvent(pool, ev({ providerEventId: 'ref1:overpaid:25', status: 'overpaid', amountMinor: 25_000_000n }));
    expect(r.entitlement).toMatchObject({ kind: 'period' });
    expect(await balance(pool, await accountFor(pool, 'revenue', 'USDT'))).toBe(19_000_000n);
    const cc = await accountFor(pool, 'customer_credit', 'USDT');
    expect(await balance(pool, cc)).toBe(6_000_000n);
    expect((await pool.query(`SELECT ref_type, ref_id FROM ledger_entries WHERE account_id=$1`, [cc])).rows[0]).toEqual({ ref_type: 'customer_credit', ref_id: 'acct_c1' });
    expect(await allBalanced(pool)).toBe(true);
  });

  it('a top-up with no intent is customer credit, never revenue, and grants nothing', async () => {
    const pool = await freshPool('pay_topup');
    await ingestCanonicalEvent(pool, ev({ canonicalRef: null, providerEventId: 'tp:succeeded:3', providerPaymentId: 'tp', amountMinor: 3_000_000n }));
    expect(await balance(pool, await accountFor(pool, 'customer_credit', 'USDT'))).toBe(3_000_000n);
    expect(await balance(pool, 'acct_platform_revenue')).toBe(0n);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants`)).toBe(0);
  });

  it('refund → reversal posted (originals untouched), entitlement revoked; partial refund keeps it', async () => {
    const pool = await freshPool('pay_refund');
    await recordIntent(pool, intent({ provider: 'razorpay', currency: 'INR', amountMinor: 159_900n }));
    const base = { provider: 'razorpay', providerPaymentId: 'pay_1', currency: 'INR', network: null };
    await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'evt_cap', amountMinor: 159_900n }));
    const origRows = (await pool.query(`SELECT id, amount, direction FROM ledger_entries ORDER BY id`)).rows;

    const partial = await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'evt_ref1', status: 'refunded', amountMinor: 50_000n }));
    expect(partial.ledgerTxnId).toBe('pay:razorpay:evt_ref1');
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants WHERE status='active'`)).toBe(1);

    const rest = await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'evt_ref2', status: 'refunded', amountMinor: 109_900n }));
    expect(rest.entitlement).toMatchObject({ revoked: [expect.any(String)] });
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants WHERE status='revoked'`)).toBe(1);
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE kind='refund'`)).toBe(2);
    expect(await balance(pool, await accountFor(pool, 'revenue', 'INR'))).toBe(0n);
    // originals are never edited or deleted
    expect((await pool.query(`SELECT id, amount, direction FROM ledger_entries WHERE id = ANY($1) ORDER BY id`, [origRows.map((r) => r.id)])).rows).toEqual(origRows);
    // over-refund is capped at what remains (nothing left → no posting)
    const extra = await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'evt_ref3', status: 'refunded', amountMinor: 1n }));
    expect(extra.ledgerTxnId).toBe(null);
    expect(await allBalanced(pool)).toBe(true);
  });

  it('currency isolation: USDT and INR land in separate accounts, never summed', async () => {
    const pool = await freshPool('pay_ccy');
    await recordIntent(pool, intent());
    await recordIntent(pool, intent({ canonicalRef: 'inv_2', provider: 'razorpay', currency: 'INR', amountMinor: 159_900n }));
    await ingestCanonicalEvent(pool, ev());
    await ingestCanonicalEvent(pool, ev({ provider: 'razorpay', providerEventId: 'evt_inr', providerPaymentId: 'pay_inr', canonicalRef: 'inv_2', currency: 'INR', amountMinor: 159_900n }));
    const usdt = await accountFor(pool, 'revenue', 'USDT');
    const inr = await accountFor(pool, 'revenue', 'INR');
    expect(usdt).not.toBe(inr);
    expect(await balance(pool, usdt)).toBe(19_000_000n);
    expect(await balance(pool, inr)).toBe(159_900n);
    const mixed = await pool.query(`SELECT le.txn_id FROM ledger_entries le JOIN accounts a ON a.id = le.account_id WHERE a.currency <> le.currency`);
    expect(mixed.rowCount).toBe(0);
    // an event whose currency disagrees with its intent is refused outright
    await recordIntent(pool, intent({ canonicalRef: 'inv_3' }));
    await expect(ingestCanonicalEvent(pool, ev({ canonicalRef: 'inv_3', providerEventId: 'x:1', providerPaymentId: 'x', currency: 'USDC' }))).rejects.toThrow(/currency mismatch/);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_events WHERE provider_event_id='x:1'`)).toBe(0);
  });

  it('crash mid-ingest → nothing committed; the retry ingests exactly once', async () => {
    const pool = await freshPool('pay_crash');
    await recordIntent(pool, intent());
    await expect(ingestCanonicalEvent(pool, ev(), { hooks: { afterEventInsert: async () => { throw new Error('process killed'); } } })).rejects.toThrow('process killed');
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_events`)).toBe(0);
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE txn_id LIKE 'pay:%'`)).toBe(0);
    const retry = await ingestCanonicalEvent(pool, ev());
    expect(retry.duplicate).toBe(false);
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE txn_id LIKE 'pay:%'`)).toBe(1);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants`)).toBe(1);
  });

  it('a second settled event for the same payment is recorded but never posted twice', async () => {
    const pool = await freshPool('pay_twice');
    await recordIntent(pool, intent());
    await ingestCanonicalEvent(pool, ev());
    const again = await ingestCanonicalEvent(pool, ev({ providerEventId: 'ref1:overpaid:20', status: 'overpaid', amountMinor: 20_000_000n }));
    expect(again.entitlement).toEqual({ skipped: 'already_settled' });
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_txns WHERE txn_id LIKE 'pay:%'`)).toBe(1);
  });

  it('early renewal stacks the period instead of overlapping', async () => {
    const pool = await freshPool('pay_renew');
    await recordIntent(pool, intent());
    await recordIntent(pool, intent({ canonicalRef: 'inv_1b' }));
    const now = new Date('2026-10-12T00:00:00Z');
    await ingestCanonicalEvent(pool, ev(), { now });
    await ingestCanonicalEvent(pool, ev({ canonicalRef: 'inv_1b', providerEventId: 'ref2:succeeded:19', providerPaymentId: 'ref2' }), { now: new Date('2026-10-20T00:00:00Z') });
    const rows = (await pool.query(`SELECT period_start, period_end FROM payment_entitlement_grants ORDER BY id`)).rows;
    expect(new Date(rows[1].period_start).getTime()).toBe(new Date(rows[0].period_end).getTime());
    expect(new Date(rows[1].period_end).toISOString()).toBe('2026-12-11T00:00:00.000Z');
  });

  it('review fix: concurrent distinct events for one payment with NO intent post exactly once', async () => {
    const pool = await freshPool('pay_race');
    const base = { canonicalRef: null, providerPaymentId: 'race1', amountMinor: 3_000_000n };
    for (let round = 0; round < 5; round++) {
      const pid = `race_${round}`;
      await Promise.all([
        ingestCanonicalEvent(pool, ev({ ...base, providerPaymentId: pid, providerEventId: `${pid}:succeeded:3` })),
        ingestCanonicalEvent(pool, ev({ ...base, providerPaymentId: pid, providerEventId: `${pid}:overpaid:4`, status: 'overpaid', amountMinor: 4_000_000n })),
      ]);
      expect(await count(pool, `SELECT COUNT(*) n FROM payment_events WHERE provider_payment_id=$1`, [pid])).toBe(2);
      expect(await count(pool, `SELECT COUNT(*) n FROM payment_events WHERE provider_payment_id=$1 AND ledger_txn_id IS NOT NULL`, [pid])).toBe(1);
    }
    expect(await allBalanced(pool)).toBe(true);
  });

  it('review fix: concurrent refunds never reverse more than was settled', async () => {
    const pool = await freshPool('pay_race_refund');
    await recordIntent(pool, intent({ provider: 'razorpay', currency: 'INR', amountMinor: 100_000n }));
    const base = { provider: 'razorpay', providerPaymentId: 'pay_r', currency: 'INR', network: null };
    await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'cap', amountMinor: 100_000n }));
    await Promise.all([1, 2, 3].map((n) => ingestCanonicalEvent(pool, ev({ ...base, providerEventId: `ref${n}`, status: 'refunded', amountMinor: 60_000n }))));
    expect(await balance(pool, await accountFor(pool, 'revenue', 'INR'))).toBe(0n); // capped at 100_000 total, never negative
    expect(await allBalanced(pool)).toBe(true);
  });

  it('review fix: an opened dispute moves no money and keeps the entitlement; a lost one reverses', async () => {
    const pool = await freshPool('pay_dispute');
    await recordIntent(pool, intent({ provider: 'razorpay', currency: 'INR', amountMinor: 159_900n }));
    const base = { provider: 'razorpay', providerPaymentId: 'pay_d', currency: 'INR', network: null };
    await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'cap', amountMinor: 159_900n }));
    const open = await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'dsp_open', status: 'dispute_open', amountMinor: 159_900n }));
    expect(open.ledgerTxnId).toBe(null);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants WHERE status='active'`)).toBe(1);
    expect(await count(pool, `SELECT COUNT(*) n FROM outbox WHERE event_type='payment.dispute_open' AND severity='warning'`)).toBe(1);
    const lost = await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'dsp_lost', status: 'disputed', amountMinor: 159_900n }));
    expect(lost.ledgerTxnId).toBe('pay:razorpay:dsp_lost');
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_entitlement_grants WHERE status='revoked'`)).toBe(1);
    expect(await balance(pool, await accountFor(pool, 'revenue', 'INR'))).toBe(0n);
  });
});

describe('Trading AI entitlements (Wave 1.7)', () => {
  const catalog = loadPlanCatalog();
  const day = (iso: string) => new Date(iso);

  it('a paid crypto period grants Pro; after period + grace it falls back to Free', async () => {
    const pool = await freshPool('plans_eff');
    await recordIntent(pool, intent());
    await ingestCanonicalEvent(pool, ev(), { now: day('2026-10-12T00:00:00Z') });
    expect((await effectivePlan(pool, 'acct_c1', { catalog, now: day('2026-10-20T00:00:00Z') })).plan.id).toBe('trading_ai_pro');
    const grace = await effectivePlan(pool, 'acct_c1', { catalog, now: day('2026-11-12T12:00:00Z') });
    expect(grace).toMatchObject({ inGrace: true });
    expect(grace.plan.id).toBe('trading_ai_pro');
    expect((await effectivePlan(pool, 'acct_c1', { catalog, now: day('2026-11-16T00:00:00Z') })).plan.id).toBe('trading_ai_free');
  });

  it('planGate uses the paid limits; a refunded period no longer counts', async () => {
    const pool = await freshPool('plans_gate');
    await recordIntent(pool, intent({ provider: 'razorpay', currency: 'INR', amountMinor: 100n }));
    const base = { provider: 'razorpay', providerPaymentId: 'p1', currency: 'INR', network: null };
    await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'cap', amountMinor: 100n }), { now: day('2026-10-12T00:00:00Z') });
    const usage = { countToday: async () => 10 };
    const now = day('2026-10-13T00:00:00Z');
    expect(await planGate(pool, { customerAccountId: 'acct_c1', feature: 'agentRuns', usage, catalog, now })).toMatchObject({ allowed: true, plan: 'trading_ai_pro', limit: 50 });
    await ingestCanonicalEvent(pool, ev({ ...base, providerEventId: 'ref', status: 'refunded', amountMinor: 100n }));
    expect(await planGate(pool, { customerAccountId: 'acct_c1', feature: 'agentRuns', usage, catalog, now })).toMatchObject({ allowed: false, plan: 'trading_ai_free' });
  });

  it('renewal reminders: T-7, T-3, T-0 each queued once; none after an early renewal; never a charge', async () => {
    const pool = await freshPool('plans_remind');
    await recordIntent(pool, intent());
    await ingestCanonicalEvent(pool, ev(), { now: day('2026-10-12T00:00:00Z') }); // ends 2026-11-11
    const at = async (iso: string) => (await queueRenewalReminders(pool, { catalog, now: day(iso) })).queued;
    expect(await at('2026-10-20T00:00:00Z')).toBe(0);
    expect(await at('2026-11-04T00:00:00Z')).toBe(1); // T-7
    expect(await at('2026-11-04T06:00:00Z')).toBe(0); // idempotent
    expect(await at('2026-11-08T00:00:00Z')).toBe(1); // T-3
    expect(await at('2026-11-11T00:00:00Z')).toBe(1); // T-0
    expect(await count(pool, `SELECT COUNT(*) n FROM outbox WHERE event_type='subscription.renewal_due'`)).toBe(3);
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_events`)).toBe(1); // reminders never create payments
    // early renewal stacks a new period → no further reminder for the old one
    await recordIntent(pool, intent({ canonicalRef: 'inv_renew' }));
    await ingestCanonicalEvent(pool, ev({ canonicalRef: 'inv_renew', providerEventId: 'r2:succeeded:19', providerPaymentId: 'r2' }), { now: day('2026-11-05T00:00:00Z') });
    const pool2Count = await count(pool, `SELECT COUNT(*) n FROM outbox WHERE event_type='subscription.renewal_due'`);
    await at('2026-11-10T00:00:00Z');
    expect(await count(pool, `SELECT COUNT(*) n FROM outbox WHERE event_type='subscription.renewal_due'`)).toBe(pool2Count);
  });
});

describe('provider reconciliation (Wave 1.9)', () => {
  const W = { windowStart: new Date('2000-01-01T00:00:00Z'), windowEnd: new Date('2100-01-01T00:00:00Z') };
  const fakeAdapter = (id: string) => ({ id, reconcile: async () => [] });

  it('clean when provider records, events and postings agree', async () => {
    const pool = await freshPool('recon_clean');
    await recordIntent(pool, intent());
    await ingestCanonicalEvent(pool, ev());
    const r = await reconcileProvider(pool, fakeAdapter('payram'), { ...W, providerRecords: [{ providerPaymentId: 'ref1', status: 'succeeded', amountMinor: 19_000_000n, currency: 'USDT' }] });
    expect(r).toMatchObject({ status: 'clean', mismatches: [] });
    expect((await pool.query(`SELECT status, provider_records, payment_events, ledger_postings FROM provider_reconciliation_runs`)).rows[0]).toEqual({ status: 'clean', provider_records: 1, payment_events: 1, ledger_postings: 1 });
    expect(await count(pool, `SELECT COUNT(*) n FROM outbox WHERE event_type='payments.reconciliation_mismatch'`)).toBe(0);
  });

  it('flags missing_event, status/amount mismatch, orphan_event and missing_posting; alerts once; never touches the ledger', async () => {
    const pool = await freshPool('recon_mm');
    await recordIntent(pool, intent());
    await ingestCanonicalEvent(pool, ev()); // ref1 settled 19 USDT
    await ingestCanonicalEvent(pool, ev({ canonicalRef: null, providerEventId: 'orph:succeeded:1', providerPaymentId: 'orph', amountMinor: 1_000_000n }));
    // a settled event with no posting (simulates a pre-Wave-1 or manual insert)
    await pool.query(`INSERT INTO payment_events (provider, provider_event_id, provider_payment_id, amount_minor, currency, status, occurred_at, raw_hash)
                      VALUES ('payram','np:succeeded:2','np',2000000,'USDT','succeeded',now(),$1)`, [sha256Hex('np')]);
    const ledgerBefore = await count(pool, `SELECT COUNT(*) n FROM ledger_entries`);
    const r = await reconcileProvider(pool, fakeAdapter('payram'), { ...W, providerRecords: [
      { providerPaymentId: 'ref1', status: 'succeeded', amountMinor: 18_000_000n, currency: 'USDT' },
      { providerPaymentId: 'np', status: 'refunded', amountMinor: 2_000_000n, currency: 'USDT' },
      { providerPaymentId: 'never', status: 'succeeded', amountMinor: 5n, currency: 'USDT' },
    ] });
    expect(r.status).toBe('mismatch');
    expect(new Set(r.mismatches.map((m: { kind: string }) => m.kind))).toEqual(new Set(['amount_mismatch', 'status_mismatch', 'missing_event', 'orphan_event', 'missing_posting']));
    expect(await count(pool, `SELECT COUNT(*) n FROM outbox WHERE event_type='payments.reconciliation_mismatch' AND severity='critical'`)).toBe(1);
    expect(await count(pool, `SELECT COUNT(*) n FROM ledger_entries`)).toBe(ledgerBefore);
  });

  it('a provider without API access records an error run, not a false clean', async () => {
    const pool = await freshPool('recon_err');
    const r = await reconcileProvider(pool, { id: 'cashfree', reconcile: async () => { throw new Error('cashfree.reconcile(): no Cashfree account'); } }, { ...W, logger: { error() {} } });
    expect(r.status).toBe('error');
    expect((await pool.query(`SELECT status FROM provider_reconciliation_runs`)).rows[0].status).toBe('error');
  });
});

describe('console checkout API (Wave 1.8)', () => {
  const VAULT = '0x577D3716d6Ad5b676d230f5409deF9838FABaCEF';
  const PUBLISHED = async () => ({ status: 'published', url: 'https://jakuraa.com/legal/refunds', httpStatus: 200, completionAllowed: true });
  const UNPUBLISHED = async () => ({ status: 'not_published', url: 'https://jakuraa.com/legal/refunds', httpStatus: 404, completionAllowed: false });
  const INVOICE_ADDR = '0x' + '5a'.repeat(20);
  const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
  const pad = (a: string) => '0x' + a.slice(2).toLowerCase().padStart(64, '0');
  const fakeChain = () => {
    const receipts = new Map<string, unknown>();
    const c = {
      head: 0,
      mine(tx: string, t: { token: string; to: string; amount: bigint; from: string; block: number }) {
        receipts.set(tx, { status: 1, blockNumber: t.block, logs: [{ address: t.token, index: 0, data: '0x' + t.amount.toString(16).padStart(64, '0'),
          topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', pad(t.from), pad(t.to)] }] });
      },
      getTransactionReceipt: async (h: string) => receipts.get(h) ?? null,
      getBlockNumber: async () => c.head,
      getBlock: async () => ({ timestamp: 1760227200 }),
    };
    return c;
  };
  const mk = (pool: Pool, account: { accountId: string; email: string } | null, refundPolicy = PUBLISHED, chain: ReturnType<typeof fakeChain> | null = null) => {
    const app = express();
    const ENV = { VAULT_ADDRESS: VAULT, PAYMENTS_ONCHAIN_INVOICE_ADDRESS: INVOICE_ADDR };
    const onchain = createOnchainNativeAdapter({ env: ENV, lookupIntentAmount: async (ref: string) => (await pool.query('SELECT amount_minor::text a FROM payment_intents WHERE canonical_ref=$1', [ref])).rows[0]?.a ?? null });
    let n = 0;
    app.use('/v1/payments', createPaymentsCheckoutRouter(pool, { adapters: { 'onchain-native': onchain }, resolveSession: async () => account, newRef: () => `inv_test_${++n}`, logger: { error() {} }, refundPolicy, env: ENV, chainProvider: () => chain }));
    return { app, onchain };
  };
  const post = (app: express.Express, body: object) => request(app).post('/v1/payments/checkout/intents').set('x-satelink-console', '1').set('Content-Type', 'application/json').send(body);

  it('public plan read carries prices from config and the merchant block; no session needed', async () => {
    const pool = await freshPool('co_plans');
    const r = await request(mk(pool, null).app).get('/v1/payments/plans/trading-ai');
    expect(r.status).toBe(200);
    expect(r.body.data.plans.find((p: { id: string }) => p.id === 'trading_ai_pro').price.USDT).toEqual({ amountMinor: '19000000', display: '19.000000' });
    expect(r.body.data.merchant).toMatchObject({ legalName: 'Jakuraa Commercial Private Limited', cin: 'U52190TZ2019PTC033093', gstin: '33AADCF9341B1Z1' });
  });

  it('intent creation needs a session and the console CSRF header', async () => {
    const pool = await freshPool('co_auth');
    expect((await post(mk(pool, null).app, { planId: 'trading_ai_pro', method: 'usdt_polygon' })).status).toBe(401);
    const { app } = mk(pool, { accountId: 'acct_c1', email: 'c@example.test' });
    expect((await request(app).post('/v1/payments/checkout/intents').set('Content-Type', 'application/json').send({ planId: 'trading_ai_pro', method: 'usdt_polygon' })).status).toBe(403);
    expect((await post(app, { planId: 'trading_ai_pro', method: 'bitcoin' })).status).toBe(400);
    expect((await post(app, { planId: 'trading_ai_pro', method: 'razorpay' })).status).toBe(409); // not enabled here
  });

  it('USDT invoice → customer pays → tx verified on-chain → pending until confirmed → receipt; intro price server-side', async () => {
    const pool = await freshPool('co_flow');
    const chain = fakeChain();
    const { app } = mk(pool, { accountId: 'acct_c1', email: 'c@example.test' }, PUBLISHED, chain);
    const first = await post(app, { planId: 'trading_ai_launch', method: 'usdt_polygon', firstPeriod: false });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ canonicalRef: 'inv_test_1', amount: { amountMinor: '5000000', currency: 'USDT' }, introApplied: true, testMode: true });
    expect(first.body.data.invoice).toMatchObject({ chainId: 137, payTo: INVOICE_ADDR, amountMinor: '5000000', rail: 'erc20_transfer' });
    const tx = '0x' + 'cd'.repeat(32);
    chain.mine(tx, { token: USDT, to: INVOICE_ADDR, amount: 5_000_000n, from: '0x' + 'aa'.repeat(20), block: 100 });
    chain.head = 105; // 6 confirmations < 25
    const pend = await request(app).post('/v1/payments/checkout/intents/inv_test_1/onchain-tx').set('x-satelink-console', '1').set('Content-Type', 'application/json').send({ txHash: tx });
    expect(pend.body.data).toMatchObject({ status: 'pending', confirmations: 6, confirmationsRequired: 25 });
    expect((await request(app).get('/v1/payments/checkout/intents/inv_test_1')).body.data.receiptReady).toBe(false);
    chain.head = 130;
    const done = await request(app).post('/v1/payments/checkout/intents/inv_test_1/onchain-tx').set('x-satelink-console', '1').set('Content-Type', 'application/json').send({ txHash: tx });
    expect(done.body.data.status).toBe('succeeded');
    const poll = await request(app).get('/v1/payments/checkout/intents/inv_test_1');
    expect(poll.body.data).toMatchObject({ status: 'succeeded', receiptReady: true, entitlement: { planId: 'trading_ai_launch' }, merchant: { gstin: '33AADCF9341B1Z1' } });
    // second purchase: no intro, even though the client asks for it
    const second = await post(app, { planId: 'trading_ai_launch', method: 'usdt_polygon', firstPeriod: true });
    expect(second.body.data).toMatchObject({ amount: { amountMinor: '19000000' }, introApplied: false });
    // the same tx can't settle a different invoice
    const reuse = await request(app).post(`/v1/payments/checkout/intents/${second.body.data.canonicalRef}/onchain-tx`).set('x-satelink-console', '1').set('Content-Type', 'application/json').send({ txHash: tx });
    expect(reuse.status).toBe(409);
    expect(reuse.body.error).toBe('tx_already_used');
  });

  it('a tx that sends the wrong token or to another address is not accepted', async () => {
    const pool = await freshPool('co_wrong');
    const chain = fakeChain(); chain.head = 200;
    const { app } = mk(pool, { accountId: 'acct_c1', email: 'c@example.test' }, PUBLISHED, chain);
    await post(app, { planId: 'trading_ai_pro', method: 'usdt_polygon' });
    const t1 = '0x' + '01'.repeat(32); chain.mine(t1, { token: '0x' + '99'.repeat(20), to: INVOICE_ADDR, amount: 19_000_000n, from: '0x' + 'aa'.repeat(20), block: 10 });
    const t2 = '0x' + '02'.repeat(32); chain.mine(t2, { token: USDT, to: '0x966E1Ae22996545015b1414B35234b10719d7Ad4', amount: 19_000_000n, from: '0x' + 'aa'.repeat(20), block: 10 });
    for (const t of [t1, t2]) {
      const r = await request(app).post('/v1/payments/checkout/intents/inv_test_1/onchain-tx').set('x-satelink-console', '1').set('Content-Type', 'application/json').send({ txHash: t });
      expect(r.status).toBe(422);
      expect(r.body.error).toBe('no_matching_transfer');
    }
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_events`)).toBe(0);
  });

  it('status poll is owner-only (another account gets 404, never the invoice)', async () => {
    const pool = await freshPool('co_owner');
    await post(mk(pool, { accountId: 'acct_a', email: 'a@example.test' }).app, { planId: 'trading_ai_pro', method: 'usdt_polygon' });
    const other = await request(mk(pool, { accountId: 'acct_b', email: 'b@example.test' }).app).get('/v1/payments/checkout/intents/inv_test_1');
    expect(other.status).toBe(404);
  });

  it('refund policy NOT published (404): invoice preview works, checkout completion is refused, nothing is created', async () => {
    const pool = await freshPool('co_refund');
    const { app } = mk(pool, { accountId: 'acct_c1', email: 'c@example.test' }, UNPUBLISHED);
    const m = await request(app).get('/v1/payments/merchant');
    expect(m.body.data.refundPolicy).toMatchObject({ status: 'not_published', httpStatus: 404, completionAllowed: false });
    const q = await request(app).post('/v1/payments/checkout/quote').set('x-satelink-console', '1').set('Content-Type', 'application/json').send({ planId: 'trading_ai_pro', method: 'usdt_polygon' });
    expect(q.status).toBe(200);
    expect(q.body.data).toMatchObject({ amount: { amountMinor: '19000000', currency: 'USDT' }, merchant: { cin: 'U52190TZ2019PTC033093', gstin: '33AADCF9341B1Z1' }, refundPolicy: { completionAllowed: false } });
    const done = await post(app, { planId: 'trading_ai_pro', method: 'usdt_polygon' });
    expect(done.status).toBe(409);
    expect(done.body.error).toBe('refund_policy_unpublished');
    expect(await count(pool, `SELECT COUNT(*) n FROM payment_intents`)).toBe(0);
  });

  it('methods endpoint lists only enabled adapters (no Razorpay unless its adapter is on)', async () => {
    const pool = await freshPool('co_methods');
    const r = await request(mk(pool, null).app).get('/v1/payments/checkout/methods');
    expect(r.body.data.methods.map((x: { id: string }) => x.id)).toEqual(['usdt_polygon', 'usdc_base']);
  });
});

