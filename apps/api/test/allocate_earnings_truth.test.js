// POST /api/nodes/admin/allocate-earnings (W1 review follow-ups, 2026-10-20/21).
//
// Allocated rows become signed USDT payouts. The route must count only real consumed usage,
// never allocate the same share twice (repeat calls, legacy wallet-keyed rows, finalizer
// rows, after a claim), work on the production table (PK epoch_id, role, wallet_or_node_id),
// and stay off unless explicitly enabled (the epoch finalizer is the allocator of record).
//
// Real SQL against local Postgres (CI: the Postgres service) in a throwaway schema with the
// production epoch_earnings shape, through the real router (verifyJWT + backfill secret).
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

describe('allocate-earnings: consumed usage only, never twice (real SQL)', function () {
  this.timeout(30000);
  const url = process.env.DATABASE_URL || '';
  const schema = `alloc_test_${process.pid}_${Date.now()}`;
  const WALLET = '0x000000000000000000000000000000000000BEEF';
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
      node_id TEXT, amount_usdt NUMERIC(18,8), is_test_data BOOLEAN, op_type TEXT, is_billable BOOLEAN, request_id TEXT,
      epoch_id INTEGER DEFAULT 1)`);
    await admin.query(`CREATE TABLE ${schema}.epochs (id INTEGER PRIMARY KEY, status TEXT)`);
    await admin.query(`CREATE TABLE ${schema}.epoch_earnings (
      epoch_id INTEGER NOT NULL, role TEXT NOT NULL, wallet_or_node_id TEXT NOT NULL,
      amount_usdt NUMERIC(18,8) NOT NULL, status TEXT NOT NULL DEFAULT 'UNPAID', created_at BIGINT NOT NULL,
      PRIMARY KEY (epoch_id, role, wallet_or_node_id))`);
    await admin.query(`CREATE TABLE ${schema}.registered_nodes (node_id TEXT PRIMARY KEY, wallet TEXT)`);
    await admin.query(`CREATE TABLE ${schema}.nodes (node_id TEXT PRIMARY KEY, wallet TEXT)`);
    await admin.query(`INSERT INTO ${schema}.registered_nodes VALUES ('node-a', $1)`, [WALLET]);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 4 });
    for (const k of ['ADMIN_BACKFILL_SECRET', 'JWT_SECRET', 'MANUAL_EARNINGS_ALLOCATION_ENABLED']) saved[k] = process.env[k];
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

  afterEach(() => { process.env.MANUAL_EARNINGS_ALLOCATION_ENABLED = 'true'; });

  beforeEach(async () => {
    process.env.MANUAL_EARNINGS_ALLOCATION_ENABLED = 'true';
    await pool.query(`DELETE FROM revenue_events_v2`);
    await pool.query(`DELETE FROM epoch_earnings`);
    await pool.query(`DELETE FROM epochs`);
    await pool.query(`DELETE FROM nodes`);
    await pool.query(`INSERT INTO epochs VALUES (1, 'CLOSED'), (2, 'OPEN')`); // fixture revenue is in closed epoch 1
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

  const allocate = (body = {}) => request(app).post('/api/nodes/admin/allocate-earnings')
    .set('Authorization', `Bearer ${token}`).send({ adminSecret: BACKFILL, nodeId: 'node-a', ...body });
  const total = async (where = 'true') =>
    Number((await pool.query(`SELECT COALESCE(SUM(amount_usdt),0) AS t FROM epoch_earnings WHERE ${where}`)).rows[0].t);

  it('is off unless MANUAL_EARNINGS_ALLOCATION_ENABLED=true (the epoch finalizer is the allocator)', async () => {
    delete process.env.MANUAL_EARNINGS_ALLOCATION_ENABLED;
    const res = await allocate();
    expect(res.status).to.equal(503);
    expect(res.body.error).to.equal('manual_allocation_disabled');
    expect(await total()).to.equal(0);
  });

  it('allocates 50% of consumed usage only (3.00 → 1.50) under its own key', async () => {
    const res = await allocate();
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(res.body.totalRevenue).to.equal(3);
    expect(await total()).to.equal(1.5);
    expect(await total(`epoch_id = -1 AND role = 'manual_allocation'`)).to.equal(1.5);
  });

  it('repeat calls do not allocate again, and a walletAddress in the body is ignored', async () => {
    await allocate();
    await allocate({ walletAddress: '0x0000000000000000000000000000000000000bad' });
    await allocate();
    expect(await total()).to.equal(1.5);
  });

  it('legacy rows keyed by the registered wallet count, even when the caller sends no wallet', async () => {
    await pool.query(`INSERT INTO epoch_earnings VALUES (7, 'node_operator', $1, 1.5, 'UNPAID', 0)`, [WALLET]);
    await allocate();
    expect(await total()).to.equal(1.5);
  });

  it('finalizer rows for the node count; claim-expiry reallocations (epoch 0) do not', async () => {
    await pool.query(`INSERT INTO epoch_earnings VALUES (5, 'node_operator', 'node-a', 1.0, 'UNPAID', 0)`);
    await pool.query(`INSERT INTO epoch_earnings VALUES (0, 'node_operator', 'node-a', 0.7, 'UNPAID', 0)`);
    const res = await allocate();
    expect(res.body.allocated).to.equal(0.5);
    expect(await total(`epoch_id = -1`)).to.equal(0.5);
  });

  it('after the earnings are CLAIMED, a new call does not re-allocate them', async () => {
    await allocate();
    await pool.query(`UPDATE epoch_earnings SET status = 'CLAIMED'`);
    await allocate();
    expect(await total()).to.equal(1.5);
  });

  it('new consumed usage tops up only the difference — on the production primary key', async () => {
    await allocate();
    await pool.query(`INSERT INTO revenue_events_v2 VALUES ('node-a', 1.00, false, 'rpc_call', true, 'req-5')`);
    const res = await allocate();
    expect(res.status, JSON.stringify(res.body)).to.equal(200);
    expect(await total()).to.equal(2);
  });

  it('concurrent calls allocate the share once', async () => {
    await Promise.all([allocate(), allocate(), allocate(), allocate()]);
    expect(await total()).to.equal(1.5);
  });

  it('only an exact "true" enables the route', async () => {
    for (const v of ['TRUE', '1', 'yes', ' true']) {
      process.env.MANUAL_EARNINGS_ALLOCATION_ENABLED = v;
      expect((await allocate()).status, JSON.stringify(v)).to.equal(503);
    }
    expect(await total()).to.equal(0);
  });

  it('revenue of the OPEN epoch is not allocated manually — the finalizer pays it once at close', async () => {
    // manual first, finalizer second (the double-pay ordering)
    await pool.query(`INSERT INTO revenue_events_v2 VALUES ('node-a', 4.00, false, 'rpc_call', true, 'req-open', 2)`);
    const first = await allocate();
    expect(first.body.totalRevenue).to.equal(3); // epoch 2 (open) excluded
    expect(await total()).to.equal(1.5);
    // the scheduler closes epoch 2 and the finalizer writes its node_operator row in the same txn
    await pool.query(`UPDATE epochs SET status = 'CLOSED' WHERE id = 2`);
    await pool.query(`INSERT INTO epoch_earnings VALUES (2, 'node_operator', 'node-a', 2.0, 'UNPAID', 0)`);
    await allocate();
    expect(await total(), 'total stays 50% of 7.00, never 1.5 + 2.0 + 2.0').to.equal(3.5);
  });

  it('revenue not yet assigned to an epoch is left to the finalizer', async () => {
    await pool.query(`INSERT INTO revenue_events_v2 VALUES ('node-a', 4.00, false, 'rpc_call', true, 'req-orphan', NULL)`);
    expect((await allocate()).body.totalRevenue).to.equal(3);
  });

  it('EXPIRED rows count as already allocated', async () => {
    await pool.query(`INSERT INTO epoch_earnings VALUES (9, 'node_operator', 'node-a', 1.5, 'EXPIRED', 0)`);
    await allocate();
    expect(await total(`epoch_id = -1`)).to.equal(0);
  });

  it('wallets from both node tables are counted', async () => {
    const other = '0x00000000000000000000000000000000000000aa';
    await pool.query(`INSERT INTO nodes VALUES ('node-a', $1)`, [other]);
    await pool.query(`INSERT INTO epoch_earnings VALUES (7, 'node_operator', $1, 1.5, 'UNPAID', 0)`, [other]);
    await allocate();
    expect(await total(`epoch_id = -1`)).to.equal(0);
  });

  it('a wallet-lookup failure aborts (500) instead of silently skipping wallet-keyed rows', async () => {
    const a = express(); a.use(express.json());
    const failing = {
      query: (...q) => pool.query(...q),
      async connect() {
        const c = await pool.connect();
        return {
          async query(sql, params) {
            if (/SELECT wallet FROM registered_nodes/.test(sql)) { const e = new Error('permission denied'); e.code = '42501'; throw e; }
            return c.query(sql, params);
          },
          release: (e) => c.release(e),
        };
      },
    };
    const { createClaimsRouter } = await import('../src/routes/claims_route.mjs');
    a.use('/api/nodes', createClaimsRouter(failing));
    const res = await request(a).post('/api/nodes/admin/allocate-earnings')
      .set('Authorization', `Bearer ${token}`).send({ adminSecret: BACKFILL, nodeId: 'node-a' });
    expect(res.status).to.equal(500);
    expect(await total()).to.equal(0);
  });

  it('an epoch the finalizer already split across several nodes gets no manual top-up (no pool overpay)', async () => {
    await pool.query(`DELETE FROM revenue_events_v2`);
    await pool.query(`INSERT INTO epochs VALUES (3, 'CLOSED')`);
    await pool.query(`INSERT INTO revenue_events_v2 VALUES
      ('node-a', 9, false, 'rpc_call', true, 'r-a', 3), ('node-b', 1, false, 'rpc_call', true, 'r-b', 3)`);
    // finalizer: pool 5 split equally
    await pool.query(`INSERT INTO epoch_earnings VALUES (3, 'node_operator', 'node-a', 2.5, 'UNPAID', 0), (3, 'node_operator', 'node-b', 2.5, 'UNPAID', 0)`);
    const res = await allocate();
    expect(res.body.totalRevenue).to.equal(0); // finalized epoch excluded
    expect(res.body.allocated).to.equal(0);
    expect(await total(`role = 'node_operator' OR role = 'manual_allocation'`), 'node payouts stay = pool').to.equal(5);
  });

  it('a CLOSED epoch the finalizer never ran on is the backfill case: 50% of its consumed usage', async () => {
    const res = await allocate(); // fixture revenue is in closed epoch 1 with no node_operator rows
    expect(res.body.allocated).to.equal(1.5);
  });
});
