import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Money, USDC, USDT } from '@satelink/kernel';
import type { Result } from '@satelink/kernel';
import { Reservation, sumHeld } from './reservation.js';
import { ReservationId } from './reservation-id.js';
import { AccountId } from '../shared/account-id.js';

function must<T, E extends { toString(): string }>(r: Result<T, E>): T {
  if (r.isErr) throw new Error(r.error.toString());
  return r.value;
}
function tagOf<T, E extends { tag: string }>(r: Result<T, E>): string {
  if (r.isOk) throw new Error('expected an error');
  return r.error.tag;
}

const usdt = (n: bigint) => Money.fromMinorUnits(n, USDT);
const ACCT = must(AccountId.of('acct_1'));
const T0 = 1_000_000;
const TTL = 60_000;

function hold(amount = 1_000n, available = 10_000n, key = 'idem_1'): Reservation {
  return must(Reservation.reserve({
    id: must(ReservationId.of('rsv_1')), accountId: ACCT, amount: usdt(amount), available: usdt(available),
    idempotencyKey: key, createdAt: T0, expiresAt: T0 + TTL,
  }));
}

describe('Reservation aggregate', () => {
  describe('reserve (invariant #1: reserve ≤ available, clean reject)', () => {
    it('holds the amount; nothing is captured or released yet', () => {
      const r = hold(1_000n);
      expect([r.state, r.reserved.amount, r.hold.amount, r.captured.amount, r.released.amount, r.closedAt, r.version])
        .toEqual(['held', 1_000n, 1_000n, 0n, 0n, null, 0]);
    });
    it('reserving exactly the available balance is allowed; one minor unit more is rejected', () => {
      expect(hold(10_000n, 10_000n).hold.amount).toBe(10_000n);
      const r = Reservation.reserve({ id: must(ReservationId.of('rsv_x')), accountId: ACCT, amount: usdt(10_001n), available: usdt(10_000n), idempotencyKey: 'k', createdAt: T0, expiresAt: T0 + TTL });
      expect(tagOf(r)).toBe('InsufficientAvailableError');
    });
    it('rejects zero/negative amounts, a currency mismatch, a bad key and a bad expiry', () => {
      const base = { id: must(ReservationId.of('rsv_x')), accountId: ACCT, available: usdt(10_000n), idempotencyKey: 'k', createdAt: T0, expiresAt: T0 + TTL };
      expect(tagOf(Reservation.reserve({ ...base, amount: usdt(0n) }))).toBe('InvalidReservationAmountError');
      expect(tagOf(Reservation.reserve({ ...base, amount: usdt(-5n) }))).toBe('InvalidReservationAmountError');
      expect(tagOf(Reservation.reserve({ ...base, amount: Money.fromMinorUnits(5n, USDC) }))).toBe('ReservationCurrencyMismatchError');
      expect(tagOf(Reservation.reserve({ ...base, amount: usdt(5n), idempotencyKey: ' ' }))).toBe('InvalidReservationAmountError');
      expect(tagOf(Reservation.reserve({ ...base, amount: usdt(5n), idempotencyKey: 'k'.repeat(201) }))).toBe('InvalidReservationAmountError');
      expect(tagOf(Reservation.reserve({ ...base, amount: usdt(5n), expiresAt: T0 }))).toBe('InvalidReservationAmountError');
      expect(tagOf(Reservation.reserve({ ...base, amount: usdt(5n), expiresAt: T0 + 0.5 }))).toBe('InvalidReservationAmountError');
    });
    it('rejects ids that are empty or too long', () => {
      expect(tagOf(ReservationId.of(''))).toBe('InvalidReservationIdError');
      expect(tagOf(ReservationId.of('r'.repeat(201)))).toBe('InvalidReservationIdError');
    });
  });

  describe('capture (invariant #2: 0 < capture ≤ reserved; remainder released)', () => {
    it('charges the actual cost and releases the remainder', () => {
      const c = must(hold(1_000n).capture(usdt(640n), T0 + 10));
      expect([c.state, c.captured.amount, c.released.amount, c.hold.amount, c.closedAt]).toEqual(['captured', 640n, 360n, 0n, T0 + 10]);
    });
    it('capturing the full reservation releases nothing', () => {
      const c = must(hold(1_000n).capture(usdt(1_000n), T0 + 10));
      expect([c.captured.amount, c.released.amount]).toEqual([1_000n, 0n]);
    });
    it('rejects capture above the reservation, zero, negative, or in another currency', () => {
      const r = hold(1_000n);
      expect(tagOf(r.capture(usdt(1_001n), T0 + 1))).toBe('CaptureExceedsReservedError');
      expect(tagOf(r.capture(usdt(0n), T0 + 1))).toBe('InvalidReservationAmountError');
      expect(tagOf(r.capture(usdt(-1n), T0 + 1))).toBe('InvalidReservationAmountError');
      expect(tagOf(r.capture(Money.fromMinorUnits(5n, USDC), T0 + 1))).toBe('ReservationCurrencyMismatchError');
      expect(r.state).toBe('held'); // a rejected capture changes nothing
    });
  });

  describe('release (a failed call is never charged)', () => {
    it('releases the whole hold', () => {
      const r = must(hold(1_000n).release(T0 + 5));
      expect([r.state, r.captured.amount, r.released.amount, r.hold.amount]).toEqual(['released', 0n, 1_000n, 0n]);
    });
  });

  describe('expiry (invariant #4: no orphan holds; no capture after expiry)', () => {
    it('cannot capture at or after expiresAt', () => {
      expect(tagOf(hold().capture(usdt(1n), T0 + TTL))).toBe('ReservationExpiredError');
      expect(tagOf(hold().capture(usdt(1n), T0 + TTL + 1))).toBe('ReservationExpiredError');
      expect(must(hold().capture(usdt(1n), T0 + TTL - 1)).state).toBe('captured');
    });
    it('expire() only at/after expiresAt; it releases everything', () => {
      expect(tagOf(hold().expire(T0 + TTL - 1))).toBe('ReservationNotExpiredError');
      const e = must(hold(700n).expire(T0 + TTL));
      expect([e.state, e.captured.amount, e.released.amount, e.hold.amount]).toEqual(['expired', 0n, 700n, 0n]);
    });
    it('a lapsed hold can still be released early by its owner (failed work)', () => {
      expect(must(hold().release(T0 + TTL + 5)).state).toBe('released');
    });
  });

  describe('terminal states (invariant #3) and idempotency (invariant #5)', () => {
    it('replaying the same terminal action returns the same reservation', () => {
      const c = must(hold().capture(usdt(400n), T0 + 1));
      expect(must(c.capture(usdt(400n), T0 + 2))).toBe(c);
      const r = must(hold().release(T0 + 1));
      expect(must(r.release(T0 + 2))).toBe(r);
      const e = must(hold().expire(T0 + TTL));
      expect(must(e.expire(T0 + TTL + 9))).toBe(e);
    });
    it('a replayed capture with a different amount is a conflict, never a second charge', () => {
      const c = must(hold().capture(usdt(400n), T0 + 1));
      expect(tagOf(c.capture(usdt(401n), T0 + 2))).toBe('IdempotencyConflictError');
    });
    it('terminal states never move to another terminal state', () => {
      const c = must(hold().capture(usdt(400n), T0 + 1));
      const r = must(hold().release(T0 + 1));
      const e = must(hold().expire(T0 + TTL));
      for (const [x, ops] of [[c, ['release', 'expire']], [r, ['capture', 'expire']], [e, ['capture', 'release']]] as const) {
        for (const op of ops) {
          const res = op === 'capture' ? x.capture(usdt(1n), T0 + 2) : op === 'release' ? x.release(T0 + 2) : x.expire(T0 + TTL + 2);
          expect(tagOf(res), `${x.state} → ${op}`).toBe('IllegalReservationTransitionError');
        }
      }
    });
    it('a retried reserve with the same key returns the existing hold; a different request conflicts', () => {
      const r = hold(1_000n, 10_000n, 'idem_9');
      expect(must(r.matchRetry({ accountId: ACCT, amount: usdt(1_000n), idempotencyKey: 'idem_9' }))).toBe(r);
      expect(tagOf(r.matchRetry({ accountId: ACCT, amount: usdt(999n), idempotencyKey: 'idem_9' }))).toBe('IdempotencyConflictError');
      expect(tagOf(r.matchRetry({ accountId: must(AccountId.of('acct_2')), amount: usdt(1_000n), idempotencyKey: 'idem_9' }))).toBe('IdempotencyConflictError');
      expect(tagOf(r.matchRetry({ accountId: ACCT, amount: Money.fromMinorUnits(1_000n, USDC), idempotencyKey: 'idem_9' }))).toBe('IdempotencyConflictError');
      expect(tagOf(r.matchRetry({ accountId: ACCT, amount: usdt(1_000n), idempotencyKey: 'other' }))).toBe('IdempotencyConflictError');
    });
    it('every transition returns a new frozen instance; the original is untouched', () => {
      const r = hold();
      const c = must(r.capture(usdt(1n), T0 + 1));
      expect(c).not.toBe(r);
      expect(r.state).toBe('held');
      expect(Object.isFrozen(c)).toBe(true);
    });
  });

  describe('sumHeld (reconciliation: holds account balance == Σ active holds)', () => {
    it('sums only active holds', () => {
      const a = hold(100n);
      const b = must(hold(200n).capture(usdt(50n), T0 + 1));
      const c = must(hold(300n).release(T0 + 1));
      const d = hold(400n);
      expect(must(sumHeld(usdt(0n), [a, b, c, d])).amount).toBe(500n);
      expect(must(sumHeld(usdt(0n), [])).amount).toBe(0n);
    });
    it('a reservation in another currency is rejected, never skipped', () => {
      const other = must(Reservation.reserve({ id: must(ReservationId.of('rsv_c')), accountId: ACCT, amount: Money.fromMinorUnits(5n, USDC), available: Money.fromMinorUnits(5n, USDC), idempotencyKey: 'k', createdAt: T0, expiresAt: T0 + TTL }));
      expect(tagOf(sumHeld(usdt(0n), [hold(), other]))).toBe('ReservationCurrencyMismatchError');
    });
  });

  describe('properties', () => {
    const RUNS = { numRuns: 1_000 }; // ACCEPTANCE_TESTS Financial OS: 1,000 random sequences
    const amount = fc.bigInt({ min: 1n, max: 10n ** 15n });

    it('conservation: in every terminal state captured + released = reserved, all ≥ 0', () => {
      fc.assert(fc.property(amount, fc.bigInt({ min: 0n, max: 10n ** 15n }), fc.constantFrom('capture', 'release', 'expire'), (reserved, rawCapture, op) => {
        const r = hold(reserved, reserved);
        const capture = (rawCapture % reserved) + 1n; // 1..reserved
        const t = op === 'capture' ? r.capture(usdt(capture), T0 + 1) : op === 'release' ? r.release(T0 + 1) : r.expire(T0 + TTL);
        const x = must(t);
        expect(x.captured.amount + x.released.amount).toBe(reserved);
        expect(x.captured.amount >= 0n && x.released.amount >= 0n && x.hold.amount === 0n).toBe(true);
        expect(x.captured.amount).toBe(op === 'capture' ? capture : 0n);
      }), RUNS);
    });

    it('reserve succeeds iff 0 < amount ≤ available', () => {
      fc.assert(fc.property(fc.bigInt({ min: -10n, max: 10n ** 12n }), fc.bigInt({ min: 0n, max: 10n ** 12n }), (amt, avail) => {
        const r = Reservation.reserve({ id: must(ReservationId.of('rsv_p')), accountId: ACCT, amount: usdt(amt), available: usdt(avail), idempotencyKey: 'k', createdAt: T0, expiresAt: T0 + TTL });
        expect(r.isOk).toBe(amt > 0n && amt <= avail);
      }), RUNS);
    });

    it('capture succeeds iff held, before expiry and 0 < capture ≤ reserved', () => {
      fc.assert(fc.property(amount, fc.bigInt({ min: -5n, max: 10n ** 15n + 5n }), fc.integer({ min: 0, max: 2 * TTL }), (reserved, cap, dt) => {
        const r = hold(reserved, reserved).capture(usdt(cap), T0 + dt);
        expect(r.isOk).toBe(cap > 0n && cap <= reserved && dt < TTL);
      }), RUNS);
    });
  });
});
