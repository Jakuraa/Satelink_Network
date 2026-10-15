-- 047_rpc_traffic_daily.sql — persistent daily aggregates of /rpc traffic (2026-10-15)
-- Railway keeps ~15 minutes of HTTP logs; this table keeps per-day counters so the
-- unpaid /rpc/polygon traffic can be segmented over days (docs/growth/TRAFFIC_SEGMENTS.md).
-- Additive only: new table + index, no existing table touched. Down: migrations/down/047_rpc_traffic_daily.sql
-- Applied idempotently by ensureSchema in src/analytics/rpc_traffic_recorder.mjs on first
-- flush; this numbered file is the reviewable record. Keep the two in sync.
--
-- Privacy: client_hash = HMAC-SHA256(server secret, client IP) truncated to 16 hex chars.
-- No raw IP is ever written. IP-literal Origin/Referer hosts are stored as 'ip-literal'.
-- Cardinality: every column is a bounded vocabulary or capped per day; distinct rows per
-- day are capped (RPC_TRAFFIC_ROW_CAP, default 20000) with overflow bucketed as 'other'.

CREATE TABLE IF NOT EXISTS rpc_traffic_daily (
  day          DATE    NOT NULL,
  client_hash  TEXT    NOT NULL,
  ua_family    TEXT    NOT NULL,
  origin_host  TEXT    NOT NULL,
  method       TEXT    NOT NULL,
  status_class TEXT    NOT NULL,   -- 2xx | 401 | 402 | 429 | 4xx | 5xx | other
  auth_state   TEXT    NOT NULL,   -- none | key-unfunded | key-funded | x402
  count        BIGINT  NOT NULL DEFAULT 0,
  PRIMARY KEY (day, client_hash, ua_family, origin_host, method, status_class, auth_state)
);

CREATE INDEX IF NOT EXISTS idx_rpc_traffic_daily_client ON rpc_traffic_daily (client_hash, day);
