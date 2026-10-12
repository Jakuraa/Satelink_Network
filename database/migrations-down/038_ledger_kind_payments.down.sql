-- 038_ledger_kind_payments.down.sql — reverts database/migrations/038_ledger_kind_payments.sql.
--
-- LOCAL / EPHEMERAL DATABASES ONLY (database/runner.ts is forward-only and never applies
-- this). Restores the 019 kind set and removes 038's schema_migrations row so the up
-- migration can be re-applied. Fails if any row already uses a 038 kind — by design.

BEGIN;

ALTER TABLE ledger_txns DROP CONSTRAINT IF EXISTS ledger_txns_kind_check;
ALTER TABLE ledger_txns ADD CONSTRAINT ledger_txns_kind_check
  CHECK (kind IN ('draw', 'settlement', 'deposit', 'adjustment', 'reversal', 'refund'));

DELETE FROM schema_migrations WHERE filename = '038_ledger_kind_payments.sql';

COMMIT;
