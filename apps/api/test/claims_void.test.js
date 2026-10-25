// Staff "void claim" (Step 4.4, 2026-10-21). A pending claim blocks new signatures for its
// node/wallet (one signature per balance). Voiding releases its reserved earnings — only when
// the chain proves the signature can never be redeemed: expired by chain time AND nonce unused.
// Real SQL (production table shapes); chain reads injected; throwaway signer key.
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { ethers } from 'ethers';

describe('claims: staff void (real SQL, chain injected)', function () {
  this.timeout(30000);
  const url = process.env.DATABASE_URL || '';
  const schema = `cvoid_test_${process.pid}_${Date.now()}`;
  const WALLET = '0x000000000000000000000000000000000000dEaD';
  const STAFF = 'test-only-admin-token-void';
  const saved = {};
  let pg, admin, pool, mod;

  before(async function () {
    if (!/@?(localhost|127\.0\.0\.1)(:|\/|\?)/.test(url) && !/host=\/tmp/.test(url)) this.skip();
    ({ default: pg } = await import('pg'));
    admin = new pg.Client({ connectionString: url });
    try { await admin.connect(); } catch { admin = null; this.skip(); }
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`CREATE TABLE ${schema}.epoch_earnings (epoch_id INTEGER NOT NULL, role TEXT NOT NULL, wallet_or_node_id TEXT NOT NULL,
      amount_usdt NUMERIC(18,8) NOT NULL, status TEXT NOT NULL DEFAULT 'UNPAID', created_at BIGINT NOT NULL, PRIMARY KEY (epoch_id, role, wallet_or_node_id))`);
    await admin.query(`CREATE TABLE ${schema}.claims (claim_id TEXT PRIMARY KEY, node_id TEXT NOT NULL, wallet TEXT NOT NULL, amount_usdt NUMERIC(18,8) NOT NULL,
      signature TEXT NOT NULL, nonce BIGINT NOT NULL, expiry BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', tx_hash TEXT,
      created_at BIGINT NOT NULL, updated_at BIGINT, claimed_at BIGINT)`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 4 });
    for (const k of ['SETTLEMENT_DRY_RUN', 'SETTLEMENT_EVM_SIGNER_PRIVATE_KEY', 'CLAIMS_CONTRACT_ADDRESS', 'ADMIN_SECRET_TOKEN', 'POLYGON_RPC_URL']) saved[k] = process.env[k];
    process.env.SETTLEMENT_DRY_RUN = '0';
    process.env.SETTLEMENT_EVM_SIGNER_PRIVATE_KEY = ethers.Wallet.createRandom().privateKey;
    process.env.CLAIMS_CONTRACT_ADDRESS = '0x000000000000000000000000000000000000c1a1';
    process.env.ADMIN_SECRET_TOKEN = STAFF;
    delete process.env.POLYGON_RPC_URL;
    mod = await import('../src/services/claims/claim_processor.js');
  });
  after(async () => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await pool?.end().catch(() => {});
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {}); await admin.end(); }
  });

  let claimId, expiry, nonce;
  beforeEach(async () => {
    await pool.query(`DELETE FROM epoch_earnings`); await pool.query(`DELETE FROM claims`);
    await pool.query(`INSERT INTO epoch_earnings VALUES (1, 'node_operator', 'node-a', 2.5, 'UNPAID', 0)`);
    const c = await mod.generateClaimSignature('node-a', WALLET, pool); // reserves -> CLAIMING
    ({ claimId, expiry, nonce } = c);
  });
  const chain = ({ now, used = false, fail = false, contract = process.env.CLAIMS_CONTRACT_ADDRESS } = {}) => ({
    contract,
    async read(n) { if (fail) throw new Error('rpc down'); expect(String(n)).to.equal(String(nonce)); return { chainTime: now, used }; },
  });
  const statuses = async () => (await pool.query(`SELECT string_agg(status, ',') s FROM epoch_earnings`)).rows[0].s;

  it('expired by chain time + nonce unused → voided, reserved earnings back to UNPAID, new claim signable', async () => {
    const r = await mod.voidClaim(claimId, pool, { chain: chain({ now: expiry + 1 }) });
    expect(r).to.include({ ok: true, released: '2.500000' }); // 6 dp, like the signed amount
    expect(await statuses()).to.equal('UNPAID');
    expect((await pool.query(`SELECT status FROM claims WHERE claim_id = $1`, [claimId])).rows[0].status).to.equal('void');
    const again = await mod.generateClaimSignature('node-a', WALLET, pool);
    expect(again.amount).to.equal(2.5);
  });

  it('not yet expired on chain → 409, nothing released (a live signature could still be redeemed)', async () => {
    const r = await mod.voidClaim(claimId, pool, { chain: chain({ now: expiry - 1 }) });
    expect(r).to.deep.equal({ ok: false, http: 409, error: 'claim_not_expired' });
    expect(await statuses()).to.equal('CLAIMING');
  });

  it('nonce already used on chain → 409 claim_redeemed_on_chain, nothing released', async () => {
    const r = await mod.voidClaim(claimId, pool, { chain: chain({ now: expiry + 1, used: true }) });
    expect(r.error).to.equal('claim_redeemed_on_chain');
    expect(await statuses()).to.equal('CLAIMING');
  });

  it('chain unavailable → 503 (fail closed), nothing released', async () => {
    const r = await mod.voidClaim(claimId, pool, { chain: chain({ fail: true }) });
    expect(r).to.deep.equal({ ok: false, http: 503, error: 'chain_unavailable' });
    expect(await statuses()).to.equal('CLAIMING');
  });

  it('unknown or non-pending claims are refused', async () => {
    expect((await mod.voidClaim('nope', pool, { chain: chain({ now: expiry + 1 }) })).http).to.equal(404);
    await mod.voidClaim(claimId, pool, { chain: chain({ now: expiry + 1 }) });
    const second = await mod.voidClaim(claimId, pool, { chain: chain({ now: expiry + 1 }) });
    expect(second).to.deep.equal({ ok: false, http: 409, error: 'claim_void' });
  });

  it('route: non-staff 401; staff with no RPC configured → 503 (fail closed)', async () => {
    const { createClaimsRouter } = await import('../src/routes/claims_route.mjs');
    const a = express(); a.use(express.json()); a.use('/api/nodes', createClaimsRouter(pool));
    expect((await request(a).post(`/api/nodes/admin/claims/${claimId}/void`)).status).to.equal(401);
    const res = await request(a).post(`/api/nodes/admin/claims/${claimId}/void`).set('x-admin-token', STAFF);
    expect(res.status).to.equal(503);
    expect(res.body.error).to.equal('chain_unavailable');
    expect(await statuses()).to.equal('CLAIMING');
  });

  it('releases only what THIS claim reserved: extra CLAIMING rows (another claim) → 409, nothing released', async () => {
    await pool.query(`INSERT INTO epoch_earnings VALUES (2, 'node_operator', 'node-a', 9, 'CLAIMING', 0)`); // legacy reservation
    const r = await mod.voidClaim(claimId, pool, { chain: chain({ now: expiry + 1 }) });
    expect(r).to.deep.equal({ ok: false, http: 409, error: 'reservation_mismatch' });
    expect(await statuses()).to.equal('CLAIMING,CLAIMING');
    expect((await pool.query(`SELECT status FROM claims WHERE claim_id = $1`, [claimId])).rows[0].status).to.equal('pending');
  });

  it('a claim signed for another contract cannot be voided by checking the current one (409)', async () => {
    const r = await mod.voidClaim(claimId, pool, { chain: chain({ now: expiry + 1, contract: '0x000000000000000000000000000000000000beef' }) });
    expect(r).to.deep.equal({ ok: false, http: 409, error: 'claim_signed_for_other_contract' });
    expect(await statuses()).to.equal('CLAIMING');
  });
});
