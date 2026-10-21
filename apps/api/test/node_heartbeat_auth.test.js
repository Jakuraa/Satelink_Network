// SEC-5 (W1 follow-up, 2026-10-21): node heartbeats must be signed by the node's registered
// wallet. Before this fix anyone who knew a public node id could mark it active and rewrite
// its endpoint_url (RPC traffic hijack, health-monitor SSRF).
//
// Hermetic: the real createNodeRegistryRouter over supertest; a fake db that records every
// write. Throwaway wallets generated per run.
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { ethers } from 'ethers';
import { createNodeRegistryRouter } from '../src/services/node_registry/registration.js';
import { heartbeatMessage, validateNodeEndpoint } from '../src/services/node_registry/heartbeat_auth.js';

const owner = ethers.Wallet.createRandom();
const attacker = ethers.Wallet.createRandom();

function fakeDb({ wallet = owner.address, status = 'offline' } = {}) {
  const writes = [];
  return {
    writes,
    async query(sql, params) {
      if (/SELECT node_id, status, wallet FROM registered_nodes/.test(sql)) {
        return { rows: params[0] === 'node-1' ? [{ node_id: 'node-1', status, wallet }] : [] };
      }
      if (/^\s*UPDATE registered_nodes/.test(sql)) { writes.push({ sql, params }); return { rowCount: 1, rows: [] }; }
      return { rows: [] }; // offline detector reads etc.
    },
  };
}

const app = (db) => { const a = express(); a.use(express.json()); a.use('/api/nodes', createNodeRegistryRouter(db, null)); return a; };
const sign = async (wallet, { nodeId = 'node-1', timestamp = Date.now(), endpointUrl } = {}) =>
  ({ timestamp, signature: await wallet.signMessage(heartbeatMessage({ nodeId, timestamp, endpointUrl })) });

const routes = [
  ['POST /api/nodes/:nodeId/heartbeat', (a, body) => request(a).post('/api/nodes/node-1/heartbeat').send(body)],
  ['POST /api/nodes/heartbeat', (a, body) => request(a).post('/api/nodes/heartbeat').send({ nodeId: 'node-1', ...body })],
];

describe('SEC-5 — node heartbeat requires the registered wallet\'s signature', () => {
  for (const [name, post] of routes) {
    describe(name, () => {
      it('unsigned → 401 and nothing is written (status and endpoint untouched)', async () => {
        const db = fakeDb();
        const res = await post(app(db), { endpoint_url: 'https://evil.example:8545' });
        expect(res.status).to.equal(401);
        expect(res.body.error).to.equal('heartbeat_signature_required');
        expect(db.writes).to.have.length(0);
      });

      it('signed by another wallet → 401, nothing written', async () => {
        const db = fakeDb();
        const res = await post(app(db), { endpoint_url: 'https://evil.example:8545', ...(await sign(attacker, { endpointUrl: 'https://evil.example:8545' })) });
        expect(res.status).to.equal(401);
        expect(res.body.error).to.equal('invalid_heartbeat_signature');
        expect(db.writes).to.have.length(0);
      });

      it('owner signature for endpoint A cannot be replayed with endpoint B', async () => {
        const db = fakeDb();
        const sig = await sign(owner, { endpointUrl: 'https://node.example:8545' });
        const res = await post(app(db), { endpoint_url: 'https://evil.example:8545', ...sig });
        expect(res.status).to.equal(401);
        expect(db.writes).to.have.length(0);
      });

      it('stale (> 60 s) or future-dated (> 5 s) heartbeats → 400', async () => {
        const db = fakeDb();
        expect((await post(app(db), await sign(owner, { timestamp: Date.now() - 61_000 }))).body.error).to.equal('stale_heartbeat');
        expect((await post(app(db), await sign(owner, { timestamp: Date.now() + 6_000 }))).body.error).to.equal('future_heartbeat');
        expect(db.writes).to.have.length(0);
      });

      it('a node without a valid registered wallet can never heartbeat', async () => {
        const db = fakeDb({ wallet: null });
        const res = await post(app(db), await sign(owner));
        expect(res.status).to.equal(401);
        expect(db.writes).to.have.length(0);
      });

      it('owner-signed heartbeat → 200, node reactivated', async () => {
        const db = fakeDb({ status: 'offline' });
        const res = await post(app(db), await sign(owner));
        expect(res.status, JSON.stringify(res.body)).to.equal(200);
        expect(res.body.status).to.equal('active');
        expect(db.writes.some((w) => /SET last_heartbeat_at/.test(w.sql))).to.equal(true);
      });

      it('owner-signed endpoint update is stored', async () => {
        const db = fakeDb({ status: 'active' });
        const url = 'https://node.example:8545';
        const res = await post(app(db), { endpoint_url: url, ...(await sign(owner, { endpointUrl: url })) });
        expect(res.status, JSON.stringify(res.body)).to.equal(200);
        expect(db.writes.find((w) => /endpoint_url = \$4/.test(w.sql))?.params[3]).to.equal(url);
      });

      it('owner-signed but private/metadata endpoint → 400, not stored', async () => {
        const db = fakeDb({ status: 'active' });
        const url = 'http://169.254.169.254/latest/meta-data';
        const res = await post(app(db), { endpoint_url: url, ...(await sign(owner, { endpointUrl: url })) });
        expect(res.status).to.equal(400);
        expect(res.body.error).to.equal('invalid_endpoint');
        expect(db.writes).to.have.length(0);
      });
    });
  }

  it('validateNodeEndpoint rejects loopback, private, link-local, metadata, non-http and circular hosts', () => {
    for (const bad of ['http://localhost:8545', 'http://127.0.0.1', 'http://10.0.0.4', 'http://172.20.1.1', 'http://192.168.1.2',
      'http://169.254.169.254', 'http://[::1]:80', 'http://[fd00::1]', 'http://[::ffff:127.0.0.1]', 'http://[::ffff:a9fe:a9fe]', 'http://[::ffff:10.0.0.1]', 'ftp://node.example',
      'https://rpc.satelink.network', 'http://user:pw@node.example', 'http://db.internal', 'not a url']) {
      expect(validateNodeEndpoint(bad), bad).to.equal('invalid_endpoint');
    }
    for (const ok of ['https://node.example:8545', 'http://203.0.113.7:3737', 'https://[2001:db8::1]:443']) {
      expect(validateNodeEndpoint(ok), ok).to.equal(null);
    }
  });

  it('registration refuses private / metadata endpoints before fetching them (SSRF)', async () => {
    let fetched = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetched += 1; return new Response('ok', { status: 200 }); };
    try {
      const res = await request(app(fakeDb())).post('/api/nodes/register').send({
        wallet_address: owner.address, node_type: 'rpc', endpoint_url: 'http://169.254.169.254',
        region: 'us-east-1', chain_ids: [137],
      });
      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal('invalid_endpoint');
      expect(fetched).to.equal(0);
    } finally { globalThis.fetch = realFetch; }
  });
});
