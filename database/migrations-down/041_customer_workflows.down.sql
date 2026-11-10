-- 041_customer_workflows.down.sql — reverts database/migrations/041_customer_workflows.sql.
--
-- LOCAL / EPHEMERAL DATABASES ONLY (database/runner.ts is forward-only and never applies
-- this). Drops ONLY the tables and guard functions 041 created and its schema_migrations
-- row. Touches no pre-existing table. Never run against production.

BEGIN;

DROP TABLE IF EXISTS workflow_receipts;
DROP TABLE IF EXISTS workflow_usage_records;
DROP TABLE IF EXISTS workflow_run_steps;
DROP TABLE IF EXISTS workflow_runs;
DROP TABLE IF EXISTS workflow_strategies;
DROP TABLE IF EXISTS workflow_definitions;
DROP TABLE IF EXISTS wf_dlq;
DROP TABLE IF EXISTS wf_suppliers;
DROP TABLE IF EXISTS wf_idempotency;
DROP TABLE IF EXISTS wf_journal;
DROP FUNCTION IF EXISTS workflow_receipts_append_only();
DROP FUNCTION IF EXISTS wf_journal_append_only();

DELETE FROM schema_migrations WHERE filename = '041_customer_workflows.sql';

COMMIT;
