// apps/api/src/billing/x402_session_keys.js
// x402 session keys — the credential a machine reuses after an x402 bundle
// payment to spend the remaining bundle calls without paying again.
//
// SECURITY (2026-10-12, supersedes PR #521): the credential is
//   x402_<64 hex>  = 32 bytes from crypto.randomBytes (256 bits of entropy)
// and ONLY its SHA-256 is stored (x402_api_keys.key_hash). It is returned to
// the payer exactly once (settlement response, or the signed recover flow) and
// never logged. It is NOT derivable from public data.
//
// The api_credits row an x402 payer is credited on keeps its internal id
// (`x402_<payer address>` for x402-created accounts). That id is public — the
// payer address is on Base — so it is an ACCOUNT ID, never a credential:
// isX402SessionKey() rejects it by shape (it contains "0x", not 64 hex) and
// it has no hash row, so presenting it as X-API-Key resolves to nothing.

import crypto from 'node:crypto';

export const X402_KEY_PREFIX = 'x402_';
const SESSION_KEY_RE = /^x402_[0-9a-f]{64}$/;

/** Shape check only — true for a server-issued session key, false for the
 *  public `x402_<address>` account id and anything else. */
export function isX402SessionKey(s) {
  return typeof s === 'string' && SESSION_KEY_RE.test(s);
}

export function hashSessionKey(key) {
  return crypto.createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Non-secret display hint for logs/UI: prefix + first 4 hex. */
export function sessionKeyHint(key) {
  return typeof key === 'string' ? `${key.slice(0, X402_KEY_PREFIX.length + 4)}…` : null;
}

// 044_x402_api_keys.sql — prod has no apps/api migration runner, so this DDL is
// applied idempotently on first use (same boot-DDL pattern as 043); the
// numbered file is the reviewable record. Keep the two in sync.
const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS x402_api_keys (
    key_hash        TEXT PRIMARY KEY,
    account_api_key TEXT NOT NULL,
    payer_address   TEXT NOT NULL,
    issued_via      TEXT NOT NULL CHECK (issued_via IN ('settlement', 'recover')),
    settlement_tx   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS x402_api_keys_account_idx ON x402_api_keys (account_api_key);
  CREATE TABLE IF NOT EXISTS x402_key_recovery_nonces (
    nonce         TEXT PRIMARY KEY,
    payer_address TEXT NOT NULL,
    message       TEXT NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    consumed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS x402_key_denials (
    id                     BIGSERIAL PRIMARY KEY,
    account_api_key        TEXT NOT NULL,
    code                   TEXT NOT NULL,
    credits_usdt_at_denial NUMERIC(18,6),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS x402_key_denials_created_idx ON x402_key_denials (created_at);
`;

// No process-level "already created" cache: a cached flag can outlive the
// table (a rolled-back transaction, a restored DB) and the next settlement
// would then fail AFTER the payer was charged. Settlements are rare, so one
// catalog lookup per call is cheap; the DDL runs only when a table is missing.
export async function ensureX402KeySchema(db) {
  const r = await db.query(
    `SELECT to_regclass('x402_api_keys') IS NOT NULL AND to_regclass('x402_key_recovery_nonces') IS NOT NULL
            AND to_regclass('x402_key_denials') IS NOT NULL AS ok`
  );
  if (!r.rows[0]?.ok) await db.query(SCHEMA_DDL);
}
/** Kept for test compatibility (no cache to reset any more). */
export function _resetSchemaCache() {}

/**
 * Mint a session key bound to an api_credits account, on the caller's
 * connection (so a settlement can issue it inside its own transaction).
 * Returns the plaintext key — the ONLY time it exists outside the client.
 */
export async function issueSessionKey(db, { accountApiKey, payer, via, settlementTx = null }) {
  const key = X402_KEY_PREFIX + crypto.randomBytes(32).toString('hex');
  await db.query(
    `INSERT INTO x402_api_keys (key_hash, account_api_key, payer_address, issued_via, settlement_tx)
     VALUES ($1, $2, $3, $4, $5)`,
    [hashSessionKey(key), accountApiKey, String(payer).toLowerCase(), via, settlementTx]
  );
  return key;
}

/**
 * Resolve a presented session key to its account id + bound wallet, or null.
 * Unknown shape, unknown hash, revoked key, or a missing table → null (the
 * caller then treats the request as having no valid key → 402).
 */
export async function resolveSessionKey(db, key) {
  if (!isX402SessionKey(key) || !db || !db.query) return null;
  try {
    const r = await db.query(
      `SELECT account_api_key, payer_address FROM x402_api_keys
        WHERE key_hash = $1 AND revoked_at IS NULL`,
      [hashSessionKey(key)]
    );
    return r.rows[0] || null;
  } catch (err) {
    if (err.code === '42P01') return null; // table not created yet → no keys exist
    throw err;
  }
}

/**
 * 402-loop instrumentation (admin alert x402_402_loop): a request carrying an
 * issued session key — proof of a past payment — was refused with a 402.
 * Records the account's balance at that moment so the alert can tell a real
 * loop (credit left, still 402) from normal bundle exhaustion. Fire-and-forget:
 * never throws, never blocks the response, never stores the key.
 */
export async function recordSessionKeyDenial(db, key, code) {
  try {
    if (!isX402SessionKey(key)) return;
    const bound = await resolveSessionKey(db, key);
    if (!bound) return;
    await ensureX402KeySchema(db);
    await db.query(
      `INSERT INTO x402_key_denials (account_api_key, code, credits_usdt_at_denial)
       SELECT $1, $2, credits_usdt FROM api_credits WHERE api_key = $1`,
      [bound.account_api_key, String(code || 'unknown').slice(0, 64)]
    );
  } catch { /* instrumentation only */ }
}
