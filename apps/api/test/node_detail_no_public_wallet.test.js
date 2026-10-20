// SEC-4b (W1 review follow-up, 2026-10-20): GET /api/nodes/:nodeId served the node's payout
// wallet, raw endpoint (IP:port), hardware and failure text to anyone. Public callers now get
// the operational summary; the staff token (ADMIN_SECRET_TOKEN) gets the full record.
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { createNodeRegistryRouter } from '../src/services/node_registry/registration.js';

const STAFF = 'test-only-admin-token-node-detail';
const PRIVATE_FIELDS = ['wallet', 'endpointUrl', 'hardware', 'lastFailureReason'];
const row = {
  node_id: 'node-1', wallet: '0x00000000000000000000000000000000000f00d1', node_type: 'rpc',
  endpoint_url: 'http://203.0.113.7:8545', region: 'us-east-1', chain_ids: [137],
  hardware_json: { cpu: 8 }, status: 'active', tier: 'basic', reputation_score: 90, uptime_pct: '99.5',
  registered_at: 1, last_heartbeat_at: 2, updated_at: 3, consecutive_failures: 0,
  total_requests_served: 10, avg_latency_ms: 40, last_failure_at: null, last_failure_reason: 'upstream 10.0.0.4 refused',
};

describe('SEC-4b — node detail hides payout wallet and endpoint from the public', () => {
  let saved;
  before(() => { saved = process.env.ADMIN_SECRET_TOKEN; process.env.ADMIN_SECRET_TOKEN = STAFF; });
  after(() => { if (saved === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = saved; });

  const app = () => {
    const db = { async query(sql) { return /FROM registered_nodes\s+WHERE node_id/.test(sql) ? { rows: [row] } : { rows: [] }; } };
    const a = express(); a.use(express.json()); a.use('/api/nodes', createNodeRegistryRouter(db, null)); return a;
  };

  for (const [name, headers] of [['anonymous', {}], ['wrong staff token', { 'x-admin-token': 'nope' }], ['wrong Bearer', { Authorization: 'Bearer nope' }]]) {
    it(`${name}: public summary only`, async () => {
      const res = await request(app()).get('/api/nodes/node-1').set(headers);
      expect(res.status).to.equal(200);
      for (const f of PRIVATE_FIELDS) expect(res.body.node, f).to.not.have.property(f);
      expect(JSON.stringify(res.body)).to.not.contain('203.0.113.7').and.not.contain('0f00d1');
      expect(res.body.node).to.include({ nodeId: 'node-1', status: 'active', region: 'us-east-1' });
    });
  }

  for (const [name, headers] of [['x-admin-token', { 'x-admin-token': STAFF }], ['Bearer', { Authorization: `Bearer ${STAFF}` }]]) {
    it(`staff (${name}): full record`, async () => {
      const res = await request(app()).get('/api/nodes/node-1').set(headers);
      expect(res.body.node.wallet).to.equal(row.wallet);
      expect(res.body.node.endpointUrl).to.equal(row.endpoint_url);
      expect(res.body.node.lastFailureReason).to.equal(row.last_failure_reason);
    });
  }

  it('ADMIN_SECRET_TOKEN unset: nobody gets the private fields (fail closed)', async () => {
    delete process.env.ADMIN_SECRET_TOKEN;
    try {
      const res = await request(app()).get('/api/nodes/node-1').set('x-admin-token', STAFF);
      for (const f of PRIVATE_FIELDS) expect(res.body.node, f).to.not.have.property(f);
    } finally { process.env.ADMIN_SECRET_TOKEN = STAFF; }
  });
});
