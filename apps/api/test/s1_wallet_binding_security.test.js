// apps/api/test/s1_wallet_binding_security.test.js
// Satelink S1 Security Fix — Wallet Ownership Binding Adversarial Regression Suite.
//
// Pins the contracts for:
//   1. Unsigned wallet binding rejected (fail-closed, 400 wallet_signature_required)
//   2. Anonymous free key creation preserved (wallet_address: null, 200)
//   3. Challenge issuance without account enumeration oracle (200 for any valid address)
//   4. Signature from a different wallet rejected (401 signature_invalid)
//   5. Invalid or invented nonce rejected (401 challenge_invalid)
//   6. Expired challenge rejected (401 challenge_expired)
//   7. Replayed challenge rejected (401 challenge_invalid)
//   8. Legitimate signed wallet binding succeeds (200, key issued and wallet bound)
//   9. Duplicate wallet association rejected (409 wallet_already_registered)
//  10. Atomic single-use consumption under concurrent requests (only 1 succeeds)
//  11. Binding wallet to existing key via POST /api/keys/bind requires proof
//  12. Zero-state verification: failed attempts create 0 keys, 0 associations, 0 credits
//
// Real Postgres (local test DB only; refuses Railway hosts), fully rolled back.

import 'dotenv/config';
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { ethers } from 'ethers';
import { createSimpleApiKeysRouter } from '../src/billing/api_keys_route.mjs';
import { apiKeyCreateLimiter } from '../src/security/middleware/rate_limits.js';
import {
  ensureWalletChallengeSchema,
  buildWalletBindingMessage,
  normalizeWalletAddress,
} from '../src/billing/wallet_challenge.mjs';

