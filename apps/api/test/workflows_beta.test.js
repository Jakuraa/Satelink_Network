// apps/api/test/workflows_beta.test.js
//
// Customer workflows beta — Strategy Lab, Agent Marketplace, workflow runs on the
// vNext RoutingKernel. Supplier and market-data I/O is faked ONLY at the connector
// boundary (fetch / candle source); the kernel, journal, idempotency, decision
// engine, supplier registry, catalog rules and backtest engine are the real ones.
//
// Verifies:
//   - strategy compiler: compile / clarify / reject; spec validation
//   - catalog: strict validation, purchasability, money as integer micros
//   - procurement: quote → approval → execute → verify → receipt; nothing charged
//   - idempotency: replayed create and double approve execute the supplier once
//   - failure: supplier error / invalid result → FAILED, no SETTLE, hold released
//   - honesty: evaluation / paused / unconfigured suppliers are blocked with reasons
//   - strategy runs: real walk-forward engine, labelled SIMULATED, geo failure surfaced
//   - durability: runs and trace survive a restart on the same store
//   - router: inert when the flag is off; auth on runs; public discovery

import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { compileStrategy, validateSpec, describeSupported } from '../src/workflows/strategy_compiler.js';
import { SupplierCatalog, validateCatalog, usdToMicros, microsToUsd, loadCatalog } from '../src/workflows/supplier_catalog.js';
import { WorkflowService } from '../src/workflows/workflow_service.js';
import { createJsonRpcBalanceConnector, createX402HttpConnector, ConnectorError } from '../src/workflows/connectors.js';
import { SIMULATION_LABEL } from '../src/workflows/workload_adapters.js';
import { MemoryRunStore } from '../src/workflows/run_store.js';
import { MemoryDurableStore, createMemoryBacking } from '../src/vnext/reliability/memory_durable_store.js';
import { SupplierRegistry } from '../src/vnext/registry/supplier_registry.js';
import { PAPER_INSTRUMENTS } from '../src/trading/engine/index.js';
import { createWorkflowsRouter } from '../src/routes/workflows_route.js';

const ADDR = '0x966E1Ae22996545015b1414B35234b10719d7Ad4';
const ME = { id: 'kref_test_customer_a' };
const OTHER = { id: 'kref_test_customer_b' };
const RPC_ENV = { WORKFLOWS_POLYGON_RPC_URL: 'https://rpc.test.invalid/polygon' };

// Test fixture: deterministic synthetic daily candles (NOT market data).
function syntheticCandles(instrument, n = 1200) {
  const out = [];
  const start = Date.UTC(2021, 0, 1);
  for (let i = 0; i < n; i++) {
    const p = 30000 + 8000 * Math.sin(i / 60) + i * 5;
    const o = BigInt(Math.round(p * 100));
    const c = BigInt(Math.round((p + 150 * Math.sin(i / 3)) * 100));
    const hi = (o > c ? o : c) + 5000n;
    const lo = (o < c ? o : c) - 5000n;
    out.push({ kind: 'CANDLE', instrument, period: '1d', eventTs: new Date(start + i * 86_400_000).toISOString(), retrievalTs: new Date(start).toISOString(), freshness: 'SNAPSHOT', freshnessWindowSec: 10, licensing: {}, openMinor: o, highMinor: hi, lowMinor: lo, closeMinor: c, volume: '1', isClosed: true });
  }
  return out;
}
const fixtureCandles = {
  calls: 0,
  async load(id) { this.calls += 1; return syntheticCandles(id === 'BINANCE:ETHUSDT' ? PAPER_INSTRUMENTS.ETH_USDT : PAPER_INSTRUMENTS.BTC_USDT); },
};

function rpcFetch({ status = 200, result = '0xde0b6b3a7640000', error = null } = {}) {
  const f = async () => { f.calls += 1; return { ok: status === 200, status, json: async () => (error ? { jsonrpc: '2.0', id: 1, error } : { jsonrpc: '2.0', id: 1, result }) }; };
  f.calls = 0;
  return f;
}

