// Refund-on-upstream-failure (F20 prerequisite, 2026-10-20).
//
// The legacy credit gate (CREDIT_CANONICAL !== 'true') deducts credit_balances
// BEFORE the upstream call. Before this fix an upstream failure returned 502 and
// kept the deduction. Now the exact deduction is put back, once, and the 502 says
// charged:false / refunded:true. (The canonical api_credits path charges only after
// success — test/rpc_charge_after_success.test.js.)
//
// Hermetic: the real createRpcGateway router over supertest, a scripted fake pool
// that holds one credit_balances row, and a stubbed global fetch. No DB, no network.
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { refundCreditGateDeduction } from '../src/middleware/credit_gate.js';

const KEY = 'sk_basic_rpcrefund_test_00000000000000000000000000000000';
const WALLET = '0x00000000000000000000000000000000000abcde';
const PRICE = 0.00003;

function fakePool({ balance = 1, refundFails = false } = {}) {
  const state = { balance, spent: 0, deductions: [], refunds: [] };
  return {
    state,
    async query(sql, params = []) {
      const s = String(sql);
      if (/FROM rpc_method_pricing/.test(s)) return { rows: [] }; // default cost
      if (/SELECT wallet_address FROM api_credits WHERE api_key = \$1/.test(s)) return { rows: [{ wallet_address: WALLET }] };
      if (/UPDATE credit_balances\s+SET balance_usdt = balance_usdt - \$1/.test(s)) {
        const [cost] = params;
        if (state.balance + 1e-12 < cost) return { rowCount: 0, rows: [] };
        state.balance = +(state.balance - cost).toFixed(8); state.spent = +(state.spent + cost).toFixed(8);
        state.deductions.push(cost);
        return { rowCount: 1, rows: [{ balance_usdt: String(state.balance), id: 42 }] };
      }
      if (/UPDATE credit_balances\s+SET balance_usdt = balance_usdt \+ \$1/.test(s)) {
        if (refundFails) throw new Error('db down');
        const [cost, id, wallet] = params;
        expect(id, 'refund targets the deducted row').to.equal(42);
        expect(wallet).to.equal(WALLET);
        state.balance = +(state.balance + cost).toFixed(8); state.spent = Math.max(0, +(state.spent - cost).toFixed(8));
        state.refunds.push(cost);
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  };
}

describe('RPC refund-on-upstream-failure (legacy credit gate)', function () {
  this.timeout(20000);
  let createRpcGateway, realFetch, prevCanonical, prevRedis;

  before(async () => {
    prevCanonical = process.env.CREDIT_CANONICAL;
    prevRedis = process.env.REDIS_URL;
    delete process.env.CREDIT_CANONICAL; // legacy: the gate pre-deducts credit_balances
    delete process.env.REDIS_URL;
    ({ createRpcGateway } = await import('../src/workloads/rpc_gateway/rpc_gateway.js'));
    realFetch = globalThis.fetch;
  });
  after(() => {
    globalThis.fetch = realFetch;
    if (prevCanonical === undefined) delete process.env.CREDIT_CANONICAL; else process.env.CREDIT_CANONICAL = prevCanonical;
    if (prevRedis !== undefined) process.env.REDIS_URL = prevRedis;
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  const app = (pool) => { const a = express(); a.use(express.json()); a.use('/rpc', createRpcGateway(pool)); return a; };
  const call = (pool) => request(app(pool)).post('/rpc/polygon').set('X-API-Key', KEY)
    .send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 9 });

  const upstreamFailures = {
    'provider 5xx': async () => new Response('bad gateway', { status: 503 }),
    'provider JSON-RPC error': async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 9, error: { code: -32000, message: 'boom' } }), { status: 200, headers: { 'content-type': 'application/json' } }),
    'network error / timeout': async () => { throw new Error('ECONNRESET'); },
  };

  for (const [name, impl] of Object.entries(upstreamFailures)) {
    it(`refunds the pre-deducted credit when the upstream fails (${name})`, async () => {
      const pool = fakePool({ balance: 1 });
      globalThis.fetch = impl;
      const res = await call(pool);
      expect(res.status, JSON.stringify(res.body)).to.equal(502);
      expect(pool.state.deductions, 'gate deducted first').to.deep.equal([PRICE]);
      expect(pool.state.refunds, 'exactly one refund').to.deep.equal([PRICE]);
      expect(pool.state.balance).to.equal(1);
      expect(pool.state.spent).to.equal(0);
      expect(res.body.charged).to.equal(false);
      expect(res.body.refunded).to.equal(true);
    });
  }

  it('a served call keeps its single deduction and is not refunded', async () => {
    const pool = fakePool({ balance: 1 });
    globalThis.fetch = async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 9, result: '0x10' }), { status: 200, headers: { 'content-type': 'application/json' } });
    const res = await call(pool);
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body.result).to.equal('0x10');
    expect(pool.state.deductions).to.deep.equal([PRICE]);
    expect(pool.state.refunds).to.deep.equal([]);
  });

  it('if the refund itself fails, the 502 says the caller was charged (never claims a refund it did not make)', async () => {
    const pool = fakePool({ balance: 1, refundFails: true });
    globalThis.fetch = async () => new Response('bad gateway', { status: 503 });
    const res = await call(pool);
    expect(res.status).to.equal(502);
    expect(res.body.charged).to.equal(true);
    expect(res.body.refunded).to.equal(false);
  });

  it('an unauthenticated (free) call that fails reports charged:false, refunded:false', async () => {
    const pool = fakePool({ balance: 1 });
    globalThis.fetch = async () => new Response('bad gateway', { status: 503 });
    const res = await request(app(pool)).post('/rpc/polygon').send({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 9 });
    expect(res.status, JSON.stringify(res.body)).to.equal(502);
    expect(res.body.charged).to.equal(false);
    expect(res.body.refunded).to.equal(false);
    expect(pool.state.deductions).to.deep.equal([]);
  });

  for (const [name, path, payload] of [
    ['unsupported chain → 400', '/rpc/notachain', { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 9 }],
    ['JSON-RPC batch → 400', '/rpc/polygon', [{ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 9 }]],
    ['invalid JSON-RPC payload → 400', '/rpc/polygon', { method: 'eth_blockNumber' }],
  ]) {
    it(`an unserved validation error refunds the gate deduction (${name})`, async () => {
      const pool = fakePool({ balance: 1 });
      let upstream = 0;
      globalThis.fetch = async () => { upstream += 1; return new Response('{}', { status: 200 }); };
      const res = await request(app(pool)).post(path).set('X-API-Key', KEY).send(payload);
      expect(res.status, JSON.stringify(res.body)).to.equal(400);
      expect(upstream).to.equal(0);
      expect(pool.state.balance, 'balance restored').to.equal(1);
      expect(pool.state.deductions, 'the gate deducted').to.deep.equal([PRICE]);
      expect(pool.state.refunds, 'and it was refunded').to.deep.equal([PRICE]);
      expect(res.headers['x-credit-refunded']).to.equal('true');
    });
  }

  it('refundCreditGateDeduction refunds at most once and stays truthful on a repeat call', async () => {
    const pool = fakePool({ balance: 0.99997 });
    const req = { creditDeducted: PRICE, creditWallet: WALLET, creditRowId: 42 };
    expect(await refundCreditGateDeduction(pool, req)).to.equal(true);
    expect(await refundCreditGateDeduction(pool, req)).to.equal(true); // already refunded
    expect(pool.state.refunds).to.deep.equal([PRICE]);
    expect(await refundCreditGateDeduction(pool, { creditDeducted: 0 })).to.equal(false);
    expect(await refundCreditGateDeduction(pool, { creditDeducted: PRICE, creditWallet: WALLET })).to.equal(false); // no row id → no refund
  });
});
