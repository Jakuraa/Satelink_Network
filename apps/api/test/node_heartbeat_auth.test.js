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
// Accepted heartbeat timestamps must strictly increase per node (replay guard), so each
// signature in this file uses a fresh, increasing timestamp.
let clock = Date.now() - 30_000;
const nextTs = () => (clock += 7);
const sign = async (wallet, { nodeId = 'node-1', timestamp = nextTs(), endpointUrl } = {}) =>
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
      'https://rpc.satelink.network', 'http://user:pw@node.example', 'http://db.internal', 'not a url', 'http://localhost.', 'http://rpc.satelink.network.',
      'https://a\nb.example', 'https://node.example/\tx', 'http://2130706433', 'http://0x7f.1', 'http://0',
      'http://[::7f00:1]', 'http://[::127.0.0.1]', 'http://[64:ff9b::a9fe:a9fe]', 'http://[2002:a9fe:a9fe::]',
      'http://[::ffff:0:7f00:1]', 'http://[fec0::1]', 'http://[2001:db8::1]', 'http://198.18.0.1', 'http://192.0.2.10',
      'http://203.0.113.7', 'http://foo.railway.internal.', 'http://[2001:0:4136:e378::1]']) {
      expect(validateNodeEndpoint(bad), bad).to.equal('invalid_endpoint');
    }
    for (const ok of ['https://node.example:8545', 'http://93.184.216.34:3737', 'https://[2606:4700:4700::1111]:443']) {
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

  it('a replayed or older heartbeat is refused (409) — it cannot roll back a newer endpoint', async () => {
    const db = fakeDb({ status: 'active' });
    const a = app(db);
    const older = await sign(owner, { endpointUrl: 'https://old.example:8545' });
    const newer = await sign(owner, { endpointUrl: 'https://new.example:8545' });
    expect((await request(a).post('/api/nodes/node-1/heartbeat').send({ endpoint_url: 'https://new.example:8545', ...newer })).status).to.equal(200);
    const replay = await request(a).post('/api/nodes/node-1/heartbeat').send({ endpoint_url: 'https://new.example:8545', ...newer });
    expect(replay.status).to.equal(409);
    const rollback = await request(a).post('/api/nodes/heartbeat').send({ nodeId: 'node-1', endpoint_url: 'https://old.example:8545', ...older });
    expect(rollback.status).to.equal(409);
    expect(db.writes.filter((w) => /endpoint_url = \$4/.test(w.sql)).map((w) => w.params[3])).to.deep.equal(['https://new.example:8545']);
  });

  it('a suspended node is not revived by its own heartbeat (staff reactivate it)', async () => {
    const db = fakeDb({ status: 'suspended' });
    const res = await request(app(db)).post('/api/nodes/node-1/heartbeat').send(await sign(owner));
    expect(res.status).to.equal(200);
    expect(res.body.status).to.equal('suspended');
    expect(db.writes.every((w) => w.params[1] === 'suspended')).to.equal(true);
  });

  it('the generic route accepts node_id (snake case) and verifies against that node', async () => {
    const db = fakeDb({ status: 'offline' });
    const res = await request(app(db)).post('/api/nodes/heartbeat').send({ node_id: 'node-1', ...(await sign(owner)) });
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body.status).to.equal('active');
  });

  it('registration probes the endpoint through the guarded client, not global fetch', async () => {
    // node_endpoint_fetch (resolve-then-check, no redirects) replaced fetch(); its behaviour is
    // covered in node_endpoint_dns_rebinding.test.js. '.example' never resolves -> refused.
    const { registrationMessage } = await import('../src/services/node_registry/heartbeat_auth.js');
    let globalFetchCalls = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => { globalFetchCalls += 1; return new Response('', { status: 200 }); };
    try {
      const fields = { node_type: 'rpc', endpoint_url: 'https://node.example:8545', region: 'us-east-1', chain_ids: [137] };
      const timestamp = Date.now();
      const signature = await owner.signMessage(registrationMessage({ walletAddress: owner.address, nodeType: 'rpc',
        endpointUrl: fields.endpoint_url, region: fields.region, chainIds: fields.chain_ids, timestamp }));
      const res = await request(app(fakeDb())).post('/api/nodes/register').send({ wallet_address: owner.address, ...fields, timestamp, signature });
      expect(res.status).to.equal(400);
      expect(res.body.error).to.match(/unreachable/i);
      expect(globalFetchCalls).to.equal(0);
    } finally { globalThis.fetch = realFetch; }
  });
});
