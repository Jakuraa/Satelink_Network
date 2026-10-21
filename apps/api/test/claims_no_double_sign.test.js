// One signature per unpaid balance (W1 review follow-ups, 2026-10-20/21).
//
// ClaimsContract.claim() only rejects a reused nonce and generateClaimSignature mints a
// fresh nonce per call, so before this fix the same earnings could be signed twice (both
// redeemable), the revenue_events_v2 fallback re-signed lifetime revenue after every
// reconciliation, and completion swept earnings that accrued after signing. Now: one lock
// per identifier {nodeId, wallet}, refusal while any claim is pending, exact reservation
// (UNPAID → CLAIMING → CLAIMED), no fallback, case-insensitive matching.
//
// Real SQL against local Postgres (CI: the Postgres service) in a throwaway schema with the
// production epoch_earnings shape (server.js). Throwaway signer key, never a real one.
import { expect } from 'chai';
import { ethers } from 'ethers';

describe('claims: one signature per unpaid balance (real SQL)', function () {
  this.timeout(30000);
  const url = process.env.DATABASE_URL || '';
  const schema = `claims_test_${process.pid}_${Date.now()}`;
  const WALLET = '0x000000000000000000000000000000000000dEaD';
  const W2 = '0x000000000000000000000000000000000000bEEF';
  const saved = {};
  let pg, admin, pool, generateClaimSignature, markClaimCompleted;

  before(async function () {
    if (!/@?(localhost|127\.0\.0\.1)(:|\/|\?)/.test(url) && !/host=\/tmp/.test(url)) this.skip();
    ({ default: pg } = await import('pg'));
    admin = new pg.Client({ connectionString: url });
    try { await admin.connect(); } catch { admin = null; this.skip(); }
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`CREATE TABLE ${schema}.epoch_earnings (
      epoch_id INTEGER NOT NULL, role TEXT NOT NULL, wallet_or_node_id TEXT NOT NULL,
      amount_usdt NUMERIC(18,8) NOT NULL, status TEXT NOT NULL DEFAULT 'UNPAID', created_at BIGINT NOT NULL,
      PRIMARY KEY (epoch_id, role, wallet_or_node_id))`);
    await admin.query(`CREATE TABLE ${schema}.revenue_events_v2 (node_id TEXT, amount_usdt NUMERIC(18,8), is_test_data BOOLEAN)`);
    // The claims table exists in production; create it once so the tests exercise the
    // guard, not first-run catalog races.
    await admin.query(`CREATE TABLE ${schema}.claims (
      claim_id TEXT PRIMARY KEY, node_id TEXT NOT NULL, wallet TEXT NOT NULL, amount_usdt NUMERIC(18,8) NOT NULL,
      signature TEXT NOT NULL, nonce BIGINT NOT NULL, expiry BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT, created_at BIGINT NOT NULL, updated_at BIGINT, claimed_at BIGINT)`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 6 });
    for (const k of ['SETTLEMENT_DRY_RUN', 'SETTLEMENT_EVM_SIGNER_PRIVATE_KEY', 'CLAIMS_CONTRACT_ADDRESS']) saved[k] = process.env[k];
    process.env.SETTLEMENT_DRY_RUN = '0';
    process.env.SETTLEMENT_EVM_SIGNER_PRIVATE_KEY = ethers.Wallet.createRandom().privateKey;
    process.env.CLAIMS_CONTRACT_ADDRESS = '0x000000000000000000000000000000000000c1a1';
    ({ generateClaimSignature, markClaimCompleted } = await import('../src/services/claims/claim_processor.js'));
  });

  after(async () => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await pool?.end().catch(() => {});
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {}); await admin.end(); }
  });

  let epoch = 0;
  const earn = (id, amount, status = 'UNPAID') =>
    pool.query(`INSERT INTO epoch_earnings VALUES ($1, 'node_operator', $2, $3, $4, 0)`, [++epoch, id, amount, status]);
  const byStatus = async () => Object.fromEntries((await pool.query(
    `SELECT status, SUM(amount_usdt)::float AS t FROM epoch_earnings GROUP BY status`)).rows.map((r) => [r.status, r.t]));
  const refusal = async (p) => { try { await p; return null; } catch (e) { return e.code || e.message; } };

  beforeEach(async () => {
    await pool.query(`DELETE FROM epoch_earnings`);
    await pool.query(`DELETE FROM claims`);
    await pool.query(`DELETE FROM revenue_events_v2`);
    await earn('node-a', 2.5);
  });

  it('two concurrent signings of the same balance produce exactly one signature', async () => {
    const results = await Promise.allSettled([
      generateClaimSignature('node-a', WALLET, pool),
      generateClaimSignature('node-a', WALLET, pool),
      generateClaimSignature('node-a', WALLET.toLowerCase(), pool),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).to.have.length(1);
    expect(results.filter((r) => r.status === 'rejected').map((r) => r.reason.code))
      .to.deep.equal(['claim_pending_reconciliation', 'claim_pending_reconciliation']);
    expect(await byStatus()).to.deep.equal({ CLAIMING: 2.5 });
  });

  it('a later call is refused while the claim is pending — even after it expired', async () => {
    await generateClaimSignature('node-a', WALLET, pool);
    await pool.query(`UPDATE claims SET expiry = 1`);
    expect(await refusal(generateClaimSignature('node-a', WALLET, pool))).to.equal('claim_pending_reconciliation');
  });

  it('another node paying out to the same wallet is refused (wallet-keyed earnings)', async () => {
    await earn(WALLET.toLowerCase(), 1.5);
    await generateClaimSignature('node-a', WALLET, pool);
    expect(await refusal(generateClaimSignature('node-b', WALLET, pool))).to.equal('claim_pending_reconciliation');
  });

  it('a wallet passed as the node id cannot bypass the lock or the pending check', async () => {
    await pool.query(`DELETE FROM epoch_earnings`);
    await earn(WALLET, 2.5);
    await generateClaimSignature('node-a', WALLET, pool);
    expect(await refusal(generateClaimSignature(WALLET, W2, pool))).to.equal('claim_pending_reconciliation');
    expect((await pool.query(`SELECT count(*)::int n FROM claims`)).rows[0].n).to.equal(1);
  });

  it('completion marks only the reserved rows; earnings accrued after signing stay UNPAID', async () => {
    const c = await generateClaimSignature('node-a', WALLET, pool);
    expect(c.amount).to.equal(2.5);
    await earn('node-a', 3);
    await markClaimCompleted(c.claimId, '0xtx', pool);
    expect(await byStatus()).to.deep.equal({ CLAIMED: 2.5, UNPAID: 3 });
    const next = await generateClaimSignature('node-a', WALLET, pool);
    expect(next.amount).to.equal(3);
  });

  it('no revenue_events_v2 fallback: without reserved earnings nothing is signed', async () => {
    await pool.query(`DELETE FROM epoch_earnings`);
    await pool.query(`INSERT INTO revenue_events_v2 VALUES ('node-a', 10, false)`);
    const r = await refusal(generateClaimSignature('node-a', WALLET, pool));
    expect(r).to.match(/Minimum/);
    expect((await pool.query(`SELECT count(*)::int n FROM claims`)).rows[0].n).to.equal(0);
  });

  it('matches wallet-keyed earnings case-insensitively (checksummed claim, lowercase rows)', async () => {
    await pool.query(`DELETE FROM epoch_earnings`);
    await earn(WALLET.toLowerCase(), 1.25);
    const c = await generateClaimSignature('node-a', WALLET, pool);
    expect(c.amount).to.equal(1.25);
  });

  it('a failure after reserving rolls everything back (earnings UNPAID again, no claim row)', async () => {
    const good = process.env.SETTLEMENT_EVM_SIGNER_PRIVATE_KEY;
    process.env.SETTLEMENT_EVM_SIGNER_PRIVATE_KEY = '0xnot-a-key';
    try {
      expect(await refusal(generateClaimSignature('node-a', WALLET, pool))).to.not.equal(null);
    } finally { process.env.SETTLEMENT_EVM_SIGNER_PRIVATE_KEY = good; }
    expect(await byStatus()).to.deep.equal({ UNPAID: 2.5 });
    expect((await pool.query(`SELECT count(*)::int n FROM claims`)).rows[0].n).to.equal(0);
  });

  it('never rounds a payout up (truncates to 6 decimals)', async () => {
    await pool.query(`DELETE FROM epoch_earnings`);
    await earn('node-a', 1.0000009);
    const c = await generateClaimSignature('node-a', WALLET, pool);
    expect(c.amountWei).to.equal('1000000');
  });
});
