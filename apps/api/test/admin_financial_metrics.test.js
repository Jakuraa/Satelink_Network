// Admin command center (Step 5): metric registry + alerts. Real SQL on local
// Postgres inside a rolled-back transaction.
//   m1 every metric carries definition/source_query/currency/as_of/status
//   m2 a metric whose source table is missing is value:null + 'unavailable' (never 0)
//   m3 categories are separate: founder + test payments never appear in external funds
//   m4 on-chain settlement is reported as dry_run while SETTLEMENT_DRY_RUN is on
//   a1 payment_without_credit fires for an external x402 payment with no credit
//   a2 x402_402_loop fires when an issued key is refused while credit remains
//   a3 an alert whose source is missing is firing:null, not false
import { expect } from 'chai';
import crypto from 'node:crypto';

describe('admin financial metrics + alerts (real SQL)', function () {
  this.timeout(20000);
  let raw; let db; let fm; let keys;
  const EXT = '0x7777000000000000000000000000000000007777';
  const FOUNDER = '0x5cbda3a1c0f1b28fecea1d919785321e88f9fa97';

  before(async function () {
    const url = process.env.DATABASE_URL || '';
    if (!url || /rlwy\.net|railway\.app|railway\.internal/.test(url)) this.skip();
    fm = await import('../src/admin/financial_metrics.js');
    keys = await import('../src/billing/x402_session_keys.js');
    const { default: pg } = await import('pg');
    raw = new pg.Client({ connectionString: url });
    try { await raw.connect(); } catch { raw = null; this.skip(); }
    await raw.query('BEGIN');
    let sp = 0;
    // One client, so serialise: the module runs metrics in parallel (Promise.all),
    // and each query gets its own savepoint so a missing table cannot poison the txn.
    let chain = Promise.resolve();
    const run = async (sql, p) => {
      sp++; const n = sp; await raw.query(`SAVEPOINT m_${n}`);
      try { const r = await raw.query(sql, p); await raw.query(`RELEASE SAVEPOINT m_${n}`); return r; }
      catch (e) { await raw.query(`ROLLBACK TO SAVEPOINT m_${n}`); throw e; }
    };
    db = { query: (sql, p) => { const r = chain.then(() => run(sql, p)); chain = r.catch(() => {}); return r; } };
    await raw.query(`DELETE FROM payment_sources; DELETE FROM api_deposits;`); // inside the rolled-back txn
    await raw.query(`INSERT INTO payment_sources (source, amount_usd, token, network, tx_hash, payer, is_test_data) VALUES
      ('x402', 0.10, 'USDC', 'eip155:8453', '0xm_ext', $1, false),
      ('x402', 0.10, 'USDC', 'eip155:8453', '0xm_founder', $2, true),
      ('x402', 5.00, 'USDC', 'eip155:84532', '0xm_test', $1, true)`, [EXT, FOUNDER]);
  });
  after(async () => { if (raw) { await raw.query('ROLLBACK'); await raw.end(); } });

  it('m1–m4: shape, unavailable-not-zero, separate categories, dry-run settlement', async () => {
    const prev = process.env.SETTLEMENT_DRY_RUN; process.env.SETTLEMENT_DRY_RUN = '1';
    const { metrics } = await fm.getFinancialMetrics(db);
    if (prev === undefined) delete process.env.SETTLEMENT_DRY_RUN; else process.env.SETTLEMENT_DRY_RUN = prev;
    const by = Object.fromEntries(metrics.map((m) => [m.id, m]));
    expect(Object.keys(by)).to.have.members(['external_funds_collected', 'credit_liabilities', 'consumed_usage', 'recognized_revenue',
      'subscriptions_active', 'refunds', 'internal_founder', 'test_simulated', 'blocked_settlement', 'onchain_settlement']);
    for (const m of metrics) for (const k of ['definition', 'source_query', 'currency', 'as_of', 'reconciliation_status']) expect(m[k], `${m.id}.${k}`).to.be.a('string');
    const ext = by.external_funds_collected.value;
    expect(ext).to.deep.equal([{ token: 'USDC', source: 'x402', n: 1, value: 0.1 }]);
    expect(by.internal_founder.value).to.be.closeTo(0.10, 1e-9);
    expect(by.test_simulated.value).to.be.closeTo(5.10, 1e-9);
    // tables absent from this DB → unavailable, never 0
    for (const id of ['subscriptions_active', 'refunds', 'blocked_settlement']) {
      const exists = (await raw.query(`SELECT to_regclass($1) IS NOT NULL AS e`, [{ subscriptions_active: 'payment_entitlement_grants', refunds: 'payment_events', blocked_settlement: 'settlement_batches' }[id]])).rows[0].e;
      if (!exists) { expect(by[id].value, id).to.equal(null); expect(by[id].reconciliation_status).to.equal('unavailable'); }
    }
    expect(by.onchain_settlement).to.include({ value: 0, reconciliation_status: 'dry_run' });
  });

  it('a1: payment_without_credit fires for the external payment with no api_deposits row', async () => {
    const { alerts } = await fm.getFinancialAlerts(db);
    const a = alerts.find((x) => x.id === 'payment_without_credit');
    expect(a.firing).to.equal(true);
    expect(a.sample.map((r) => r.tx_hash)).to.deep.equal(['0xm_ext']);
  });

  it('a2: x402_402_loop fires when an issued key is refused while credit remains', async () => {
    await keys.ensureX402KeySchema(db);
    const acct = `x402_${EXT}`;
    await raw.query(`INSERT INTO api_credits (api_key, tier, daily_limit, wallet_address, credits_usdt) VALUES ($1, 'x402', 1000, $2, 0.02)`, [acct, EXT]);
    const key = await keys.issueSessionKey(db, { accountApiKey: acct, payer: EXT, via: 'settlement' });
    await keys.recordSessionKeyDenial(db, key, 'insufficient_credits');
    await keys.recordSessionKeyDenial(db, 'x402_' + crypto.randomBytes(32).toString('hex'), 'x'); // unknown key → ignored
    const { alerts } = await fm.getFinancialAlerts(db);
    const a = alerts.find((x) => x.id === 'x402_402_loop');
    expect(a.firing).to.equal(true);
    expect(a.count).to.equal(1);
    expect(JSON.stringify(a)).to.not.include(key);
  });

  it('a3: an alert whose source is missing is firing:null (unknown), not false', async () => {
    const exists = (await raw.query(`SELECT to_regclass('deposit_scan_cursor') IS NOT NULL AS e`)).rows[0].e;
    const { alerts } = await fm.getFinancialAlerts(db);
    const w = alerts.find((x) => x.id === 'worker_down');
    if (!exists) expect(w.firing).to.equal(null); else expect(w.firing).to.be.a('boolean');
  });
});
