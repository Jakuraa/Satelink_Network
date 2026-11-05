/**
 * ReservationId — identity of a Reservation. Non-empty, bounded string.
 *
 * Aggregates reference each other by Id only (invariant #7).
 */

import type { Result } from '@satelink/kernel';
import { ok, err } from '@satelink/kernel';
import { InvalidReservationIdError } from './errors.js';

const MAX_LEN = 200;

export class ReservationId {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static of(raw: string): Result<ReservationId, InvalidReservationIdError> {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return err(new InvalidReservationIdError('reservation id must be a non-empty string'));
    }
    if (raw.length > MAX_LEN) {
      return err(new InvalidReservationIdError(`reservation id must be <= ${MAX_LEN} characters`));
    }
    return ok(new ReservationId(raw));
  }

  equals(other: ReservationId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
