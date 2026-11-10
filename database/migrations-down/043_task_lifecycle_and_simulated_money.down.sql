-- 043_task_lifecycle_and_simulated_money.down.sql — LOCAL / EPHEMERAL DATABASES ONLY.
-- Reverts 043. Drops preview-only tables; fails if reservation ledger rows exist (by design: they are
-- append-only money rows and must be removed with their database, never piecemeal).
BEGIN;
DROP VIEW IF EXISTS revenue_truth;
DROP TABLE IF EXISTS workflow_reservations;
ALTER TABLE ledger_txns DROP CONSTRAINT IF EXISTS ledger_txns_reservation_tagged;
ALTER TABLE ledger_txns DROP COLUMN IF EXISTS environment, DROP COLUMN IF EXISTS origin;
DROP TRIGGER IF EXISTS workflow_quotes_no_update ON workflow_quotes;
DROP FUNCTION IF EXISTS workflow_quotes_immutable();
DROP TABLE IF EXISTS workflow_quotes;
DROP TABLE IF EXISTS capability_registry;
DROP INDEX IF EXISTS uq_workflow_run_steps_idem;
ALTER TABLE workflow_run_steps
    DROP COLUMN IF EXISTS verified_at, DROP COLUMN IF EXISTS result, DROP COLUMN IF EXISTS last_error_code,
    DROP COLUMN IF EXISTS attempts, DROP COLUMN IF EXISTS idempotency_key, DROP COLUMN IF EXISTS provider_id,
    DROP COLUMN IF EXISTS capability_id, DROP COLUMN IF EXISTS step_no;
DROP INDEX IF EXISTS idx_workflow_runs_tenant;
DROP INDEX IF EXISTS idx_workflow_runs_state;
ALTER TABLE workflow_runs
    DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS quote_id, DROP COLUMN IF EXISTS plan,
    DROP COLUMN IF EXISTS intent, DROP COLUMN IF EXISTS origin, DROP COLUMN IF EXISTS environment,
    DROP COLUMN IF EXISTS actor_type, DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS version,
    DROP COLUMN IF EXISTS state;
DELETE FROM schema_migrations WHERE filename = '043_task_lifecycle_and_simulated_money.sql';
COMMIT;
