// Reservation service + ledger postings (S-5) over the in-memory repositories (no DB I/O; named
// *.integration.test.ts like m6-in-memory.contract.integration.test.ts so it runs with the Financial
// OS suite). Covers reserve, capture, partial capture, release, duplicate requests, concurrency,
// crash before / between writes and after commit, recovery, and ledger balance / conservation over
// 1,000 random operation sequences.
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  AccountRef, Direction, EntryState, LedgerTransaction, SourceReference, TxnId, holdTxnId, settleTxnId, settlePosting,
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
const OTHER = 'acct_other';
const REVENUE = 'acct_platform_revenue:sie';
const CASH = 'acct_settlement_cash';
const holds = (a: string) => `${a}:holds`;

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

async function deposit(ledger: InMemoryLedgerRepository, account: string, amount: bigint, id: string): Promise<void> {
  const src = must(SourceReference.of('test_deposit', id));
  must(await ledger.post(must(LedgerTransaction.create({
    txnId: must(TxnId.of(id)), kind: 'deposit', source: src,
    entries: [
      { account: ref(CASH), direction: Direction.DEBIT, amount: usdt(amount), state: EntryState.POSTED, source: src },
      { account: ref(account), direction: Direction.CREDIT, amount: usdt(amount), state: EntryState.POSTED, source: src },
    ],
  }))));
}

async function harness(customerDeposit: bigint): Promise<Harness> {
  const repo = new InMemoryReservationRepository();
  const ledger = new InMemoryLedgerRepository();
  const balances = new LedgerAvailableBalanceReader(ledger);
  const uowImpl = new InMemoryReservationUnitOfWork(repo, ledger, balances);
  if (customerDeposit > 0n) await deposit(ledger, CUSTOMER, customerDeposit, 'dep_1');
  const accountsFor = (r: Reservation): ReservationAccounts => ({ customer: ref(r.accountId.value), holds: ref(holds(r.accountId.value)), revenue: ref(REVENUE) });
  return { reservations: repo, uow: uowImpl, balances, accountsFor, repo, ledger, uowImpl };
}

/** credits − debits of non-voided entries on an account (the derived balance). */
async function bal(h: Harness, account: string): Promise<bigint> {
  let b = 0n;
  for (const e of must(await h.ledger.streamByAccount(account, {}))) if (!e.state.isVoided()) b += e.direction.isCredit() ? e.amount.amount : -e.amount.amount;
  return b;
}
async function txnIds(h: Harness): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const a of [CUSTOMER, holds(CUSTOMER), REVENUE, CASH]) for (const e of must(await h.ledger.streamByAccount(a, {}))) ids.add(e.source.refId);
  return ids;
}
const cmd = (id: string, amount: bigint, key = `idem_${id}`, now = T0, accountId = CUSTOMER) =>
  ({ reservationId: id, accountId, amount: usdt(amount), idempotencyKey: key, now, ttlMs: TTL });

