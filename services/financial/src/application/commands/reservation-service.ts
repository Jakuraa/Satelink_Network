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
import type { ReservationUnitOfWork } from '../ports/reservation-unit-of-work.js';
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
  | ReservationNotFoundError
  | InvalidReservationInputError;

export interface ReservationServiceDeps {
  readonly reservations: ReservationRepository;
  readonly uow: ReservationUnitOfWork;
  /** Ledger-derived available balance of the customer account (already net of posted holds). */
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
  const prior = await deps.reservations.findByIdempotencyKey(cmd.idempotencyKey);
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
  const committed = await deps.uow.commit(r.value, posting.value);
  if (committed.isErr) return committed;
  return reload(deps, r.value.id.value);
}

export function capture(deps: ReservationServiceDeps, reservationId: string, amount: Money, now: number): Promise<Result<Reservation, ReservationServiceError>> {
  return transition(deps, reservationId, (r) => r.capture(amount, now));
}

export function release(deps: ReservationServiceDeps, reservationId: string, now: number): Promise<Result<Reservation, ReservationServiceError>> {
  return transition(deps, reservationId, (r) => r.release(now));
}

/**
 * Orphan recovery: expire (and post the release of) up to `limit` lapsed holds. Returns the ids
 * expired. A reservation that moved on concurrently (stale version) is skipped, never forced.
 */
export async function expireLapsed(deps: ReservationServiceDeps, now: number, limit = 100): Promise<Result<string[], RepositoryError>> {
  const lapsed = await deps.reservations.findLapsed(now, limit);
  if (lapsed.isErr) return lapsed;
  const expired: string[] = [];
  for (const r of lapsed.value) {
    const next = r.expire(now);
    if (next.isErr || next.value === r) continue;
    const posting = settlePosting(next.value, deps.accountsFor(next.value));
    if (posting.isErr) continue;
    const committed = await deps.uow.commit(next.value, posting.value);
    if (committed.isOk) expired.push(r.id.value);
  }
  return ok(expired);
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
  const committed = await deps.uow.commit(next.value, posting.value);
  if (committed.isErr) return committed;
  return reload(deps, reservationId);
}

async function reload(deps: ReservationServiceDeps, id: string): Promise<Result<Reservation, ReservationServiceError>> {
  const r = await deps.reservations.findById(id);
  if (r.isErr) return r;
  return r.value ? ok(r.value) : err(new ReservationNotFoundError(id));
}
