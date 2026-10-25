/**
 * Reservation application service — the Financial OS reserve / capture / release API (S-5: the
 * only charging path for new capabilities). Library only: no route uses it yet.
 *
 *   reserve(max cost) → upstream call → capture(actual cost)   on success
 *                                     → release()              on failure (nothing charged)
 *   expireLapsed() (scheduled)        → releases holds a crash left behind
 *
 * Every state change is committed together with its balanced ledger posting through the
 * ReservationUnitOfWork (all-or-nothing). Postings (REVENUE_MODEL §2): hold = customer → holds;
 * capture = holds → revenue + remainder → customer; release = holds → customer.
 *
 * Idempotent everywhere: reserve on the client idempotency key; capture / release / expire on the
 * reservation state, and every posting on its deterministic txn id. A replay writes nothing.
 * Crash-safe: a commit that fails leaves nothing behind (retry is clean); a commit that succeeded
 * but whose caller crashed is a replay on retry; a hold whose caller never settles is expired.
 */
import { AccountId, Reservation, ReservationId, holdPosting, settlePosting } from '@satelink/financial-domain';
import type { ReservationAccounts, ReservationError, ReservationPostingError } from '@satelink/financial-domain';
import type { Money, Result } from '@satelink/kernel';
import { ok, err } from '@satelink/kernel';
import type { AvailableBalanceReader, ReservationRepository } from '../ports/reservation-repository.js';
import type { CommitHoldError, CommitSettleError, ReservationUnitOfWork } from '../ports/reservation-unit-of-work.js';
import type { RepositoryError, WriteError } from '../ports/repository-errors.js';

export class ReservationNotFoundError {
  readonly tag = 'ReservationNotFoundError' as const;
  constructor(readonly reservationId: string) {}
  toString(): string { return `ReservationNotFoundError: ${this.reservationId}`; }
}

export class InvalidReservationInputError {
  readonly tag = 'InvalidReservationInputError' as const;
  constructor(readonly reason: string) {}
  toString(): string { return `InvalidReservationInputError: ${this.reason}`; }
}

export type ReservationServiceError =
  | ReservationError
  | ReservationPostingError
  | RepositoryError
  | WriteError
  | CommitHoldError
  | CommitSettleError
  | ReservationNotFoundError
  | InvalidReservationInputError;

export interface ReservationServiceDeps {
  readonly reservations: ReservationRepository;
  readonly uow: ReservationUnitOfWork;
  /**
   * Ledger-derived available balance of the customer account (already net of posted holds). Used
   * as a fast pre-check only: the authoritative check runs inside uow.commitHold under the lock.
   */
  readonly balances: AvailableBalanceReader;
  /** Which ledger accounts a reservation posts to (customer = its accountId). */
  readonly accountsFor: (r: Reservation) => ReservationAccounts;
}

export interface ReserveCommand {
  readonly reservationId: string;
  readonly accountId: string;
  readonly amount: Money;
  readonly idempotencyKey: string;
  readonly now: number;
  readonly ttlMs: number;
}

export async function reserve(deps: ReservationServiceDeps, cmd: ReserveCommand): Promise<Result<Reservation, ReservationServiceError>> {
  const accountId = AccountId.of(cmd.accountId);
  if (accountId.isErr) return err(new InvalidReservationInputError(accountId.error.toString()));
  const id = ReservationId.of(cmd.reservationId);
  if (id.isErr) return err(new InvalidReservationInputError(id.error.toString()));
  if (!Number.isSafeInteger(cmd.ttlMs) || cmd.ttlMs <= 0) return err(new InvalidReservationInputError('ttlMs must be a positive integer'));

  // Idempotent replay: the same key returns the existing reservation (or a conflict), never a 2nd hold.
  const replay = () => replayByKey(deps, cmd, accountId.value);
  const prior = await deps.reservations.findByIdempotencyKey(cmd.accountId, cmd.idempotencyKey);
  if (prior.isErr) return prior;
  if (prior.value) return prior.value.matchRetry({ accountId: accountId.value, amount: cmd.amount, idempotencyKey: cmd.idempotencyKey });

  const available = await deps.balances.available(cmd.accountId, cmd.amount);
  if (available.isErr) return available;

  const r = Reservation.reserve({
    id: id.value, accountId: accountId.value, amount: cmd.amount, available: available.value,
    idempotencyKey: cmd.idempotencyKey, createdAt: cmd.now, expiresAt: cmd.now + cmd.ttlMs,
  });
  if (r.isErr) return r;
  const posting = holdPosting(r.value, deps.accountsFor(r.value));
  if (posting.isErr) return posting;
  const committed = await deps.uow.commitHold(r.value, posting.value);
  if (committed.isErr) {
    // a concurrent reserve with the same key won the race: this call is its replay
    if (committed.error.tag === 'DuplicateReservationError' && committed.error.field === 'idempotency_key') return replay();
    return committed;
  }
  return reload(deps, r.value.id.value);
}

