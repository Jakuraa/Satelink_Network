/**
 * ReservationUnitOfWork — commits a Reservation state change and its ledger posting in ONE
 * transaction (same deliberate deviation as UnitOfWork for draws: on the money path a hold or a
 * capture without its ledger entries, or the reverse, is lost or invented money).
 *
 * The checks that protect money happen INSIDE the transaction, under a lock — never in the caller
 * before it (a read-then-commit race lets two reserves spend the same balance):
 *
 * commitHold — new reservation + its `hold` posting:
 *   1. lock the customer account (Postgres: SELECT … FOR UPDATE on accounts.id);
 *   2. recompute available from the ledger and reject `InsufficientAvailableError` if
 *      reserved > available (libs invariant #8: clean reject, nothing held);
 *   3. (accountId, idempotency key) and the reservation id are UNIQUE: a duplicate is
 *      `DuplicateReservationError`, which the service turns into an idempotent replay;
 *   4. insert the reservation and post the hold; any failure rolls back both.
 *
 * commitSettle — terminal reservation + its single `settle` posting:
 *   1. optimistic lock on `version` (a stale writer gets StaleVersionError);
 *   2. the settle txn id must NOT exist yet (a reservation is settled once, one way);
 *   3. update the reservation and post the settle; any failure rolls back both.
 */
import type { LedgerTransaction, Reservation, InsufficientAvailableError, ReservationCurrencyMismatchError } from '@satelink/financial-domain';
import type { Result } from '@satelink/kernel';
import type { WriteError } from './repository-errors.js';

/** Same (account, idempotency key) or same reservation id already stored. */
export class DuplicateReservationError {
  readonly tag = 'DuplicateReservationError' as const;
  constructor(readonly field: 'idempotency_key' | 'reservation_id') {}
  toString(): string { return `DuplicateReservationError: ${this.field} already exists`; }
}

/** The settle posting for this reservation already exists: it cannot be settled again. */
export class AlreadySettledError {
  readonly tag = 'AlreadySettledError' as const;
  constructor(readonly txnId: string) {}
  toString(): string { return `AlreadySettledError: ${this.txnId} already posted`; }
}

export type CommitHoldError = WriteError | DuplicateReservationError | InsufficientAvailableError | ReservationCurrencyMismatchError;
export type CommitSettleError = WriteError | AlreadySettledError;

export interface ReservationUnitOfWork {
  commitHold(reservation: Reservation, hold: LedgerTransaction): Promise<Result<void, CommitHoldError>>;
  commitSettle(reservation: Reservation, settle: LedgerTransaction): Promise<Result<void, CommitSettleError>>;
}
