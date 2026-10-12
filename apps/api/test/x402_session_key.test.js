// x402 session keys — security regression suite (2026-10-12, supersedes PR #521).
//
// PR #521 made `x402_<payer address>` a bearer credential. The payer address is
// public on Base, so anyone reading the settlement tx could spend that payer's
// prepaid calls. These tests pin the replacement:
//
// k1  a guessed `x402_<address>` (the public account id) is rejected everywhere
// k2  settlement issues x402_<64 hex>; only its SHA-256 is stored
// k3  the issued key serves ≥5 calls through x402 mw → free-tier gate → meter,
//     no new 402, balance debited exactly 5 × price
// k4  replayed settlement: 409, no second credit, no second key
// k5  recover requires a fresh challenge signed by the payer wallet
//     (wrong signer 401, reused nonce 401, valid → new key works, old revoked)
// k6  the plaintext key never reaches any log sink (settle path + recover path)
//
// Real Postgres, every write inside an outer transaction that is rolled back.
// NEVER point this at production: the suite refuses a Railway host.

import 'dotenv/config';
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { ethers } from 'ethers';

const PRICE = 0.00003;
const BUNDLE = 1000;

describe('x402 session keys (secure reuse credential)', function () {
  this.timeout(30000);

  let raw; let db; let connected = false;
  let mod; let credit; let mw; let gateMod; let recoveryMod;
  const payer = ethers.Wallet.createRandom();
  const stranger = ethers.Wallet.createRandom();
  const payerAddr = payer.address.toLowerCase();

  // Every log line from every sink, so k6 can assert the key never appears.
  const logged = [];
  const capture = (...a) => logged.push(a.map(String).join(' '));
  const logger = { info: capture, warn: capture, error: capture, log: capture };
  const origConsole = {};

  before(async function () {
    const url = process.env.DATABASE_URL || '';
    if (!url || /rlwy\.net|railway\.app|railway\.internal/.test(url)) this.skip();
    process.env.FREE_TIER_DAILY_LIMIT = '2';
    process.env.FREE_TIER_ANON_CALLS = '0';
    mod = await import('../src/billing/x402_session_keys.js');
    credit = await import('../src/billing/credit_service.mjs');
    mw = await import('../src/payments/x402/middleware.js');
    gateMod = await import('../src/middleware/free_tier_gate.js');
    recoveryMod = await import('../src/payments/x402/key_recovery_router.js');
    const { default: pg } = await import('pg');
    raw = new pg.Client({ connectionString: url });
    try { await raw.connect(); connected = true; } catch { this.skip(); }
    await raw.query('BEGIN');
    let sp = 0;
    const client = {
      query(sql, params) {
        if (sql === 'BEGIN') { sp++; return raw.query(`SAVEPOINT sk_sp_${sp}`); }
        if (sql === 'COMMIT') return raw.query(`RELEASE SAVEPOINT sk_sp_${sp}`);
        if (sql === 'ROLLBACK') return raw.query(`ROLLBACK TO SAVEPOINT sk_sp_${sp}`);
        return raw.query(sql, params);
      },
      release() {},
    };
    db = { connect: async () => client, query: (sql, params) => raw.query(sql, params) };
    mod._resetSchemaCache();
    for (const k of ['log', 'info', 'warn', 'error']) { origConsole[k] = console[k]; console[k] = capture; }
  });

  after(async () => {
    for (const k of Object.keys(origConsole)) console[k] = origConsole[k];
    if (mod) mod._resetSchemaCache();
    if (raw && connected) { await raw.query('ROLLBACK'); await raw.end(); }
  });

  // Fake facilitator: verifies + settles one payment from `payer` with `tx`.
  function fakeServer(tx) {
    return {
      initialize: async () => {},
      processHTTPRequest: async () => ({ type: 'payment-verified', paymentPayload: {}, paymentRequirements: {} }),
      processSettlement: async () => ({ success: true, transaction: tx, payer: payer.address, network: 'eip155:8453', headers: {} }),
    };
  }

  function makeReq(headers, ip) {
    return {
      headers, method: 'POST', originalUrl: '/rpc/polygon', url: '/rpc/polygon', path: '/rpc/polygon',
      query: {}, protocol: 'https', body: { jsonrpc: '2.0', method: 'eth_blockNumber', id: 1 },
      socket: { remoteAddress: ip },
      header(n) { return this.headers[n.toLowerCase()]; },
    };
  }

  // x402 middleware → free-tier gate → (gateway billing: precheck + meter).
  async function rpcCall(middleware, gate, headers, ip) {
    const req = makeReq(headers, ip);
    const out = await new Promise((resolve) => {
      const res = {
        statusCode: 200, headers: {},
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, getHeaders() { return this.headers; },
        set(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
        status(c) { this.statusCode = c; return this; },
        json(b) { resolve({ served: false, status: this.statusCode, body: b, headers: this.headers }); return this; },
        send(b) { resolve({ served: false, status: this.statusCode, body: b, headers: this.headers }); return this; },
      };
      Promise.resolve(middleware(req, res, () => gate(req, res, () => resolve({ served: true, headers: res.headers, req }))))
        .catch((e) => resolve({ error: e }));
    });
    if (out.error) throw out.error;
    if (!out.served) return out;
    const apiKey = req.headers['x-api-key'];
    const wallet = req.x402?.settled ? req.x402.wallet : null;
    const pre = await credit.precheckCharge(db, { apiKey, wallet });
    if (!pre.ok) return { served: false, status: pre.http, body: pre, headers: out.headers };
    const charge = await credit.authorizeAndMeter(db, { apiKey, wallet });
    return { served: charge.ok, status: charge.ok ? 200 : charge.http, body: charge, headers: out.headers };
  }

  let issuedKey;

  it('k2: settlement issues a random x402_<64 hex> key and stores only its hash', async () => {
    process.env.X402_ENABLED = 'true';
    const m = mw.createX402Middleware(db, logger, { httpServer: fakeServer('0xsk_settle_1') });
    const gate = gateMod.createFreeTierGate(logger, null);
    const paid = await rpcCall(m, gate, { 'x-payment': Buffer.from(JSON.stringify({ x402Version: 2 })).toString('base64') }, '10.40.0.1');
    expect(paid.served).to.equal(true);
    issuedKey = paid.headers['x-satelink-api-key'];
    expect(issuedKey).to.match(/^x402_[0-9a-f]{64}$/);
    expect(paid.headers['x-api-key']).to.equal(issuedKey);
    expect(issuedKey).to.not.equal(`x402_${payerAddr}`);

    const rows = await raw.query(`SELECT key_hash, account_api_key, payer_address, issued_via FROM x402_api_keys WHERE payer_address = $1`, [payerAddr]);
    expect(rows.rows).to.have.length(1);
    expect(rows.rows[0].key_hash).to.equal(mod.hashSessionKey(issuedKey));
    expect(rows.rows[0].issued_via).to.equal('settlement');
    // the plaintext is stored nowhere
    const leak = await raw.query(
      `SELECT (SELECT count(*) FROM x402_api_keys WHERE key_hash = $1 OR account_api_key = $1)
            + (SELECT count(*) FROM api_credits WHERE api_key = $1)
            + (SELECT count(*) FROM payment_sources WHERE credited_api_key = $1) AS n`, [issuedKey]);
    expect(Number(leak.rows[0].n)).to.equal(0);
  });

  it('k1: a guessed x402_<payer address> is rejected (resolve, precheck, meter, gateway chain)', async () => {
    const guessed = `x402_${payerAddr}`;
    // the account with that id exists and is funded — and still is not reachable
    const acct = await raw.query(`SELECT credits_usdt FROM api_credits WHERE api_key = $1`, [guessed]);
    expect(parseFloat(acct.rows[0].credits_usdt)).to.be.greaterThan(0);
    expect(mod.isX402SessionKey(guessed)).to.equal(false);
    expect(await credit.resolveAccount(db, { apiKey: guessed })).to.equal(null);
    expect(await credit.resolveAccount(db, { apiKey: `x402_${'0'.repeat(64)}` })).to.equal(null);
    const meter = await credit.authorizeAndMeter(db, { apiKey: guessed });
    expect(meter.ok).to.equal(false);
    expect(meter.code).to.equal('account_not_found');
    const m = mw.createX402Middleware(db, logger, { httpServer: fakeServer('0xunused') });
    const out = await rpcCall(m, gateMod.createFreeTierGate(logger, null), { 'x-api-key': guessed }, '10.41.0.1');
    expect(out.served).to.equal(false);
    const after = await raw.query(`SELECT credits_usdt FROM api_credits WHERE api_key = $1`, [guessed]);
    expect(after.rows[0].credits_usdt).to.equal(acct.rows[0].credits_usdt); // nothing debited
  });

  it('k3: the issued key serves ≥5 calls with no new 402, debiting exactly 5 × price', async () => {
    const id = `x402_${payerAddr}`;
    const before = parseFloat((await raw.query(`SELECT credits_usdt FROM api_credits WHERE api_key=$1`, [id])).rows[0].credits_usdt);
    const m = mw.createX402Middleware(db, logger, { httpServer: fakeServer('0xunused') });
    const gate = gateMod.createFreeTierGate(logger, null);
    for (let i = 0; i < 5; i++) {
      const out = await rpcCall(m, gate, { 'x-api-key': issuedKey }, '10.42.0.1');
      expect(out.status, `call ${i + 1}`).to.not.equal(402);
      expect(out.served, `call ${i + 1}`).to.equal(true);
    }
    const afterBal = parseFloat((await raw.query(`SELECT credits_usdt FROM api_credits WHERE api_key=$1`, [id])).rows[0].credits_usdt);
    expect(before - afterBal).to.be.closeTo(5 * PRICE, 1e-9);
  });

  it('k4: a replayed settlement is rejected with no second credit and no second key', async () => {
    const id = `x402_${payerAddr}`;
    const bal = (await raw.query(`SELECT credits_usdt FROM api_credits WHERE api_key=$1`, [id])).rows[0].credits_usdt;
    const m = mw.createX402Middleware(db, logger, { httpServer: fakeServer('0xsk_settle_1') }); // same tx as k2
    const out = await rpcCall(m, gateMod.createFreeTierGate(logger, null), { 'x-payment': Buffer.from(JSON.stringify({ x402Version: 2 })).toString('base64') }, '10.43.0.1');
    expect(out.status).to.equal(409);
    expect(out.headers['x-satelink-api-key']).to.equal(undefined);
    const keys = await raw.query(`SELECT count(*)::int AS n FROM x402_api_keys WHERE payer_address=$1`, [payerAddr]);
    expect(keys.rows[0].n).to.equal(1);
    const deps = await raw.query(`SELECT count(*)::int AS n FROM api_deposits WHERE tx_hash='0xsk_settle_1'`);
    expect(deps.rows[0].n).to.equal(1);
    expect((await raw.query(`SELECT credits_usdt FROM api_credits WHERE api_key=$1`, [id])).rows[0].credits_usdt).to.equal(bal);
  });

  it('k7: a settlement that fails mid-transaction leaves no key and no credit', async () => {
    const { recordX402Settlement } = await import('../src/payments/x402/settlement.js');
    const p2 = ethers.Wallet.createRandom().address;
    const failing = {
      query: db.query,
      connect: async () => {
        const c = await db.connect();
        return { ...c, query(sql, params) {
          if (/INSERT INTO payment_sources/.test(sql)) return Promise.reject(new Error('boom'));
          return c.query(sql, params);
        } };
      },
    };
    let threw = false;
    try { await recordX402Settlement(failing, { txHash: '0xsk_fail', payer: p2, network: 'eip155:8453', amountUsd: '0.10', bundleCalls: BUNDLE }); } catch { threw = true; }
    expect(threw).to.equal(true);
    const k = await raw.query(`SELECT count(*)::int n FROM x402_api_keys WHERE payer_address=$1`, [p2.toLowerCase()]);
    const a = await raw.query(`SELECT count(*)::int n FROM api_credits WHERE lower(wallet_address)=$1`, [p2.toLowerCase()]);
    expect(k.rows[0].n).to.equal(0);
    expect(a.rows[0].n).to.equal(0);
  });

  describe('k5: POST /v1/x402/key/recover', () => {
    let app;
    before(() => {
      app = express();
      app.use('/v1/x402/key', recoveryMod.createX402KeyRecoveryRouter(db, { log: logger, limiter: (q, s, n) => n() }));
    });

    async function challenge(address) {
      const r = await request(app).post('/v1/x402/key/recover/challenge').send({ address });
      return r;
    }

    it('rejects a signature from any wallet other than the payer', async () => {
      const c = await challenge(payer.address);
      expect(c.status).to.equal(200);
      const signature = await stranger.signMessage(c.body.message);
      const r = await request(app).post('/v1/x402/key/recover').send({ address: payer.address, nonce: c.body.nonce, signature });
      expect(r.status).to.equal(401);
      expect(r.body.error).to.equal('signature_invalid');
      expect(r.body.api_key).to.equal(undefined);
    });

    it('rejects a missing/invented challenge and a wallet with no account', async () => {
      const signature = await payer.signMessage('anything');
      const r = await request(app).post('/v1/x402/key/recover').send({ address: payer.address, nonce: 'a'.repeat(32), signature });
      expect(r.status).to.equal(401);
      const none = await challenge(stranger.address);
      expect(none.status).to.equal(404);
    });

    it('rejects malformed input (400) and an expired challenge (401)', async () => {
      const bad = await request(app).post('/v1/x402/key/recover').send({ address: 'nope', nonce: 'x', signature: '0x' });
      expect(bad.status).to.equal(400);
      const c = await challenge(payer.address);
      await raw.query(`UPDATE x402_key_recovery_nonces SET expires_at = NOW() - INTERVAL '1 second' WHERE nonce = $1`, [c.body.nonce]);
      const signature = await payer.signMessage(c.body.message);
      const r = await request(app).post('/v1/x402/key/recover').send({ address: payer.address, nonce: c.body.nonce, signature });
      expect(r.status).to.equal(401);
      expect(r.body.api_key).to.equal(undefined);
    });

    it('a valid payer signature issues a new working key once and revokes the old one; nonce is single-use', async () => {
      const c = await challenge(payer.address);
      const signature = await payer.signMessage(c.body.message);
      const r = await request(app).post('/v1/x402/key/recover').send({ address: payer.address, nonce: c.body.nonce, signature });
      expect(r.status).to.equal(200);
      const fresh = r.body.api_key;
      expect(fresh).to.match(/^x402_[0-9a-f]{64}$/);
      expect(fresh).to.not.equal(issuedKey);
      expect(r.headers['x-satelink-api-key']).to.equal(fresh);
      expect(r.headers['cache-control']).to.equal('no-store');

      expect((await credit.resolveAccount(db, { apiKey: fresh }))?.api_key).to.equal(`x402_${payerAddr}`);
      expect(await credit.resolveAccount(db, { apiKey: issuedKey })).to.equal(null); // revoked

      const replay = await request(app).post('/v1/x402/key/recover').send({ address: payer.address, nonce: c.body.nonce, signature });
      expect(replay.status).to.equal(401);
      expect(replay.body.api_key).to.equal(undefined);
      issuedKey = fresh;
    });
  });

  describe('k6 (runs after k5)', () => it('k6: no issued key ever reached a log sink', async () => {
    const all = await raw.query(`SELECT key_hash FROM x402_api_keys WHERE payer_address=$1`, [payerAddr]);
    expect(all.rows.length).to.be.greaterThan(1);
    expect(logged.length).to.be.greaterThan(0); // the sinks were actually exercised
    const keyRe = /x402_[0-9a-f]{64}/;
    for (const line of logged) expect(keyRe.test(line), line).to.equal(false);
  }));
});
