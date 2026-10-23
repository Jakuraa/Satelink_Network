import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import { createClaimsRouter } from '../src/routes/claims_route.mjs';
import { generateClaimSignature } from '../src/services/claims/claim_processor.js';

// W1 (2026-10-20): POST /api/nodes/:nodeId/claim signs a payout authorization with the
// production signer. It must require staff auth and refuse while SETTLEMENT_DRY_RUN is
// anything but '0' — a self-registered JWT alone must never reach the signer.

const SAVED = {};
const KEYS = ['JWT_SECRET', 'ADMIN_SECRET_TOKEN', 'SETTLEMENT_DRY_RUN', 'SETTLEMENT_EVM_SIGNER_PRIVATE_KEY', 'CLAIMS_CONTRACT_ADDRESS'];
const ADMIN = 'test-only-admin-token-claims-gate';

function app(pool) {
  const a = express();
  a.use(express.json());
  a.use('/api/nodes', createClaimsRouter(pool));
  return a;
}

// Any DB use means the request got past the gates.
function trapPool() {
  const hits = { n: 0 };
  return {
    hits,
    async query() { hits.n++; return { rows: [] }; },
    async connect() { hits.n++; throw new Error('gate bypassed: DB reached'); },
  };
}

describe('claims signing gate (W1)', () => {
  before(() => {
    for (const k of KEYS) SAVED[k] = process.env[k];
    if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-only-claims-gate-'.padEnd(64, '0');
    process.env.ADMIN_SECRET_TOKEN = ADMIN;
  });
  after(() => {
    for (const k of KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  });

  const userJwt = () => jwt.sign({ userId: 'self-registered', role: 'user' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const body = { walletAddress: '0x000000000000000000000000000000000000dEaD' };

  it('a valid user JWT without staff auth is rejected (401) and never reaches the DB', async () => {
    process.env.SETTLEMENT_DRY_RUN = '0';
    const pool = trapPool();
    const res = await request(app(pool)).post('/api/nodes/any-node/claim')
      .set('Authorization', `Bearer ${userJwt()}`).send(body);
    expect(res.status).to.equal(401);
    expect(pool.hits.n).to.equal(0);
  });

  it('staff auth while SETTLEMENT_DRY_RUN=1 is refused (503) before the DB', async () => {
    process.env.SETTLEMENT_DRY_RUN = '1';
    const pool = trapPool();
    const res = await request(app(pool)).post('/api/nodes/any-node/claim')
      .set('x-admin-token', ADMIN).send(body);
    expect(res.status).to.equal(503);
    expect(res.body.error).to.equal('settlement_dry_run');
    expect(pool.hits.n).to.equal(0);
  });

  it('SETTLEMENT_DRY_RUN unset counts as dry-run (fail closed)', async () => {
    delete process.env.SETTLEMENT_DRY_RUN;
    const pool = trapPool();
    const res = await request(app(pool)).post('/api/nodes/any-node/claim')
      .set('x-admin-token', ADMIN).send(body);
    expect(res.status).to.equal(503);
    expect(pool.hits.n).to.equal(0);
  });

  it('staff auth (Bearer) with SETTLEMENT_DRY_RUN=0 reaches the signer and returns a signature', async () => {
    process.env.SETTLEMENT_DRY_RUN = '0';
    const signer = ethers.Wallet.createRandom(); // throwaway key, generated per run
    process.env.SETTLEMENT_EVM_SIGNER_PRIVATE_KEY = signer.privateKey;
    process.env.CLAIMS_CONTRACT_ADDRESS = '0x000000000000000000000000000000000000c1a1';
    const writes = [];
    const client = {
      async query(sql, params) {
        if (/UPDATE epoch_earnings SET status = 'CLAIMING'/.test(sql)) return { rows: [{ claimable: '2.5' }] }; // reservation (one signature per balance)
        if (/INSERT INTO claims/.test(sql)) writes.push(params);
        return { rows: [] };
      },
      release() {},
    };
    const pool = { async query() { return { rows: [] }; }, async connect() { return client; } };
    const res = await request(app(pool)).post('/api/nodes/node-1/claim')
      .set('Authorization', `Bearer ${ADMIN}`).send(body);
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body.signature.amount).to.equal(2.5);
    expect(res.body.signature.signature).to.match(/^0x[0-9a-f]+$/i);
    expect(writes).to.have.length(1);
    // The signature must recover to the configured signer for the contract's EIP-712 domain.
    const sig = res.body.signature;
    const recovered = ethers.verifyTypedData(
      { name: 'SatelinkClaims', version: '1', chainId: 137, verifyingContract: process.env.CLAIMS_CONTRACT_ADDRESS },
      { Claim: [{ name: 'nodeId', type: 'string' }, { name: 'wallet', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'expiry', type: 'uint256' }] },
      { nodeId: 'node-1', wallet: body.walletAddress, amount: sig.amountWei, nonce: sig.nonce, expiry: sig.expiry },
      sig.signature,
    );
    expect(recovered).to.equal(signer.address);
  });

  it('ADMIN_SECRET_TOKEN unset → 503 before the DB, even with SETTLEMENT_DRY_RUN=0', async () => {
    process.env.SETTLEMENT_DRY_RUN = '0';
    delete process.env.ADMIN_SECRET_TOKEN;
    try {
      const pool = trapPool();
      const res = await request(app(pool)).post('/api/nodes/any-node/claim')
        .set('x-admin-token', ADMIN).send(body);
      expect(res.status).to.equal(503);
      expect(pool.hits.n).to.equal(0);
    } finally {
      process.env.ADMIN_SECRET_TOKEN = ADMIN;
    }
  });

  it('an invalid walletAddress is rejected (400) before the DB', async () => {
    process.env.SETTLEMENT_DRY_RUN = '0';
    const pool = trapPool();
    const res = await request(app(pool)).post('/api/nodes/any-node/claim')
      .set('x-admin-token', ADMIN).send({ walletAddress: 'not-an-address' });
    expect(res.status).to.equal(400);
    expect(pool.hits.n).to.equal(0);
  });

  it('generateClaimSignature itself refuses while SETTLEMENT_DRY_RUN is not "0" (unmounted callers too)', async () => {
    for (const v of [undefined, '1', 'false', ' 0']) {
      if (v === undefined) delete process.env.SETTLEMENT_DRY_RUN; else process.env.SETTLEMENT_DRY_RUN = v;
      const pool = trapPool();
      let err;
      try { await generateClaimSignature('node-1', body.walletAddress, pool); } catch (e) { err = e; }
      expect(err?.message, `SETTLEMENT_DRY_RUN=${JSON.stringify(v)}`).to.match(/settlement_dry_run/);
      expect(pool.hits.n).to.equal(0);
    }
  });
});
