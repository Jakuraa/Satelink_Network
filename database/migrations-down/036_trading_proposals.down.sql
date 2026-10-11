-- Rollback for 036_trading_proposals (local / ephemeral databases only). Run before 029's down.
DROP TABLE IF EXISTS trading_proposal_events;
DROP TABLE IF EXISTS trading_proposals;
DELETE FROM schema_migrations WHERE filename = '036_trading_proposals.sql';