describe('Satelink S1 Security Fix — Wallet Ownership Binding', function () {
  this.timeout(30000);

  let raw;
  let pool;
  let app;
  let sp = 0;

  const walletA = ethers.Wallet.createRandom();
  const walletB = ethers.Wallet.createRandom();
  const walletC = ethers.Wallet.createRandom();
  const walletD = ethers.Wallet.createRandom();
  const walletE = ethers.Wallet.createRandom();
  const walletF = ethers.Wallet.createRandom();

  before(async function () {
    const url = process.env.DATABASE_URL || '';
    if (!url || /rlwy\.net|railway\.app|railway\.internal/.test(url)) {
      this.skip();
    }

    const { default: pg } = await import('pg');
    raw = new pg.Client({ connectionString: url });
    try {
      await raw.connect();
    } catch {
      this.skip();
    }

    await raw.query('BEGIN');

    const client = {
      query(sql, params) {
        if (sql === 'BEGIN') {
          sp++;
          return raw.query(`SAVEPOINT s1_sp_${sp}`);
        }
        if (sql === 'COMMIT') {
          return raw.query(`RELEASE SAVEPOINT s1_sp_${sp}`);
        }
        if (sql === 'ROLLBACK') {
          return raw.query(`ROLLBACK TO SAVEPOINT s1_sp_${sp}`);
        }
        return raw.query(sql, params);
      },
      release() {},
    };

    pool = {
      connect: async () => client,
      query: (sql, params) => client.query(sql, params),
    };

    await ensureWalletChallengeSchema(pool);

    app = express();
    app.set('trust proxy', true);
    app.use(express.json());
    app.use('/api/keys', createSimpleApiKeysRouter(pool));
  });

  const resetLimiter = () => {
    try {
      apiKeyCreateLimiter.resetKey('::ffff:127.0.0.1');
      apiKeyCreateLimiter.resetKey('127.0.0.1');
      apiKeyCreateLimiter.resetKey('::1');
    } catch {}
  };

  afterEach(resetLimiter);

  after(async function () {
    resetLimiter();
    if (raw) {
      await raw.query('ROLLBACK').catch(() => {});
      await raw.end().catch(() => {});
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Unsigned wallet binding is rejected (Fail-Closed)
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-1: rejects POST /api/keys with wallet_address but no signature/nonce (fail-closed)', async () => {
    const res = await request(app)
      .post('/api/keys')
      .send({
        tier: 'free',
        wallet_address: walletA.address,
      });

    expect(res.status).to.equal(400);
    expect(res.body.ok).to.equal(false);
    expect(res.body.error).to.equal('wallet_signature_required');
    expect(res.body.message).to.include('cryptographic proof');

    // Verify no key was created in api_credits
    const check = await pool.query(
      `SELECT count(*) FROM api_credits WHERE lower(wallet_address) = $1`,
      [walletA.address.toLowerCase()]
    );
    expect(parseInt(check.rows[0].count, 10)).to.equal(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Anonymous key creation is preserved
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-2: preserves anonymous free key creation when wallet_address is omitted', async () => {
    const res = await request(app)
      .post('/api/keys')
      .send({
        tier: 'free',
      });

    expect(res.status).to.equal(200);
    expect(res.body.ok).to.equal(true);
    expect(res.body.api_key).to.match(/^sk_free_/);
    expect(res.body.wallet_address).to.equal(null);
    expect(res.body.daily_limit).to.equal(500);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Challenge issuance & enumeration resistance
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-3: POST /api/keys/challenge issues challenge with no account-enumeration oracle', async () => {
    // Challenge for an unknown wallet
    const resUnknown = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: walletA.address });

    expect(resUnknown.status).to.equal(200);
    expect(resUnknown.body.ok).to.equal(true);
    expect(resUnknown.body.nonce).to.match(/^[0-9a-f]{32}$/);
    expect(resUnknown.body.message).to.include(ethers.getAddress(walletA.address));
    expect(resUnknown.body.message).to.include('Chain ID: 137');
    expect(resUnknown.body.message).to.include(`Nonce: ${resUnknown.body.nonce}`);

    // Pre-insert an existing account for walletB to test oracle behavior
    await pool.query(
      `INSERT INTO api_credits (api_key, tier, daily_limit, wallet_address, status)
       VALUES ($1, 'free', 500, $2, 'active')`,
      ['sk_free_existing_' + 'b'.repeat(30), walletB.address.toLowerCase()]
    );

    // Challenge for the already-registered wallet
    const resKnown = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: walletB.address });

    expect(resKnown.status).to.equal(200);
    expect(resKnown.body.ok).to.equal(true);
    expect(resKnown.body.nonce).to.match(/^[0-9a-f]{32}$/);
    // Both responses have identical shape: status 200, ok true, nonce, message, expires_at
    expect(Object.keys(resKnown.body).sort()).to.deep.equal(Object.keys(resUnknown.body).sort());
  });

  it('s1-4: POST /api/keys/challenge rejects invalid wallet addresses', async () => {
    const resShort = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: '0x123' });
    expect(resShort.status).to.equal(400);
    expect(resShort.body.error).to.equal('invalid_wallet_address');

    const resJunk = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: 'not-an-address' });
    expect(resJunk.status).to.equal(400);
    expect(resJunk.body.error).to.equal('invalid_wallet_address');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Mismatched signature from a different wallet is rejected
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-5: rejects signature from a different wallet (signature_invalid)', async () => {
    // Obtain challenge for walletA
    const chRes = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: walletA.address });
    expect(chRes.status).to.equal(200);

    // Sign with walletB (wrong wallet)
    const badSignature = await walletB.signMessage(chRes.body.message);

    const res = await request(app)
      .post('/api/keys')
      .send({
        tier: 'free',
        wallet_address: walletA.address,
        nonce: chRes.body.nonce,
        signature: badSignature,
      });

    expect(res.status).to.equal(401);
    expect(res.body.ok).to.equal(false);
    expect(res.body.error).to.equal('signature_invalid');

    // No key created for walletA
    const check = await pool.query(
      `SELECT count(*) FROM api_credits WHERE lower(wallet_address) = $1`,
      [walletA.address.toLowerCase()]
    );
    expect(parseInt(check.rows[0].count, 10)).to.equal(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Invented or invalid nonce is rejected
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-6: rejects invented/unknown nonce with valid signature', async () => {
    const fakeNonce = '0123456789abcdef0123456789abcdef';
    const fakeMessage = buildWalletBindingMessage({
      address: walletA.address,
      nonce: fakeNonce,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    const sig = await walletA.signMessage(fakeMessage);

    const res = await request(app)
      .post('/api/keys')
      .send({
        tier: 'free',
        wallet_address: walletA.address,
        nonce: fakeNonce,
        signature: sig,
      });

    expect(res.status).to.equal(401);
    expect(res.body.error).to.equal('challenge_invalid');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Expired challenge is rejected
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-7: rejects expired challenges', async () => {
    const expiredNonce = 'aabbccddeeff00112233445566778899';
    const past = new Date(Date.now() - 60000).toISOString();
    const message = buildWalletBindingMessage({
      address: walletC.address,
      nonce: expiredNonce,
      issuedAt: new Date(Date.now() - 120000).toISOString(),
      expiresAt: past,
    });
    await pool.query(
      `INSERT INTO api_key_wallet_challenges (nonce, wallet_address, message, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [expiredNonce, walletC.address.toLowerCase(), message, past]
    );

    const sig = await walletC.signMessage(message);

    const res = await request(app)
      .post('/api/keys')
      .send({
        tier: 'free',
        wallet_address: walletC.address,
        nonce: expiredNonce,
        signature: sig,
      });

    expect(res.status).to.equal(401);
    expect(res.body.error).to.equal('challenge_expired');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Legitimate signed binding flow succeeds
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-8: legitimate wallet completes challenge-signature binding flow', async () => {
    const chRes = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: walletA.address });
    expect(chRes.status).to.equal(200);

    const sig = await walletA.signMessage(chRes.body.message);

    const res = await request(app)
      .post('/api/keys')
      .send({
        tier: 'free',
        wallet_address: walletA.address,
        nonce: chRes.body.nonce,
        signature: sig,
      });

    expect(res.status).to.equal(200);
    expect(res.body.ok).to.equal(true);
    expect(res.body.api_key).to.match(/^sk_free_/);
    expect(res.body.wallet_address).to.equal(walletA.address.toLowerCase());

    // Verify row in api_credits
    const r = await pool.query(
      `SELECT api_key, wallet_address, tier, daily_limit, credits_usdt FROM api_credits WHERE api_key = $1`,
      [res.body.api_key]
    );
    expect(r.rows.length).to.equal(1);
    expect(r.rows[0].wallet_address).to.equal(walletA.address.toLowerCase());
    expect(parseFloat(r.rows[0].credits_usdt)).to.equal(0);

    // Verify challenge consumed
    const ch = await pool.query(
      `SELECT consumed_at FROM api_key_wallet_challenges WHERE nonce = $1`,
      [chRes.body.nonce]
    );
    expect(ch.rows[0].consumed_at).to.not.be.null;

    // ──────────────────────────────────────────────────────────────────────────
    // 8. Replay attack with same challenge is rejected
    // ──────────────────────────────────────────────────────────────────────────
    const replayRes = await request(app)
      .post('/api/keys')
      .send({
        tier: 'free',
        wallet_address: walletA.address,
        nonce: chRes.body.nonce,
        signature: sig,
      });

    expect(replayRes.status).to.equal(401);
    expect(replayRes.body.error).to.equal('challenge_invalid');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Duplicate wallet association rejected (one account per wallet)
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-9: rejects second key registration for an already-associated wallet (wallet_already_registered)', async () => {
    // walletA is already registered above. Request a fresh challenge:
    const chRes = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: walletA.address });
    expect(chRes.status).to.equal(200);

    const freshSig = await walletA.signMessage(chRes.body.message);

    const res = await request(app)
      .post('/api/keys')
      .send({
        tier: 'free',
        wallet_address: walletA.address,
        nonce: chRes.body.nonce,
        signature: freshSig,
      });

    expect(res.status).to.equal(409);
    expect(res.body.ok).to.equal(false);
    expect(res.body.error).to.equal('wallet_already_registered');

    // Still exactly one key for walletA
    const count = await pool.query(
      `SELECT count(*) FROM api_credits WHERE lower(wallet_address) = $1`,
      [walletA.address.toLowerCase()]
    );
    expect(parseInt(count.rows[0].count, 10)).to.equal(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 10. Concurrent requests cannot reuse a challenge (single-use atomicity)
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-10: concurrent requests with the same challenge nonce atomically serialize (exactly one succeeds)', async () => {
    const chRes = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: walletD.address });
    expect(chRes.status).to.equal(200);

    const sig = await walletD.signMessage(chRes.body.message);

    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/keys')
        .send({
          tier: 'free',
          wallet_address: walletD.address,
          nonce: chRes.body.nonce,
          signature: sig,
        }),
      request(app)
        .post('/api/keys')
        .send({
          tier: 'free',
          wallet_address: walletD.address,
          nonce: chRes.body.nonce,
          signature: sig,
        }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).to.deep.equal([200, 401]);

    // Exactly one key created
    const count = await pool.query(
      `SELECT count(*) FROM api_credits WHERE lower(wallet_address) = $1`,
      [walletD.address.toLowerCase()]
    );
    expect(parseInt(count.rows[0].count, 10)).to.equal(1);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 11. Binding a wallet to an existing API key requires proof
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-11: POST /api/keys/bind requires verified challenge signature', async () => {
    // 1. Create an unbound anonymous key
    const createRes = await request(app)
      .post('/api/keys')
      .send({ tier: 'free' });
    const key = createRes.body.api_key;

    // 2. Unsigned bind attempt fails
    const unsignedRes = await request(app)
      .post('/api/keys/bind')
      .set('X-API-Key', key)
      .send({ wallet_address: walletE.address });
    expect(unsignedRes.status).to.equal(400);
    expect(unsignedRes.body.error).to.equal('wallet_signature_required');

    // 3. Legitimate signed bind succeeds
    const chRes = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: walletE.address });
    const sig = await walletE.signMessage(chRes.body.message);

    const bindRes = await request(app)
      .post('/api/keys/bind')
      .set('X-API-Key', key)
      .send({
        wallet_address: walletE.address,
        nonce: chRes.body.nonce,
        signature: sig,
      });
    expect(bindRes.status).to.equal(200);
    expect(bindRes.body.ok).to.equal(true);
    expect(bindRes.body.wallet_address).to.equal(walletE.address.toLowerCase());

    // Key in DB now has wallet_address
    const r = await pool.query(`SELECT wallet_address FROM api_credits WHERE api_key = $1`, [key]);
    expect(r.rows[0].wallet_address).to.equal(walletE.address.toLowerCase());

    // 4. Cannot re-bind an already-bound key
    const chRes2 = await request(app)
      .post('/api/keys/challenge')
      .send({ wallet_address: walletF.address });
    const sig2 = await walletF.signMessage(chRes2.body.message);

    const rebindRes = await request(app)
      .post('/api/keys/bind')
      .set('X-API-Key', key)
      .send({
        wallet_address: walletF.address,
        nonce: chRes2.body.nonce,
        signature: sig2,
      });
    expect(rebindRes.status).to.equal(409);
    expect(rebindRes.body.error).to.equal('key_already_has_wallet');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Zero-state verification
  // ──────────────────────────────────────────────────────────────────────────
  it('s1-12: failed adversarial attempts created 0 keys, associations, or credits for walletF', async () => {
    // Attempt invalid wallet binding for walletF with no signature
    await request(app).post('/api/keys').send({ wallet_address: walletF.address });

    // Attempt with invalid signature
    const ch = await request(app).post('/api/keys/challenge').send({ wallet_address: walletF.address });
    await request(app).post('/api/keys').send({
      wallet_address: walletF.address,
      nonce: ch.body.nonce,
      signature: '0x' + '0'.repeat(130),
    });

    // Assert: zero rows in api_credits, zero deposits
    const credits = await pool.query(
      `SELECT count(*) FROM api_credits WHERE lower(wallet_address) = $1`,
      [walletF.address.toLowerCase()]
    );
    expect(parseInt(credits.rows[0].count, 10)).to.equal(0);

    const deposits = await pool.query(
      `SELECT count(*) FROM api_deposits WHERE lower(from_address) = $1`,
      [walletF.address.toLowerCase()]
    );
    expect(parseInt(deposits.rows[0].count, 10)).to.equal(0);
  });
});