describe('Reservation service + ledger postings (S-5)', () => {
  let h: Harness;
  beforeEach(async () => { h = await harness(1_000n); });

  it('reserve posts a balanced hold (customer → holds); an insufficient reserve posts nothing', async () => {
    must(await reserve(h, cmd('r1', 600n)));
    const t = must(await h.ledger.findByTxnId(holdTxnId('r1')))!;
    expect([t.kind, t.isBalanced(), t.totalDebits().amount]).toEqual(['hold', true, 600n]);
    expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER)), await bal(h, REVENUE)]).toEqual([400n, 600n, 0n]);
    expect(tagOf(await reserve(h, cmd('r2', 401n)))).toBe('InsufficientAvailableError');
    expect(must(await h.ledger.findByTxnId(holdTxnId('r2')))).toBeNull();
    must(await reserve(h, cmd('r2', 400n)));
    expect(await bal(h, CUSTOMER)).toBe(0n);
  });

  it('full capture: holds → revenue', async () => {
    must(await reserve(h, cmd('r1', 500n)));
    must(await capture(h, 'r1', usdt(500n), T0 + 1));
    const t = must(await h.ledger.findByTxnId(settleTxnId('r1')))!;
    expect([t.kind, t.isBalanced(), t.entryCount]).toEqual(['capture', true, 2]);
    expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER)), await bal(h, REVENUE)]).toEqual([500n, 0n, 500n]);
  });

  it('partial capture: actual cost → revenue, remainder → customer, in ONE balanced txn', async () => {
    must(await reserve(h, cmd('r1', 500n)));
    must(await capture(h, 'r1', usdt(120n), T0 + 1));
    const t = must(await h.ledger.findByTxnId(settleTxnId('r1')))!;
    expect([t.kind, t.isBalanced(), t.entryCount, t.totalDebits().amount]).toEqual(['capture', true, 3, 500n]);
    expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER)), await bal(h, REVENUE)]).toEqual([880n, 0n, 120n]);
  });

  it('release (failed call): the whole hold returns; no revenue', async () => {
    must(await reserve(h, cmd('r1', 500n)));
    must(await release(h, 'r1', T0 + 1));
    expect(must(await h.ledger.findByTxnId(settleTxnId('r1')))!.kind).toBe('release');
    expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER)), await bal(h, REVENUE)]).toEqual([1_000n, 0n, 0n]);
  });

  it('duplicate requests post nothing new: same reserve key, repeated capture; never settled both ways', async () => {
    must(await reserve(h, cmd('r1', 300n, 'k1')));
    const before = (await txnIds(h)).size;
    expect(must(await reserve(h, cmd('r1-retry', 300n, 'k1'))).id.value).toBe('r1');
    expect(tagOf(await reserve(h, cmd('r1-other', 301n, 'k1')))).toBe('IdempotencyConflictError');
    must(await capture(h, 'r1', usdt(100n), T0 + 1));
    must(await capture(h, 'r1', usdt(100n), T0 + 2));
    expect(tagOf(await capture(h, 'r1', usdt(101n), T0 + 2))).toBe('IdempotencyConflictError');
    expect(tagOf(await release(h, 'r1', T0 + 3))).toBe('IllegalReservationTransitionError');
    expect((await txnIds(h)).size).toBe(before + 1);
    expect([await bal(h, CUSTOMER), await bal(h, REVENUE)]).toEqual([900n, 100n]);
  });

  it('idempotency keys are scoped per account: another account may use the same key', async () => {
    await deposit(h.ledger, OTHER, 100n, 'dep_2');
    must(await reserve(h, cmd('a1', 10n, 'shared')));
    const b = must(await reserve(h, cmd('b1', 20n, 'shared', T0, OTHER)));
    expect([b.id.value, b.accountId.value, b.reserved.amount]).toEqual(['b1', OTHER, 20n]);
  });

  it('a reused reservation id with a new key is a conflict, never an overwrite', async () => {
    must(await reserve(h, cmd('r1', 10n, 'k1')));
    expect(tagOf(await reserve(h, cmd('r1', 10n, 'k2')))).toBe('DuplicateReservationError');
  });

  describe('concurrency (the checks run inside the commit, under the lock)', () => {
    it('two concurrent reserves cannot spend the same balance', async () => {
      const [a, b] = await Promise.all([reserve(h, cmd('c1', 600n)), reserve(h, cmd('c2', 600n))]);
      expect([tagOf(a), tagOf(b)].sort()).toEqual(['InsufficientAvailableError', 'ok']);
      expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER))]).toEqual([400n, 600n]);
    });

    it('many concurrent reserves never overdraw', async () => {
      const results = await Promise.all(Array.from({ length: 12 }, (_, i) => reserve(h, cmd(`m${i}`, 150n))));
      expect(results.filter((r) => r.isOk)).toHaveLength(6); // 6 × 150 = 900 ≤ 1,000 < 7 × 150
      expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER))]).toEqual([100n, 900n]);
    });

    it('two concurrent reserves with the SAME key create ONE hold; the loser replays it', async () => {
      const [a, b] = await Promise.all([reserve(h, cmd('s1', 100n, 'same')), reserve(h, cmd('s2', 100n, 'same'))]);
      expect(must(a).id.value).toBe(must(b).id.value);
      expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER))]).toEqual([900n, 100n]);
    });

    it('capture racing release: exactly one wins, the ledger shows only the winner', async () => {
      must(await reserve(h, cmd('r1', 500n)));
      const [c, r] = await Promise.all([capture(h, 'r1', usdt(200n), T0 + 1), release(h, 'r1', T0 + 1)]);
      expect([tagOf(c), tagOf(r)].filter((t) => t === 'ok')).toHaveLength(1);
      const settled = must(await h.repo.findById('r1'))!;
      expect(must(await h.ledger.findByTxnId(settleTxnId('r1')))!.kind).toBe(settled.state === 'captured' ? 'capture' : 'release');
      expect(await bal(h, holds(CUSTOMER))).toBe(0n);
    });

    it('a settle posting that already exists is a conflict, never a silent no-op', async () => {
      must(await reserve(h, cmd('r1', 500n)));
      const loaded = must(await h.repo.findById('r1'))!;
      must(await capture(h, 'r1', usdt(100n), T0 + 1));
      const stale = must(loaded.release(T0 + 2));
      expect(tagOf(await h.uow.commitSettle(stale, must(settlePosting(stale, h.accountsFor(stale)))))).toBe('StaleVersionError');
      const fresh = must(await h.repo.findById('r1'))!; // captured; a forged second settle for it
      expect(tagOf(await h.uow.commitSettle(fresh, must(settlePosting(fresh, h.accountsFor(fresh)))))).toBe('AlreadySettledError');
      expect([await bal(h, CUSTOMER), await bal(h, REVENUE)]).toEqual([900n, 100n]);
    });
  });

  describe('crash safety', () => {
    for (const at of ['before_writes', 'between_writes'] as const) {
      it(`crash ${at.replace('_', ' ')} during capture: nothing is written; the retry captures exactly once`, async () => {
        must(await reserve(h, cmd('r1', 500n)));
        h.uowImpl.crashOnNextCommit(at);
        expect(tagOf(await capture(h, 'r1', usdt(200n), T0 + 1))).toBe('RepositoryError');
        expect(must(await h.repo.findById('r1'))!.state).toBe('held');
        expect(must(await h.ledger.findByTxnId(settleTxnId('r1')))).toBeNull();
        must(await capture(h, 'r1', usdt(200n), T0 + 2));
        expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER)), await bal(h, REVENUE)]).toEqual([800n, 0n, 200n]);
      });

      it(`crash ${at.replace('_', ' ')} during reserve: no reservation, no hold; the retry holds once`, async () => {
        h.uowImpl.crashOnNextCommit(at);
        expect(tagOf(await reserve(h, cmd('r1', 500n)))).toBe('RepositoryError');
        expect(must(await h.repo.findById('r1'))).toBeNull();
        expect(must(await h.repo.findByIdempotencyKey(CUSTOMER, 'idem_r1'))).toBeNull();
        expect(await bal(h, CUSTOMER)).toBe(1_000n);
        must(await reserve(h, cmd('r1', 500n)));
        expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER))]).toEqual([500n, 500n]);
      });
    }

    it('crash after commit (response lost): the retry is a replay, not a second charge', async () => {
      must(await reserve(h, cmd('r1', 500n)));
      must(await capture(h, 'r1', usdt(200n), T0 + 1));
      const n = (await txnIds(h)).size;
      must(await capture(h, 'r1', usdt(200n), T0 + 5));
      expect((await txnIds(h)).size).toBe(n);
      expect(await bal(h, REVENUE)).toBe(200n);
    });
  });

  describe('recovery', () => {
    it('a hold whose caller never settled is released at expiry, once', async () => {
      must(await reserve(h, cmd('lost', 400n, 'k-lost', T0)));
      must(await reserve(h, cmd('fresh', 100n, 'k-fresh', T0 + TTL)));
      expect(must(await expireLapsed(h, T0 + TTL - 1))).toEqual({ expired: [], failed: [] });
      expect(must(await expireLapsed(h, T0 + TTL))).toEqual({ expired: ['lost'], failed: [] });
      expect(must(await expireLapsed(h, T0 + TTL))).toEqual({ expired: [], failed: [] });
      expect(must(await h.ledger.findByTxnId(settleTxnId('lost')))!.kind).toBe('release');
      expect([await bal(h, CUSTOMER), await bal(h, holds(CUSTOMER))]).toEqual([900n, 100n]);
      expect(tagOf(await capture(h, 'lost', usdt(1n), T0 + TTL + 1))).toBe('IllegalReservationTransitionError');
    });

    it('failures are reported, not swallowed, and do not starve the other lapsed holds', async () => {
      for (const id of ['a', 'b', 'c']) must(await reserve(h, cmd(id, 100n, `k-${id}`, T0)));
      let n = 0;
      const down = { tag: 'RepositoryError' as const, message: 'db down' };
      const flaky: ReservationServiceDeps = {
        ...h,
        uow: {
          commitHold: (r, p) => h.uow.commitHold(r, p),
          commitSettle: (r, p) => (n++ < 2 ? Promise.resolve({ isOk: false, isErr: true, error: down } as never) : h.uow.commitSettle(r, p)),
        },
      };
      const res = must(await expireLapsed(flaky, T0 + TTL, 3));
      expect(res.failed.map((f) => f.id)).toEqual(['a', 'b']);
      expect(res.failed[0]!.error).toMatch(/db down/);
      expect(res.expired).toEqual(['c']); // not starved by the two failures
      expect([...must(await expireLapsed(h, T0 + TTL, 10)).expired].sort()).toEqual(['a', 'b']);
    });
  });

  it('a reserve in another currency than the ledger is refused, never mixed (S-4)', async () => {
    const r = await reserve(h, { ...cmd('c1', 5n), amount: Money.fromMinorUnits(5n, USDC) });
    expect(tagOf(r)).toBe('RepositoryError');
    expect(String((r.error as { message: string }).message)).toMatch(/currency/i);
    expect(must(await h.ledger.findByTxnId(holdTxnId('c1')))).toBeNull();
    expect(tagOf(await capture(h, 'nope', usdt(1n), T0))).toBe('ReservationNotFoundError');
    expect(tagOf(await reserve(h, { ...cmd('r1', 5n), ttlMs: 0 }))).toBe('InvalidReservationInputError');
  });

  it('property (1,000 random sequences, keys from a small pool, concurrent bursts): balanced, conserved, never overdrawn', async () => {
    type Op =
      | { kind: 'reserve'; amt: bigint; key: number }
      | { kind: 'burst'; amt: bigint; keys: number[] }
      | { kind: 'capture'; i: number; frac: number; dt: number }
      | { kind: 'release'; i: number }
      | { kind: 'expire'; dt: number }
      | { kind: 'crash'; between: boolean };
    const op: fc.Arbitrary<Op> = fc.oneof(
      fc.record({ kind: fc.constant('reserve' as const), amt: fc.bigInt({ min: 1n, max: 900n }), key: fc.nat(5) }),
      fc.record({ kind: fc.constant('burst' as const), amt: fc.bigInt({ min: 1n, max: 900n }), keys: fc.array(fc.nat(5), { minLength: 2, maxLength: 4 }) }),
      fc.record({ kind: fc.constant('capture' as const), i: fc.nat(20), frac: fc.integer({ min: 1, max: 100 }), dt: fc.integer({ min: 0, max: 2 * TTL }) }),
      fc.record({ kind: fc.constant('release' as const), i: fc.nat(20) }),
      fc.record({ kind: fc.constant('expire' as const), dt: fc.integer({ min: 0, max: 2 * TTL }) }),
      fc.record({ kind: fc.constant('crash' as const), between: fc.boolean() }),
    );
    await fc.assert(fc.asyncProperty(fc.array(op, { minLength: 1, maxLength: 25 }), async (ops) => {
      const x = await harness(2_000n);
      const ids = new Set<string>();
      let n = 0;
      const tryReserve = async (amt: bigint, key: number) => {
        const r = await reserve(x, cmd(`p${n++}`, amt, `key${key}`));
        if (r.isOk) ids.add(r.value.id.value);
        else expect(['InsufficientAvailableError', 'IdempotencyConflictError', 'RepositoryError']).toContain((r.error as { tag: string }).tag);
      };
      for (const o of ops) {
        const list = [...ids];
        if (o.kind === 'reserve') await tryReserve(o.amt, o.key);
        else if (o.kind === 'burst') await Promise.all(o.keys.map((k) => tryReserve(o.amt, k)));
        else if (o.kind === 'capture' && list.length) {
          const id = list[o.i % list.length]!; const r = must(await x.repo.findById(id))!;
          await capture(x, id, usdt((r.reserved.amount * BigInt(o.frac)) / 100n || 1n), T0 + o.dt);
        } else if (o.kind === 'release' && list.length) await release(x, list[o.i % list.length]!, T0 + 1);
        else if (o.kind === 'expire') {
          const res = await expireLapsed(x, T0 + o.dt);
          // only a simulated crash may fail an expiry; it must be reported, never swallowed
          for (const f of must(res).failed) expect(f.error).toMatch(/simulated crash/);
        } else if (o.kind === 'crash') x.uowImpl.crashOnNextCommit(o.between ? 'between_writes' : 'before_writes');
      }
      const customer = await bal(x, CUSTOMER); const held = await bal(x, holds(CUSTOMER)); const revenue = await bal(x, REVENUE);
      expect(await bal(x, CASH)).toBe(-2_000n);
      expect(customer + held + revenue).toBe(2_000n); // conservation
      expect(customer >= 0n).toBe(true); // never overdrawn, even with concurrent bursts
      let captured = 0n; let active = 0n;
      for (const id of ids) {
        const r = must(await x.repo.findById(id))!;
        captured += r.captured.amount; active += r.hold.amount;
        expect(must(await x.ledger.findByTxnId(holdTxnId(id)))?.isBalanced()).toBe(true); // every reservation has exactly its hold
        const settle = must(await x.ledger.findByTxnId(settleTxnId(id)));
        expect(Boolean(settle)).toBe(r.state !== 'held');
        if (settle) expect(settle.isBalanced()).toBe(true);
      }
      expect(revenue).toBe(captured);
      expect(held).toBe(active);
    }), { numRuns: 1_000 });
  });
});
