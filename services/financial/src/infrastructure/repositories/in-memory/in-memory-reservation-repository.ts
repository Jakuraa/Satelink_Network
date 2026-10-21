import { Reservation } from '@satelink/financial-domain';
import type { Result } from '@satelink/kernel';
import { ok, err } from '@satelink/kernel';
import type { ReservationRepository } from '../../../application/ports/reservation-repository.js';
import type { RepositoryError, WriteError } from '../../../application/ports/repository-errors.js';
import { repositoryError, staleVersionError } from '../../../application/ports/repository-errors.js';

/** In-memory ReservationRepository: same contract as the future Postgres one (UNIQUE key, CAS on version). */
export class InMemoryReservationRepository implements ReservationRepository {
  private readonly store = new Map<string, Reservation>();

  async findById(id: string): Promise<Result<Reservation | null, RepositoryError>> {
    return ok(this.store.get(id) ?? null);
  }

  async findByIdempotencyKey(key: string): Promise<Result<Reservation | null, RepositoryError>> {
    for (const r of this.store.values()) if (r.idempotencyKey === key) return ok(r);
    return ok(null);
  }

  async findHeldByAccount(accountId: string): Promise<Result<Reservation[], RepositoryError>> {
    return ok([...this.store.values()].filter((r) => r.state === 'held' && r.accountId.value === accountId));
  }

  async findLapsed(now: number, limit: number): Promise<Result<Reservation[], RepositoryError>> {
    return ok([...this.store.values()]
      .filter((r) => r.state === 'held' && r.expiresAt <= now)
      .sort((a, b) => a.expiresAt - b.expiresAt || a.id.value.localeCompare(b.id.value))
      .slice(0, limit));
  }

  async save(reservation: Reservation): Promise<Result<void, WriteError>> {
    const id = reservation.id.value;
    const existing = this.store.get(id);
    if (!existing) {
      if (reservation.version !== 0) return err(staleVersionError(id, reservation.version));
      const dup = await this.findByIdempotencyKey(reservation.idempotencyKey);
      if (dup.isOk && dup.value) return err(repositoryError('duplicate idempotency_key'));
      this.store.set(id, withVersion(reservation, 1));
      return ok(undefined);
    }
    if (existing.version !== reservation.version) return err(staleVersionError(id, reservation.version));
    this.store.set(id, withVersion(reservation, reservation.version + 1));
    return ok(undefined);
  }
}

function withVersion(r: Reservation, version: number): Reservation {
  return Reservation.reconstitute({
    id: r.id, accountId: r.accountId, reserved: r.reserved, captured: r.captured, idempotencyKey: r.idempotencyKey,
    state: r.state, createdAt: r.createdAt, expiresAt: r.expiresAt, closedAt: r.closedAt, version,
  });
}
