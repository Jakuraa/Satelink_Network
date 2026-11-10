/**
 * Reservation ledger postings (decision S-5; docs/build/REVENUE_MODEL.md §2). Pure: turns a
 * Reservation state into the balanced LedgerTransaction that records it. All entries are POSTED
 * and append-only; a hold moves money from the customer's balance to the customer's holds account,
 * so the customer's ledger balance is already "available after holds".
 *
 *   hold    (on reserve)          Dr customer reserved            / Cr holds   reserved
 *   capture (held → captured)     Dr holds    reserved            / Cr revenue captured
 *                                                                  + Cr customer reserved − captured
 *   release (held → released |    Dr holds    reserved            / Cr customer reserved
 *            held → expired)
 *
 * Idempotency: transaction ids are deterministic — `rsv:<id>:hold` and ONE `rsv:<id>:settle` per
 * reservation (capture and release share it), so a replay posts nothing new and a reservation can
 * never be settled twice or both ways. Balanced per currency by LedgerTransaction construction.
 */

import type { Result } from '@satelink/kernel';
import { Money, ok, err } from '@satelink/kernel';
import type { Reservation } from '../reservation/reservation.js';
import { LedgerTransaction } from '../ledger/ledger-transaction.js';
import { TxnId } from '../ledger/txn-id.js';
import { SourceReference } from '../ledger/source-reference.js';
import { Direction } from '../ledger/direction.js';
import { EntryState } from '../ledger/entry-state.js';
import type { AccountRef } from '../ledger/account-ref.js';
import type { LedgerEntryInput } from '../ledger/types.js';
import type { LedgerError } from '../ledger/errors.js';

export interface ReservationAccounts {
  /** The customer's balance account (a liability: what Satelink owes the customer). */
  readonly customer: AccountRef;
  /** The customer's holds account: reserved but not yet captured or released. */
  readonly holds: AccountRef;
  /** Revenue for the capability that captured the charge. */
  readonly revenue: AccountRef;
}

export class ReservationNotSettledError {
  readonly tag = 'ReservationNotSettledError' as const;
  constructor(readonly reservationId: string) {}
  toString(): string {
    return `ReservationNotSettledError: reservation "${this.reservationId}" is still held`;
  }
}

export class InvalidPostingIdError {
  readonly tag = 'InvalidPostingIdError' as const;
  constructor(readonly reason: string) {}
  toString(): string {
    return `InvalidPostingIdError: ${this.reason}`;
  }
}

export type ReservationPostingError = LedgerError | ReservationNotSettledError | InvalidPostingIdError;

export const holdTxnId = (reservationId: string): string => `rsv:${reservationId}:hold`;
export const settleTxnId = (reservationId: string): string => `rsv:${reservationId}:settle`;

/** The hold posting written atomically with the new reservation. */
export function holdPosting(r: Reservation, a: ReservationAccounts): Result<LedgerTransaction, ReservationPostingError> {
  const ids = idsFor(r, holdTxnId(r.id.value), 'hold');
  if (ids.isErr) return ids;
  return LedgerTransaction.create({
    txnId: ids.value.txnId,
    kind: 'hold',
    source: ids.value.source,
    entries: [entry(a.customer, Direction.DEBIT, r.reserved, ids.value.source), entry(a.holds, Direction.CREDIT, r.reserved, ids.value.source)],
  });
}

/** The single settle posting for a terminal reservation (captured, released or expired). */
export function settlePosting(r: Reservation, a: ReservationAccounts): Result<LedgerTransaction, ReservationPostingError> {
  if (r.state === 'held') return err(new ReservationNotSettledError(r.id.value));
  const captured = r.state === 'captured';
  const ids = idsFor(r, settleTxnId(r.id.value), captured ? 'capture' : 'release');
  if (ids.isErr) return ids;
  const src = ids.value.source;
  const entries: LedgerEntryInput[] = [entry(a.holds, Direction.DEBIT, r.reserved, src)];
  if (captured) entries.push(entry(a.revenue, Direction.CREDIT, r.captured, src));
  const back = r.released;
  if (back.isPositive()) entries.push(entry(a.customer, Direction.CREDIT, back, src));
  return LedgerTransaction.create({ txnId: ids.value.txnId, kind: captured ? 'capture' : 'release', source: src, entries });
}

function idsFor(r: Reservation, txn: string, phase: string): Result<{ txnId: TxnId; source: SourceReference }, InvalidPostingIdError> {
  const txnId = TxnId.of(txn);
  if (txnId.isErr) return err(new InvalidPostingIdError(txnId.error.toString()));
  const source = SourceReference.of('reservation', `${r.id.value}:${phase}`);
  if (source.isErr) return err(new InvalidPostingIdError(source.error.toString()));
  return ok({ txnId: txnId.value, source: source.value });
}

function entry(account: AccountRef, direction: Direction, amount: Money, source: SourceReference): LedgerEntryInput {
  return { account, direction, amount, state: EntryState.POSTED, source };
}
