// claim_expiry_job (Step 4.3, 2026-10-21). Before: the reallocation insert omitted `role`
// (NOT NULL + part of the PK) so every run rolled back and nothing expired; money was split
// in JS floats; it depended on runtime ALTER TABLE. Real SQL on the production table shape.
import { expect } from 'chai';
import { sweepExpiredEarnings } from '../src/scheduler/jobs/claim_expiry_job.js';

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
    const swept = await sum(`SELECT SUM(amount_usdt)::text t FROM treasury_sweeps`);
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
});
