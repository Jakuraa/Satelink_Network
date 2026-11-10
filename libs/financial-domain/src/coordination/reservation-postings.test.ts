import { describe, it, expect } from 'vitest';
import { Money, USDT } from '@satelink/kernel';
import type { Result } from '@satelink/kernel';
import { Reservation } from '../reservation/reservation.js';
import { ReservationId } from '../reservation/reservation-id.js';
import { AccountId } from '../shared/account-id.js';
import { AccountRef } from '../ledger/account-ref.js';
import { holdPosting, settlePosting, holdTxnId, settleTxnId } from './reservation-postings.js';

function must<T, E extends { toString(): string }>(r: Result<T, E>): T {
  if (r.isErr) throw new Error(r.error.toString());
  return r.value;
}
const usdt = (n: bigint) => Money.fromMinorUnits(n, USDT);
const A = { customer: must(AccountRef.of('c')), holds: must(AccountRef.of('c:holds')), revenue: must(AccountRef.of('rev')) };
const held = (amt = 500n) => must(Reservation.reserve({
  id: must(ReservationId.of('r1')), accountId: must(AccountId.of('c')), amount: usdt(amt), available: usdt(amt),
  idempotencyKey: 'k', createdAt: 0, expiresAt: 1_000,
}));
const lines = (t: { entries: readonly { account: { value: string }; direction: { isDebit(): boolean }; amount: Money }[] }) =>
  t.entries.map((e) => `${e.direction.isDebit() ? 'Dr' : 'Cr'} ${e.account.value} ${e.amount.amount}`);

describe('reservation ledger postings (REVENUE_MODEL §2)', () => {
  it('hold: Dr customer / Cr holds, kind hold, deterministic id', () => {
    const t = must(holdPosting(held(), A));
    expect([t.txnId.value, t.kind, t.isBalanced(), lines(t)]).toEqual([holdTxnId('r1'), 'hold', true, ['Dr c 500', 'Cr c:holds 500']]);
  });
  it('partial capture: Dr holds reserved / Cr revenue captured + Cr customer remainder', () => {
    const t = must(settlePosting(must(held().capture(usdt(120n), 1)), A));
    expect([t.txnId.value, t.kind, t.isBalanced(), lines(t)]).toEqual([settleTxnId('r1'), 'capture', true, ['Dr c:holds 500', 'Cr rev 120', 'Cr c 380']]);
  });
  it('full capture has no zero-amount remainder entry', () => {
    expect(lines(must(settlePosting(must(held().capture(usdt(500n), 1)), A)))).toEqual(['Dr c:holds 500', 'Cr rev 500']);
  });
  it('release and expire: Dr holds / Cr customer, kind release, same single settle id', () => {
    for (const r of [must(held().release(1)), must(held().expire(1_000))]) {
      const t = must(settlePosting(r, A));
      expect([t.txnId.value, t.kind, lines(t)]).toEqual([settleTxnId('r1'), 'release', ['Dr c:holds 500', 'Cr c 500']]);
    }
  });
  it('a held reservation has no settle posting', () => {
    const r = settlePosting(held(), A);
    expect(r.isErr && r.error.tag).toBe('ReservationNotSettledError');
  });
});
