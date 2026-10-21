// POST /api/nodes/register must prove control of wallet_address (W1 follow-up, 2026-10-21).
// Before: any caller could register nodes under any wallet. Now: an EIP-191 signature by that
// wallet over every registered field + a fresh timestamp, verified before the endpoint probe.
//
// Hermetic: real router; recording fake db; the endpoint probe injected (probeEndpoint).
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { ethers } from 'ethers';
import { createNodeRegistryRouter } from '../src/services/node_registry/registration.js';
import { registrationMessage } from '../src/services/node_registry/heartbeat_auth.js';

const owner = ethers.Wallet.createRandom();
const other = ethers.Wallet.createRandom();
const base = { node_type: 'rpc', endpoint_url: 'https://node.example:8545', region: 'us-east-1', chain_ids: [137] };

function setup({ existing = [] } = {}) {
  const calls = { probes: 0, inserts: [], dupChecks: [] };
  const db = {
    async query(sql, params) {
      if (/SELECT node_id FROM registered_nodes WHERE lower\(wallet\) = lower\(\$1\)/.test(sql)) {
        calls.dupChecks.push(params);
        const hit = existing.find((e) => e.wallet.toLowerCase() === String(params[0]).toLowerCase() && e.endpoint === params[1]);
        return { rows: hit ? [{ node_id: 'NODE-existing' }] : [] };
      }
      if (/INSERT INTO registered_nodes/.test(sql)) { calls.inserts.push(params); return { rowCount: 1, rows: [] }; }
      return { rows: [] };
    },
  };
  const a = express(); a.use(express.json());
  a.use('/api/nodes', createNodeRegistryRouter(db, null, { probeEndpoint: async () => { calls.probes += 1; return true; } }));
  return { app: a, calls };
}

let clock = Date.now() - 20_000;
async function signed(wallet, fields = {}, { as = wallet.address } = {}) {
  const body = { ...base, ...fields, wallet_address: as };
  const timestamp = (clock += 11);
  const signature = await wallet.signMessage(registrationMessage({
    walletAddress: body.wallet_address, nodeType: body.node_type, endpointUrl: body.endpoint_url,
    region: body.region, chainIds: body.chain_ids, timestamp,
  }));
  return { ...body, timestamp, signature };
}
const register = (app, body) => request(app).post('/api/nodes/register').send(body);

