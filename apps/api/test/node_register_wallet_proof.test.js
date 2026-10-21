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
    for (const [delta, err] of [[-61_000, 'stale_registration'], [6_000, 'future_registration']]) {
      const ts = Date.now() + delta;
      const sig = await owner.signMessage(registrationMessage({
        walletAddress: owner.address, nodeType: 'rpc', endpointUrl: base.endpoint_url, region: base.region, chainIds: [137], timestamp: ts }));
      const res = await register(app, { ...base, wallet_address: owner.address, timestamp: ts, signature: sig });
      expect(res.body.error).to.equal(err);
    }
  });

  it('non-integer chain ids are refused (they would not sign canonically)', async () => {
    const { app } = setup();
    const res = await register(app, { ...(await signed(owner)), chain_ids: ['137'] });
    expect(res.status).to.equal(400);
  });

  it('a valid proof registers the node (probe runs after the proof)', async () => {
    const { app, calls } = setup();
    const res = await register(app, await signed(owner));
    expect(res.status, JSON.stringify(res.body)).to.equal(201);
    expect(calls.probes).to.equal(1);
    expect(calls.inserts).to.have.length(1);
    expect(calls.inserts[0][1]).to.equal(owner.address);
  });

  it('a replay with a differently-cased wallet hits the duplicate check (409), no second row', async () => {
    const { app, calls } = setup({ existing: [{ wallet: owner.address, endpoint: base.endpoint_url }] });
    const res = await register(app, await signed(owner, {}, { as: owner.address.toLowerCase() }));
    expect(res.status).to.equal(409);
    expect(calls.inserts).to.have.length(0);
  });
});
