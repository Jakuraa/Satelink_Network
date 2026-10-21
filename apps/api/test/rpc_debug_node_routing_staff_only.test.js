// /rpc/debug/node-routing lists node endpoints (IP:port). Staff only (W1 follow-up, 2026-10-21):
// before, any caller past the payment gate (x402 payer, API key) could read it.
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { createRpcGateway } from '../src/workloads/rpc_gateway/rpc_gateway.js';

const STAFF = 'test-only-admin-token-node-routing';

describe('/rpc/debug/node-routing is staff-only', () => {
  let saved;
  before(() => { saved = process.env.ADMIN_SECRET_TOKEN; process.env.ADMIN_SECRET_TOKEN = STAFF; });
  after(() => { if (saved === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = saved; });

  const app = () => {
    const pool = { async query() { return { rows: [{ node_id: 'n1', endpoint_url: 'http://203.0.113.7:3737', chain_ids: [137], status: 'active', last_heartbeat_at: 1, consecutive_failures: 0 }] }; } };
    const a = express(); a.use(express.json()); a.use('/rpc', createRpcGateway(pool)); return a;
  };

  for (const [name, headers] of [['anonymous', {}], ['an API key', { 'x-api-key': 'sk_' + 'live_' + 'x'.repeat(32) }], ['a wrong staff token', { 'x-admin-token': 'nope' }]]) {
    it(`${name} → 401, no endpoints`, async () => {
      const res = await request(app()).get('/rpc/debug/node-routing').set(headers);
      expect(res.status).to.equal(401);
      expect(JSON.stringify(res.body)).to.not.contain('203.0.113');
    });
  }

  it('ADMIN_SECRET_TOKEN unset → 503 (fail closed)', async () => {
    delete process.env.ADMIN_SECRET_TOKEN;
    try { expect((await request(app()).get('/rpc/debug/node-routing').set('x-admin-token', STAFF)).status).to.equal(503); }
    finally { process.env.ADMIN_SECRET_TOKEN = STAFF; }
  });

  it('staff token → 200', async () => {
    const res = await request(app()).get('/rpc/debug/node-routing').set('x-admin-token', STAFF);
    expect(res.status).to.equal(200);
    expect(res.body.ok).to.equal(true);
  });
});
