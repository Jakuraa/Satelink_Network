import type { Reservation } from '@satelink/financial-domain';
import type { Money, Result } from '@satelink/kernel';
import type { RepositoryError } from './repository-errors.js';

/**
 * Read side of reservations. Every WRITE goes through ReservationUnitOfWork, where the money
 * checks run under a lock in the same transaction as the ledger posting.
 */
export interface ReservationRepository {
  findById(id: string): Promise<Result<Reservation | null, RepositoryError>>;

  /**
   * Idempotency keys are scoped per account: UNIQUE (account_id, idempotency_key). A retried
   * reserve finds the EXISTING reservation, never creates a second hold.
   */
  findByIdempotencyKey(accountId: string, key: string): Promise<Result<Reservation | null, RepositoryError>>;

  /**
   * Held reservations whose expiresAt <= now (the orphan-recovery job's input), oldest first,
   * skipping `excluding` (ids that already failed this run, so they cannot starve the rest).
   */
  findLapsed(now: number, limit: number, excluding?: ReadonlySet<string>): Promise<Result<Reservation[], RepositoryError>>;
}

/**
 * The customer account's available balance, derived from the ledger (posted_credits −
 * posted_debits − pending_debits, libs invariant #3). Reservation holds are posted transfers to the
 * holds account, so this is already net of active holds — never subtract holds again.
 */
export interface AvailableBalanceReader {
  available(accountId: string, like: Money): Promise<Result<Money, RepositoryError>>;
}
