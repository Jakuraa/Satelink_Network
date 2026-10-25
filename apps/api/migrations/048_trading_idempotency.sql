-- 048_trading_idempotency.sql — Durable, crash-recoverable idempotency for trading operations
-- Enforces principal-scoped uniqueness, concurrency mutual exclusion, payload hash integrity,
-- lease timeouts for crash recovery, and coordination with financial receipts.
--
-- Rollback: migrations/down/048_trading_idempotency.sql

CREATE TABLE IF NOT EXISTS trading_idempotency (
  key           TEXT PRIMARY KEY,
  principal_id  TEXT NOT NULL,
  action        TEXT NOT NULL DEFAULT 'paper_simulation',
  payload_hash  TEXT NOT NULL,
  state         TEXT NOT NULL CHECK (state IN ('pending', 'succeeded', 'failed')),
  receipt_ref   TEXT,
  response      JSONB,
  error         TEXT,
  locked_until  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_idempotency_principal ON trading_idempotency (principal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trading_idempotency_state_lock ON trading_idempotency (state, locked_until);
