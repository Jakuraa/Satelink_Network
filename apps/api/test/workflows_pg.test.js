// apps/api/test/workflows_pg.test.js
//
// Customer workflows on real PostgreSQL (migration 041 + 040), in an isolated
// throwaway schema. Runs wherever DATABASE_URL points at a local/CI database (the
// prod-db guard refuses anything else); skips without one.
//
// Verifies:
//   - runs, receipts, usage and strategies persist and are owner-scoped
//   - receipts carry a sha256 of their body and the table is append-only
//   - workflow usage can never be recorded as revenue (CHECK)
//   - two concurrent approvals execute the supplier once (compare-and-set in SQL)
//   - restart recovery: kernel finished but run not finalized → finalized from the
//     memoized kernel phases, supplier NOT called again
//   - restart recovery: crash after approval, before SUBMIT → resubmitted and completed
//   - Strategy Lab evaluations land in trading_strategy_evaluations (040)

import { expect } from 'chai';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorkflowService } from '../src/workflows/workflow_service.js';
import { PgRunStore } from '../src/workflows/run_store.js';
import { createJsonRpcBalanceConnector, createX402HttpConnector } from '../src/workflows/connectors.js';
import { PgDurableStore } from '../src/vnext/reliability/pg_durable_store.js';
import { PAPER_INSTRUMENTS, PgEvaluationStore } from '../src/trading/engine/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(__dirname, '..', '..', '..', 'database', 'migrations');
const URL = process.env.DATABASE_URL;
const ADDR = '0x966E1Ae22996545015b1414B35234b10719d7Ad4';
const A = { id: 'kref_pg_customer_a' };
const B = { id: 'kref_pg_customer_b' };

