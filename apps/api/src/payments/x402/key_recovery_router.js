// apps/api/src/payments/x402/key_recovery_router.js
// POST /v1/x402/key/recover/challenge  { address }                     → message to sign
// POST /v1/x402/key/recover            { address, nonce, signature }   → new session key (once)
//
// The ONLY way to obtain an x402 session key other than paying: prove control
// of the paying wallet with an EIP-191 personal_sign over a single-use,
// short-lived, server-issued challenge (SIWE-style text). This is the
// migration path for payer accounts credited before 2026-10-12, whose only
// "key" was the public `x402_<address>` account id (PR #521 flaw) — and the
// recovery path for any machine that lost its key.
//
// Recovering issues a NEW random key and revokes every earlier x402 key of
// that wallet on that account. It never moves funds and never reveals an
// sk_ key. The key is never logged.
//
// No account enumeration (2026-10-13): the challenge endpoint answers every
// well-formed address identically (200 + a challenge) and never looks up the
// account. Whether a wallet has an account is revealed only AFTER a valid
// signature, i.e. only to whoever controls the wallet. Abuse bounds: a per-IP
// and a per-address rate limit, at most MAX_PENDING_PER_ADDRESS unexpired
// challenges per address (beyond that the newest pending challenge is
// returned again, so flooding an address cannot lock its owner out), and
// expired challenges are deleted on every challenge request.

import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { ethers } from 'ethers';
import { PRICE_PER_CALL_USDT } from '../../billing/credit_service.mjs';
import { ensureX402KeySchema, issueSessionKey, sessionKeyHint } from '../../billing/x402_session_keys.js';

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;
const SIG_RE = /^0x[0-9a-fA-F]{130}$/;
const NONCE_RE = /^[0-9a-f]{32}$/;
export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
export const MAX_PENDING_PER_ADDRESS = 3;
export const DEFAULT_RATE_LIMITS = Object.freeze({
  ip: { windowMs: 60 * 1000, max: 10 },
  address: { windowMs: 15 * 60 * 1000, max: 20 },
});

/** Deletes every expired challenge (consumed or not). Returns rows removed. */
export async function cleanupExpiredChallenges(db) {
  const r = await db.query(`DELETE FROM x402_key_recovery_nonces WHERE expires_at < NOW()`);
  return r.rowCount || 0;
}

