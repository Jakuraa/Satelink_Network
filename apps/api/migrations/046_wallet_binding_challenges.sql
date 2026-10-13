-- 046_wallet_binding_challenges.sql — single-use challenges for wallet ownership binding
-- Security fix S1 (2026-10-14): eliminates wallet-binding vulnerability in POST /api/keys.
-- Requires an EIP-191 personal_sign challenge from the wallet before binding to an API key.
-- Additive only: new table, no change to existing tables.
-- Applied idempotently by ensureWalletChallengeSchema (src/billing/wallet_challenge.mjs) on first use;
-- this numbered file is the reviewable record. Keep the two in sync.

CREATE TABLE IF NOT EXISTS api_key_wallet_challenges (
  nonce          TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  message        TEXT NOT NULL,
  operation      TEXT NOT NULL DEFAULT 'bind_wallet',
  expires_at     TIMESTAMPTZ NOT NULL,
  consumed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_challenges_addr ON api_key_wallet_challenges (wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_challenges_expires ON api_key_wallet_challenges (expires_at);
