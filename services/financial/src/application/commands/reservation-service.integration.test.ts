// Reservation service over the in-memory repository (no DB I/O; named *.integration.test.ts like
// m6-in-memory.contract.integration.test.ts so it runs with the Financial OS suite). The Postgres
// repository will run the same scenarios once its migration exists.
import { describe, it, expect, beforeEach } from 'vitest';
import { Money, USDT, USDC, ok } from '@satelink/kernel';
import type { Result } from '@satelink/kernel';
import { InMemoryReservationRepository } from '../../infrastructure/repositories/in-memory/in-memory-reservation-repository.js';
import type { AvailableBalanceReader } from '../ports/reservation-repository.js';
import { reserve, capture, release, expireLapsed } from './reservation-service.js';
import type { ReservationServiceDeps } from './reservation-service.js';

const usdt = (n: bigint) => Money.fromMinorUnits(n, USDT);
const T0 = 1_000_000;
const TTL = 30_000;

function must<T, E>(r: Result<T, E>): T {
  if (r.isErr) throw new Error(String((r.error as { toString(): string }).toString()));
  return r.value;
}
const tagOf = <T, E>(r: Result<T, E>) => (r.isErr ? (r.error as { tag: string }).tag : 'ok');

function deps(ledgerAvailable: bigint): ReservationServiceDeps & { repo: InMemoryReservationRepository } {
  const repo = new InMemoryReservationRepository();
  const balances: AvailableBalanceReader = { available: async (_a, like) => ok(Money.fromMinorUnits(ledgerAvailable, like.currency)) };
  return { reservations: repo, balances, repo };
}
const cmd = (id: string, amount: bigint, key = `idem_${id}`, now = T0) =>
  ({ reservationId: id, accountId: 'acct_1', amount: usdt(amount), idempotencyKey: key, now, ttlMs: TTL });

describe('Reservation service (reserve / capture / release / expire)', () => {
  let d: ReturnType<typeof deps>;
  beforeEach(() => { d = deps(1_000n); });

  it('reserve holds against ledger available MINUS existing holds', async () => {
    expect(must(await reserve(d, cmd('r1', 600n))).hold.amount).toBe(600n);
    expect(tagOf(await reserve(d, cmd('r2', 401n)))).toBe('InsufficientAvailableError'); // 1000 − 600 = 400 left
    expect(must(await reserve(d, cmd('r2', 400n))).state).toBe('held');
  });

  it('a released or captured hold frees the balance again', async () => {
    must(await reserve(d, cmd('r1', 1_000n)));
    must(await release(d, 'r1', T0 + 1));
    must(await reserve(d, cmd('r2', 700n)));
    must(await capture(d, 'r2', usdt(250n), T0 + 2));
    expect(must(await reserve(d, cmd('r3', 1_000n))).hold.amount).toBe(1_000n); // ledger posting of the capture is the UoW's job
  });

  it('reserve is idempotent on the client key: same request → same hold; different request → conflict', async () => {
    const a = must(await reserve(d, cmd('r1', 300n, 'k1')));
    const b = must(await reserve(d, cmd('r1-retry', 300n, 'k1')));
    expect(b.id.value).toBe(a.id.value);
    expect(must(await d.repo.findHeldByAccount('acct_1')).length).toBe(1);
    expect(tagOf(await reserve(d, cmd('r1-other', 301n, 'k1')))).toBe('IdempotencyConflictError');
  });

  it('capture charges ≤ reserved and is idempotent; release is idempotent; versions advance once per change', async () => {
    must(await reserve(d, cmd('r1', 500n)));
    const c = must(await capture(d, 'r1', usdt(120n), T0 + 5));
    expect([c.state, c.captured.amount, c.released.amount, c.version]).toEqual(['captured', 120n, 380n, 2]);
    expect(must(await capture(d, 'r1', usdt(120n), T0 + 6)).version).toBe(2); // replay writes nothing
    expect(tagOf(await capture(d, 'r1', usdt(121n), T0 + 6))).toBe('IdempotencyConflictError');
    expect(tagOf(await release(d, 'r1', T0 + 7))).toBe('IllegalReservationTransitionError');
    must(await reserve(d, cmd('r2', 100n)));
    const r = must(await release(d, 'r2', T0 + 5));
    expect(must(await release(d, 'r2', T0 + 6)).version).toBe(r.version);
    expect(tagOf(await capture(d, 'r2', usdt(600n), T0 + 5))).toBe('IllegalReservationTransitionError');
  });

  it('a stale concurrent writer loses (optimistic lock), never double-applies', async () => {
    must(await reserve(d, cmd('r1', 500n)));
    const loaded = must(await d.repo.findById('r1'))!;
    must(await capture(d, 'r1', usdt(100n), T0 + 1));
    const stale = must(loaded.release(T0 + 2));
    expect(tagOf(await d.repo.save(stale))).toBe('StaleVersionError');
    expect(must(await d.repo.findById('r1'))!.state).toBe('captured');
  });

  it('expireLapsed releases only lapsed holds and skips settled ones; capture after expiry is refused', async () => {
    must(await reserve(d, cmd('old', 100n, 'k-old', T0)));
    must(await reserve(d, cmd('done', 100n, 'k-done', T0)));
    must(await capture(d, 'done', usdt(100n), T0 + 1));
    must(await reserve(d, cmd('fresh', 100n, 'k-fresh', T0 + TTL)));
    expect(tagOf(await capture(d, 'old', usdt(1n), T0 + TTL))).toBe('ReservationExpiredError');
    expect(must(await expireLapsed(d, T0 + TTL))).toEqual(['old']);
    expect(must(await expireLapsed(d, T0 + TTL))).toEqual([]); // idempotent: nothing left to expire
    expect(must(await d.repo.findById('old'))!.state).toBe('expired');
    expect(must(await d.repo.findById('fresh'))!.state).toBe('held');
  });

  it('rejects bad input without writing anything', async () => {
    expect(tagOf(await reserve(d, { ...cmd('r1', 5n), ttlMs: 0 }))).toBe('InvalidReservationInputError');
    expect(tagOf(await reserve(d, { ...cmd('', 5n) }))).toBe('InvalidReservationInputError');
    expect(tagOf(await reserve(d, { ...cmd('r1', 5n), accountId: '' }))).toBe('InvalidReservationInputError');
    expect(tagOf(await reserve(d, { ...cmd('r1', 5n), amount: Money.fromMinorUnits(5n, USDC) }))).toBe('ok'); // reader answers in the request currency
    expect(tagOf(await capture(d, 'nope', usdt(1n), T0))).toBe('ReservationNotFoundError');
    expect(tagOf(await release(d, 'nope', T0))).toBe('ReservationNotFoundError');
  });

  it('a hold in another currency on the same account is a caller bug: reserve refuses, never mixes', async () => {
    must(await reserve(d, { ...cmd('c1', 5n), amount: Money.fromMinorUnits(5n, USDC) }));
    expect(tagOf(await reserve(d, cmd('c2', 5n)))).toBe('ReservationCurrencyMismatchError');
  });
});
