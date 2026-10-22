import type { LedgerTransaction, Reservation } from '@satelink/financial-domain';
import type { Result } from '@satelink/kernel';
import { ok, err } from '@satelink/kernel';
import type { ReservationUnitOfWork } from '../../../application/ports/reservation-unit-of-work.js';
import type { WriteError } from '../../../application/ports/repository-errors.js';
import { repositoryError, staleVersionError } from '../../../application/ports/repository-errors.js';
import type { InMemoryReservationRepository } from './in-memory-reservation-repository.js';
import type { InMemoryLedgerRepository } from './in-memory-ledger-repository.js';

/**
 * All-or-nothing over the in-memory reservation + ledger repositories. Every precondition is
 * checked before anything is written, so a failure (including an injected crash) leaves both
 * stores exactly as they were — the same outcome as a rolled-back Postgres transaction.
 */
export class InMemoryReservationUnitOfWork implements ReservationUnitOfWork {
  /** Test hook: the next commit fails before writing (a crash / connection loss mid-commit). */
  private crashNext = false;

  constructor(
    private readonly reservations: InMemoryReservationRepository,
    private readonly ledger: InMemoryLedgerRepository,
  ) {}

  crashOnNextCommit(): void {
    this.crashNext = true;
  }

  async commit(reservation: Reservation, posting: LedgerTransaction): Promise<Result<void, WriteError>> {
    if (this.crashNext) {
      this.crashNext = false;
      return err(repositoryError('commit aborted (simulated crash); nothing written'));
    }
    const current = await this.reservations.findById(reservation.id.value);
    if (current.isErr) return current;
    const expected = current.value ? current.value.version : 0;
    if (reservation.version !== expected) return err(staleVersionError(reservation.id.value, reservation.version));
    if (!current.value) {
      const dup = await this.reservations.findByIdempotencyKey(reservation.idempotencyKey);
      if (dup.isErr) return dup;
      if (dup.value) return err(repositoryError('duplicate idempotency_key'));
    }
    const existing = await this.ledger.findByTxnId(posting.txnId.value);
    if (existing.isErr) return err(repositoryError(existing.error.message, existing.error.cause));
    if (existing.value && existing.value.kind !== posting.kind) {
      return err(repositoryError(`ledger txn ${posting.txnId.value} already posted as ${existing.value.kind}`));
    }
    // Preconditions hold: apply both.
    const posted = await this.ledger.post(posting);
    if (posted.isErr) return err(repositoryError(posted.error.message, posted.error.cause));
    return this.reservations.save(reservation);
  }
}
