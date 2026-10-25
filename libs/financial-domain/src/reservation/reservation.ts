/**
 * Reservation — aggregate root. Reserve → capture | release | expire.
 *
 * Holds an amount against an account's available balance before work whose final cost is not yet
 * known (a model call, an upstream RPC call), then settles it against the actual cost. This is the
 * mandate §8 invariant 6 primitive ("reserve ≤ balance; settle ≤ reserve; remainder released; no
 * orphan reservations after crash") and the money shape for a refund-on-failure: a failed call
 * RELEASES its hold — nothing is charged, so nothing has to be reversed.
 *
 * INVARIANTS enforced HERE:
 *   #1 reserve ≤ available, amount > 0, same currency. Insufficient → clean reject, nothing held.
 *   #2 capture ≤ reserved and > 0 (a zero-cost outcome is a release). captured + released = reserved
 *      in every terminal state; while held, captured = released = 0.
 *   #3 Terminal states (captured, released, expired) are irreversible. A correction after capture
 *      is a new ledger reversal, never an edit of this aggregate (libs invariant #5).
 *   #4 No capture at or after expiresAt. A lapsed hold can only expire (the recovery job's path),
 *      so a crash between reserve and settle never leaves money held forever.
 *   #5 Idempotent: replaying the same reserve / capture / release / expire returns the same
 *      reservation; the same key with a different request is IdempotencyConflictError
 *      (libs invariant #6). Key uniqueness itself is the repository's UNIQUE constraint.
 *
 * Pure: amounts are Money (bigint minor units), time is epoch ms passed in by the caller.
 * Immutable — every operation returns a new Reservation; `version` is bumped by the repository.
 * References its Account by Id only (#7). Ledger posting of a capture belongs to the application
 * layer (coordination/reservation-postings.ts: hold → capture | release, all posted), not to this
 * aggregate.
 *
 * State machine:
 *   held → captured (terminal)
 *   held → released (terminal)
 *   held → expired  (terminal; only at/after expiresAt)
 */

import type { Result } from '@satelink/kernel';
import { Money, ok, err } from '@satelink/kernel';
import { ReservationId } from './reservation-id.js';
import { AccountId } from '../shared/account-id.js';
import {
  CaptureExceedsReservedError,
  IdempotencyConflictError,
  IllegalReservationTransitionError,
  InsufficientAvailableError,
  InvalidReservationAmountError,
  ReservationCurrencyMismatchError,
  ReservationExpiredError,
  ReservationNotExpiredError,
} from './errors.js';
import type { ReservationError } from './errors.js';

export type ReservationStateValue = 'held' | 'captured' | 'released' | 'expired';

const MAX_KEY_LEN = 200;

export interface ReservationProps {
  readonly id: ReservationId;
  readonly accountId: AccountId;
  readonly reserved: Money;
  readonly captured: Money;
  readonly idempotencyKey: string;
  readonly state: ReservationStateValue;
  readonly createdAt: number; // epoch ms
  readonly expiresAt: number; // epoch ms
  readonly closedAt: number | null; // epoch ms of the terminal transition
  readonly version: number;
}

export class Reservation {
  private constructor(private readonly props: ReservationProps) {
    Object.freeze(this.props);
    Object.freeze(this);
  }

  /**
   * Hold `amount` against `available` — the customer account's ledger-derived available balance.
   * Holds are posted transfers to the holds account, so that balance is ALREADY net of every other
   * active hold: never subtract holds again. The authoritative check is repeated inside the unit of
   * work, under the account lock, in the transaction that writes the hold.
   *
   * Policy: capture is refused at/after expiresAt (the hold has lapsed and is released by the
   * recovery job). Work that may outlast the TTL must be reserved with a TTL that covers it.
   */
  static reserve(params: {
    id: ReservationId;
    accountId: AccountId;
    amount: Money;
    available: Money;
    idempotencyKey: string;
    createdAt: number;
    expiresAt: number;
  }): Result<Reservation, ReservationError> {
    const { amount, available } = params;
    if (amount.currency.code !== available.currency.code) {
      return err(new ReservationCurrencyMismatchError(available.currency.code, amount.currency.code));
    }
    if (!amount.isPositive()) {
      return err(new InvalidReservationAmountError('reserve amount must be > 0'));
    }
    if (typeof params.idempotencyKey !== 'string' || params.idempotencyKey.trim() === '' || params.idempotencyKey.length > MAX_KEY_LEN) {
      return err(new InvalidReservationAmountError(`idempotency key must be a non-empty string <= ${MAX_KEY_LEN} characters`));
    }
    if (!Number.isSafeInteger(params.createdAt) || !Number.isSafeInteger(params.expiresAt) || params.expiresAt <= params.createdAt) {
      return err(new InvalidReservationAmountError('expiresAt must be an integer epoch ms after createdAt'));
    }
    if (amount.amount > available.amount) {
      return err(new InsufficientAvailableError(amount.toDecimalString(), available.toDecimalString()));
    }
    return ok(new Reservation({
      id: params.id,
      accountId: params.accountId,
      reserved: amount,
      captured: zeroOf(amount),
      idempotencyKey: params.idempotencyKey,
      state: 'held',
      createdAt: params.createdAt,
      expiresAt: params.expiresAt,
      closedAt: null,
      version: 0,
    }));
  }