describe('node registration requires proof of wallet ownership', () => {
  it('unsigned → 401; the endpoint is not probed and nothing is stored', async () => {
    const { app, calls } = setup();
    const res = await register(app, { ...base, wallet_address: owner.address });
    expect(res.status).to.equal(401);
    expect(res.body.error).to.equal('registration_signature_required');
    expect(res.body.sign.message_template).to.match(/^Satelink node registration\nwallet: /);
    expect(calls.probes).to.equal(0);
    expect(calls.inserts).to.have.length(0);
  });

  it('someone else\'s wallet (signed by another key) → 401', async () => {
    const { app, calls } = setup();
    const res = await register(app, await signed(other, {}, { as: owner.address }));
    expect(res.status).to.equal(401);
    expect(res.body.error).to.equal('invalid_registration_signature');
    expect(calls.probes + calls.inserts.length).to.equal(0);
  });

  for (const [field, value] of [['endpoint_url', 'https://evil.example:8545'], ['region', 'eu-west-1'], ['node_type', 'compute'], ['chain_ids', [1]]]) {
    it(`a signed body with ${field} changed afterwards → 401`, async () => {
      const { app, calls } = setup();
      const body = await signed(owner);
      const res = await register(app, { ...body, [field]: value });
      expect(res.status).to.equal(401);
      expect(calls.inserts).to.have.length(0);
    });
  }

  it('stale or future timestamps → 400', async () => {
    const { app } = setup();
    for (const [delta, err] of [[-301_000, 'stale_registration'], [6_000, 'future_registration']]) {
      const ts = Date.now() + delta;
      const sig = await owner.signMessage(registrationMessage({
        walletAddress: owner.address, nodeType: 'rpc', endpointUrl: base.endpoint_url, region: base.region, chainIds: [137], timestamp: ts }));
      const res = await register(app, { ...base, wallet_address: owner.address, timestamp: ts, signature: sig });
      expect(res.status).to.equal(400);
      expect(res.body.error).to.equal(err);
    }
  });

  it('non-positive-integer chain ids are refused (they would not sign canonically)', async () => {
    const { app, calls } = setup();
    for (const bad of [['137'], [0], [1.5], [-1]]) {
      const res = await register(app, await signed(owner, { chain_ids: bad }));
      expect(res.status, JSON.stringify(bad)).to.equal(400);
    }
    expect(calls.inserts).to.have.length(0);
  });

  it('a signed request older than a heartbeat window but inside 5 minutes is accepted', async () => {
    const { app } = setup();
    const ts = Date.now() - 120_000;
    const sig = await owner.signMessage(registrationMessage({
      walletAddress: owner.address, nodeType: 'rpc', endpointUrl: base.endpoint_url, region: base.region, chainIds: [137], timestamp: ts }));
    const res = await register(app, { ...base, wallet_address: owner.address, timestamp: ts, signature: sig });
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
  });

  it('a valid proof registers the node (probe runs after the proof)', async () => {
    const { app, calls } = setup();
    const res = await register(app, await signed(owner));
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    expect(calls.probes).to.equal(1);
    expect(calls.inserts).to.have.length(1);
    expect(calls.inserts[0][1]).to.equal(owner.address);
  });

  it('replaying the same signature bytes with a re-cased wallet hits the duplicate check (409)', async () => {
    const { app, calls } = setup();
    const body = await signed(owner);
    expect((await register(app, body)).status).to.equal(201);
    // the fake db now "has" the row
    const { app: app2, calls: calls2 } = setup({ existing: [{ wallet: owner.address, endpoint: base.endpoint_url }] });
    const res = await register(app2, { ...body, wallet_address: owner.address.toLowerCase() });
    expect(res.status).to.equal(409);
    expect(calls2.inserts).to.have.length(0);
    expect(calls.inserts).to.have.length(1);
  });

  describe('parallel identical requests (real Postgres)', function () {
    const url = process.env.DATABASE_URL || '';
    const schema = `reg_test_${process.pid}_${Date.now()}`;
    let pg, admin, pool;
    before(async function () {
      if (!/@?(localhost|127\.0\.0\.1)(:|\/|\?)/.test(url) && !/host=\/tmp/.test(url)) this.skip();
      ({ default: pg } = await import('pg'));
      admin = new pg.Client({ connectionString: url });
      try { await admin.connect(); } catch { admin = null; this.skip(); }
      await admin.query(`CREATE SCHEMA ${schema}`);
      await admin.query(`CREATE TABLE ${schema}.registered_nodes (id SERIAL PRIMARY KEY, node_id TEXT UNIQUE NOT NULL,
        wallet TEXT NOT NULL, node_type TEXT, endpoint_url TEXT NOT NULL, region TEXT, chain_ids JSONB, hardware_json JSONB,
        status TEXT, tier TEXT, registered_at BIGINT, updated_at BIGINT)`);
      pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 6 });
    });
    after(async () => {
      await pool?.end().catch(() => {});
      if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {}); await admin.end(); }
    });

    it('five parallel copies of one signed registration store exactly one node', async () => {
      const a = express(); a.use(express.json());
      // Widen the race window deterministically: every duplicate-check SELECT returns 150 ms
      // late, so without the lock all five see "no row" and insert.
      const slowPool = {
        query: (...q) => pool.query(...q),
        async connect() {
          const c = await pool.connect();
          return {
            async query(sql, params) {
              const r = await c.query(sql, params);
              if (/SELECT node_id FROM registered_nodes WHERE lower\(wallet\)/.test(sql)) await new Promise((res) => setTimeout(res, 150));
              return r;
            },
            release: (e) => c.release(e),
          };
        },
      };
      a.use('/api/nodes', createNodeRegistryRouter(slowPool, null, { probeEndpoint: async () => true }));
      const body = await signed(owner);
      const results = await Promise.all(Array.from({ length: 5 }, () => register(a, body)));
      expect(results.map((r) => r.status).sort()).to.deep.equal([201, 409, 409, 409, 409]);
      const { rows } = await pool.query(`SELECT count(*)::int n FROM registered_nodes`);
      expect(rows[0].n).to.equal(1);
    });
  });
});