export function buildRecoveryMessage({ address, nonce, issuedAt, expiresAt, host = 'rpc.satelink.network' }) {
  return [
    `${host} wants you to recover your Satelink x402 API key with your Ethereum account:`,
    ethers.getAddress(address),
    '',
    'Signing issues a NEW x402 API key for the remaining credits of this wallet and revokes any earlier x402 key. It does not move funds.',
    '',
    `URI: https://${host}/v1/x402/key/recover`,
    'Version: 1',
    'Chain ID: 8453',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join('\n');
}

// Same resolution as settlement.js / credit_service.resolveAccount: the oldest
// api_credits row bound to the wallet is the one x402 bundles were credited on.
async function accountForWallet(db, address) {
  const r = await db.query(
    `SELECT api_key, credits_usdt FROM api_credits WHERE lower(wallet_address) = lower($1)
      ORDER BY created_at ASC LIMIT 1`,
    [address]
  );
  return r.rows[0] || null;
}

export function createX402KeyRecoveryRouter(pool, { log = console, limiter, addressLimiter, rateLimits = DEFAULT_RATE_LIMITS } = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));
  const limited = { ok: false, error: 'x402_recover_rate_limited' };
  const ipLimit = limiter || rateLimit({
    ...rateLimits.ip, standardHeaders: true, legacyHeaders: false, validate: false, message: limited,
  });
  // Keyed on the (lowercased) address in the body, so rotating IPs does not
  // help against one address. Malformed addresses share one bucket and are
  // rejected with 400 right after anyway.
  const addrLimit = addressLimiter || rateLimit({
    ...rateLimits.address, standardHeaders: true, legacyHeaders: false, validate: false, message: limited,
    keyGenerator: (req) => `x402-recover-addr:${String(req.body?.address || '').toLowerCase().slice(0, 42)}`,
  });
  const limit = [ipLimit, addrLimit];

  router.post('/recover/challenge', limit, async (req, res) => {
    const address = req.body?.address;
    if (!WALLET_RE.test(address || '')) {
      return res.status(400).json({ ok: false, error: 'invalid_address', message: 'address must be a 0x-prefixed 20-byte hex wallet address' });
    }
    const payer = address.toLowerCase();
    try {
      await ensureX402KeySchema(pool);
      // Deliberately NO account lookup here (no enumeration oracle).
      await cleanupExpiredChallenges(pool);
      const client = await pool.connect();
      let challenge;
      try {
        await client.query('BEGIN');
        // Serialise challenge creation per address so the pending cap holds
        // under concurrency.
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`x402-recover:${payer}`]);
        const pending = await client.query(
          `SELECT nonce, message, expires_at FROM x402_key_recovery_nonces
            WHERE payer_address = $1 AND consumed_at IS NULL AND expires_at > NOW()
            ORDER BY created_at DESC, expires_at DESC`,
          [payer]
        );
        if (pending.rows.length >= MAX_PENDING_PER_ADDRESS) {
          const p = pending.rows[0];
          challenge = { nonce: p.nonce, message: p.message, expiresAt: new Date(p.expires_at).toISOString() };
        } else {
          const nonce = crypto.randomBytes(16).toString('hex');
          const now = Date.now();
          const issuedAt = new Date(now).toISOString();
          const expiresAt = new Date(now + CHALLENGE_TTL_MS).toISOString();
          const message = buildRecoveryMessage({ address, nonce, issuedAt, expiresAt });
          await client.query(
            `INSERT INTO x402_key_recovery_nonces (nonce, payer_address, message, expires_at) VALUES ($1, $2, $3, $4)`,
            [nonce, payer, message, expiresAt]
          );
          challenge = { nonce, message, expiresAt };
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      return res.json({
        ok: true, nonce: challenge.nonce, message: challenge.message, expires_at: challenge.expiresAt,
        sign_with: 'personal_sign (EIP-191) from the paying wallet, then POST {address, nonce, signature} to /v1/x402/key/recover',
      });
    } catch (err) {
      log.error(`[x402-recover] challenge failed: ${err.message}`);
      return res.status(500).json({ ok: false, error: 'recover_unavailable' });
    }
  });

  router.post('/recover', limit, async (req, res) => {
    const { address, nonce, signature } = req.body || {};
    if (!WALLET_RE.test(address || '') || !NONCE_RE.test(nonce || '') || !SIG_RE.test(signature || '')) {
      return res.status(400).json({ ok: false, error: 'invalid_request', message: 'address, nonce and a 65-byte hex signature are required' });
    }
    const payer = address.toLowerCase();
    try {
      await ensureX402KeySchema(pool);
      const ch = await pool.query(
        `SELECT message FROM x402_key_recovery_nonces
          WHERE nonce = $1 AND payer_address = $2 AND consumed_at IS NULL AND expires_at > NOW()`,
        [nonce, payer]
      );
      if (!ch.rows[0]) {
        return res.status(401).json({ ok: false, error: 'challenge_invalid', message: 'Unknown, expired or already-used challenge. Request a new one.' });
      }
      let signer = null;
      try { signer = ethers.verifyMessage(ch.rows[0].message, signature).toLowerCase(); } catch { signer = null; }
      if (signer !== payer) {
        return res.status(401).json({ ok: false, error: 'signature_invalid', message: 'Signature was not produced by the paying wallet.' });
      }

      const client = await pool.connect();
      let key; let account;
      try {
        await client.query('BEGIN');
        // Consume the challenge in the same transaction as the issuance: two
        // concurrent recovers with one nonce cannot both mint a key.
        const used = await client.query(
          `UPDATE x402_key_recovery_nonces SET consumed_at = NOW()
            WHERE nonce = $1 AND payer_address = $2 AND consumed_at IS NULL AND expires_at > NOW()
            RETURNING nonce`,
          [nonce, payer]
        );
        if (!used.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(401).json({ ok: false, error: 'challenge_invalid', message: 'Challenge already used.' });
        }
        account = await accountForWallet(client, payer);
        if (!account) {
          // Reached only with a valid signature: the caller controls this
          // wallet, so telling them it has no account enumerates nothing.
          await client.query('ROLLBACK');
          return res.status(404).json({ ok: false, error: 'no_account', message: 'No credited account is bound to this wallet.' });
        }
        await client.query(
          `UPDATE x402_api_keys SET revoked_at = NOW()
            WHERE account_api_key = $1 AND payer_address = $2 AND revoked_at IS NULL`,
          [account.api_key, payer]
        );
        key = await issueSessionKey(client, { accountApiKey: account.api_key, payer, via: 'recover' });
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }

      log.info(`[x402-recover] key re-issued for payer=${payer} key=${sessionKeyHint(key)}`);
      res.setHeader('X-Satelink-API-Key', key);
      res.setHeader('X-API-Key', key);
      res.setHeader('Cache-Control', 'no-store');
      const credits = parseFloat(account.credits_usdt || 0);
      return res.json({
        ok: true,
        api_key: key,
        wallet: payer,
        calls_remaining: Math.floor(credits / PRICE_PER_CALL_USDT + 1e-6),
        note: 'Shown ONCE — store it. Every earlier x402 key of this wallet is now revoked. Send it as the X-API-Key header.',
      });
    } catch (err) {
      log.error(`[x402-recover] recover failed: ${err.message}`);
      return res.status(500).json({ ok: false, error: 'recover_unavailable' });
    }
  });

  return router;
}