async function makeService({ fetchImpl = rpcFetch(), env = RPC_ENV, backing, runStore, candleSource = fixtureCandles } = {}) {
  const connectors = { jsonrpc_balance: createJsonRpcBalanceConnector({ fetchImpl, env }), x402_http: createX402HttpConnector() };
  const svc = await WorkflowService.create({ store: new MemoryDurableStore(backing), runStore, connectors, candleSource, clock: () => Date.UTC(2026, 10, 3) });
  return { svc, fetchImpl };
}

const balanceRun = (key, extra = {}) => ({ template: 'procurement.capability_call.v1', input: { capability: 'wallet.balance', network: 'polygon', address: ADDR, ...extra }, budget_usd: '0.01', idempotency_key: key });

describe('workflows beta — strategy compiler', () => {
  it('compiles an SMA crossover with explicit periods into a valid versioned spec', () => {
    const out = compileStrategy('Buy bitcoin when the 20 day moving average crosses above the 50 day');
    expect(out.status).to.equal('compiled');
    expect(out.spec.family).to.equal('sma-crossover');
    expect(out.spec.params).to.deep.equal({ fastPeriod: 20, slowPeriod: 50 });
    expect(out.spec.market.instrument_id).to.equal('BINANCE:BTCUSDT');
    expect(out.spec.direction).to.equal('long_only');
    expect(out.spec.id).to.match(/^strat_[0-9a-f]{16}$/);
    expect(validateSpec(out.spec)).to.deep.equal([]);
    expect(compileStrategy('Buy bitcoin when the 20 day moving average crosses above the 50 day').spec.id).to.equal(out.spec.id);
  });

  it('compiles a Donchian breakout and records assumptions it made', () => {
    const out = compileStrategy('ETH breakout strategy, 30 day channel, allocate 50% of capital');
    expect(out.status).to.equal('compiled');
    expect(out.spec.family).to.equal('donchian-breakout');
    expect(out.spec.params.entry).to.equal(30);
    expect(out.spec.risk.allocation_pct).to.equal(50);
    expect(out.assumptions.join(' ')).to.match(/exit channel/);
  });

  it('asks clarifying questions for ambiguous requests and resolves them from answers', () => {
    const out = compileStrategy('a trend following strategy for crypto');
    expect(out.status).to.equal('needs_clarification');
    expect(out.questions.map((q) => q.id)).to.have.members(['market', 'family']);
    const resolved = compileStrategy('a trend following strategy for crypto', { market: 'ETHUSDT', family: 'sma-crossover' });
    expect(resolved.status).to.equal('compiled');
    expect(resolved.spec.market.symbol).to.equal('ETHUSDT');
  });

  for (const [prompt, re] of [
    ['short bitcoin when RSI is above 70', /Short selling/],
    ['5x leveraged ETH breakout', /Leverage/],
    ['MACD crossover on BTC', /indicator is not implemented/],
    ['NIFTY 50 moving average crossover', /Indian markets/],
    ['guaranteed profit BTC strategy', /guarantee/],
    ['SMA crossover on AAPL stock', /Only Binance spot/],
  ]) {
    it(`rejects unsupported request: "${prompt}"`, () => {
      const out = compileStrategy(prompt);
      expect(out.status).to.equal('unsupported');
      expect(out.reasons.join(' ')).to.match(re);
    });
  }

  it('validateSpec rejects tampered specs (fast >= slow, leverage, unknown market)', () => {
    const { spec } = compileStrategy('BTC 10/30 moving average crossover');
    expect(validateSpec({ ...spec, params: { fastPeriod: 50, slowPeriod: 20 } })).to.include('fastPeriod must be shorter than slowPeriod');
    expect(validateSpec({ ...spec, risk: { allocation_pct: 150 } }).join()).to.match(/no leverage/);
    expect(validateSpec({ ...spec, market: { symbol: 'SOLUSDT', instrument_id: 'BINANCE:SOLUSDT' } }).join()).to.match(/market must be/);
    expect(describeSupported().families).to.have.length(2);
  });
});

