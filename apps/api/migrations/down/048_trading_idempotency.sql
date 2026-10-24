-- Down for 048_trading_idempotency.sql
-- Removes the durable trading idempotency table.
-- Safe rollback: does not touch canonical financial ledgers (api_credits, revenue_events_v2).

DROP INDEX IF EXISTS idx_trading_idempotency_state_lock;
DROP INDEX IF EXISTS idx_trading_idempotency_principal;
DROP TABLE IF EXISTS trading_idempotency;
