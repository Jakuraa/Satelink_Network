// Real-SQL check of CONSUMED_USAGE_PREDICATE (S6): only consumed usage counts —
// not deposits, refund reversals, unbilled rows, x402 bundle purchases or test data,
// and a row with NULL flag columns must not drop out. Same predicate feeds
// /api/financial/truth and the admin consumed_usage metric.
// Local Postgres only, inside a rolled-back transaction.
import { expect } from 'chai';

describe('S6: consumed-usage predicate (real SQL)', function () {
  this.timeout(20000);
  let raw; let CONSUMED_USAGE_PREDICATE;

  before(async function () {
    const url = process.env.DATABASE_URL || '';
    if (!url || /rlwy\.net|railway\.app|railway\.internal/.test(url)) this.skip();
    ({ CONSUMED_USAGE_PREDICATE } = await import('../src/services/financial/truth.js'));
    const { default: pg } = await import('pg');
    raw = new pg.Client({ connectionString: url });
    try { await raw.connect(); } catch { raw = null; this.skip(); }
    await raw.query('BEGIN');
    await raw.query(`CREATE TEMP TABLE revenue_events_v2 (
      amount_usdt NUMERIC, op_type TEXT, is_billable BOOLEAN, request_id TEXT, is_test_data BOOLEAN) ON COMMIT DROP`);
    await raw.query(`INSERT INTO revenue_events_v2 VALUES
      (0.00003, 'rpc_call',             true,  'req-1',      false),  -- usage: counted
      (0.01,    NULL,                   NULL,  NULL,         NULL),   -- usage, NULL flags: counted
      (19.00,   'subscription_payment', true,  'sub-1',      false),  -- deposit
      (9.99,    'pack_purchase',        true,  'pack-1',     false),  -- deposit
      (-1.00,   'refund_reversal',      true,  'ref-1',      false),  -- refund
      (5.00,    'rpc_call',             false, 'req-2',      false),  -- never charged
      (0.10,    'rpc_call',             true,  'x402:0xabc', false),  -- x402 bundle purchase
      (100,     'rpc_call',             true,  'req-3',      true)    -- test data`);
  });
  after(async () => { if (raw) { await raw.query('ROLLBACK'); await raw.end(); } });

  it('sums only consumed usage', async () => {
    const r = await raw.query(`
      SELECT COALESCE(SUM(e.amount_usdt), 0)::text AS total, COUNT(*)::int AS n
        FROM pg_temp.revenue_events_v2 e
       WHERE (e.is_test_data = false OR e.is_test_data IS NULL)
         AND (${CONSUMED_USAGE_PREDICATE})`);
    expect(r.rows[0].n).to.equal(2);
    expect(r.rows[0].total).to.equal('0.01003');
  });
});