function rpcFetch() {
  const f = async () => { f.calls += 1; return { ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x2386f26fc10000' }) }; };
  f.calls = 0;
  return f;
}
function candles(n = 1200) {
  const inst = PAPER_INSTRUMENTS.BTC_USDT; const out = []; const t0 = Date.UTC(2021, 0, 1);
  for (let i = 0; i < n; i++) {
    const p = 30000 + 8000 * Math.sin(i / 60) + i * 5; const o = BigInt(Math.round(p * 100)); const c = BigInt(Math.round((p + 150 * Math.sin(i / 3)) * 100));
    out.push({ kind: 'CANDLE', instrument: inst, period: '1d', eventTs: new Date(t0 + i * 86_400_000).toISOString(), retrievalTs: new Date(t0).toISOString(), freshness: 'SNAPSHOT', freshnessWindowSec: 10, licensing: {}, openMinor: o, highMinor: (o > c ? o : c) + 5000n, lowMinor: (o < c ? o : c) - 5000n, closeMinor: c, volume: '1', isClosed: true });
  }
  return out;
}
const balanceRun = (key) => ({ template: 'procurement.capability_call.v1', input: { capability: 'wallet.balance', network: 'polygon', address: ADDR }, budget_usd: '0.01', idempotency_key: key });

describe('workflows beta — PostgreSQL persistence and recovery', function () {
  this.timeout(60000);
  let admin; let pool; let schema;

  before(async function () {
    if (!URL) return this.skip();
    schema = `wf_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    admin = new pg.Pool({ connectionString: URL, max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new pg.Pool({ connectionString: URL, max: 4, options: `-c search_path=${schema}` });
    for (const f of ['040_trading_strategy_evaluations.sql', '041_customer_workflows.sql']) {
      await pool.query(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
    }
  });

  after(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });

  async function boot({ fetchImpl = rpcFetch() } = {}) {
    const svc = await WorkflowService.create({
      store: new PgDurableStore(pool, { prefix: 'wf_' }),
      runStore: new PgRunStore(pool),
      evaluationStore: new PgEvaluationStore((t, p) => pool.query(t, p)),
      connectors: { jsonrpc_balance: createJsonRpcBalanceConnector({ fetchImpl, env: { WORKFLOWS_POLYGON_RPC_URL: 'https://rpc.test.invalid' } }), x402_http: createX402HttpConnector() },
      candleSource: { load: async () => candles() },
    });
    return { svc, fetchImpl };
  }

  it('persists a purchase end to end, owner-scoped, with a hashed receipt and a non-revenue usage record', async () => {
    const { svc } = await boot();
    const c = await svc.createRun(A, balanceRun('pg-happy-000001'));
    expect(c.run.status).to.equal('awaiting_approval');
    const { run } = await svc.approve(A, c.run.id);
    expect(run.status).to.equal('completed');
    expect(run.receipt.customer_charge_usd).to.equal('0');
    expect(run.receipt_sha256).to.match(/^[0-9a-f]{64}$/);

    const { rows: [u] } = await pool.query('SELECT counted_as_revenue, money_moved, is_test_data, customer_charge_micros FROM workflow_usage_records WHERE run_id = $1', [run.id]);
    expect(u).to.deep.include({ counted_as_revenue: false, money_moved: false, is_test_data: true });
    expect(String(u.customer_charge_micros)).to.equal('0');
    const { rows: steps } = await pool.query('SELECT node_id, status FROM workflow_run_steps WHERE run_id = $1', [run.id]);
    expect(steps.every((s) => s.status === 'done')).to.equal(true);

    expect(await svc.listRuns(B)).to.have.length(0);
    for (const fn of [() => svc.getRun(B, run.id), () => svc.getReceipt(B, run.receipt.receipt_id)]) {
      try { await fn(); expect.fail('expected 404'); } catch (e) { expect(e.status).to.equal(404); }
    }
    expect((await svc.getReceipt(A, run.receipt.receipt_id)).receipt_sha256).to.equal(run.receipt_sha256);
  });

  it('receipts and the journal are append-only; usage can never be revenue', async () => {
    const { rows: [r] } = await pool.query('SELECT receipt_id FROM workflow_receipts LIMIT 1');
    for (const sql of [
      [`UPDATE workflow_receipts SET body = '{}'::jsonb WHERE receipt_id = $1`, [r.receipt_id]],
      ['DELETE FROM wf_journal WHERE seq = (SELECT min(seq) FROM wf_journal)', []],
    ]) {
      try { await pool.query(sql[0], sql[1]); expect.fail('expected rejection'); } catch (e) { expect(e.message).to.match(/append-only/); }
    }
    const { rows: [run] } = await pool.query('SELECT run_id FROM workflow_runs LIMIT 1');
    try {
      await pool.query(`INSERT INTO workflow_usage_records (run_id, principal, offer_id, capability, supplier_cost_micros, customer_charge_micros, pricing_approved, counted_as_revenue)
        VALUES ($1, 'x', 'o', 'c', 0, 1, true, true)`, [run.run_id]);
      expect.fail('expected CHECK violation');
    } catch (e) { expect(e.code).to.be.oneOf(['23514', '23505']); }
  });

  it('two concurrent approvals execute the supplier once', async () => {
    const { svc, fetchImpl } = await boot();
    const c = await svc.createRun(A, balanceRun('pg-race-0000001'));
    const results = await Promise.all([svc.approve(A, c.run.id), svc.approve(A, c.run.id), svc.approve(A, c.run.id)]);
    expect(results.filter((r) => r.changed)).to.have.length(1);
    expect(fetchImpl.calls).to.equal(1);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM wf_journal WHERE stream_id = $1 AND phase = 'SETTLE'`, [c.run.id]);
    expect(rows[0].n).to.equal(1);
  });

  it('recovery: kernel finished but the run was not finalized → finalized without calling the supplier again', async () => {
    const first = await boot();
    const c = await first.svc.createRun(A, balanceRun('pg-crash-after-close'));
    // Simulate: approve committed, kernel ran to CLOSED, process died before finalize.
    const running = await first.svc.runs.transition(c.run.id, ['awaiting_approval'], { status: 'running', updated_at: new Date().toISOString() });
    const tx = await first.svc.dk.submit(running._request, { txId: c.run.id });
    expect(tx.state).to.equal('CLOSED');
    expect(first.fetchImpl.calls).to.equal(1);

    const second = await boot();
    expect(second.svc.lastRecovery.finalized).to.include(c.run.id);
    expect(second.svc.lastRecovery.resubmitted).to.not.include(c.run.id);
    expect(second.fetchImpl.calls).to.equal(0);
    const r = await second.svc.getRun(A, c.run.id);
    expect(r.status).to.equal('completed');
    expect(r.result.data.balance).to.equal('0.01');
    expect(r.receipt.receipt_id).to.match(/^rcpt_/);
  });

  it('recovery: crash after approval but before SUBMIT → resubmitted and completed once', async () => {
    const first = await boot();
    const c = await first.svc.createRun(A, balanceRun('pg-crash-before-submit'));
    await first.svc.runs.transition(c.run.id, ['awaiting_approval'], { status: 'running', updated_at: new Date().toISOString() });

    const second = await boot();
    expect(second.svc.lastRecovery.resubmitted).to.include(c.run.id);
    expect(second.fetchImpl.calls).to.equal(1);
    expect((await second.svc.getRun(A, c.run.id)).status).to.equal('completed');
    const third = await boot();
    expect(third.svc.lastRecovery.finalized).to.not.include(c.run.id);
    expect(third.fetchImpl.calls).to.equal(0);
  });

  it('the journal hash chain survives restarts, and history is visible after restart', async () => {
    const { svc } = await boot();
    expect(svc.dk.journal.verifyChain()).to.equal(true);
    const runs = await svc.listRuns(A);
    expect(runs.length).to.be.greaterThan(2);
    expect(runs.every((r) => r.status === 'completed')).to.equal(true);
  });

  it('a Strategy Lab run saves the strategy and records its evaluation in trading_strategy_evaluations', async () => {
    const { svc } = await boot();
    const { run } = await svc.createRun(A, { template: 'strategy_lab.backtest.v1', input: { prompt: 'BTC 10/30 moving average crossover' }, idempotency_key: 'pg-strategy-0001' });
    expect(run.status).to.equal('completed');
    expect(run.is_simulation).to.equal(true);
    const sid = run.input.spec.id;
    const saved = await svc.getStrategy(A, sid);
    expect(saved.runs.map((r) => r.id)).to.include(run.id);
    const { rows } = await pool.query('SELECT verdict FROM trading_strategy_evaluations WHERE evaluation_id = $1', [run.result.scorecard.evaluation_id]);
    expect(rows).to.have.length(1);
    try { await svc.getStrategy(B, sid); expect.fail('expected 404'); } catch (e) { expect(e.status).to.equal(404); }
  });

  it('a client-supplied spec id or cost is never trusted', async () => {
    const { svc } = await boot();
    const s = await svc.saveStrategy(A, { prompt: 'ETH 20 day breakout' });
    const forged = { ...s.spec, id: 'strat_0000000000000000', costs: { fee_bps: 0, half_spread_bps: 0, slippage_bps: 0 } };
    const again = await svc.saveStrategy(A, { spec: forged });
    expect(again.strategy_id).to.equal(s.strategy_id);
    expect(again.spec.costs.fee_bps).to.equal(10);
  });
});
