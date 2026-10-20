// One signature per unpaid balance (W1 review follow-up, 2026-10-20).
//
// ClaimsContract.claim() only rejects a reused nonce and generateClaimSignature mints a
// fresh nonce per call, so before this fix two calls signed the same UNPAID earnings twice
// and both signatures were redeemable. Now signing is serialised per node + wallet and
// refused while any claim for them is still 'pending'.
//
// Real SQL against local Postgres (CI: the Postgres service) in a throwaway schema;
// skips only when no local DB is configured. Throwaway signer key, never a real one.
import { expect } from 'chai';
import { ethers } from 'ethers';

describe('claims: one signature per unpaid balance (real SQL)', function () {
  this.timeout(30000);
  const url = process.env.DATABASE_URL || '';
  const schema = `claims_test_${process.pid}_${Date.now()}`;
  const WALLET = '0x000000000000000000000000000000000000dEaD';
  const saved = {};
  let pg, admin, pool, generateClaimSignature;

  before(async function () {
    if (!/@?(localhost|127\.0\.0\.1)(:|\/|\?)/.test(url) && !/host=\/tmp/.test(url)) this.skip();
    ({ default: pg } = await import('pg'));
    admin = new pg.Client({ connectionString: url });
    try { await admin.connect(); } catch { admin = null; this.skip(); }
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`CREATE TABLE ${schema}.epoch_earnings (wallet_or_node_id TEXT, amount_usdt NUMERIC(18,8), status TEXT)`);
    pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 4 });
    for (const k of ['SETTLEMENT_DRY_RUN', 'SETTLEMENT_EVM_SIGNER_PRIVATE_KEY', 'CLAIMS_CONTRACT_ADDRESS']) saved[k] = process.env[k];
    process.env.SETTLEMENT_DRY_RUN = '0';
    process.env.SETTLEMENT_EVM_SIGNER_PRIVATE_KEY = ethers.Wallet.createRandom().privateKey;
    process.env.CLAIMS_CONTRACT_ADDRESS = '0x000000000000000000000000000000000000c1a1';
    ({ generateClaimSignature } = await import('../src/services/claims/claim_processor.js'));
  });

  after(async () => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await pool?.end().catch(() => {});
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {}); await admin.end(); }
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM epoch_earnings`);
    await pool.query(`DROP TABLE IF EXISTS claims`);
    await pool.query(`INSERT INTO epoch_earnings VALUES ('node-a', 2.5, 'UNPAID')`);
  });

  it('two concurrent signings of the same balance produce exactly one signature', async () => {
    const results = await Promise.allSettled([
      generateClaimSignature('node-a', WALLET, pool),
      generateClaimSignature('node-a', WALLET, pool),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const refused = results.filter((r) => r.status === 'rejected');
    expect(ok).to.have.length(1);
    expect(refused).to.have.length(1);
    expect(refused[0].reason.code).to.equal('claim_pending_reconciliation');
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM claims WHERE status = 'pending'`);
    expect(rows[0].n).to.equal(1);
  });

  it('a later call is refused while the claim is pending — even after it expired', async () => {
    await generateClaimSignature('node-a', WALLET, pool);
    await pool.query(`UPDATE claims SET expiry = 1`); // long expired, still unreconciled
    let err;
    try { await generateClaimSignature('node-a', WALLET, pool); } catch (e) { err = e; }
    expect(err?.code).to.equal('claim_pending_reconciliation');
  });

  it('another node paying out to the same wallet is refused too (earnings match by wallet)', async () => {
    await generateClaimSignature('node-a', WALLET, pool);
    let err;
    try { await generateClaimSignature('node-b', WALLET.toLowerCase(), pool); } catch (e) { err = e; }
    expect(err?.code).to.equal('claim_pending_reconciliation');
  });

  it('once the pending claim is reconciled, a new balance can be signed', async () => {
    await generateClaimSignature('node-a', WALLET, pool);
    await pool.query(`UPDATE claims SET status = 'completed'`);
    await pool.query(`UPDATE epoch_earnings SET status = 'CLAIMED'`);
    await pool.query(`INSERT INTO epoch_earnings VALUES ('node-a', 1.5, 'UNPAID')`);
    const r = await generateClaimSignature('node-a', WALLET, pool);
    expect(r.amount).to.equal(1.5);
  });

  it('a refused call leaves no partial state (transaction rolled back)', async () => {
    await generateClaimSignature('node-a', WALLET, pool);
    await generateClaimSignature('node-a', WALLET, pool).catch(() => {});
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM claims`);
    expect(rows[0].n).to.equal(1);
  });
});
