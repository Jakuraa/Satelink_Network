/**
 * Reservation domain errors. Plain classes (not extends Error) so they compose in
 * Result<T, E> without stack-trace overhead — same convention as draw/errors.ts.
 */

export class InvalidReservationIdError {
  readonly tag = 'InvalidReservationIdError' as const;
  constructor(readonly reason: string) {}
  toString(): string {
    return `InvalidReservationIdError: ${this.reason}`;
  }
}

export class InvalidReservationAmountError {
  readonly tag = 'InvalidReservationAmountError' as const;
  constructor(readonly reason: string) {}
  toString(): string {
    return `InvalidReservationAmountError: ${this.reason}`;
  }
}

/** reserve > available. Clean reject: nothing is held (never a partial hold). */
export class InsufficientAvailableError {
  readonly tag = 'InsufficientAvailableError' as const;
  constructor(
    readonly requested: string,
    readonly available: string,
  ) {}
  toString(): string {
    return `InsufficientAvailableError: requested ${this.requested} > available ${this.available}`;
  }
}

/** capture > reserved. The hold is the ceiling of what can be charged. */
export class CaptureExceedsReservedError {
  readonly tag = 'CaptureExceedsReservedError' as const;
  constructor(
    readonly capture: string,
    readonly reserved: string,
  ) {}
  toString(): string {
    return `CaptureExceedsReservedError: capture ${this.capture} > reserved ${this.reserved}`;
  }
}

export class ReservationCurrencyMismatchError {
  readonly tag = 'ReservationCurrencyMismatchError' as const;
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {}
  toString(): string {
    return `ReservationCurrencyMismatchError: expected ${this.expected}, got ${this.actual}`;
  }
}

/** A capture after expiresAt: the hold has lapsed and must be expired, not charged. */
export class ReservationExpiredError {
  readonly tag = 'ReservationExpiredError' as const;
  constructor(
    readonly reservationId: string,
    readonly expiresAt: number,
    readonly at: number,
  ) {}
  toString(): string {
    return `ReservationExpiredError: reservation "${this.reservationId}" expired at ${this.expiresAt} (now ${this.at})`;
  }
}

export class ReservationNotExpiredError {
  readonly tag = 'ReservationNotExpiredError' as const;
  constructor(
    readonly reservationId: string,
    readonly expiresAt: number,
    readonly at: number,
  ) {}
  toString(): string {
    return `ReservationNotExpiredError: reservation "${this.reservationId}" expires at ${this.expiresAt} (now ${this.at})`;
  }
}

export class IllegalReservationTransitionError {
  readonly tag = 'IllegalReservationTransitionError' as const;
  constructor(
    readonly from: string,
    readonly action: string,
  ) {}
  toString(): string {
    return `IllegalReservationTransitionError: cannot ${this.action} from state "${this.from}"`;
  }
}

/** Same idempotency key, different request: never silently return or create anything. */
export class IdempotencyConflictError {
  readonly tag = 'IdempotencyConflictError' as const;
  constructor(
    readonly idempotencyKey: string,
    readonly field: string,
  ) {}
  toString(): string {
    return `IdempotencyConflictError: key "${this.idempotencyKey}" was used with a different ${this.field}`;
  }
}

export type ReservationError =
  | InvalidReservationAmountError
  | InsufficientAvailableError
  | CaptureExceedsReservedError
  | ReservationCurrencyMismatchError
  | ReservationExpiredError
  | ReservationNotExpiredError
  | IllegalReservationTransitionError
  | IdempotencyConflictError;
