// POST /api/nodes/admin/allocate-earnings (W1 review follow-up, 2026-10-20).
//
// The allocated amount becomes a signed USDT payout (claim_processor reads
// epoch_earnings as-is), so it must count only real consumed usage, and it must never
// allocate the same share twice. Before this fix it summed ALL revenue_events_v2 rows for
// the node (test data, deposits, refunds, x402 bundle purchases) and subtracted only
// UNPAID rows written under nodeId — so a call with walletAddress, or any call after a
// claim, allocated the share again.
//
// Real SQL against local Postgres (CI: the Postgres service) in a throwaway schema,
// through the real router (real verifyJWT + ADMIN_BACKFILL_SECRET gate).
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

describe('allocate-earnings: consumed usage only, never twice (real SQL)', function () {
  this.timeout(30000);
  const url = process.env.DATABASE_URL || '';
  const schema = `alloc_test_${process.pid}_${Date.now()}`;
  const WALLET = '0x000000000000000000000000000000000000beef';
  const BACKFILL = 'test-only-backfill-value';
  const saved = {};
  let pg, admin, pool, app, token;

  before(async function () {
    if (!/@?(localhost|127\.0\.0\.1)(:|\/|\?)/.test(url) && !/host=\/tmp/.test(url)) this.skip();
    ({ default: pg } = await import('pg'));
    admin = new pg.Client({ connectionString: url });
    try { await admin.connect(); } catch { admin = null; this.skip(); }
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`CREATE TABLE ${schema}.revenue_events_v2 (
      node_id TEXT, amount_usdt NUMERIC(18,8), is_test_data BOOLEAN,
      op_type TEXT, is_billable BOOLEAN, request_id TEXT)`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 3 });
    for (const k of ['ADMIN_BACKFILL_SECRET', 'JWT_SECRET']) saved[k] = process.env[k];
    process.env.ADMIN_BACKFILL_SECRET = BACKFILL;
    if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-only-alloc-'.padEnd(64, '0');
    token = jwt.sign({ userId: 'staff', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const { createClaimsRouter } = await import('../src/routes/claims_route.mjs');
    app = express(); app.use(express.json()); app.use('/api/nodes', createClaimsRouter(pool));
  });

  after(async () => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await pool?.end().catch(() => {});
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {}); await admin.end(); }
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM revenue_events_v2`);
    await pool.query(`DROP TABLE IF EXISTS epoch_earnings`);
    await pool.query(`INSERT INTO revenue_events_v2 VALUES
      ('node-a', 2.00,  false, 'rpc_call',             true,  'req-1'),      -- real usage
      ('node-a', 1.00,  NULL,  NULL,                   NULL,  NULL),         -- real usage, NULL flags
      ('node-a', 100,   true,  'rpc_call',             true,  'req-2'),      -- test data
      ('node-a', 19.00, false, 'subscription_payment', true,  'sub-1'),      -- deposit
      ('node-a', -1.00, false, 'refund_reversal',      true,  'ref-1'),      -- refund
      ('node-a', 5.00,  false, 'rpc_call',             false, 'req-3'),      -- never charged
      ('node-a', 0.10,  false, 'rpc_call',             true,  'x402:0xab'),  -- bundle purchase
      ('node-b', 50,    false, 'rpc_call',             true,  'req-4')       -- another node`);
  });

  const allocate = (body) => request(app).post('/api/nodes/admin/allocate-earnings')
    .set('Authorization', `Bearer ${token}`).send({ adminSecret: BACKFILL, ...body });
  const total = async () => Number((await pool.query(`SELECT COALESCE(SUM(amount_usdt),0) AS t FROM epoch_earnings`)).rows[0].t);

  it('allocates 50% of consumed usage only (3.00 → 1.50), ignoring test data and non-usage rows', async () => {
    const res = await allocate({ nodeId: 'node-a' });
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body.totalRevenue).to.equal(3);
    expect(await total()).to.equal(1.5);
  });

  it('calling again with walletAddress does not allocate the share a second time', async () => {
    await allocate({ nodeId: 'node-a', walletAddress: WALLET });
    await allocate({ nodeId: 'node-a', walletAddress: WALLET });
    await allocate({ nodeId: 'node-a' });
    expect(await total()).to.equal(1.5);
  });

  it('after the earnings are CLAIMED, a new call does not re-allocate them', async () => {
    await allocate({ nodeId: 'node-a' });
    await pool.query(`UPDATE epoch_earnings SET status = 'CLAIMED'`);
    await allocate({ nodeId: 'node-a' });
    expect(await total()).to.equal(1.5);
  });

  it('new consumed usage after an allocation allocates only the difference', async () => {
    await allocate({ nodeId: 'node-a' });
    await pool.query(`INSERT INTO revenue_events_v2 VALUES ('node-a', 1.00, false, 'rpc_call', true, 'req-5')`);
    await allocate({ nodeId: 'node-a' });
    expect(await total()).to.equal(2);
  });
});
