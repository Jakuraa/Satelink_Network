// POST /api/keys/deposit atomicity — crash/retry regression (2026-10-12,
// founder-approved; same pattern as cfab183b for DepositListener).
//
// Defect: the api_deposits INSERT and the api_credits UPDATE were two separate
// autocommit pool.query calls. A crash between them left the deposit recorded
// (so the tx_hash dedupe refuses every retry with tx_already_used) but the
// account never credited — the customer's USDT stranded.
//
// d1  UPDATE fails once (simulated crash) → 500, NO api_deposits row; the
//     retry credits exactly once
// d2  a concurrent duplicate insert (UNIQUE tx_hash) → 400 tx_already_used,
//     not 500, balance credited once
//
// Real Postgres (local only; refuses a Railway host), rolled back. The Polygon
// receipt is stubbed on the ethers provider prototype — no network.
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { ethers } from 'ethers';

const KEY = 'sk_free_' + 'd'.repeat(48);
const WALLET = '0xd00000000000000000000000000000000000d001';
const VAULT = process.env.REVENUE_VAULT_ADDRESS || '0x577D3716d6Ad5b676d230f5409deF9838FABaCEF';
const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const pad = (a) => ethers.zeroPadValue(a, 32);

describe('POST /api/keys/deposit — atomic credit (crash/retry)', function () {
  this.timeout(20000);
  let raw; let pool; let router; const restore = {};
  let failNextUpdate = false;

  before(async function () {
    const url = process.env.DATABASE_URL || '';
    if (!url || /rlwy\.net|railway\.app|railway\.internal/.test(url)) this.skip();
    const { default: pg } = await import('pg');
    raw = new pg.Client({ connectionString: url });
    try { await raw.connect(); } catch { raw = null; this.skip(); }
    await raw.query('BEGIN');
    let sp = 0;
    const exec = (sql, params) => {
      if (failNextUpdate && /UPDATE api_credits/.test(sql)) {
        failNextUpdate = false;
        return Promise.reject(new Error('simulated crash between deposit insert and credit'));
      }
      return raw.query(sql, params);
    };
    const client = {
      query(sql, params) {
        if (sql === 'BEGIN') { sp++; return raw.query(`SAVEPOINT dep_sp_${sp}`); }
        if (sql === 'COMMIT') return raw.query(`RELEASE SAVEPOINT dep_sp_${sp}`);
        if (sql === 'ROLLBACK') return raw.query(`ROLLBACK TO SAVEPOINT dep_sp_${sp}`);
        return exec(sql, params);
      },
      release() {},
    };
    pool = { connect: async () => client, query: exec };
    await raw.query(
      `INSERT INTO api_credits (api_key, tier, daily_limit, wallet_address, credits_usdt, total_deposited)
       VALUES ($1, 'free', 500, $2, 0, 0)`, [KEY, WALLET]);

    for (const m of ['getTransactionReceipt', 'getBlockNumber']) restore[m] = ethers.JsonRpcProvider.prototype[m];
    ethers.JsonRpcProvider.prototype.getBlockNumber = async () => 1000;
    ethers.JsonRpcProvider.prototype.getTransactionReceipt = async () => ({
      status: 1, blockNumber: 900,
      logs: [{
        address: USDT,
        topics: [TRANSFER, pad(WALLET), pad(VAULT)],
        data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [1_000_000n]), // 1.00 USDT
      }],
    });
    const mod = await import('../src/billing/api_keys_route.mjs');
    router = mod.createSimpleApiKeysRouter(pool);
  });

  after(async () => {
    for (const [m, f] of Object.entries(restore)) ethers.JsonRpcProvider.prototype[m] = f;
    if (raw) { await raw.query('ROLLBACK'); await raw.end(); }
  });

  const app = () => { const a = express(); a.use(express.json()); a.use('/api/keys', router); return a; };
  const deposit = (tx) => request(app()).post('/api/keys/deposit').set('X-API-Key', KEY).send({ tx_hash: tx });
  const balance = async () => parseFloat((await raw.query(`SELECT credits_usdt FROM api_credits WHERE api_key=$1`, [KEY])).rows[0].credits_usdt);

  it('d1: a crash between insert and credit leaves nothing recorded, and the retry credits once', async () => {
    const tx = '0x' + '1'.repeat(64);
    failNextUpdate = true;
    const crashed = await deposit(tx);
    expect(crashed.status).to.equal(500);
    const rows = await raw.query(`SELECT count(*)::int n FROM api_deposits WHERE tx_hash=$1`, [tx]);
    expect(rows.rows[0].n, 'deposit row must roll back with the failed credit').to.equal(0);
    expect(await balance()).to.equal(0);

    const retry = await deposit(tx);
    expect(retry.status, JSON.stringify(retry.body)).to.equal(200);
    expect(await balance()).to.be.closeTo(1, 1e-9);
    const again = await deposit(tx);
    expect(again.status).to.equal(400);
    expect(again.body.error).to.equal('tx_already_used');
    expect(await balance()).to.be.closeTo(1, 1e-9);
  });

  it('d2: a duplicate that slips past the pre-check (UNIQUE race) is tx_already_used, credited once', async () => {
    const tx = '0x' + '2'.repeat(64);
    const before = await balance();
    // Simulate the race: the row lands between the pre-check and the insert.
    const origQuery = pool.query;
    let injected = false;
    pool.query = async (sql, params) => {
      const r = await origQuery(sql, params);
      if (!injected && /SELECT 1 FROM api_deposits WHERE tx_hash/.test(sql)) {
        injected = true;
        await raw.query(`INSERT INTO api_deposits (api_key, tx_hash, amount_usdt, credited_usdt) VALUES ($1, $2, 1, 1)`, ['sk_other', tx]);
      }
      return r;
    };
    const res = await deposit(tx);
    pool.query = origQuery;
    expect(res.status).to.equal(400);
    expect(res.body.error).to.equal('tx_already_used');
    expect(await balance()).to.equal(before);
  });
});
