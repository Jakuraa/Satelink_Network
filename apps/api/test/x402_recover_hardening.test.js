// POST /v1/x402/key/recover[/challenge] — abuse hardening (2026-10-13).
//
// The challenge endpoint used to answer 404 no_account for unknown wallets and
// 200 + nonce for known ones: an account-enumeration oracle (it is how an
// api_credits row bound to 0x…dEaD was discovered). These tests pin:
//
// r1  challenge: known and unknown wallets get byte-identical responses
//     (modulo nonce, timestamps and the checksummed address)
// r2  recover without the wallet's signature: identical status + body for
//     known and unknown wallets
// r3  the owner of an unknown wallet (valid signature) learns no_account — and
//     only they can reach that branch
// r4  pending challenges per address are capped; at the cap the newest pending
//     challenge is returned again and stays usable by the real owner
// r5  per-address rate limit: 429 across rotating IPs, other addresses unaffected
// r6  per-IP rate limit: 429 across rotating addresses
// r7  expired challenges are deleted on the next challenge; live ones are kept
//
// Real Postgres, every write inside an outer transaction that is rolled back.
// NEVER point this at production: the suite refuses a Railway host.

import 'dotenv/config';
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { ethers } from 'ethers';

describe('x402 key recovery hardening (no enumeration, abuse bounds)', function () {
  this.timeout(30000);

  let raw; let db; let connected = false; let rec;
  const known = ethers.Wallet.createRandom();
  const unknown = ethers.Wallet.createRandom();
  const noLimit = (q, s, n) => n();

  before(async function () {
    const url = process.env.DATABASE_URL || '';
    if (!url || /rlwy\.net|railway\.app|railway\.internal/.test(url)) this.skip();
    rec = await import('../src/payments/x402/key_recovery_router.js');
    const keys = await import('../src/billing/x402_session_keys.js');
    const { default: pg } = await import('pg');
    raw = new pg.Client({ connectionString: url });
    try { await raw.connect(); connected = true; } catch { this.skip(); }
    await raw.query('BEGIN');
    let sp = 0;
    const client = {
      query(sql, params) {
        if (sql === 'BEGIN') { sp++; return raw.query(`SAVEPOINT rh_sp_${sp}`); }
        if (sql === 'COMMIT') return raw.query(`RELEASE SAVEPOINT rh_sp_${sp}`);
        if (sql === 'ROLLBACK') return raw.query(`ROLLBACK TO SAVEPOINT rh_sp_${sp}`);
        return raw.query(sql, params);
      },
      release() {},
    };
    db = { connect: async () => client, query: (sql, params) => raw.query(sql, params) };
    await keys.ensureX402KeySchema(db);
    await raw.query(
      `INSERT INTO api_credits (api_key, tier, daily_limit, wallet_address, credits_usdt)
       VALUES ($1, 'x402', 1000, $2, 0.03)`,
      [`x402_${known.address.toLowerCase()}`, known.address.toLowerCase()]
    );
  });

  after(async () => {
    if (raw && connected) { await raw.query('ROLLBACK'); await raw.end(); }
  });

  const silent = { info() {}, warn() {}, error() {}, log() {} };
  function appWith(opts = {}) {
    const app = express();
    app.set('trust proxy', true); // lets tests vary the client IP via X-Forwarded-For
    app.use('/v1/x402/key', rec.createX402KeyRecoveryRouter(db, { log: silent, limiter: noLimit, addressLimiter: noLimit, ...opts }));
    return app;
  }
  const challenge = (app, address, ip = '10.0.0.1') =>
    request(app).post('/v1/x402/key/recover/challenge').set('X-Forwarded-For', ip).send({ address });

  // Remove the per-request values so two responses can be compared exactly.
  function normalise(body, address) {
    const b = JSON.parse(JSON.stringify(body));
    const cs = ethers.getAddress(address);
    if (b.nonce) b.nonce = '<nonce>';
    if (b.expires_at) b.expires_at = '<ts>';
    if (b.message) {
      b.message = b.message.split(cs).join('<addr>')
        .replace(/Nonce: [0-9a-f]+/, 'Nonce: <nonce>')
        .replace(/Issued At: \S+/, 'Issued At: <ts>')
        .replace(/Expiration Time: \S+/, 'Expiration Time: <ts>');
    }
    return b;
  }

  it('r1: challenge responses for known and unknown wallets are identical', async () => {
    const app = appWith();
    const a = await challenge(app, known.address);
    const b = await challenge(app, unknown.address);
    expect(a.status).to.equal(200);
    expect(b.status).to.equal(a.status);
    expect(Object.keys(b.headers).filter((h) => !/date|etag|content-length/.test(h)).sort())
      .to.deep.equal(Object.keys(a.headers).filter((h) => !/date|etag|content-length/.test(h)).sort());
    expect(normalise(b.body, unknown.address)).to.deep.equal(normalise(a.body, known.address));
  });

  it('r2: recover without the wallet signature is identical for known and unknown wallets', async () => {
    const app = appWith();
    const attacker = ethers.Wallet.createRandom();
    const results = [];
    for (const w of [known, unknown]) {
      const c = await challenge(app, w.address);
      const signature = await attacker.signMessage(c.body.message);
      const r = await request(app).post('/v1/x402/key/recover').send({ address: w.address, nonce: c.body.nonce, signature });
      results.push({ status: r.status, body: r.body });
      // invented nonce
      const r2 = await request(app).post('/v1/x402/key/recover').send({ address: w.address, nonce: 'b'.repeat(32), signature });
      results.push({ status: r2.status, body: r2.body });
    }
    expect(results[0]).to.deep.equal(results[2]);
    expect(results[1]).to.deep.equal(results[3]);
    expect(results[0].status).to.equal(401);
  });

  it('r3: only the controller of an unknown wallet learns it has no account', async () => {
    const app = appWith();
    const c = await challenge(app, unknown.address);
    const signature = await unknown.signMessage(c.body.message);
    const r = await request(app).post('/v1/x402/key/recover').send({ address: unknown.address, nonce: c.body.nonce, signature });
    expect(r.status).to.equal(404);
    expect(r.body.error).to.equal('no_account');
    expect(r.body.api_key).to.equal(undefined);
  });

  it('r4: pending challenges per address are capped; the re-served challenge still works for the owner', async () => {
    const app = appWith();
    const w = ethers.Wallet.createRandom();
    await raw.query(
      `INSERT INTO api_credits (api_key, tier, daily_limit, wallet_address, credits_usdt) VALUES ($1, 'x402', 1000, $2, 0.03)`,
      [`x402_${w.address.toLowerCase()}`, w.address.toLowerCase()]
    );
    const nonces = [];
    for (let i = 0; i < rec.MAX_PENDING_PER_ADDRESS + 4; i++) {
      const c = await challenge(app, w.address);
      expect(c.status).to.equal(200);
      nonces.push(c.body.nonce);
    }
    const pending = await raw.query(
      `SELECT count(*)::int n FROM x402_key_recovery_nonces WHERE payer_address=$1 AND consumed_at IS NULL AND expires_at > NOW()`,
      [w.address.toLowerCase()]
    );
    expect(pending.rows[0].n).to.equal(rec.MAX_PENDING_PER_ADDRESS);
    expect(new Set(nonces).size).to.equal(rec.MAX_PENDING_PER_ADDRESS);

    const last = await challenge(app, w.address);
    const signature = await w.signMessage(last.body.message);
    const r = await request(app).post('/v1/x402/key/recover').send({ address: w.address, nonce: last.body.nonce, signature });
    expect(r.status).to.equal(200);
    expect(r.body.api_key).to.match(/^x402_[0-9a-f]{64}$/);
  });

  it('r5: per-address rate limit holds across rotating IPs and does not touch other addresses', async () => {
    const app = appWith({ addressLimiter: undefined, rateLimits: { ip: { windowMs: 60000, max: 1000 }, address: { windowMs: 60000, max: 3 } } });
    const target = ethers.Wallet.createRandom().address;
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await challenge(app, target, `10.1.0.${i + 1}`)).status);
    expect(statuses.slice(0, 3)).to.deep.equal([200, 200, 200]);
    expect(statuses.slice(3)).to.deep.equal([429, 429]);
    // recover shares the per-address bucket
    const rr = await request(app).post('/v1/x402/key/recover').set('X-Forwarded-For', '10.1.0.9')
      .send({ address: target, nonce: 'c'.repeat(32), signature: '0x' + '1'.repeat(130) });
    expect(rr.status).to.equal(429);
    expect((await challenge(app, ethers.Wallet.createRandom().address, '10.1.0.1')).status).to.equal(200);
  });

  it('r6: per-IP rate limit holds across rotating addresses', async () => {
    const app = appWith({ limiter: undefined, addressLimiter: undefined, rateLimits: { ip: { windowMs: 60000, max: 3 }, address: { windowMs: 60000, max: 1000 } } });
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await challenge(app, ethers.Wallet.createRandom().address, '10.2.0.1')).status);
    expect(statuses).to.deep.equal([200, 200, 200, 429, 429]);
    expect((await challenge(app, ethers.Wallet.createRandom().address, '10.2.0.2')).status).to.equal(200);
  });

  it('r7: expired challenges are deleted on the next challenge; live ones are kept', async () => {
    const app = appWith();
    const w = ethers.Wallet.createRandom();
    const c1 = await challenge(app, w.address);
    const c2 = await challenge(app, w.address);
    await raw.query(`UPDATE x402_key_recovery_nonces SET expires_at = NOW() - INTERVAL '1 second' WHERE nonce = $1`, [c1.body.nonce]);
    await challenge(app, ethers.Wallet.createRandom().address); // any challenge triggers cleanup
    const rows = await raw.query(`SELECT nonce FROM x402_key_recovery_nonces WHERE nonce = ANY($1)`, [[c1.body.nonce, c2.body.nonce]]);
    expect(rows.rows.map((r) => r.nonce)).to.deep.equal([c2.body.nonce]);
    expect(await rec.cleanupExpiredChallenges(db)).to.be.a('number');
  });
});