async function replayByKey(deps: ReservationServiceDeps, cmd: ReserveCommand, accountId: AccountId): Promise<Result<Reservation, ReservationServiceError>> {
  const winner = await deps.reservations.findByIdempotencyKey(cmd.accountId, cmd.idempotencyKey);
  if (winner.isErr) return winner;
  if (!winner.value) return err(new ReservationNotFoundError(`key ${cmd.idempotencyKey}`));
  return winner.value.matchRetry({ accountId, amount: cmd.amount, idempotencyKey: cmd.idempotencyKey });
}

export function capture(deps: ReservationServiceDeps, reservationId: string, amount: Money, now: number): Promise<Result<Reservation, ReservationServiceError>> {
  return transition(deps, reservationId, (r) => r.capture(amount, now));
}

export function release(deps: ReservationServiceDeps, reservationId: string, now: number): Promise<Result<Reservation, ReservationServiceError>> {
  return transition(deps, reservationId, (r) => r.release(now));
}

export interface ExpireResult {
  readonly expired: readonly string[];
  /** Lapsed holds that could not be expired this run (error text per id) — alert on a non-empty list. */
  readonly failed: readonly { readonly id: string; readonly error: string }[];
}

/**
 * Orphan recovery: expire (and post the release of) up to `limit` lapsed holds. Failures are
 * reported, never swallowed, and skipped for the rest of the run so they cannot starve the others.
 * A reservation settled concurrently (stale version / already settled) is not a failure.
 */
export async function expireLapsed(deps: ReservationServiceDeps, now: number, limit = 100): Promise<Result<ExpireResult, RepositoryError>> {
  const expired: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const skip = new Set<string>();
  while (expired.length + failed.length < limit) {
    const page = await deps.reservations.findLapsed(now, limit - expired.length - failed.length, skip);
    if (page.isErr) return page;
    if (page.value.length === 0) break;
    for (const r of page.value) {
      skip.add(r.id.value);
      const next = r.expire(now);
      if (next.isErr) { failed.push({ id: r.id.value, error: describe(next.error) }); continue; }
      const posting = settlePosting(next.value, deps.accountsFor(next.value));
      if (posting.isErr) { failed.push({ id: r.id.value, error: describe(posting.error) }); continue; }
      const committed = await deps.uow.commitSettle(next.value, posting.value);
      if (committed.isOk) expired.push(r.id.value);
      else if (committed.error.tag !== 'StaleVersionError' && committed.error.tag !== 'AlreadySettledError') {
        failed.push({ id: r.id.value, error: describe(committed.error) });
      }
    }
  }
  return ok({ expired, failed });
}

function describe(e: unknown): string {
  const o = e as { tag?: string; message?: string; toString?: () => string };
  if (typeof o?.message === 'string') return `${o.tag ?? 'Error'}: ${o.message}`;
  const t = o?.toString?.();
  return t && t !== '[object Object]' ? t : (o?.tag ?? 'unknown error');
}

async function transition(
  deps: ReservationServiceDeps,
  reservationId: string,
  step: (r: Reservation) => Result<Reservation, ReservationError>,
): Promise<Result<Reservation, ReservationServiceError>> {
  const found = await deps.reservations.findById(reservationId);
  if (found.isErr) return found;
  if (!found.value) return err(new ReservationNotFoundError(reservationId));
  const next = step(found.value);
  if (next.isErr) return next;
  if (next.value === found.value) return ok(found.value); // idempotent replay: nothing to write
  const posting = settlePosting(next.value, deps.accountsFor(next.value));
  if (posting.isErr) return posting;
  const committed = await deps.uow.commitSettle(next.value, posting.value);
  if (committed.isErr) return committed;
  return reload(deps, reservationId);
}

async function reload(deps: ReservationServiceDeps, id: string): Promise<Result<Reservation, ReservationServiceError>> {
  const r = await deps.reservations.findById(id);
  if (r.isErr) return r;
  return r.value ? ok(r.value) : err(new ReservationNotFoundError(id));
}
