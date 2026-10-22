/**
 * ReservationUnitOfWork — commits a Reservation state change and its ledger posting in ONE
 * transaction (same deliberate deviation as UnitOfWork for draws: on the money path a hold or a
 * capture without its ledger entries, or the reverse, is lost or invented money).
 *
 * Contract:
 *   - all-or-nothing: on any error neither the reservation nor the posting is stored;
 *   - the posting's txn id is deterministic (rsv:<id>:hold | rsv:<id>:settle), so re-committing an
 *     already-stored posting is a no-op and a reservation is never settled twice;
 *   - the reservation save is optimistic-locked on `version` (a stale writer loses).
 * A Postgres implementation also takes the customer account row lock before reading the available
 * balance for a reserve, so two concurrent reserves cannot spend the same balance.
 */
import type { LedgerTransaction, Reservation } from '@satelink/financial-domain';
import type { Result } from '@satelink/kernel';
import type { WriteError } from './repository-errors.js';

export interface ReservationUnitOfWork {
  commit(reservation: Reservation, posting: LedgerTransaction): Promise<Result<void, WriteError>>;
}
