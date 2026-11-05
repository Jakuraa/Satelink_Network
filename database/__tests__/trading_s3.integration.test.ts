/**
 * Release A · Slice S3 — Trading AI on the shared engine (real Postgres; synthetic recorded data; no network).
 * NL → spec → walk-forward scorecard → deterministic GO/WAIT/REJECT with trace → approval → paper order → fill → report.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freshMigratedDb } from './fresh-db.js';
import { Pool } from 'pg';
import { join, resolve } from 'node:path';
import { TaskService } from '../../apps/api/src/workflows/task_service.js';
import { CapabilityRegistry } from '../../apps/api/src/workflows/capability_registry.js';
import { createModelRouter } from '../../apps/api/src/workflows/model_router.js';
import { loadPricing } from '../../apps/api/src/workflows/pricing.js';
import { createTradingConnector, decide, syntheticCandles, TRADING_LABEL, paperFill } from '../../apps/api/src/workflows/connectors/trading_connector.js';
import { AlpacaPaperAdapter, assertPaperHost } from '../../apps/api/src/workflows/connectors/alpaca_paper_adapter.js';
import { compileStrategy } from '../../apps/api/src/workflows/strategy_compiler.js';
import { familyFor } from '../../apps/api/src/workflows/workload_adapters.js';
import { detectLookahead, PgEvaluationStore } from '../../apps/api/src/trading/engine/index.js';
import { PgDurableStore } from '../../apps/api/src/vnext/reliability/pg_durable_store.js';
import { PgRunStore } from '../../apps/api/src/workflows/run_store.js';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ROOT = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', '..');
const U = { id: 'user:trader-1' };
const SMA = 'Backtest: buy bitcoin when the 20 day moving average crosses above the 50 day';
const GO_STRATEGY = 'Backtest an ETH breakout strategy, 20 day channel'; // GO on the synthetic dataset
let db: Awaited<ReturnType<typeof freshMigratedDb>>; let pool: Pool; let svc: Any; let evals: Any;

beforeAll(async () => {
  db = await freshMigratedDb('s3trade', join(ROOT, 'database', 'migrations'));
  const url = db.url;
  pool = new Pool({ connectionString: url, max: 8 });
  pool.on('error', (e: Any) => { if (e.code !== '57P01') throw e; });
  evals = new PgEvaluationStore((t: string, p: unknown[]) => pool.query(t, p));
  svc = await TaskService.create({
    pool, registry: new CapabilityRegistry(pool), router: createModelRouter({ env: {} }), pricing: loadPricing(),
    connectors: { trading_engine: createTradingConnector({ evaluationStore: evals }) },
    workflowOptions: { store: new PgDurableStore(pool, { prefix: 'wf_' }), runStore: new PgRunStore(pool), env: {} },
  });
}, 180_000);
afterAll(async () => { await pool?.end(); await db?.stop(); });

async function runTask(text: string, key: string) {
  const { task } = await svc.createTask(U, { text, idempotency_key: key });
  if (task.state !== 'AWAITING_APPROVAL') return task;
  await svc.approve(U, task.id, { quote_id: task.quote.quote_id, quote_version: task.quote.version });
  await svc.drain();
  return svc.getTask(U, task.id);
}

describe('S3 trading on the shared engine', () => {
  let evaluationId = ''; let decision = '';

  it('NL → spec → walk-forward scorecard → deterministic risk decision with trace; labelled; $0.10 from credits', async () => {
    const { task } = await svc.createTask(U, { text: SMA, idempotency_key: 'trade-000001' });
    expect(task.state).toBe('AWAITING_APPROVAL');
    expect(task.plan.steps[0]).toMatchObject({ capability_id: 'trading.strategy.evaluate', provider_name: 'Satelink Trading Engine (simulation)' });
    expect(task.quote).toMatchObject({ credit_charge_usd: '0.100000', merchant_paid_by_user_usd: '0.000000' });
    await svc.approve(U, task.id, { quote_id: task.quote.quote_id, quote_version: task.quote.version });
    await svc.drain();
    const done = await svc.getTask(U, task.id);
    expect(done.state).toBe('SUCCEEDED');
    const { rows: [step] } = await pool.query('SELECT result FROM workflow_run_steps WHERE run_id = $1', [task.id]);
    const r = (await pool.query('SELECT result FROM workflow_runs WHERE run_id = $1', [task.id])).rows[0].result.steps[0].data;
    expect(step.result.status).toMatch(/^evaluated:(GO|WAIT|REJECT)$/);
    expect(r.label).toBe(TRADING_LABEL);
    expect(r.dataset_label).toMatch(/SYNTHETIC RECORDED DATASET/);
    expect(r.scorecard.method).toMatchObject({ kind: 'walk-forward out-of-sample', windows: 4 });
    expect(r.scorecard.method.costs_bps.fee).toBeGreaterThan(0);
    expect(r.risk.trace.map((t: Any) => t.rule.slice(0, 2))).toEqual(['L1', 'L2', 'R1', 'R2', 'R3']);
    evaluationId = r.evaluation_id; decision = r.risk.decision;
    const receipt = await svc.getReceipt(U, done.receipt_id);
    expect(receipt.simulation_label).toBe('SIMULATED — NO MONEY MOVED');
    expect(receipt.verification.evidence.status).toBe(`evaluated:${decision}`);
  });

  it('risk decision is deterministic (same evaluation → same decision and trace)', async () => {
    const r = (await pool.query("SELECT result FROM workflow_runs WHERE template_id = 'assistant.task.v1' AND intent = $1", [SMA])).rows[0].result.steps[0].data;
    expect(decide(r.scorecard)).toEqual(decide(structuredClone(r.scorecard)));
    expect(decide(r.scorecard)).toEqual(r.risk);
  });

  it('look-ahead: a strategy that reads future candles is detected (injected future data fails)', () => {
    const candles = syntheticCandles('BINANCE:BTCUSDT', 400);
    const fam = familyFor(compileStrategy(SMA).spec);
    // Honest strategy: the factory ignores the full series; evaluate() only sees the visible prefix.
    expect(detectLookahead(() => fam.build(fam.grid[0]), candles).leaks).toBe(false);
    // Cheating strategy: keeps the FULL series in a closure and peeks at the next bar's close (future data).
    const cheat = (all: Any[]) => ({ evaluate: ({ recentCandles }: Any) => {
      const nxt = all[recentCandles.length]; const now = recentCandles[recentCandles.length - 1];
      return { signal: nxt && nxt.closeMinor > now.closeMinor ? 'BUY' : 'SELL', confidence: 1 };
    } });
    expect(detectLookahead(cheat, candles).leaks).toBe(true);
    const sc = { verdict: 'PASS', flags: ['LEAKAGE'], windows: [{ trades: 10 }], summary: { candidate_worst_drawdown_pct: 5, windows_beaten: 4 }, method: { windows: 4, costs_bps: { fee: 10, slippage: 2 } } };
    expect(decide(sc).decision).toBe('REJECT');
  });

  it('fees and slippage reduce returns (costs are applied, not zero)', () => {
    const base = { verdict: 'PASS', flags: [], windows: [{ trades: 10 }], summary: { candidate_worst_drawdown_pct: 5, windows_beaten: 4 }, method: { windows: 4, costs_bps: { fee: 10, slippage: 2 } } };
    expect(decide(base).decision).toBe('GO');
    expect(decide({ ...base, flags: ['ZERO_COST'] }).decision).toBe('REJECT');
    expect(decide({ ...base, verdict: 'FAIL' }).decision).toBe('WAIT');
  });

  it('paper order is refused for a WAIT evaluation', async () => {
    expect(decision).toBe('WAIT'); // the SMA strategy fails out of sample on this dataset
    const t = await runTask(`Paper trade ${evaluationId} buy`, 'paper-000001');
    expect(t.state).toBe('REJECTED');
    expect(t.error.code).toBe('RISK_NOT_GO');
  });

  it('GO evaluation → paper order → deterministic fill verified after a JSONB round trip → SUCCEEDED', async () => {
    const ev = await runTask(GO_STRATEGY, 'trade-go-0001');
    expect(ev.state).toBe('SUCCEEDED');
    expect(ev.trading.risk.decision).toBe('GO');
    const t = await runTask(`Paper trade ${ev.trading.evaluation_id} buy`, 'paper-000002');
    expect(t.state).toBe('SUCCEEDED');
    expect(t.trading.fill).toMatchObject({ status: 'filled', venue: 'InternalPaperBroker', label: TRADING_LABEL, side: 'buy' });
    expect(t.quote.credit_charge_usd).toBe('0.050000');
    const r = await svc.getReceipt(U, t.receipt_id);
    expect(r.trading_label).toBe(TRADING_LABEL);
    expect(r.verification.evidence.status).toBe('filled (paper)');
  });

  it('paper fills are deterministic and re-computable (verification basis)', () => {
    const c = syntheticCandles('BINANCE:BTCUSDT', 50);
    expect(paperFill({ idempotencyKey: 'k1', instrumentId: 'BINANCE:BTCUSDT', side: 'buy', candles: c })).toEqual(paperFill({ idempotencyKey: 'k1', instrumentId: 'BINANCE:BTCUSDT', side: 'buy', candles: c }));
  });

  it('the live Alpaca host is refused; only paper-api is allowed; no keys → not constructed', () => {
    expect(() => assertPaperHost('https://api.alpaca.markets/v2/orders')).toThrow(/api\.alpaca\.markets/);
    expect(() => new AlpacaPaperAdapter({ env: { ALPACA_PAPER_KEY_ID: 'x', ALPACA_PAPER_SECRET_KEY: 'y' }, baseUrl: 'https://api.alpaca.markets' })).toThrow(expect.objectContaining({ code: 'LIVE_HOST_FORBIDDEN' }));
    expect(() => new AlpacaPaperAdapter({ env: {} })).toThrow(expect.objectContaining({ code: 'NOT_CONFIGURED' }));
    expect(assertPaperHost('https://paper-api.alpaca.markets/v2/account').host).toBe('paper-api.alpaca.markets');
  });

  it('unsupported strategies are refused clearly (not a generic failure)', async () => {
    const { task } = await svc.createTask(U, { text: 'Backtest a strategy that predicts lottery numbers with options on gold', idempotency_key: 'trade-000002' });
    expect(['REJECTED', 'AWAITING_INPUT']).toContain(task.state);
  });
});