describe('workflows beta — supplier catalog', () => {
  it('the shipped catalog validates and lists only Satelink RPC + Binance data as executable', () => {
    const cat = new SupplierCatalog(loadCatalog());
    const reg = new SupplierRegistry();
    const n = cat.registerInto(reg, (o) => o.capability);
    expect(n).to.equal(2);
    expect(reg.list().map((s) => s.supplierId).sort()).to.deep.equal(['binance.public-klines', 'satelink.polygon-rpc.balance']);
  });

  it('money is integer micro-USD with strict parsing', () => {
    expect(usdToMicros('0.00003')).to.equal(30n);
    expect(usdToMicros('0.005')).to.equal(5000n);
    expect(microsToUsd(5000n)).to.equal('0.005');
    expect(() => usdToMicros('1e-5')).to.throw(RangeError);
    expect(() => usdToMicros('-1')).to.throw(RangeError);
    expect(() => usdToMicros('0.0000001')).to.throw(RangeError);
  });

  it('rejects invalid catalogs (bad status, approved pricing without a price)', () => {
    const raw = loadCatalog();
    const bad1 = structuredClone(raw); bad1.offers[0].status = 'live-ish';
    expect(() => validateCatalog(bad1)).to.throw(/invalid status/);
    const bad2 = structuredClone(raw); bad2.offers[1].pricing.approved = true;
    expect(() => validateCatalog(bad2)).to.throw(/approved pricing needs customer_price_usd/);
  });

  it('purchasability: evaluation offers and paused networks are refused with reasons; unapproved pricing charges 0', () => {
    const cat = SupplierCatalog.fromFile();
    expect(cat.purchasability(cat.offer('sck.token-risk.risk-lite'), 'base')).to.include({ ok: false, reason: 'offer_evaluation' });
    expect(cat.purchasability(cat.offer('satelink.polygon-rpc.balance'), 'base')).to.include({ ok: false, reason: 'network_unsupported' });
    expect(cat.purchasability(cat.offer('satelink.polygon-rpc.balance'), 'polygon')).to.deep.equal({ ok: true });
    const p = cat.price(cat.offer('satelink.polygon-rpc.balance'));
    expect(p.chargeMicros).to.equal(0n);
    expect(p.listPriceMicros).to.equal(30n);
  });
});

