/**
 * Release A ADR-5 — the plain-JS simulated-money writer (apps/api/src/workflows/sim_ledger.js) against the
 * TypeScript Financial OS it mirrors.
 *
 *   1. PARITY (pure): for hold / partial capture / full capture / release / expire, the JS posting equals
 *      the TS `reservation-postings` posting entry-for-entry (txn id, kind, source ref, account, direction,
 *      amount, state).
 *   2. READ-BACK: rows the JS writer posts are read by the TS PostgresLedgerRepository into a balanced
 *      LedgerTransaction (the DB balance trigger also passes at COMMIT).
 *   3. BEHAVIOUR on real Postgres: promo credit once; reserve atomic + idempotent (sequential AND
 *      concurrent duplicates → exactly one hold); insufficient credit → clean reject, no rows; capture once;
 *      release after capture refused; balances derived from the ledger; revenue_truth stays empty (R5).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import { applyMigrationsForTest } from './apply-migrations.js';
import { Money, USDC } from '@satelink/kernel';
import type { Result } from '@satelink/kernel';
import { Reservation } from '../../libs/financial-domain/src/reservation/reservation.js';
import { ReservationId } from '../../libs/financial-domain/src/reservation/reservation-id.js';
import { AccountId } from '../../libs/financial-domain/src/shared/account-id.js';
import { AccountRef } from '../../libs/financial-domain/src/ledger/account-ref.js';
import { holdPosting as tsHold, settlePosting as tsSettle } from '../../libs/financial-domain/src/coordination/reservation-postings.js';
import { PostgresLedgerRepository } from '../../services/financial/src/infrastructure/repositories/postgres/postgres-ledger-repository.js';
// Plain-JS runtime writer — imported exactly as apps/api uses it.
import {
  SimLedger, holdPosting as jsHold, settlePosting as jsSettle, holdTxnId, settleTxnId, PROMO_DEMO_CREDIT_MINOR,
} from '../../apps/api/src/workflows/sim_ledger.js';

const MIGRATIONS_DIR = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', 'migrations');

function must<T, E extends { toString(): string }>(r: Result<T, E>): T {
  if (r.isErr) throw new Error(r.error.toString());
  return r.value;
}
const usdc = (n: bigint) => Money.fromMinorUnits(n, USDC);
const ACC = { customer: 'acct_c_credit', holds: 'acct_c_holds', revenue: 'acct_rev' };
const TS_ACC = { customer: must(AccountRef.of(ACC.customer)), holds: must(AccountRef.of(ACC.holds)), revenue: must(AccountRef.of(ACC.revenue)) };
const held = (id: string, amt: bigint) => must(Reservation.reserve({
  id: must(ReservationId.of(id)), accountId: must(AccountId.of(ACC.customer)), amount: usdc(amt), available: usdc(amt),
  idempotencyKey: `k-${id}`, createdAt: 0, expiresAt: 1_000,
}));

type Norm = { txnId: string; kind: string; entries: string[] };
const normTs = (t: { txnId: { value: string }; kind: string; entries: readonly { account: { value: string }; direction: { isDebit(): boolean }; amount: Money; state: { value: string }; source: { refType: string; refId: string } }[] }): Norm => ({
  txnId: t.txnId.value, kind: t.kind,
  entries: t.entries.map((e) => `${e.direction.isDebit() ? 'debit' : 'credit'}|${e.account.value}|${e.amount.amount}|${e.state.value}|${e.source.refType}|${e.source.refId}`),
});
const normJs = (t: { txnId: string; kind: string; entries: { account: string; direction: string; amount: bigint; state: string; refType: string; refId: string }[] }): Norm => ({
  txnId: t.txnId, kind: t.kind, entries: t.entries.map((e) => `${e.direction}|${e.account}|${e.amount}|${e.state}|${e.refType}|${e.refId}`),
});

describe('sim_ledger ↔ TS reservation-postings parity (pure)', () => {
  const cases: [string, bigint, (r: Reservation) => Reservation, { state: string; captured?: bigint }][] = [
    ['partial capture', 500n, (r) => must(r.capture(usdc(120n), 1)), { state: 'captured', captured: 120n }],
    ['full capture', 500n, (r) => must(r.capture(usdc(500n), 1)), { state: 'captured', captured: 500n }],
    ['release', 999_999n, (r) => must(r.release(1)), { state: 'released' }],
    ['expire', 7n, (r) => must(r.expire(1_000)), { state: 'expired' }],
  ];
  it('hold posting is identical', () => {
    for (const amt of [1n, 500n, 2_500_000n]) {
      expect(normJs(jsHold({ reservationId: 'r1', reserved: amt }, ACC))).toEqual(normTs(must(tsHold(held('r1', amt), TS_ACC))));
    }
  });
  for (const [name, amt, step, js] of cases) {
    it(`settle posting is identical — ${name}`, () => {
      const ts = normTs(must(tsSettle(step(held('r1', amt)), TS_ACC)));
      expect(normJs(jsSettle({ reservationId: 'r1', reserved: amt, ...js }, ACC))).toEqual(ts);
    });
  }
  it('JS refuses float amounts (R4)', () => {
    expect(() => jsHold({ reservationId: 'r1', reserved: 1.5 as unknown as bigint }, ACC)).toThrow(/BigInt/);
  });
});

describe('sim_ledger on real Postgres', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let sim: InstanceType<typeof SimLedger>;
  let acc: { customer: string; holds: string; revenue: string };

  async function seedRun(runId: string): Promise<string> {
    const quoteId = `q_${runId.slice(4).padEnd(16, '0')}`;
    await pool.query(
      `INSERT INTO workflow_runs (run_id, principal, idempotency_key, template_id, template_version, status, input, quote, approval,
          budget_hold, is_simulation, created_at, updated_at, state, origin, environment)
       VALUES ($1,'user:test-1',$1,'assistant.task.v1',1,'running','{}','{}','{}','{}',true,now(),now(),'AUTHORIZED','simulated','preview')`,
      [runId],
    );
    await pool.query(
      `INSERT INTO workflow_quotes (quote_id, run_id, version, currency, minor_decimals, lines, supplier_cost_minor, satelink_fee_minor,
          tax_minor, total_minor, credit_charge_minor, fee_policy_status, disclosure, expires_at, origin, environment)
       VALUES ($1,$2,1,'USD',6,'[]',0,200000,0,200000,200000,'PROPOSED — NOT APPROVED','test',now() + interval '10 minutes','simulated','preview')`,
      [quoteId, runId],
    );
    return quoteId;
  }
  const count = async (sql: string, p: unknown[] = []) => Number((await pool.query(sql, p)).rows[0].n);

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const connectionString = container.getConnectionUri();
    const result = await applyMigrationsForTest(connectionString, MIGRATIONS_DIR);
    expect(result.errors).toEqual([]);
    pool = new Pool({ connectionString });
    await pool.query(`INSERT INTO workflow_definitions (template_id, version, definition) VALUES ('assistant.task.v1', 1, '{}') ON CONFLICT DO NOTHING`);
    sim = new SimLedger(pool);
    await sim.ensurePlatformAccounts();
    acc = await sim.ensureCustomer('user:test-1', 'human');
    await sim.ensureCustomer('user:test-1', 'human'); // idempotent
  }, 180_000);

  afterAll(async () => { await pool?.end(); await container?.stop(); });

  it('grants the $1 promotional credit exactly once, tagged promotional/preview', async () => {
    expect(await sim.grantDemoCredit(acc)).toBe(true);
    expect(await sim.grantDemoCredit(acc)).toBe(false);
    expect(await sim.available(acc.customer)).toBe(PROMO_DEMO_CREDIT_MINOR);
    const { rows } = await pool.query(`SELECT origin, environment FROM ledger_txns WHERE ref_type = 'promotion'`);
    expect(rows).toEqual([{ origin: 'promotional', environment: 'preview' }]);
  });

  it('reserve is atomic and idempotent: sequential and concurrent duplicates post exactly one hold', async () => {
    const runId = 'run_aaaaaaaaaaaa0001'; const quoteId = await seedRun(runId);
    const args = { reservationId: 'rsv_aaaaaaaaaaaa0001', runId, quoteId, accounts: acc, amount: 200_000n, idempotencyKey: 'idem-1' };
    const results = await Promise.all(Array.from({ length: 6 }, () => sim.reserve(args)));
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect((await sim.reserve(args)).replayed).toBe(true);
    expect(await count(`SELECT count(*) AS n FROM ledger_txns WHERE txn_id = $1`, [holdTxnId(args.reservationId)])).toBe(1);
    expect(await count(`SELECT count(*) AS n FROM ledger_entries WHERE txn_id = $1`, [holdTxnId(args.reservationId)])).toBe(2);
    expect(await sim.available(acc.customer)).toBe(PROMO_DEMO_CREDIT_MINOR - 200_000n);
    expect(await sim.available(acc.holds)).toBe(200_000n);
  });

  it('TS PostgresLedgerRepository reads JS-posted rows back as a balanced transaction', async () => {
    const repo = new PostgresLedgerRepository(pool);
    const t = must(await repo.findByTxnId(holdTxnId('rsv_aaaaaaaaaaaa0001')));
    expect(t).not.toBeNull();
    expect(t!.isBalanced()).toBe(true);
    expect(t!.entries.map((e) => `${e.direction.isDebit() ? 'Dr' : 'Cr'} ${e.account.value} ${e.amount.amount}`))
      .toEqual([`Dr ${acc.customer} 200000`, `Cr ${acc.holds} 200000`]);
  });

  it('insufficient credit is a clean reject: no ledger rows, no reservation', async () => {
    const runId = 'run_aaaaaaaaaaaa0002'; const quoteId = await seedRun(runId);
    await expect(sim.reserve({ reservationId: 'rsv_aaaaaaaaaaaa0002', runId, quoteId, accounts: acc, amount: 5_000_000n, idempotencyKey: 'idem-2' }))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_CREDIT' });
    expect(await count(`SELECT count(*) AS n FROM ledger_txns WHERE txn_id = $1`, [holdTxnId('rsv_aaaaaaaaaaaa0002')])).toBe(0);
    expect(await count(`SELECT count(*) AS n FROM workflow_reservations WHERE run_id = $1`, [runId])).toBe(0);
  });

  it('capture settles exactly once; a later release is refused; balances follow the ledger', async () => {
    const id = 'rsv_aaaaaaaaaaaa0001';
    const a = await Promise.all([sim.settle(id, 'captured', 150_000n), sim.settle(id, 'captured', 150_000n)]);
    expect(a.filter((r) => !r.replayed)).toHaveLength(1);
    await expect(sim.settle(id, 'released')).rejects.toMatchObject({ code: 'ILLEGAL_TRANSITION' });
    expect(await count(`SELECT count(*) AS n FROM ledger_txns WHERE txn_id = $1`, [settleTxnId(id)])).toBe(1);
    expect(await sim.available(acc.holds)).toBe(0n);
    expect(await sim.available(acc.customer)).toBe(PROMO_DEMO_CREDIT_MINOR - 150_000n);
    expect(await sim.available(acc.revenue)).toBe(150_000n);
    const txns = await sim.transactionsFor(id);
    expect(txns.map((t) => t.kind)).toEqual(['hold', 'capture']);
  });

  it('release returns the full hold to the customer', async () => {
    const runId = 'run_aaaaaaaaaaaa0003'; const quoteId = await seedRun(runId);
    const before = await sim.available(acc.customer);
    await sim.reserve({ reservationId: 'rsv_aaaaaaaaaaaa0003', runId, quoteId, accounts: acc, amount: 100_000n, idempotencyKey: 'idem-3' });
    await sim.settle('rsv_aaaaaaaaaaaa0003', 'released');
    expect(await sim.available(acc.customer)).toBe(before);
    expect((await pool.query(`SELECT state, captured_minor FROM workflow_reservations WHERE run_id = $1`, [runId])).rows[0]).toEqual({ state: 'released', captured_minor: null });
  });

  it('revenue_truth never counts simulated or promotional money (R5)', async () => {
    expect((await pool.query('SELECT * FROM revenue_truth')).rows).toEqual([]);
    expect(await count(`SELECT count(*) AS n FROM ledger_txns WHERE ref_type = 'reservation' AND (origin IS NULL OR environment IS NULL)`)).toBe(0);
    // The DB itself refuses an untagged reservation posting.
    await expect(pool.query(`INSERT INTO ledger_txns (txn_id, kind, ref_type, ref_id, currency, state) VALUES ('rsv:x:hold','hold','reservation','x','USDC','posted')`))
      .rejects.toThrow(/ledger_txns_reservation_tagged/);
  });
});
