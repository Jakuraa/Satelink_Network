-- 045_x402_key_denials.sql — 402-loop instrumentation for the admin alert
-- x402_402_loop (2026-10-12 directive, Step 5). Additive only. Applied
-- idempotently by ensureX402KeySchema (src/billing/x402_session_keys.js) on
-- first use; this numbered file is the reviewable record. No key is stored —
-- only the internal account id the key was issued on.
CREATE TABLE IF NOT EXISTS x402_key_denials (
  id                     BIGSERIAL PRIMARY KEY,
  account_api_key        TEXT NOT NULL,
  code                   TEXT NOT NULL,
  credits_usdt_at_denial NUMERIC(18,6),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS x402_key_denials_created_idx ON x402_key_denials (created_at);