describe('workflows beta — agent procurement', () => {
  it('quote → approval → execute → verify → receipt, with nothing charged and a full kernel trace', async () => {
    const { svc, fetchImpl } = await makeService();
    const created = await svc.createRun(ME, balanceRun('proc-happy-0001'));
    expect(created.run.status).to.equal('awaiting_approval');
    expect(created.run.quote.chosen.offer_id).to.equal('satelink.polygon-rpc.balance');
    expect(created.run.quote.compared.map((c) => c.offer_id)).to.include('sck.bal-check.balance-lite');
    expect(fetchImpl.calls).to.equal(0); // nothing executes before approval

    const { run } = await svc.approve(ME, created.run.id);
    expect(run.status).to.equal('completed');
    expect(run.result.verified).to.equal(true);
    expect(run.result.data.balance).to.equal('1'); // 1e18 wei
    expect(run.receipt.customer_charge_usd).to.equal('0');
    expect(run.receipt.list_price_usd).to.equal('0.00003');
    expect(run.receipt.settlement.money_moved).to.equal(false);
    expect(run.receipt.revenue.counted).to.equal(false);
    expect(run.budget_hold.status).to.equal('captured');

    const full = await svc.getRun(ME, run.id);
    const phases = full.trace.filter((e) => e.stream === 'kernel').map((e) => e.phase);
    expect(phases).to.deep.equal(['SUBMIT', 'DISCOVER', 'QUOTE', 'ROUTE', 'EXECUTE', 'SETTLE', 'CLOSED']);
    expect(full.graph.nodes.every((n) => n.status === 'done')).to.equal(true);
    expect(svc.dk.journal.verifyChain()).to.equal(true);
  });

  it('a replayed create and a double approve execute the supplier exactly once', async () => {
    const { svc, fetchImpl } = await makeService();
    const a = await svc.createRun(ME, balanceRun('proc-dupe-0001'));
    const b = await svc.createRun(ME, balanceRun('proc-dupe-0001'));
    expect(b.replayed).to.equal(true);
    expect(b.run.id).to.equal(a.run.id);
    await Promise.all([svc.approve(ME, a.run.id), svc.approve(ME, a.run.id)]);
    await svc.approve(ME, a.run.id);
    expect(fetchImpl.calls).to.equal(1);
    const settles = (await svc.getRun(ME, a.run.id)).trace.filter((e) => e.phase === 'SETTLE');
    expect(settles).to.have.length(1);
    expect(svc.settlement.records).to.have.length(1);
  });

  it('reusing an idempotency key for another template is a conflict', async () => {
    const { svc } = await makeService();
    await svc.createRun(ME, balanceRun('proc-conf-0001'));
    try {
      await svc.createRun(ME, { template: 'strategy_lab.backtest.v1', input: { prompt: 'BTC 10/30 moving average crossover' }, idempotency_key: 'proc-conf-0001' });
      expect.fail('expected conflict');
    } catch (e) { expect(e.code).to.equal('idempotency_conflict'); }
  });

  it('a supplier failure fails the run, never settles, and releases the hold', async () => {
    const { svc } = await makeService({ fetchImpl: rpcFetch({ status: 503 }) });
    const c = await svc.createRun(ME, balanceRun('proc-fail-0001'));
    const { run } = await svc.approve(ME, c.run.id);
    expect(run.status).to.equal('failed');
    expect(run.error.code).to.equal('supplier_error');
    expect(run.receipt.customer_charge_usd).to.equal('0');
    expect(run.budget_hold.status).to.equal('released');
    const phases = (await svc.getRun(ME, run.id)).trace.map((e) => e.phase);
    expect(phases).to.include('FAILED');
    expect(phases).to.not.include('SETTLE');
    expect(svc.settlement.records).to.have.length(0);
  });

  it('an invalid supplier result is rejected (no SETTLE, no receipt charge)', async () => {
    const { svc } = await makeService({ fetchImpl: rpcFetch({ result: 'not-a-quantity' }) });
    const c = await svc.createRun(ME, balanceRun('proc-invalid-01'));
    const { run } = await svc.approve(ME, c.run.id);
    expect(run.status).to.equal('failed');
    expect(run.error.code).to.equal('invalid_result');
    expect((await svc.getRun(ME, run.id)).trace.map((e) => e.phase)).to.not.include('SETTLE');
  });

  it('evaluation-only and paused suppliers block the run with per-offer reasons (no execution)', async () => {
    const { svc } = await makeService();
    const base = await svc.createRun(ME, { template: 'procurement.capability_call.v1', input: { capability: 'token.risk', network: 'base', address: ADDR }, idempotency_key: 'proc-block-base' });
    expect(base.run.status).to.equal('blocked');
    expect(base.run.blocked.offers.every((o) => o.reason === 'offer_evaluation')).to.equal(true);
    const poly = svc.quote({ capability: 'token.risk', network: 'polygon' });
    expect(poly.available).to.equal(false);
    expect(poly.compared.every((c) => c.purchasable.reason === 'offer_evaluation')).to.equal(true);
    expect(base.run.graph.nodes.find((n) => n.status === 'blocked')).to.exist;
  });

  it('an unconfigured first-party connector is shown as not authorized and blocks', async () => {
    const { svc } = await makeService({ env: {} });
    const cap = svc.describeCapability('wallet.balance', 'polygon');
    expect(cap.offers.find((o) => o.id === 'satelink.polygon-rpc.balance').status).to.equal('not_authorized');
    const r = await svc.createRun(ME, balanceRun('proc-unconf-01'));
    expect(r.run.status).to.equal('blocked');
  });

  it('cancel releases the hold; other customers cannot see or approve the run', async () => {
    const { svc, fetchImpl } = await makeService();
    const c = await svc.createRun(ME, balanceRun('proc-cancel-01'));
    for (const fn of [() => svc.getRun(OTHER, c.run.id), () => svc.approve(OTHER, c.run.id)]) {
      try { await fn(); expect.fail('expected 404'); } catch (e) { expect(e.status).to.equal(404); }
    }
    expect(await svc.listRuns(OTHER)).to.have.length(0);
    const { run } = await svc.cancel(ME, c.run.id);
    expect(run.status).to.equal('cancelled');
    expect(run.budget_hold.status).to.equal('released');
    expect(fetchImpl.calls).to.equal(0);
  });

  it('validates input (address, capability, idempotency key, budget)', async () => {
    const { svc } = await makeService();
    const cases = [
      [{ ...balanceRun('proc-val-0001'), input: { capability: 'wallet.balance', network: 'polygon', address: '0x123' } }, 'invalid_address'],
      [{ ...balanceRun('proc-val-0002'), input: { capability: 'nope', network: 'polygon', address: ADDR } }, 'unknown_capability'],
      [{ ...balanceRun('x'), idempotency_key: 'x' }, 'idempotency_key_required'],
      [{ ...balanceRun('proc-val-0003'), budget_usd: '0.1.2' }, 'invalid_budget'],
    ];
    for (const [body, code] of cases) {
      try { await svc.createRun(ME, body); expect.fail(code); } catch (e) { expect(e.code).to.equal(code); }
    }
  });
});

