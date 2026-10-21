/**
 * Reservation application service — the Financial OS reserve / capture / release API.
 *
 * Library only: no route uses it yet (Session B). The caller (an RPC or model-call path) does:
 *   reserve(max cost) → upstream call → capture(actual cost)   on success
 *                                     → release()              on failure (nothing charged)
 * and a scheduled job calls expireLapsed() so a crash between reserve and settle never leaves a
 * hold behind (mandate §8 invariant 6).
 *
 * Ledger posting of a capture (pending hold → posted debit) is NOT done here; it belongs to the
 * unit of work that also writes the ledger (see UnitOfWork). This service only owns the hold.
 *
 * Every operation is idempotent: reserve on the client idempotency key; capture / release /
 * expire on the reservation's state (a replay returns the same reservation).
 */
import { AccountId, Reservation, ReservationId, sumHeld } from '@satelink/financial-domain';
import type { ReservationError } from '@satelink/financial-domain';
import type { Money, Result } from '@satelink/kernel';
import { ok, err } from '@satelink/kernel';
import type { AvailableBalanceReader, ReservationRepository } from '../ports/reservation-repository.js';
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
  | RepositoryError
  | WriteError
  | ReservationNotFoundError
  | InvalidReservationInputError;

export interface ReservationServiceDeps {
  readonly reservations: ReservationRepository;
  readonly balances: AvailableBalanceReader;
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

  const ledgerAvailable = await deps.balances.available(cmd.accountId, cmd.amount);
  if (ledgerAvailable.isErr) return ledgerAvailable;
  const held = await deps.reservations.findHeldByAccount(cmd.accountId);
  if (held.isErr) return held;
  const holds = sumHeld(cmd.amount, held.value);
  if (holds.isErr) return holds;
  const available = ledgerAvailable.value.subtract(holds.value);
  if (available.isErr) return err(new InvalidReservationInputError(available.error.toString()));

  const r = Reservation.reserve({
    id: id.value, accountId: accountId.value, amount: cmd.amount, available: available.value,
    idempotencyKey: cmd.idempotencyKey, createdAt: cmd.now, expiresAt: cmd.now + cmd.ttlMs,
  });
  if (r.isErr) return r;
  const saved = await deps.reservations.save(r.value);
  if (saved.isErr) return saved;
  return reload(deps, r.value.id.value);
}

export function capture(deps: ReservationServiceDeps, reservationId: string, amount: Money, now: number): Promise<Result<Reservation, ReservationServiceError>> {
  return transition(deps, reservationId, (r) => r.capture(amount, now));
}

export function release(deps: ReservationServiceDeps, reservationId: string, now: number): Promise<Result<Reservation, ReservationServiceError>> {
  return transition(deps, reservationId, (r) => r.release(now));
}

/**
 * Orphan recovery: expire up to `limit` lapsed holds. Returns the ids expired. A reservation that
 * moved on concurrently (captured/released, stale version) is skipped, never forced.
 */
export async function expireLapsed(deps: ReservationServiceDeps, now: number, limit = 100): Promise<Result<string[], RepositoryError>> {
  const lapsed = await deps.reservations.findLapsed(now, limit);
  if (lapsed.isErr) return lapsed;
  const expired: string[] = [];
  for (const r of lapsed.value) {
    const next = r.expire(now);
    if (next.isErr || next.value === r) continue;
    const saved = await deps.reservations.save(next.value);
    if (saved.isOk) expired.push(r.id.value);
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
  const saved = await deps.reservations.save(next.value);
  if (saved.isErr) return saved;
  return reload(deps, reservationId);
}

async function reload(deps: ReservationServiceDeps, id: string): Promise<Result<Reservation, ReservationServiceError>> {
  const r = await deps.reservations.findById(id);
  if (r.isErr) return r;
  return r.value ? ok(r.value) : err(new ReservationNotFoundError(id));
}
