import { InsufficientAvailableError, ReservationCurrencyMismatchError } from '@satelink/financial-domain';
import type { LedgerTransaction, Reservation } from '@satelink/financial-domain';
import type { Result } from '@satelink/kernel';
import { ok, err } from '@satelink/kernel';
import {
  AlreadySettledError, DuplicateReservationError,
} from '../../../application/ports/reservation-unit-of-work.js';
import type { CommitHoldError, CommitSettleError, ReservationUnitOfWork } from '../../../application/ports/reservation-unit-of-work.js';
import type { AvailableBalanceReader } from '../../../application/ports/reservation-repository.js';
import { repositoryError, staleVersionError } from '../../../application/ports/repository-errors.js';
import type { InMemoryReservationRepository } from './in-memory-reservation-repository.js';
import type { InMemoryLedgerRepository } from './in-memory-ledger-repository.js';

export type CrashPoint = 'before_writes' | 'between_writes';

/**
 * In-memory ReservationUnitOfWork with the same guarantees as the Postgres one must give:
 *   - every commit runs in ONE critical section (a promise-chain mutex = the account row lock and
 *     transaction): no other commit can interleave between its checks and its writes;
 *   - the available-balance check is recomputed inside that section;
 *   - all-or-nothing: if the ledger write fails after the reservation write, the reservation write
 *     is undone (rollback), so no hold exists without its reservation or vice versa.
 */
export class InMemoryReservationUnitOfWork implements ReservationUnitOfWork {
  private tail: Promise<unknown> = Promise.resolve();
  private crash: CrashPoint | null = null;

  constructor(
    private readonly reservations: InMemoryReservationRepository,
    private readonly ledger: InMemoryLedgerRepository,
    private readonly balances: AvailableBalanceReader,
  ) {}

  /** Test hook: the next commit fails at this point (a crash / lost connection mid-commit). */
  crashOnNextCommit(at: CrashPoint = 'before_writes'): void {
    this.crash = at;
  }

  commitHold(r: Reservation, hold: LedgerTransaction): Promise<Result<void, CommitHoldError>> {
    return this.serialized(async () => {
      if (this.reservations._get(r.id.value)) return err(new DuplicateReservationError('reservation_id'));
      if (this.reservations._hasKey(r.accountId.value, r.idempotencyKey)) return err(new DuplicateReservationError('idempotency_key'));
      if (r.version !== 0 || r.state !== 'held') return err(staleVersionError(r.id.value, r.version));
      const existing = await this.ledger.findByTxnId(hold.txnId.value);
      if (existing.isErr || existing.value) return err(repositoryError(`hold ${hold.txnId.value} already posted`));
      // available is recomputed HERE, under the lock — never trusted from the caller
      const available = await this.balances.available(r.accountId.value, r.reserved);
      if (available.isErr) return available;
      if (available.value.currency.code !== r.reserved.currency.code) {
        return err(new ReservationCurrencyMismatchError(available.value.currency.code, r.reserved.currency.code));
      }
      if (r.reserved.amount > available.value.amount) {
        return err(new InsufficientAvailableError(r.reserved.toDecimalString(), available.value.toDecimalString()));
      }
      return this.write(r, hold, undefined);
    });
  }

  commitSettle(r: Reservation, settle: LedgerTransaction): Promise<Result<void, CommitSettleError>> {
    return this.serialized(async () => {
      const current = this.reservations._get(r.id.value);
      if (!current || current.version !== r.version) return err(staleVersionError(r.id.value, r.version));
      const existing = await this.ledger.findByTxnId(settle.txnId.value);
      if (existing.isErr) return err(repositoryError(existing.error.message, existing.error.cause));
      if (existing.value) return err(new AlreadySettledError(settle.txnId.value));
      return this.write(r, settle, current);
    });
  }

  /** Reservation write, then ledger write; undo the first if the second fails. */
  private async write(r: Reservation, posting: LedgerTransaction, previous: Reservation | undefined): Promise<Result<void, CommitHoldError & CommitSettleError>> {
    if (this.takeCrash('before_writes')) return err(repositoryError('commit aborted before any write (simulated crash)'));
    this.reservations._put(r, r.version + 1);
    if (this.takeCrash('between_writes')) {
      this.reservations._restore(r.id.value, previous, r.accountId.value, r.idempotencyKey);
      return err(repositoryError('commit aborted between writes (simulated crash); rolled back'));
    }
    const posted = await this.ledger.post(posting);
    if (posted.isErr) {
      this.reservations._restore(r.id.value, previous, r.accountId.value, r.idempotencyKey);
      return err(repositoryError(posted.error.message, posted.error.cause));
    }
    return ok(undefined);
  }

  private takeCrash(at: CrashPoint): boolean {
    if (this.crash !== at) return false;
    this.crash = null;
    return true;
  }

  private serialized<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.catch(() => undefined);
    return run;
  }
}