describe('workflows beta — Strategy Lab runs', function () {
  this.timeout(30000);

  it('runs the real walk-forward engine and returns a labelled scorecard with a PASS/FAIL verdict', async () => {
    const { svc } = await makeService();
    const { run } = await svc.createRun(ME, { template: 'strategy_lab.backtest.v1', input: { prompt: 'BTC 10/30 moving average crossover' }, idempotency_key: 'strat-run-0001' });
    expect(run.status).to.equal('completed');
    const sc = run.result.scorecard;
    expect(sc.label).to.equal(SIMULATION_LABEL);
    expect(['PASS', 'FAIL']).to.include(sc.verdict);
    expect(sc.windows).to.have.length(4);
    expect(sc.method.costs_bps.fee).to.equal(10);
    expect(sc.data.offer_id).to.equal('binance.public-klines');
    expect(sc.data.sha256).to.match(/^[0-9a-f]{64}$/);
    expect(run.labels.simulation).to.equal(SIMULATION_LABEL);
    expect(run.graph.nodes.find((n) => n.id === 'paper').status).to.equal('available');
    // Reproducible: same spec + same data → same result hash.
    const again = await (await makeService()).svc.createRun(ME, { template: 'strategy_lab.backtest.v1', input: { prompt: 'BTC 10/30 moving average crossover' }, idempotency_key: 'strat-run-0002' });
    expect(again.run.result.scorecard.result_hash).to.equal(sc.result_hash);
  });

  it('surfaces a data geo-restriction as a failed run (no fabricated result)', async () => {
    const geo = { async load() { const e = new Error('[data_geo_restricted] market data unavailable: Binance klines failed: HTTP 451'); throw e; } };
    const { svc } = await makeService({ candleSource: geo });
    const { run } = await svc.createRun(ME, { template: 'strategy_lab.backtest.v1', input: { prompt: 'ETH 20 day breakout' }, idempotency_key: 'strat-geo-0001' });
    expect(run.status).to.equal('failed');
    expect(run.error.code).to.equal('data_geo_restricted');
    expect(run.result).to.equal(null);
  });

  it('an ambiguous prompt is refused at creation with the clarification questions', async () => {
    const { svc } = await makeService();
    try {
      await svc.createRun(ME, { template: 'strategy_lab.backtest.v1', input: { prompt: 'make me money' }, idempotency_key: 'strat-amb-0001' });
      expect.fail('expected 422');
    } catch (e) {
      expect(e.status).to.equal(422);
      expect(e.extra.compile.status).to.equal('needs_clarification');
    }
  });

  it('runs and the journal survive a restart on the same durable store', async () => {
    const backing = createMemoryBacking();
    const runStore = new MemoryRunStore();
    const first = await makeService({ backing, runStore });
    const c = await first.svc.createRun(ME, balanceRun('proc-durable-01'));
    await first.svc.approve(ME, c.run.id);
    const second = await makeService({ backing, runStore });
    const r = await second.svc.getRun(ME, c.run.id);
    expect(r.status).to.equal('completed');
    expect(r.receipt.customer_charge_usd).to.equal('0');
    expect(second.svc.dk.journal.verifyChain()).to.equal(true);
    // A replay after restart does not execute again.
    const again = await second.svc.createRun(ME, balanceRun('proc-durable-01'));
    expect(again.replayed).to.equal(true);
    expect(second.fetchImpl.calls).to.equal(0);
  });
});

