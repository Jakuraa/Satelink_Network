// apps/api/src/billing/wallet_challenge.mjs
// Single-use challenge generation and verification for wallet ownership binding.
// Security fix S1 (2026-10-14): eliminates wallet-binding vulnerability in POST /api/keys.
//
// Every wallet association requires proof of private-key control via an EIP-191
// personal_sign signature over a server-issued, short-lived, single-use challenge.
// Challenges are bound to:
//   - Wallet address (EVM 20-byte, lowercase normalized)
//   - Cryptographically random 16-byte (32-hex) nonce
//   - Host and API endpoint URI context
//   - Polygon mainnet (Chain ID 137)
//   - Explicit operation ('bind_wallet')
//   - Issue and expiration timestamps (10-minute TTL)
//
// Anti-abuse & enumeration resistance:
//   - Issue does NOT query account tables; every well-formed address gets a challenge.
//   - Pending challenge cap (max 3 pending per address) prevents lockout/flooding.
//   - Single-use consumption is atomic within the caller's transaction.

import crypto from 'node:crypto';
import { ethers } from 'ethers';

export const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;
export const SIG_RE = /^0x[0-9a-fA-F]{130}$/;
export const NONCE_RE = /^[0-9a-f]{32}$/i;
export const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_PENDING_CHALLENGES = 3;

/**
 * Normalize and validate an EVM wallet address.
 * Returns lowercase hex address if valid, or null.
 */
