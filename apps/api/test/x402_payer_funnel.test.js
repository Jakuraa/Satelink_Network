// Per-payer x402 funnel (Step 3.4) — real SQL, local Postgres only, rolled back.
import { expect } from 'chai';

describe('admin: per-payer x402 funnel (real SQL)', function () {
  this.timeout(20000);
  let raw; let getX402PayerFunnel;
  const A = '0xaaaa00000000000000000000000000000000f001';
  const B = '0xbbbb00000000000000000000000000000000f002';
  const C = '0xcccc00000000000000000000000000000000f003';
  const FOUNDER = '0x5cbda3a1c0f1b28fecea1d919785321e88f9fa97';

  before(async function () {
    const url = process.env.DATABASE_URL || '';
    if (!url || /rlwy\.net|railway\.app|railway\.internal/.test(url)) this.skip();
    ({ getX402PayerFunnel } = await import('../src/admin/x402_payer_funnel.js'));
    const { default: pg } = await import('pg');
    raw = new pg.Client({ connectionString: url });
    try { await raw.connect(); } catch { raw = null; this.skip(); }
    await raw.query('BEGIN');
    await raw.query(`CREATE TEMP TABLE payment_sources (source text, payer text, credited_api_key text, is_test_data boolean) ON COMMIT DROP`);
    await raw.query(`CREATE TEMP TABLE api_usage_daily (api_key text, date date, request_count int) ON COMMIT DROP`);
    await raw.query(`INSERT INTO pg_temp.payment_sources VALUES
      ('x402', $1, 'x402_a', false),            -- A paid once, used 1 call (the paid call)
      ('x402', $2, 'x402_b', false),            -- B paid twice, used 7 calls
      ('x402', $2, 'x402_b', false),
      ('x402', $3, 'x402_c', true),             -- C test data → excluded
      ('x402', $4, 'x402_f', false),            -- founder → excluded
      ('dodo', $1, 'x402_a', false)             -- other rail → ignored`, [A, B, C, FOUNDER]);
    await raw.query(`INSERT INTO pg_temp.api_usage_daily VALUES ('x402_a', '2026-10-12', 1), ('x402_b', '2026-10-11', 3), ('x402_b', '2026-10-12', 4), ('x402_f', '2026-10-12', 99)`);
  });
  after(async () => { if (raw) { await raw.query('ROLLBACK'); await raw.end(); } });

  it('counts payers per stage; anonymous stages are null with a reason', async () => {
    const pool = { query: (sql, p) => raw.query(sql.replace(/FROM payment_sources/g, 'FROM pg_temp.payment_sources').replace(/JOIN api_usage_daily/g, 'JOIN pg_temp.api_usage_daily'), p) };
    const f = await getX402PayerFunnel(pool);
    expect(f.stages.paid.value).to.equal(2);
    expect(f.stages.first_call.value).to.equal(2);
    expect(f.stages.repeat_calls.value).to.equal(1);
    expect(f.stages.repeat_purchase.value).to.equal(1);
    expect(f.stages.discovery_hits.value).to.equal(null);
    expect(f.stages.x402_issued.reason).to.match(/anonymous/);
  });
});
