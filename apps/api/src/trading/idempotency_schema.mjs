// apps/api/src/trading/idempotency_schema.mjs
// DDL and idempotent initialization for durable trading idempotency.
// Mirrors apps/api/migrations/048_trading_idempotency.sql.

export const TRADING_IDEMPOTENCY_DDL = `
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
`;

let ensured = null;

export async function ensureTradingIdempotencySchema(pool) {
  if (!pool || typeof pool.query !== 'function') return;
  if (!ensured) {
    ensured = pool.query(TRADING_IDEMPOTENCY_DDL).catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

export function __resetTradingIdempotencySchema() {
  ensured = null;
}
