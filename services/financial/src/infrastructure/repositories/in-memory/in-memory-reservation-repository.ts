import { Reservation } from '@satelink/financial-domain';
import type { Result } from '@satelink/kernel';
import { ok } from '@satelink/kernel';
import type { ReservationRepository } from '../../../application/ports/reservation-repository.js';
import type { RepositoryError } from '../../../application/ports/repository-errors.js';

/**
 * In-memory reservation store. Reads implement ReservationRepository; the synchronous `_…` helpers
 * are for InMemoryReservationUnitOfWork only, which calls them inside its critical section.
 */
export class InMemoryReservationRepository implements ReservationRepository {
  private readonly byId = new Map<string, Reservation>();
  private readonly byKey = new Map<string, string>(); // `${accountId}\u0000${key}` → id

  static keyOf(accountId: string, key: string): string { return `${accountId}\u0000${key}`; }

  async findById(id: string): Promise<Result<Reservation | null, RepositoryError>> {
    return ok(this.byId.get(id) ?? null);
  }

  async findByIdempotencyKey(accountId: string, key: string): Promise<Result<Reservation | null, RepositoryError>> {
    const id = this.byKey.get(InMemoryReservationRepository.keyOf(accountId, key));
    return ok(id ? this.byId.get(id) ?? null : null);
  }

  async findLapsed(now: number, limit: number, excluding: ReadonlySet<string> = new Set()): Promise<Result<Reservation[], RepositoryError>> {
    return ok([...this.byId.values()]
      .filter((r) => r.state === 'held' && r.expiresAt <= now && !excluding.has(r.id.value))
      .sort((a, b) => a.expiresAt - b.expiresAt || a.id.value.localeCompare(b.id.value))
      .slice(0, limit));
  }

  // --- synchronous helpers for the in-memory unit of work (inside its critical section) ---
  _get(id: string): Reservation | undefined { return this.byId.get(id); }
  _hasKey(accountId: string, key: string): boolean { return this.byKey.has(InMemoryReservationRepository.keyOf(accountId, key)); }
  _put(r: Reservation, version: number): void {
    const stored = Reservation.reconstitute({
      id: r.id, accountId: r.accountId, reserved: r.reserved, captured: r.captured, idempotencyKey: r.idempotencyKey,
      state: r.state, createdAt: r.createdAt, expiresAt: r.expiresAt, closedAt: r.closedAt, version,
    });
    this.byId.set(r.id.value, stored);
    this.byKey.set(InMemoryReservationRepository.keyOf(r.accountId.value, r.idempotencyKey), r.id.value);
  }
  _restore(id: string, previous: Reservation | undefined, accountId: string, key: string): void {
    if (previous) this.byId.set(id, previous);
    else { this.byId.delete(id); this.byKey.delete(InMemoryReservationRepository.keyOf(accountId, key)); }
  }
}
