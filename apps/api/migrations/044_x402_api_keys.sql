-- 044_x402_api_keys.sql — hashed x402 session keys + signed key recovery
-- (2026-10-12, supersedes the deterministic `x402_<payer>` credential of PR #521).
-- Additive only: two new tables, no change to any existing table.
-- Prod has no apps/api migration runner, so ensureX402KeySchema
-- (src/billing/x402_session_keys.js) applies this DDL idempotently on first
-- use (same boot-DDL pattern as 038/039/042/043); this numbered file is the
-- reviewable record. Keep the two in sync.

-- One row per issued key. Only the SHA-256 of the key is stored; the plaintext
-- is returned to the payer once and never persisted or logged.
CREATE TABLE IF NOT EXISTS x402_api_keys (
  key_hash        TEXT PRIMARY KEY,               -- sha256(hex) of x402_<64 hex>
  account_api_key TEXT NOT NULL,                  -- api_credits.api_key the key spends from
  payer_address   TEXT NOT NULL,                  -- lowercase, facilitator-verified payer
  issued_via      TEXT NOT NULL CHECK (issued_via IN ('settlement', 'recover')),
  settlement_tx   TEXT,                           -- x402 tx that issued it (settlement only)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS x402_api_keys_account_idx ON x402_api_keys (account_api_key);

-- Single-use challenges for POST /v1/x402/key/recover (EIP-191 personal_sign).
CREATE TABLE IF NOT EXISTS x402_key_recovery_nonces (
  nonce         TEXT PRIMARY KEY,
  payer_address TEXT NOT NULL,
  message       TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
