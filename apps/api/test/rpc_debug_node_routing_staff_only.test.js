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

// #575 review: the gateway runs after x402 + freeTierGate, which answer 402 to a request with only
// the staff token. app_factory therefore serves the route BEFORE the /rpc gates.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAdminAuth } from '../src/admin/admin_router.js';
import { nodeRoutingDebugHandler } from '../src/workloads/rpc_gateway/rpc_gateway.js';

describe('/rpc/debug/node-routing — reachable by staff ahead of the /rpc payment gates', () => {
  let saved;
  before(() => { saved = process.env.ADMIN_SECRET_TOKEN; process.env.ADMIN_SECRET_TOKEN = STAFF; });
  after(() => { if (saved === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = saved; });

  it('app_factory registers the staff route before any app.use("/rpc", …) gate', () => {
    const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app_factory.mjs'), 'utf8');
    const route = src.indexOf('app.get("/rpc/debug/node-routing", requireAdminAuth, nodeRoutingDebugHandler)');
    const firstGate = src.indexOf('app.use("/rpc"');
    expect(route, 'staff route registered').to.be.greaterThan(-1);
    expect(route, 'before the first /rpc gate').to.be.lessThan(firstGate);
  });

  it('with a 402 payment gate mounted after it (as in production): staff token alone → 200 with the node data; others → 401', async () => {
    const pool = { async query() { return { rows: [{ node_id: 'n1', endpoint_url: 'http://203.0.113.7:3737', chain_ids: [137], status: 'active', last_heartbeat_at: 1, consecutive_failures: 0 }] }; } };
    const a = express();
    a.get('/rpc/debug/node-routing', requireAdminAuth, nodeRoutingDebugHandler);
    a.use('/rpc', (_req, res) => res.status(402).json({ error: 'payment_required' })); // stands in for x402 + freeTierGate
    a.use('/rpc', createRpcGateway(pool));
    const staff = await request(a).get('/rpc/debug/node-routing').set('x-admin-token', STAFF);
    expect(staff.status).to.equal(200);
    expect(staff.body.ok).to.equal(true);
    expect(JSON.stringify(staff.body)).to.contain('n1');
    const anon = await request(a).get('/rpc/debug/node-routing');
    expect(anon.status).to.equal(401);
    expect(JSON.stringify(anon.body)).to.not.contain('203.0.113');
  });
});