describe('workflows beta — review findings (PR #609) regressions', function () {
  this.timeout(30000);

  it('#2 prototype keys never pass as a family or market', () => {
    const { spec } = compileStrategy('BTC 10/30 moving average crossover');
    expect(validateSpec({ ...spec, family: '__proto__', params: { entry: -5 } })).to.include("unsupported family '__proto__'");
    expect(validateSpec({ ...spec, market: { symbol: 'constructor', instrument_id: 'x' } }).join()).to.match(/market must be/);
    expect(compileStrategy('buy btc entry 20 exit 10', { family: 'constructor', market: '__proto__' }).status).to.equal('needs_clarification');
  });

  it('#3 a client cannot change the evaluation window, the costs or the spec id', async () => {
    const { spec } = compileStrategy('BTC 10/30 moving average crossover');
    expect(validateSpec({ ...spec, evaluation: { ...spec.evaluation, windows: 1 } }).join()).to.match(/evaluation window is fixed/);
    const { svc } = await makeService();
    const { run } = await svc.createRun(ME, { template: 'strategy_lab.backtest.v1', input: { spec: { ...spec, id: 'strat_ffffffffffffffff', evaluation: { ...spec.evaluation, windows: 1, test_bars: 5 }, costs: { fee_bps: 0, half_spread_bps: 0, slippage_bps: 0 } } }, idempotency_key: 'rev-eval-00001' });
    expect(run.input.spec.id).to.equal(spec.id);
    expect(run.result.scorecard.windows).to.have.length(4);
    expect(run.result.scorecard.method.costs_bps.fee).to.equal(10);
  });

  it('#6 the kernel settles the supplier cost; the receipt shows the approved customer charge', async () => {
    const raw = loadCatalog();
    const o = raw.offers.find((x) => x.id === 'satelink.polygon-rpc.balance');
    o.pricing = { ...o.pricing, supplier_cost_usd: '0.00001', customer_price_usd: '0.00003', approved: true };
    const connectors = { jsonrpc_balance: createJsonRpcBalanceConnector({ fetchImpl: rpcFetch(), env: RPC_ENV }), x402_http: createX402HttpConnector() };
    const svc = await WorkflowService.create({ catalog: new SupplierCatalog(raw), connectors, candleSource: fixtureCandles });
    const c = await svc.createRun(ME, balanceRun('rev-cost-00001'));
    const { run } = await svc.approve(ME, c.run.id);
    expect(run.status).to.equal('completed');
    expect(svc.settlement.records[0].ref.amount_usd).to.equal('0.00001'); // supplier cost, not the customer price
    expect(run.receipt.customer_charge_usd).to.equal('0.00003');
    expect(run.receipt.supplier_cost_usd).to.equal('0.00001');
    expect(run.receipt.margin_usd).to.equal('0.00002');
    expect(run.receipt.revenue.counted).to.equal(false);
  });

  it('#6 a price change between quote and approval fails the run before anything executes', async () => {
    const raw = loadCatalog();
    const connectorsFetch = rpcFetch();
    const connectors = { jsonrpc_balance: createJsonRpcBalanceConnector({ fetchImpl: connectorsFetch, env: RPC_ENV }), x402_http: createX402HttpConnector() };
    const svc = await WorkflowService.create({ catalog: new SupplierCatalog(raw), connectors, candleSource: fixtureCandles });
    const c = await svc.createRun(ME, balanceRun('rev-stale-0001'));
    const offer = svc.catalog.offer('satelink.polygon-rpc.balance');
    offer.pricing = { ...offer.pricing, approved: true, customer_price_usd: '0.5' };
    const { run } = await svc.approve(ME, c.run.id);
    expect(run.status).to.equal('failed');
    expect(run.error.code).to.equal('quote_expired');
    expect(connectorsFetch.calls).to.equal(0);
  });

  it('#7 the same idempotency key with a different input is a 409, not a silent replay', async () => {
    const { svc } = await makeService();
    await svc.createRun(ME, balanceRun('rev-idem-00001'));
    for (const body of [
      { ...balanceRun('rev-idem-00001'), input: { capability: 'wallet.balance', network: 'polygon', address: '0x0000000000000000000000000000000000000001' } },
      { ...balanceRun('rev-idem-00001'), budget_usd: '5' },
    ]) {
      try { await svc.createRun(ME, body); expect.fail('expected 409'); } catch (e) { expect(e.code).to.equal('idempotency_conflict'); }
    }
    expect((await svc.createRun(ME, balanceRun('rev-idem-00001'))).replayed).to.equal(true);
  });

  it('LOW: "short-term" is not short selling; unknown internal errors are not shown to customers', async () => {
    expect(compileStrategy('buy BTC when the short-term moving average crosses above the long-term one').status).to.equal('compiled');
    const boom = { async load() { throw new TypeError('Cannot read properties of undefined (reading secret_internal)'); } };
    const { svc } = await makeService({ candleSource: boom });
    const { run } = await svc.createRun(ME, { template: 'strategy_lab.backtest.v1', input: { prompt: 'BTC 10/30 moving average crossover' }, idempotency_key: 'rev-err-000001' });
    expect(run.status).to.equal('failed');
    expect(run.error.code).to.equal('execution_failed');
    expect(JSON.stringify(run)).to.not.match(/secret_internal|TypeError/);
  });
});

