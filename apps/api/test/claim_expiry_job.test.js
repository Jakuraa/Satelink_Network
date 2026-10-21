// claim_expiry_job (Step 4.3, 2026-10-21). Before: the reallocation insert omitted `role`
// (NOT NULL + part of the PK) so every run rolled back and nothing expired; money was split
// in JS floats; it depended on runtime ALTER TABLE. Real SQL on the production table shape.
import { expect } from 'chai';
import { sweepExpiredEarnings, startClaimExpiryJob, runExpiryJob } from '../src/scheduler/jobs/claim_expiry_job.js';

describe('claim expiry: sweep + reallocation (real SQL)', function () {
  this.timeout(30000);
  const url = process.env.DATABASE_URL || '';
  const schema = `cexp_test_${process.pid}_${Date.now()}`;
  let pg, admin, pool;
  const OLD = Math.floor(Date.now() / 1000) - 60 * 86400; // 60 days ago
  const NEW = Math.floor(Date.now() / 1000) - 86400;

  before(async function () {
    if (!/@?(localhost|127\.0\.0\.1)(:|\/|\?)/.test(url) && !/host=\/tmp/.test(url)) this.skip();
    ({ default: pg } = await import('pg'));
    admin = new pg.Client({ connectionString: url });
    try { await admin.connect(); } catch { admin = null; this.skip(); }
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 3 });
  });
  after(async () => {
    await pool?.end().catch(() => {});
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {}); await admin.end(); }
  });

  async function reset({ sweeps = true, expiredAt = false } = {}) {
    await pool.query(`DROP TABLE IF EXISTS epoch_earnings, nodes, treasury_sweeps`);
    await pool.query(`CREATE TABLE epoch_earnings (epoch_id INTEGER NOT NULL, role TEXT NOT NULL, wallet_or_node_id TEXT NOT NULL,
      amount_usdt NUMERIC(18,8) NOT NULL, status TEXT NOT NULL DEFAULT 'UNPAID', created_at BIGINT NOT NULL
      ${expiredAt ? ', expired_at BIGINT' : ''}, PRIMARY KEY (epoch_id, role, wallet_or_node_id))`);
    await pool.query(`CREATE TABLE nodes (node_id TEXT PRIMARY KEY, status TEXT)`);
    if (sweeps) await pool.query(`CREATE TABLE treasury_sweeps (id SERIAL PRIMARY KEY, node_id TEXT, amount_usdt NUMERIC(18,8), reason TEXT, swept_at BIGINT)`);
    await pool.query(`INSERT INTO nodes VALUES ('n-active-1', 'active'), ('n-active-2', 'online'), ('n-off', 'offline')`);
    await pool.query(`INSERT INTO epoch_earnings VALUES
      (1, 'node_operator', 'n-old', 1.00000001, 'UNPAID', ${OLD}),
      (2, 'node_operator', 'n-old', 0.5,        'UNPAID', ${OLD}),
      (3, 'node_operator', 'n-claiming', 2.0,   'CLAIMING', ${OLD}),
      (4, 'node_operator', 'n-recent', 3.0,     'UNPAID', ${NEW})`);
  }
  const sum = async (sql) => (await pool.query(sql)).rows[0].t;

  it('expires old UNPAID rows, sweeps 50% to treasury, reallocates the rest (money conserved, numeric)', async () => {
    await reset();
    const r = await sweepExpiredEarnings(pool);
    expect(r.nodesAffected).to.equal(1);
    expect(await sum(`SELECT string_agg(status, ',' ORDER BY epoch_id) t FROM epoch_earnings WHERE epoch_id IN (1,2,3,4)`)).to.equal('EXPIRED,EXPIRED,CLAIMING,UNPAID');
    const expired = '1.50000001';
    const swept = await sum(`SELECT SUM(amount_usdt)::text t FROM treasury_sweeps WHERE reason = '48_day_expiry_50pct'`);
    const realloc = await sum(`SELECT SUM(amount_usdt)::text t FROM epoch_earnings WHERE role = 'expiry_reallocation'`);
    expect(swept).to.equal('0.75000000');
    expect((await pool.query(`SELECT ($1::numeric + $2::numeric)::text t`, [swept, realloc])).rows[0].t).to.match(/^1\.5000000/);
    expect(Number(realloc)).to.be.at.most(Number(expired) - Number(swept) + 1e-12);
    expect(await sum(`SELECT COUNT(*)::int t FROM epoch_earnings WHERE role = 'expiry_reallocation'`)).to.equal(2); // two active nodes
  });

  it('a second run adds to the reallocation rows instead of failing on the primary key', async () => {
    await reset();
    await sweepExpiredEarnings(pool);
    await pool.query(`INSERT INTO epoch_earnings VALUES (5, 'node_operator', 'n-old2', 4.0, 'UNPAID', ${OLD})`);
    const r = await sweepExpiredEarnings(pool);
    expect(r.nodesAffected).to.equal(1);
    expect(await sum(`SELECT COUNT(*)::int t FROM epoch_earnings WHERE role = 'expiry_reallocation'`)).to.equal(2);
  });

  it('missing treasury_sweeps → nothing is expired (fail closed)', async () => {
    await reset({ sweeps: false });
    const r = await sweepExpiredEarnings(pool);
    expect(r.skipped).to.equal('treasury_sweeps_missing');
    expect(await sum(`SELECT COUNT(*)::int t FROM epoch_earnings WHERE status = 'EXPIRED'`)).to.equal(0);
  });

  it('sets expired_at only when the column exists', async () => {
    await reset({ expiredAt: true });
    await sweepExpiredEarnings(pool);
    expect(await sum(`SELECT COUNT(*)::int t FROM epoch_earnings WHERE status = 'EXPIRED' AND expired_at IS NOT NULL`)).to.equal(2);
  });

  it('no active nodes → the pooled half is recorded with the treasury, not lost', async () => {
    await reset();
    await pool.query(`UPDATE nodes SET status = 'offline'`);
    await sweepExpiredEarnings(pool);
    expect(await sum(`SELECT SUM(amount_usdt)::text t FROM treasury_sweeps`)).to.equal('1.50000001');
    expect(await sum(`SELECT COUNT(*)::int t FROM epoch_earnings WHERE role = 'expiry_reallocation'`)).to.equal(0);
  });

  it('the scheduler is off unless CLAIM_EXPIRY_ENABLED=true AND SETTLEMENT_DRY_RUN=0 — and touches nothing', async () => {
    await reset();
    const saved = { e: process.env.CLAIM_EXPIRY_ENABLED, d: process.env.SETTLEMENT_DRY_RUN };
    try {
      for (const [e, d] of [[undefined, '0'], ['true', '1'], ['true', undefined], ['TRUE', '0']]) {
        if (e === undefined) delete process.env.CLAIM_EXPIRY_ENABLED; else process.env.CLAIM_EXPIRY_ENABLED = e;
        if (d === undefined) delete process.env.SETTLEMENT_DRY_RUN; else process.env.SETTLEMENT_DRY_RUN = d;
        const job = startClaimExpiryJob(pool);
        expect((await job.runNow()).disabled, `${e}/${d}`).to.equal(true);
        job.stop();
      }
      expect(await sum(`SELECT COUNT(*)::int t FROM epoch_earnings WHERE status = 'EXPIRED'`)).to.equal(0);
    } finally {
      if (saved.e === undefined) delete process.env.CLAIM_EXPIRY_ENABLED; else process.env.CLAIM_EXPIRY_ENABLED = saved.e;
      if (saved.d === undefined) delete process.env.SETTLEMENT_DRY_RUN; else process.env.SETTLEMENT_DRY_RUN = saved.d;
    }
  });

  const conserved = async () => (await pool.query(`SELECT
      (SELECT COALESCE(SUM(amount_usdt),0) FROM treasury_sweeps)
    + (SELECT COALESCE(SUM(amount_usdt),0) FROM epoch_earnings WHERE role = 'expiry_reallocation' AND status = 'UNPAID') AS out`)).rows[0].out;

  it('money is conserved exactly: swept + credited + uncredited == expired (incl. split dust)', async () => {
    await reset();
    await pool.query(`INSERT INTO nodes VALUES ('n-active-3', 'healthy')`); // 3 nodes: 0.75000000 / 3 leaves no dust; 0.7500000x would
    await pool.query(`UPDATE epoch_earnings SET amount_usdt = 1.00000002 WHERE epoch_id = 1`);
    await sweepExpiredEarnings(pool);
    expect(await conserved()).to.equal('1.50000002');
  });

  it('never adds a reallocation onto an EXPIRED or CLAIMING row — that share goes to the treasury', async () => {
    await reset();
    await pool.query(`INSERT INTO epoch_earnings VALUES
      (0, 'expiry_reallocation', 'n-active-1', 5, 'CLAIMING', ${NEW}),
      (0, 'expiry_reallocation', 'n-active-2', 7, 'EXPIRED',  ${NEW})`);
    await sweepExpiredEarnings(pool);
    const rows = Object.fromEntries((await pool.query(`SELECT wallet_or_node_id k, amount_usdt::text v, status FROM epoch_earnings WHERE role = 'expiry_reallocation'`))
      .rows.map((r) => [r.k, `${r.v}/${r.status}`]));
    expect(rows).to.deep.equal({ 'n-active-1': '5.00000000/CLAIMING', 'n-active-2': '7.00000000/EXPIRED' });
    expect(await sum(`SELECT SUM(amount_usdt)::text t FROM treasury_sweeps`)).to.equal('1.50000001');
  });

  it('platform / pool / distribution rows are never expired', async () => {
    await reset();
    await pool.query(`INSERT INTO epoch_earnings VALUES (9, 'platform', 'PLATFORM_TREASURY', 10, 'UNPAID', ${OLD}), (9, 'distribution_pool', 'DAO_POOL', 4, 'UNPAID', ${OLD})`);
    await sweepExpiredEarnings(pool);
    expect(await sum(`SELECT string_agg(status, ',' ORDER BY role) t FROM epoch_earnings WHERE epoch_id = 9`)).to.equal('UNPAID,UNPAID');
  });

  it('runExpiryJob is gated like the scheduler (a manual trigger cannot bypass it)', async () => {
    await reset();
    const saved = { e: process.env.CLAIM_EXPIRY_ENABLED, d: process.env.SETTLEMENT_DRY_RUN };
    try {
      delete process.env.CLAIM_EXPIRY_ENABLED; process.env.SETTLEMENT_DRY_RUN = '0';
      expect((await runExpiryJob(pool)).disabled).to.equal(true);
      expect(await sum(`SELECT COUNT(*)::int t FROM epoch_earnings WHERE status = 'EXPIRED'`)).to.equal(0);
    } finally {
      if (saved.e === undefined) delete process.env.CLAIM_EXPIRY_ENABLED; else process.env.CLAIM_EXPIRY_ENABLED = saved.e;
      if (saved.d === undefined) delete process.env.SETTLEMENT_DRY_RUN; else process.env.SETTLEMENT_DRY_RUN = saved.d;
    }
  });
});
