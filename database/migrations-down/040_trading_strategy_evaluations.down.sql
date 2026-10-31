-- 040_trading_strategy_evaluations.down.sql — reverts database/migrations/040_trading_strategy_evaluations.sql.
--
-- LOCAL / EPHEMERAL DATABASES ONLY (database/runner.ts is forward-only and never applies
-- this). Drops ONLY the 2 tables and the guard function 040 created and its
-- schema_migrations row. Touches no pre-existing table. Never run against production.

BEGIN;

DROP TABLE IF EXISTS trading_decisions;
DROP TABLE IF EXISTS trading_strategy_evaluations;
DROP FUNCTION IF EXISTS trading_append_only_guard();

DELETE FROM schema_migrations WHERE filename = '040_trading_strategy_evaluations.sql';

COMMIT;
