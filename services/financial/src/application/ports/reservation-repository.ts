import type { Reservation } from '@satelink/financial-domain';
import type { Money, Result } from '@satelink/kernel';
import type { RepositoryError, WriteError } from './repository-errors.js';

export interface ReservationRepository {
  findById(id: string): Promise<Result<Reservation | null, RepositoryError>>;

  /** INVARIANT: a duplicate key returns the EXISTING reservation, never a second hold. */
  findByIdempotencyKey(key: string): Promise<Result<Reservation | null, RepositoryError>>;

  /** Active (held) reservations of an account — their holds reduce what can be reserved next. */
  findHeldByAccount(accountId: string): Promise<Result<Reservation[], RepositoryError>>;

  /** Held reservations whose expiresAt <= now (the orphan-recovery job's input), oldest first. */
  findLapsed(now: number, limit: number): Promise<Result<Reservation[], RepositoryError>>;

  /**
   * Insert (version 0) or update with optimistic locking on `version`. A second reservation with
   * an existing idempotency key is rejected (UNIQUE constraint in Postgres).
   */
  save(reservation: Reservation): Promise<Result<void, WriteError>>;
}

/**
 * The customer account's available balance, derived from the ledger (posted_credits −
 * posted_debits − pending_debits, libs invariant #3). Reservation holds are posted transfers to the
 * holds account, so this is already net of active holds. A Postgres implementation must read it
 * under the same transaction and account row lock the reserve commits in, so two concurrent
 * reserves cannot spend the same balance.
 */
export interface AvailableBalanceReader {
  available(accountId: string, like: Money): Promise<Result<Money, RepositoryError>>;
}