export function normalizeWalletAddress(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!WALLET_RE.test(trimmed)) return null;
  try {
    return ethers.getAddress(trimmed).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Validate signature format (0x-prefixed 65-byte hex string).
 */
export function isValidSignature(sig) {
  return typeof sig === 'string' && SIG_RE.test(sig.trim());
}

/**
 * Validate nonce format (32-char hex string).
 */
export function isValidNonce(nonce) {
  return typeof nonce === 'string' && NONCE_RE.test(nonce.trim());
}

/**
 * Idempotently ensure the wallet challenges schema exists.
 */
export async function ensureWalletChallengeSchema(pool) {
  if (!pool || !pool.query) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_key_wallet_challenges (
        nonce          TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        message        TEXT NOT NULL,
        operation      TEXT NOT NULL DEFAULT 'bind_wallet',
        expires_at     TIMESTAMPTZ NOT NULL,
        consumed_at    TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wallet_challenges_addr ON api_key_wallet_challenges (wallet_address)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wallet_challenges_expires ON api_key_wallet_challenges (expires_at)`);
  } catch (err) {
    console.error('[WalletChallenge] Schema ensure failed:', err.message);
  }
}

/**
 * Build the human-readable EIP-191 challenge message.
 */
export function buildWalletBindingMessage({
  address,
  nonce,
  issuedAt,
  expiresAt,
  host = 'rpc.satelink.network'
}) {
  const checksumAddress = ethers.getAddress(address);
  return [
    `${host} wants you to bind your wallet to a Satelink API key:`,
    checksumAddress,
    '',
    'Signing confirms you control this wallet and authorizes associating it with a Satelink API key for usage tracking and credit deposits. It does not authorize any transaction or move funds.',
    '',
    `URI: https://${host}/api/keys`,
    'Version: 1',
    'Chain ID: 137',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join('\n');
}

/**
 * Delete all expired challenges.
 */
export async function cleanupExpiredChallenges(pool) {
  if (!pool || !pool.query) return;
  try {
    await pool.query(`DELETE FROM api_key_wallet_challenges WHERE expires_at < NOW()`);
  } catch (err) {
    console.warn('[WalletChallenge] Cleanup expired failed:', err.message);
  }
}

/**
 * Server-issue a single-use challenge for a wallet address.
 * Does not check whether the wallet already has an account (prevents enumeration).
 */
export async function issueWalletChallenge(pool, { walletAddress, host = 'rpc.satelink.network' } = {}) {
  const normalized = normalizeWalletAddress(walletAddress);
  if (!normalized) {
    throw new Error('invalid_wallet_address');
  }

  await ensureWalletChallengeSchema(pool);
  await cleanupExpiredChallenges(pool);

  const client = typeof pool.connect === 'function' ? await pool.connect() : pool;
  try {
    if (client !== pool) await client.query('BEGIN');

    // Advisory lock per wallet to serialize challenge creation and prevent race conditions
    try {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`challenge_mint:${normalized}`]);
    } catch {
      // Best-effort in environments where advisory locks are not supported (e.g. lightweight mocks)
    }

    // Check pending unexpired challenges for this wallet
    const pending = await client.query(
      `SELECT nonce, message, expires_at FROM api_key_wallet_challenges
       WHERE wallet_address = $1 AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [normalized]
    );

    // If capped, re-serve the newest unexpired challenge so flooding cannot lock the owner out
    if (pending.rows.length >= MAX_PENDING_CHALLENGES) {
      if (client !== pool) await client.query('COMMIT');
      const newest = pending.rows[0];
      return {
        nonce: newest.nonce,
        message: newest.message,
        expires_at: new Date(newest.expires_at).toISOString(),
      };
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const issuedAt = new Date(now).toISOString();
    const expiresAt = new Date(now + CHALLENGE_TTL_MS).toISOString();
    const message = buildWalletBindingMessage({ address: normalized, nonce, issuedAt, expiresAt, host });

    await client.query(
      `INSERT INTO api_key_wallet_challenges (nonce, wallet_address, message, operation, expires_at)
       VALUES ($1, $2, $3, 'bind_wallet', $4)`,
      [nonce, normalized, message, expiresAt]
    );

    if (client !== pool) await client.query('COMMIT');

    return {
      nonce,
      message,
      expires_at: expiresAt,
    };
  } catch (err) {
    if (client !== pool) await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (client !== pool && typeof client.release === 'function') {
      client.release();
    }
  }
}

/**
 * Verify signature against stored challenge and atomically consume the challenge.
 * Must be executed within a transaction client so challenge consumption and key creation
 * commit together.
 */
export async function verifyAndConsumeWalletChallenge(client, { walletAddress, nonce, signature } = {}) {
  const normalized = normalizeWalletAddress(walletAddress);
  if (!normalized) {
    return { ok: false, code: 'invalid_wallet_address', http: 400, message: 'Invalid wallet address format' };
  }
  if (!isValidNonce(nonce) || !isValidSignature(signature)) {
    return { ok: false, code: 'invalid_request', http: 400, message: 'Invalid nonce or signature format' };
  }

  // 1. Fetch challenge row
  const ch = await client.query(
    `SELECT message, expires_at, consumed_at FROM api_key_wallet_challenges
     WHERE nonce = $1 AND wallet_address = $2`,
    [nonce.trim(), normalized]
  );
  const row = ch.rows?.[0];
  if (!row) {
    return { ok: false, code: 'challenge_invalid', http: 401, message: 'Unknown, expired or invalid challenge. Request a new one.' };
  }
  if (row.consumed_at) {
    return { ok: false, code: 'challenge_invalid', http: 401, message: 'Challenge already used. Request a new one.' };
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, code: 'challenge_expired', http: 401, message: 'Challenge has expired. Request a new one.' };
  }

  // 2. Cryptographic signature recovery via ethers
  let signer = null;
  try {
    signer = ethers.verifyMessage(row.message, signature.trim()).toLowerCase();
  } catch {
    signer = null;
  }

  if (!signer || signer !== normalized) {
    return { ok: false, code: 'signature_invalid', http: 401, message: 'Signature was not produced by the specified wallet.' };
  }

  // 3. Atomically consume the challenge in this transaction
  const consumed = await client.query(
    `UPDATE api_key_wallet_challenges
     SET consumed_at = NOW()
     WHERE nonce = $1 AND wallet_address = $2 AND consumed_at IS NULL AND expires_at > NOW()
     RETURNING nonce`,
    [nonce.trim(), normalized]
  );

  if (!consumed.rows?.[0]) {
    return { ok: false, code: 'challenge_invalid', http: 401, message: 'Challenge already consumed or expired.' };
  }

  return { ok: true, normalizedWallet: normalized };
}
