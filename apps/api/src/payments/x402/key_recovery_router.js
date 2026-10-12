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

import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { ethers } from 'ethers';
import { PRICE_PER_CALL_USDT } from '../../billing/credit_service.mjs';
import { ensureX402KeySchema, issueSessionKey, sessionKeyHint } from '../../billing/x402_session_keys.js';

const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;
const SIG_RE = /^0x[0-9a-fA-F]{130}$/;
const NONCE_RE = /^[0-9a-f]{32}$/;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

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

export function createX402KeyRecoveryRouter(pool, { log = console, limiter } = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));
  const limit = limiter || rateLimit({
    windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, validate: false,
    message: { ok: false, error: 'x402_recover_rate_limited' },
  });

  router.post('/recover/challenge', limit, async (req, res) => {
    const address = req.body?.address;
    if (!WALLET_RE.test(address || '')) {
      return res.status(400).json({ ok: false, error: 'invalid_address', message: 'address must be a 0x-prefixed 20-byte hex wallet address' });
    }
    try {
      await ensureX402KeySchema(pool);
      if (!(await accountForWallet(pool, address))) {
        return res.status(404).json({ ok: false, error: 'no_account', message: 'No credited account is bound to this wallet.' });
      }
      const nonce = crypto.randomBytes(16).toString('hex');
      const now = Date.now();
      const issuedAt = new Date(now).toISOString();
      const expiresAt = new Date(now + CHALLENGE_TTL_MS).toISOString();
      const message = buildRecoveryMessage({ address, nonce, issuedAt, expiresAt });
      await pool.query(`DELETE FROM x402_key_recovery_nonces WHERE expires_at < NOW() - INTERVAL '1 day'`);
      await pool.query(
        `INSERT INTO x402_key_recovery_nonces (nonce, payer_address, message, expires_at) VALUES ($1, $2, $3, $4)`,
        [nonce, address.toLowerCase(), message, expiresAt]
      );
      return res.json({
        ok: true, nonce, message, expires_at: expiresAt,
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