  static reconstitute(props: ReservationProps): Reservation {
    return new Reservation(props);
  }

  // --- Getters ---
  get id(): ReservationId { return this.props.id; }
  get accountId(): AccountId { return this.props.accountId; }
  get idempotencyKey(): string { return this.props.idempotencyKey; }
  get state(): ReservationStateValue { return this.props.state; }
  get createdAt(): number { return this.props.createdAt; }
  get expiresAt(): number { return this.props.expiresAt; }
  get closedAt(): number | null { return this.props.closedAt; }
  get version(): number { return this.props.version; }
  get isTerminal(): boolean { return this.props.state !== 'held'; }
  /** The amount originally held. */
  get reserved(): Money { return this.props.reserved; }
  /** What was charged (zero unless captured). */
  get captured(): Money { return this.props.captured; }
  /** What went back to the account: reserved − captured once terminal, zero while held. */
  get released(): Money {
    if (this.props.state === 'held') return zeroOf(this.props.reserved);
    return minor(this.props.reserved, this.props.reserved.amount - this.props.captured.amount);
  }
  /** What still counts against the account's available balance. */
  get hold(): Money {
    return this.props.state === 'held' ? this.props.reserved : zeroOf(this.props.reserved);
  }

  /**
   * A reserve call retried with the same idempotency key: returns THIS reservation when the
   * request is the same, a conflict when it is not. Never creates a second hold.
   */
  matchRetry(params: { accountId: AccountId; amount: Money; idempotencyKey: string }): Result<Reservation, IdempotencyConflictError> {
    const key = this.props.idempotencyKey;
    if (params.idempotencyKey !== key) return err(new IdempotencyConflictError(params.idempotencyKey, 'idempotency key'));
    if (!params.accountId.equals(this.props.accountId)) return err(new IdempotencyConflictError(key, 'account'));
    if (!sameMoney(params.amount, this.props.reserved)) return err(new IdempotencyConflictError(key, 'amount'));
    return ok(this);
  }

  /** held → captured: charge `amount` (0 < amount ≤ reserved); the remainder is released. */
  capture(amount: Money, at: number): Result<Reservation, ReservationError> {
    if (this.props.state === 'captured') {
      return sameMoney(amount, this.props.captured) ? ok(this) : err(new IdempotencyConflictError(this.props.idempotencyKey, 'capture amount'));
    }
    if (this.props.state !== 'held') return err(new IllegalReservationTransitionError(this.props.state, 'capture'));
    if (at >= this.props.expiresAt) return err(new ReservationExpiredError(this.props.id.value, this.props.expiresAt, at));
    if (amount.currency.code !== this.props.reserved.currency.code) {
      return err(new ReservationCurrencyMismatchError(this.props.reserved.currency.code, amount.currency.code));
    }
    if (!amount.isPositive()) return err(new InvalidReservationAmountError('capture amount must be > 0 (release a zero-cost outcome instead)'));
    if (amount.amount > this.props.reserved.amount) {
      return err(new CaptureExceedsReservedError(amount.toDecimalString(), this.props.reserved.toDecimalString()));
    }
    return ok(new Reservation({ ...this.props, state: 'captured', captured: amount, closedAt: at }));
  }

  /** held → released: nothing is charged (failed or cancelled work). */
  release(at: number): Result<Reservation, ReservationError> {
    if (this.props.state === 'released') return ok(this);
    if (this.props.state !== 'held') return err(new IllegalReservationTransitionError(this.props.state, 'release'));
    return ok(new Reservation({ ...this.props, state: 'released', closedAt: at }));
  }

  /** held → expired, only at/after expiresAt: the orphan-recovery path; nothing is charged. */
  expire(at: number): Result<Reservation, ReservationError> {
    if (this.props.state === 'expired') return ok(this);
    if (this.props.state !== 'held') return err(new IllegalReservationTransitionError(this.props.state, 'expire'));
    if (at < this.props.expiresAt) return err(new ReservationNotExpiredError(this.props.id.value, this.props.expiresAt, at));
    return ok(new Reservation({ ...this.props, state: 'expired', closedAt: at }));
  }
}

/**
 * Sum of the active holds in `currency` — for RECONCILIATION only (holds account balance ==
 * Σ active holds). Never subtract it from a ledger available balance: holds are already posted
 * there. Reservations in another currency are a caller bug and are rejected, never skipped.
 */
export function sumHeld(currencyOf: Money, reservations: readonly Reservation[]): Result<Money, ReservationCurrencyMismatchError> {
  let total = 0n;
  for (const r of reservations) {
    if (r.reserved.currency.code !== currencyOf.currency.code) {
      return err(new ReservationCurrencyMismatchError(currencyOf.currency.code, r.reserved.currency.code));
    }
    total += r.hold.amount;
  }
  return ok(minor(currencyOf, total));
}

function minor(like: Money, amount: bigint): Money {
  return Money.fromMinorUnits(amount, like.currency);
}

function zeroOf(like: Money): Money {
  return minor(like, 0n);
}

function sameMoney(a: Money, b: Money): boolean {
  return a.currency.code === b.currency.code && a.amount === b.amount;
}
