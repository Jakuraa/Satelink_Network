// Reservation service + ledger postings (S-5) over the in-memory repositories (no DB I/O; named
// *.integration.test.ts like m6-in-memory.contract.integration.test.ts so it runs with the Financial
// OS suite). Covers: reserve, capture, release, partial capture, duplicate requests, crash mid-capture,
// recovery, and ledger balance / conservation over 1,000 random operation sequences.
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  AccountRef, EntryState, LedgerTransaction, SourceReference, TxnId, holdTxnId, settleTxnId, settlePosting,
} from '@satelink/financial-domain';
import type { Reservation, ReservationAccounts } from '@satelink/financial-domain';
import { Money, USDT, USDC } from '@satelink/kernel';
import type { Result } from '@satelink/kernel';
import { InMemoryReservationRepository } from '../../infrastructure/repositories/in-memory/in-memory-reservation-repository.js';
import { InMemoryLedgerRepository } from '../../infrastructure/repositories/in-memory/in-memory-ledger-repository.js';
import { InMemoryReservationUnitOfWork } from '../../infrastructure/repositories/in-memory/in-memory-reservation-unit-of-work.js';
import { LedgerAvailableBalanceReader } from '../queries/ledger-available-balance.js';
import { reserve, capture, release, expireLapsed } from './reservation-service.js';
import type { ReservationServiceDeps } from './reservation-service.js';

const usdt = (n: bigint) => Money.fromMinorUnits(n, USDT);
const T0 = 1_000_000;
const TTL = 30_000;
const CUSTOMER = 'acct_cust';
const HOLDS = `${CUSTOMER}:holds`;
const REVENUE = 'acct_platform_revenue:sie';
const CASH = 'acct_settlement_cash';

function must<T, E>(r: Result<T, E>): T {
  if (r.isErr) throw new Error(String((r.error as { toString(): string }).toString()));
  return r.value;
}
const tagOf = <T, E>(r: Result<T, E>) => (r.isErr ? (r.error as { tag: string }).tag : 'ok');
const ref = (s: string) => must(AccountRef.of(s));

interface Harness extends ReservationServiceDeps {
  repo: InMemoryReservationRepository;
  ledger: InMemoryLedgerRepository;
  uowImpl: InMemoryReservationUnitOfWork;
}

function harness(deposit: bigint): Harness {
  const repo = new InMemoryReservationRepository();
  const ledger = new InMemoryLedgerRepository();
  const uowImpl = new InMemoryReservationUnitOfWork(repo, ledger);
  if (deposit > 0n) {
    // customer deposit: Dr cash / Cr customer balance (REVENUE_MODEL §2: a deposit is a liability, not revenue)
    const src = must(SourceReference.of('test_deposit', 'dep_1'));
    void ledger.post(must(LedgerTransaction.transfer({
      txnId: must(TxnId.of('dep_1')), kind: 'deposit', source: src, debitAccount: ref(CASH), creditAccount: ref(CUSTOMER),
      amount: usdt(deposit), state: EntryState.POSTED,
    })));
  }
  const accountsFor = (r: Reservation): ReservationAccounts => ({ customer: ref(r.accountId.value), holds: ref(`${r.accountId.value}:holds`), revenue: ref(REVENUE) });
  return { reservations: repo, uow: uowImpl, balances: new LedgerAvailableBalanceReader(ledger), accountsFor, repo, ledger, uowImpl };
}

/** credits − debits of POSTED entries on an account, from the ledger (the derived balance). */
async function bal(h: Harness, account: string): Promise<bigint> {
  const entries = must(await h.ledger.streamByAccount(account, {}));
  let b = 0n;
  for (const e of entries) if (!e.state.isVoided()) b += e.direction.isCredit() ? e.amount.amount : -e.amount.amount;
  return b;
}
async function txnCount(h: Harness): Promise<number> {
  const all = new Set<string>();
  for (const a of [CUSTOMER, HOLDS, REVENUE, CASH]) for (const e of must(await h.ledger.streamByAccount(a, {}))) all.add(e.source.refId);
  return all.size;
}
const cmd = (id: string, amount: bigint, key = `idem_${id}`, now = T0) =>
  ({ reservationId: id, accountId: CUSTOMER, amount: usdt(amount), idempotencyKey: key, now, ttlMs: TTL });

