-- 039_payments_core.down.sql — reverts database/migrations/039_payments_core.sql.
--
-- LOCAL / EPHEMERAL DATABASES ONLY (database/runner.ts is forward-only and never applies
-- this). Drops ONLY the 4 tables 039 created (reverse dependency order) and its
-- schema_migrations row. Touches no pre-existing table. Never run against production.

BEGIN;

DROP TABLE IF EXISTS provider_reconciliation_runs;
DROP TABLE IF EXISTS payment_entitlement_grants;
DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS payment_intents;

DELETE FROM schema_migrations WHERE filename = '039_payments_core.sql';

COMMIT;
