import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createClaimsRouter } from '../src/routes/claims_route.mjs';

// W1 (2026-10-20): POST /api/nodes/:nodeId/claim signs a payout authorization with the
// production signer. It must require staff auth and refuse while SETTLEMENT_DRY_RUN is
// anything but '0' — a self-registered JWT alone must never reach the signer.

const SAVED = {};
const KEYS = ['JWT_SECRET', 'ADMIN_SECRET_TOKEN', 'SETTLEMENT_DRY_RUN'];
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
});