describe('workflows beta — HTTP router', function () {
  this.timeout(30000);

  function appWith(opts) {
    const app = express();
    app.use('/v1', createWorkflowsRouter(null, opts));
    app.use((_req, res) => res.status(404).json({ fallthrough: true }));
    return app;
  }

  it('is inert when WORKFLOWS_BETA_ENABLED is not true (requests fall through)', async () => {
    const res = await request(appWith({ enabled: false })).get('/v1/marketplace/capabilities');
    expect(res.status).to.equal(404);
    expect(res.body.fallthrough).to.equal(true);
  });

  it('serves public discovery and requires an identity for runs', async () => {
    const { svc } = await makeService();
    const app = appWith({ enabled: true, service: svc, resolvePrincipal: async (req) => (req.get('X-API-Key') === 'sk_test' ? ME : null) });

    const caps = await request(app).get('/v1/marketplace/capabilities?q=risk');
    expect(caps.status).to.equal(200);
    expect(caps.body.capabilities.map((c) => c.id)).to.include('token.risk');
    expect(caps.body.capabilities.find((c) => c.id === 'token.risk').availability).to.equal('evaluation');

    const comp = await request(app).post('/v1/strategy-lab/compile').send({ prompt: 'short BTC' });
    expect(comp.status).to.equal(422);
    expect(comp.body.status).to.equal('unsupported');

    const noKey = await request(app).post('/v1/workflows/runs').send(balanceRun('http-run-0001'));
    expect(noKey.status).to.equal(401);

    const created = await request(app).post('/v1/workflows/runs').set('X-API-Key', 'sk_test').send(balanceRun('http-run-0001'));
    expect(created.status).to.equal(201);
    expect(created.body.run.status).to.equal('awaiting_approval');
    const replay = await request(app).post('/v1/workflows/runs').set('X-API-Key', 'sk_test').send(balanceRun('http-run-0001'));
    expect(replay.status).to.equal(200);
    expect(replay.body.replayed).to.equal(true);

    const approved = await request(app).post(`/v1/workflows/runs/${created.body.run.id}/approve`).set('X-API-Key', 'sk_test');
    expect(approved.body.run.status).to.equal('completed');
    const list = await request(app).get('/v1/workflows/runs').set('X-API-Key', 'sk_test');
    expect(list.body.runs).to.have.length(1);
    const detail = await request(app).get(`/v1/workflows/runs/${created.body.run.id}`).set('X-API-Key', 'sk_test');
    expect(detail.body.run.trace.length).to.be.greaterThan(5);
    expect(detail.body.run).to.not.have.property('_request');
    const bad = await request(app).post('/v1/workflows/runs').set('X-API-Key', 'sk_test').send({ template: 'nope', idempotency_key: 'http-run-0002' });
    expect(bad.status).to.equal(422);
  });

  it('console-session runs (accounts V1) require the CSRF header; without a key or session → 401', async () => {
    const { svc } = await makeService();
    const app = appWith({ enabled: true, service: svc });
    const prev = process.env.CONSOLE_ACCOUNTS_V1;
    process.env.CONSOLE_ACCOUNTS_V1 = 'true';
    try {
      const noHeader = await request(app).post('/v1/workflows/runs').send(balanceRun('http-csrf-0001'));
      expect(noHeader.status).to.equal(403);
      expect(noHeader.body.error).to.equal('csrf_header_missing');
      const list = await request(app).get('/v1/workflows/runs');
      expect(list.status).to.equal(401);
    } finally {
      if (prev === undefined) delete process.env.CONSOLE_ACCOUNTS_V1; else process.env.CONSOLE_ACCOUNTS_V1 = prev;
    }
  });

  it('#1 revoked or inactive API keys are refused (same rule as billing); run creation is rate limited', async () => {
    const { svc } = await makeService();
    const accounts = { sk_fx_active_000000000000000000: 'active', sk_fx_revoke_000000000000000000: 'revoked', sk_fx_paused_000000000000000000: 'paused' };
    const pool = { query: async (_sql, params) => ({ rows: accounts[params[0]] ? [{ api_key: params[0], status: accounts[params[0]] }] : [] }) };
    const app = express();
    app.use('/v1', createWorkflowsRouter(pool, { enabled: true, service: svc }));
    for (const k of ['sk_fx_revoke_000000000000000000', 'sk_fx_paused_000000000000000000']) {
      const r = await request(app).get('/v1/workflows/runs').set('X-API-Key', k);
      expect(r.status, k).to.equal(401);
    }
    expect((await request(app).get('/v1/workflows/runs').set('X-API-Key', 'sk_fx_active_000000000000000000')).status).to.equal(200);
    const prev = process.env.WORKFLOWS_RUNS_PER_MINUTE;
    process.env.WORKFLOWS_RUNS_PER_MINUTE = '2';
    try {
      const limited = express();
      limited.use('/v1', createWorkflowsRouter(pool, { enabled: true, service: svc }));
      const codes = [];
      for (let i = 0; i < 3; i++) {
        codes.push((await request(limited).post('/v1/workflows/runs').set('X-API-Key', 'sk_fx_active_000000000000000000').send(balanceRun(`rev-rate-${i}0000`))).status);
      }
      expect(codes).to.deep.equal([201, 201, 429]);
    } finally {
      if (prev === undefined) delete process.env.WORKFLOWS_RUNS_PER_MINUTE; else process.env.WORKFLOWS_RUNS_PER_MINUTE = prev;
    }
  });

  it('contract: every router route is in the OpenAPI document and every documented path is routed', async () => {
    const router = createWorkflowsRouter(null, { enabled: true, service: (await makeService()).svc });
    const routed = new Set(router.stack.filter((l) => l.route).flatMap((l) => Object.keys(l.route.methods).map((m) => `${m} /v1${l.route.path.replace(/:(\w+)/g, '{$1}')}`)));
    const res = await request(appWith({ enabled: true, service: (await makeService()).svc })).get('/v1/workflows/openapi.json');
    expect(res.status).to.equal(200);
    expect(res.body.openapi).to.equal('3.1.0');
    const documented = new Set(Object.entries(res.body.paths).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m} ${p}`)));
    expect([...routed].filter((r) => !documented.has(r)), 'undocumented routes').to.deep.equal([]);
    expect([...documented].filter((d) => !routed.has(d)), 'documented but not routed').to.deep.equal([]);
    const tools = await request(appWith({ enabled: true, service: (await makeService()).svc })).get('/v1/workflows/mcp-tools');
    expect(tools.body.manifest.tools.map((t) => t.name)).to.include.members(['list_capabilities', 'approve_purchase', 'run_backtest']);
  });

  it('a database that is missing migration 041 yields a typed 503, never a crash or a 500', async () => {
    const app = express();
    const brokenPool = { query: async () => { throw Object.assign(new Error('relation "workflow_definitions" does not exist'), { code: '42P01' }); } };
    app.use('/v1', createWorkflowsRouter(brokenPool, { enabled: true, resolvePrincipal: async () => ME }));
    const caps = await request(app).get('/v1/marketplace/capabilities');
    expect(caps.status).to.equal(503);
    expect(caps.body.error).to.equal('workflows_unavailable');
    expect(JSON.stringify(caps.body)).to.not.match(/relation|workflow_definitions/);
    const runs = await request(app).get('/v1/workflows/runs');
    expect(runs.status).to.equal(503);
  });

  it('x402 supplier connector refuses to pay (no wallet, no authorization)', async () => {
    const c = createX402HttpConnector();
    try { await c.call({ provider: { name: 'X' } }); expect.fail('expected refusal'); } catch (e) {
      expect(e).to.be.instanceOf(ConnectorError);
      expect(e.code).to.equal('payment_not_authorized');
    }
  });
});
