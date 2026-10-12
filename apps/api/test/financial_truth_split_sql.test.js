// Real-SQL check of the external/internal revenue split (truth.js
// INTERNAL_PREDICATE). PR #521's version joined only treasury-bound api keys,
// so an x402 row whose client_id IS a founder wallet (x402 rows carry the payer
// address) and any key bound to founder wallet 0x5cbda3… counted as EXTERNAL.
// Local Postgres only, inside a rolled-back transaction.
import { expect } from 'chai';

describe('financial truth: external vs internal split (real SQL)', function () {
  this.timeout(20000);
  let raw; let INTERNAL_PREDICATE; let FOUNDER_WALLETS;
  const ext = '0x1111111111111111111111111111111111111111';

  before(async function () {
    const url = process.env.DATABASE_URL || '';
    if (!url || /rlwy\.net|railway\.app|railway\.internal/.test(url)) this.skip();
    ({ INTERNAL_PREDICATE } = await import('../src/services/financial/truth.js'));
    ({ FOUNDER_WALLETS } = await import('../src/payments/founder_wallets.js'));
    const { default: pg } = await import('pg');
    raw = new pg.Client({ connectionString: url });
    try { await raw.connect(); } catch { raw = null; this.skip(); }
    await raw.query('BEGIN');
    await raw.query(`CREATE TEMP TABLE revenue_events_v2 (client_id TEXT, amount_usdt NUMERIC, is_test_data BOOLEAN) ON COMMIT DROP`);
    await raw.query(`CREATE TEMP TABLE api_credits (api_key TEXT PRIMARY KEY, wallet_address TEXT) ON COMMIT DROP`);
    await raw.query(`INSERT INTO api_credits VALUES ('sk_ext', $1), ('sk_founder', '0x5CBDA3A1C0F1B28FECEA1D919785321E88F9FA97'), ('sk_treasury', '0x966E1Ae22996545015b1414B35234b10719d7Ad4')`, [ext]);
    await raw.query(`INSERT INTO revenue_events_v2 VALUES
      ('sk_ext', 0.10, false),                                        -- external key
      ($1, 0.10, false),                                              -- external x402 payer
      ('0x175727a8486a7eb3ac4bcf2a1a89fd2d58ca0dfd', 0.10, false),    -- founder x402 payer (mis-flagged)
      ('sk_founder', 0.05, false),                                    -- key bound to founder wallet
      ('sk_treasury', 0.05, false),                                   -- key bound to treasury
      ('sk_ext', 100, true)                                           -- test data, excluded`, [ext]);
  });
  after(async () => { if (raw) { await raw.query('ROLLBACK'); await raw.end(); } });

  it('founder payers and founder/treasury-bound keys are internal; the rest is external', async () => {
    const r = await raw.query(`
      SELECT COALESCE(SUM(e.amount_usdt) FILTER (WHERE NOT ${INTERNAL_PREDICATE}), 0)::float AS ext,
             COALESCE(SUM(e.amount_usdt) FILTER (WHERE ${INTERNAL_PREDICATE}), 0)::float AS int
        FROM pg_temp.revenue_events_v2 e LEFT JOIN pg_temp.api_credits t ON t.api_key = e.client_id
       WHERE e.is_test_data = false OR e.is_test_data IS NULL`, [FOUNDER_WALLETS]);
    expect(r.rows[0].ext).to.be.closeTo(0.20, 1e-9);
    expect(r.rows[0].int).to.be.closeTo(0.20, 1e-9);
  });
});