describe('Reservation service + ledger postings (S-5)', () => {
  let h: Harness;
  beforeEach(() => { h = harness(1_000n); });

  it('reserve posts a balanced hold (customer → holds) and the next reserve sees the reduced balance', async () => {
    must(await reserve(h, cmd('r1', 600n)));
    const t = must(await h.ledger.findByTxnId(holdTxnId('r1')))!;
    expect([t.kind, t.isBalanced(), t.totalDebits().amount]).toEqual(['hold', true, 600n]);
    expect([await bal(h, CUSTOMER), await bal(h, HOLDS), await bal(h, REVENUE)]).toEqual([400n, 600n, 0n]);
    expect(tagOf(await reserve(h, cmd('r2', 401n)))).toBe('InsufficientAvailableError');
    expect(must(await h.ledger.findByTxnId(holdTxnId('r2')))).toBeNull(); // rejected reserve posts nothing
    must(await reserve(h, cmd('r2', 400n)));
    expect(await bal(h, CUSTOMER)).toBe(0n);
  });

  it('full capture: holds → revenue; nothing returns to the customer', async () => {
    must(await reserve(h, cmd('r1', 500n)));
    must(await capture(h, 'r1', usdt(500n), T0 + 1));
    const t = must(await h.ledger.findByTxnId(settleTxnId('r1')))!;
    expect([t.kind, t.isBalanced(), t.entryCount]).toEqual(['capture', true, 2]);
    expect([await bal(h, CUSTOMER), await bal(h, HOLDS), await bal(h, REVENUE)]).toEqual([500n, 0n, 500n]);
  });

  it('partial capture: the actual cost goes to revenue, the remainder back to the customer, in ONE balanced txn', async () => {
    must(await reserve(h, cmd('r1', 500n)));
    must(await capture(h, 'r1', usdt(120n), T0 + 1));
    const t = must(await h.ledger.findByTxnId(settleTxnId('r1')))!;
    expect([t.kind, t.isBalanced(), t.entryCount, t.totalDebits().amount]).toEqual(['capture', true, 3, 500n]);
    expect([await bal(h, CUSTOMER), await bal(h, HOLDS), await bal(h, REVENUE)]).toEqual([880n, 0n, 120n]);
  });

  it('release (failed call): the whole hold returns; no revenue', async () => {
    must(await reserve(h, cmd('r1', 500n)));
    must(await release(h, 'r1', T0 + 1));
    const t = must(await h.ledger.findByTxnId(settleTxnId('r1')))!;
    expect([t.kind, t.isBalanced()]).toEqual(['release', true]);
    expect([await bal(h, CUSTOMER), await bal(h, HOLDS), await bal(h, REVENUE)]).toEqual([1_000n, 0n, 0n]);
  });

  it('duplicate requests post nothing new: same reserve key, repeated capture, repeated release', async () => {
    must(await reserve(h, cmd('r1', 300n, 'k1')));
    const before = await txnCount(h);
    expect(must(await reserve(h, cmd('r1-retry', 300n, 'k1'))).id.value).toBe('r1');
    expect(tagOf(await reserve(h, cmd('r1-other', 301n, 'k1')))).toBe('IdempotencyConflictError');
    must(await capture(h, 'r1', usdt(100n), T0 + 1));
    must(await capture(h, 'r1', usdt(100n), T0 + 2));
    expect(tagOf(await capture(h, 'r1', usdt(101n), T0 + 2))).toBe('IdempotencyConflictError');
    expect(tagOf(await release(h, 'r1', T0 + 3))).toBe('IllegalReservationTransitionError'); // never settled both ways
    expect(await txnCount(h)).toBe(before + 1); // exactly one settle txn
    expect([await bal(h, CUSTOMER), await bal(h, REVENUE)]).toEqual([900n, 100n]);
  });

  it('crash mid-capture (commit fails): nothing is written; the retry captures exactly once', async () => {
    must(await reserve(h, cmd('r1', 500n)));
    h.uowImpl.crashOnNextCommit();
    expect(tagOf(await capture(h, 'r1', usdt(200n), T0 + 1))).toBe('RepositoryError');
    expect(must(await h.repo.findById('r1'))!.state).toBe('held');
    expect(must(await h.ledger.findByTxnId(settleTxnId('r1')))).toBeNull();
    expect([await bal(h, HOLDS), await bal(h, REVENUE)]).toEqual([500n, 0n]);
    must(await capture(h, 'r1', usdt(200n), T0 + 2));
    expect([await bal(h, CUSTOMER), await bal(h, HOLDS), await bal(h, REVENUE)]).toEqual([800n, 0n, 200n]);
  });

  it('crash after commit (response lost): the retry is a replay, not a second charge', async () => {
    must(await reserve(h, cmd('r1', 500n)));
    must(await capture(h, 'r1', usdt(200n), T0 + 1)); // committed; caller "crashed" before seeing it
    const n = await txnCount(h);
    must(await capture(h, 'r1', usdt(200n), T0 + 5));
    expect(await txnCount(h)).toBe(n);
    expect(await bal(h, REVENUE)).toBe(200n);
  });

  it('crash during reserve (commit fails): no reservation, no hold; the retry holds once', async () => {
    h.uowImpl.crashOnNextCommit();
    expect(tagOf(await reserve(h, cmd('r1', 500n)))).toBe('RepositoryError');
    expect(must(await h.repo.findById('r1'))).toBeNull();
    expect(await bal(h, CUSTOMER)).toBe(1_000n);
    must(await reserve(h, cmd('r1', 500n)));
    expect([await bal(h, CUSTOMER), await bal(h, HOLDS)]).toEqual([500n, 500n]);
  });

  it('recovery: a hold whose caller never settled is expired and released at expiry, once', async () => {
    must(await reserve(h, cmd('lost', 400n, 'k-lost', T0)));
    must(await reserve(h, cmd('fresh', 100n, 'k-fresh', T0 + TTL)));
    expect(must(await expireLapsed(h, T0 + TTL - 1))).toEqual([]); // not lapsed yet
    expect(must(await expireLapsed(h, T0 + TTL))).toEqual(['lost']);
    expect(must(await expireLapsed(h, T0 + TTL))).toEqual([]);
    const t = must(await h.ledger.findByTxnId(settleTxnId('lost')))!;
    expect([t.kind, t.isBalanced()]).toEqual(['release', true]);
    expect([await bal(h, CUSTOMER), await bal(h, HOLDS)]).toEqual([900n, 100n]);
    expect(tagOf(await capture(h, 'lost', usdt(1n), T0 + TTL + 1))).toBe('IllegalReservationTransitionError');
  });

  it('a stale concurrent writer loses at commit (optimistic lock); nothing double-settles', async () => {
    must(await reserve(h, cmd('r1', 500n)));
    const loaded = must(await h.repo.findById('r1'))!;
    must(await capture(h, 'r1', usdt(100n), T0 + 1));
    const stale = must(loaded.release(T0 + 2));
    const p = must(settlePosting(stale, h.accountsFor(stale)));
    expect(tagOf(await h.uow.commit(stale, p))).toBe('StaleVersionError');
    expect([await bal(h, CUSTOMER), await bal(h, REVENUE)]).toEqual([900n, 100n]);
  });

  it('a hold in another currency on the same account is refused, never mixed', async () => {
    // the customer's ledger is USDT: reading it as USDC is an explicit currency failure (S-4), never a mixed sum
    const r = await reserve(h, { ...cmd('c1', 5n), amount: Money.fromMinorUnits(5n, USDC) });
    expect(tagOf(r)).toBe('RepositoryError');
    expect(String((r.error as { message: string }).message)).toMatch(/currency/i);
    expect(must(await h.ledger.findByTxnId(holdTxnId('c1')))).toBeNull();
    expect(tagOf(await capture(h, 'nope', usdt(1n), T0))).toBe('ReservationNotFoundError');
    expect(tagOf(await reserve(h, { ...cmd('r1', 5n), ttlMs: 0 }))).toBe('InvalidReservationInputError');
  });

  it('property (1,000 random sequences): every txn balances; money is conserved; revenue = Σ captured; holds = Σ active', async () => {
    type Op = { kind: 'reserve'; amt: bigint } | { kind: 'capture'; i: number; frac: number } | { kind: 'release'; i: number } | { kind: 'expire'; dt: number } | { kind: 'crash' };
    const op: fc.Arbitrary<Op> = fc.oneof(
      fc.record({ kind: fc.constant('reserve' as const), amt: fc.bigInt({ min: 1n, max: 600n }) }),
      fc.record({ kind: fc.constant('capture' as const), i: fc.nat(20), frac: fc.integer({ min: 1, max: 100 }) }),
      fc.record({ kind: fc.constant('release' as const), i: fc.nat(20) }),
      fc.record({ kind: fc.constant('expire' as const), dt: fc.integer({ min: 0, max: 2 * TTL }) }),
      fc.constant({ kind: 'crash' as const }),
    );
    await fc.assert(fc.asyncProperty(fc.array(op, { minLength: 1, maxLength: 25 }), async (ops) => {
      const x = harness(2_000n);
      const ids: string[] = [];
      let n = 0;
      for (const o of ops) {
        if (o.kind === 'reserve') { const id = `p${n++}`; if ((await reserve(x, cmd(id, o.amt, id))).isOk) ids.push(id); }
        else if (o.kind === 'capture' && ids.length) {
          const id = ids[o.i % ids.length]!; const r = must(await x.repo.findById(id))!;
          const amt = (r.reserved.amount * BigInt(o.frac)) / 100n || 1n;
          await capture(x, id, usdt(amt), T0 + 1);
        } else if (o.kind === 'release' && ids.length) await release(x, ids[o.i % ids.length]!, T0 + 1);
        else if (o.kind === 'expire') await expireLapsed(x, T0 + o.dt);
        else if (o.kind === 'crash') x.uowImpl.crashOnNextCommit();
      }
      const all = new Map<string, bigint>();
      for (const a of [CASH, CUSTOMER, HOLDS, REVENUE]) all.set(a, await bal(x, a));
      // conservation: the deposit's 2,000 is split between customer, holds and revenue; cash side −2,000
      expect(all.get(CASH)).toBe(-2_000n);
      expect(all.get(CUSTOMER)! + all.get(HOLDS)! + all.get(REVENUE)!).toBe(2_000n);
      let captured = 0n; let held = 0n;
      for (const id of ids) {
        const r = must(await x.repo.findById(id))!;
        captured += r.captured.amount; held += r.hold.amount;
        for (const t of [holdTxnId(id), settleTxnId(id)]) { const tx = must(await x.ledger.findByTxnId(t)); if (tx) expect(tx.isBalanced()).toBe(true); }
        expect(Boolean(must(await x.ledger.findByTxnId(settleTxnId(id))))).toBe(r.state !== 'held');
      }
      expect(all.get(REVENUE)).toBe(captured);
      expect(all.get(HOLDS)).toBe(held);
      expect(all.get(CUSTOMER)! >= 0n).toBe(true);
    }), { numRuns: 1_000 });
  });
});
