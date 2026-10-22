/**
 * AvailableBalanceReader derived from the ledger (libs invariant #1: balance is DERIVED, never
 * stored). Uses BalanceCalculator, which matches the `account_balances` view: available =
 * posted_credits − posted_debits − pending_debits. Reservation holds are posted transfers to the
 * holds account, so this is already "available after holds".
 */
import { AccountRef, BalanceCalculator } from '@satelink/financial-domain';
import type { Money, Result } from '@satelink/kernel';
import { ok, err } from '@satelink/kernel';
import type { LedgerRepository } from '../ports/ledger-repository.js';
import type { AvailableBalanceReader } from '../ports/reservation-repository.js';
import type { RepositoryError } from '../ports/repository-errors.js';
import { repositoryError } from '../ports/repository-errors.js';

export class LedgerAvailableBalanceReader implements AvailableBalanceReader {
  constructor(private readonly ledger: LedgerRepository) {}

  async available(accountId: string, like: Money): Promise<Result<Money, RepositoryError>> {
    const ref = AccountRef.of(accountId);
    if (ref.isErr) return err(repositoryError(ref.error.toString()));
    const entries = await this.ledger.streamByAccount(accountId, {});
    if (entries.isErr) return err(repositoryError(entries.error.message, entries.error.cause));
    const bal = BalanceCalculator.compute(ref.value, like.currency, entries.value);
    if (bal.isErr) return err(repositoryError(bal.error.toString()));
    return ok(bal.value.available);
  }
}
