-- 042_ledger_kind_reservation.down.sql — reverts database/migrations/042_ledger_kind_reservation.sql.
--
-- LOCAL / EPHEMERAL DATABASES ONLY (database/runner.ts is forward-only and never applies
-- this). Restores the 038 kind set and removes 042's schema_migrations row so the up
-- migration can be re-applied. Fails if any row already uses a 042 kind — by design.

BEGIN;

ALTER TABLE ledger_txns DROP CONSTRAINT IF EXISTS ledger_txns_kind_check;
ALTER TABLE ledger_txns ADD CONSTRAINT ledger_txns_kind_check
  CHECK (kind IN ('draw', 'settlement', 'deposit', 'adjustment', 'reversal', 'refund',
                  'payment', 'subscription', 'commission', 'rebate', 'provider_fee'));

DELETE FROM schema_migrations WHERE filename = '042_ledger_kind_reservation.sql';

COMMIT;
