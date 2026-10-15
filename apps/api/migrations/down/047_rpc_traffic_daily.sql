-- Down for 047_rpc_traffic_daily.sql. Removes only the analytics table this migration
-- created (aggregate counters, no money data). Run only on an explicit founder decision;
-- set RPC_TRAFFIC_ANALYTICS=off first or the recorder recreates the table on next flush.
DROP INDEX IF EXISTS idx_rpc_traffic_daily_client;
DROP TABLE IF EXISTS rpc_traffic_daily;
