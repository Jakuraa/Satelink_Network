/**
 * Phase 6 item 14 — FULL-LOOP E2E (paper), Postgres, every write through tracedPool:
 *   A. human intent  → assistant → orchestrator (agents) → engines → scorecard → proposal → human
 *      step-up approval → OMS acceptance → risk → mandate → paper venue → fills → portfolio →
 *      memory → post-trade review
 *   B. machine API   → agent key (scope / budget / metering) → evaluate → propose → human approval
 *      → … same chain
 *   C. Mode B        → EXECUTE key bound to a human-signed Mode B mandate → candidate → mode_b_executor
 *      bot (MANDATE_MODE_B) → risk Mode B rule → paper venue → fills
 * Each leg runs under ONE trace id, asserted across every trace-bearing table it touched.
 * Synthetic market data and scripted models only. No live money, no network.
 *
 * Default: testcontainers (CI). Local without Docker: TRADING_FOUNDATION_TEST_DB pointing at a LOCAL
 * server (the test creates and drops its own database).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { resolve } from 'node:path';
import { applyMigrationsForTest } from './apply-migrations.js';
// @ts-expect-error — plain ESM JS modules from apps/api (no type declarations)
import { ToolRegistry, createDefaultTools, ScriptedProvider, TieredModelRouter, TraceRecorder, PgTraceStore } from '../../apps/api/src/trading_agent/agent/index.mjs';
// @ts-expect-error
import { DecisionService, PgDecisionStore } from '../../apps/api/src/trading_agent/decision/index.mjs';
// @ts-expect-error
import { Orchestrator } from '../../apps/api/src/trading_agent/orchestrator/index.mjs';
// @ts-expect-error
import { StrategyService, PgStrategyStore, parseStrategyDsl, LifecycleState as S } from '../../apps/api/src/trading_agent/strategies/index.mjs';
// @ts-expect-error
import { MandateService, PgMandateStore } from '../../apps/api/src/trading_agent/authorization/index.mjs';
// @ts-expect-error
import { RiskEngine, PgRiskStore } from '../../apps/api/src/trading_agent/risk/index.mjs';
// @ts-expect-error
import { PgOmsStore, OrderAcceptanceService, OrderDispatcher } from '../../apps/api/src/trading_agent/oms/index.mjs';
// @ts-expect-error
import { PgPortfolioStore, FillConsumer, PortfolioSnapshotter } from '../../apps/api/src/trading_agent/portfolio/index.mjs';
// @ts-expect-error
import { MockBroker, MockScenario } from '../../apps/api/src/trading_agent/brokers/mock_broker.mjs';
// @ts-expect-error
import { InstrumentRegistry, defineInstrument } from '../../apps/api/src/trading_agent/brokers/symbols.mjs';
// @ts-expect-error
import { tracedPool, runWithTrace, newTrace } from '../../apps/api/src/trading_agent/audit/index.mjs';
// @ts-expect-error
import { ProposalService, PgProposalStore, createAssistant } from '../../apps/api/src/trading_agent/proposals/index.mjs';
// @ts-expect-error
import { AgentKeyService, PgAgentKeyStore, AgentAccessGuard, createMachineInterface } from '../../apps/api/src/trading_agent/access/index.mjs';
// @ts-expect-error
import { MemoryService, PgMemoryStore } from '../../apps/api/src/trading_agent/memory/index.mjs';
// @ts-expect-error
import { BotRunner } from '../../apps/api/src/trading_agent/bots/index.mjs';
// @ts-expect-error
import { ShadowRevenueEngine } from '../../apps/api/src/trading_agent/revenue/index.mjs';
// @ts-expect-error — plain ESM JS test helper
import { goodInput, NOW } from '../../apps/api/test/helpers/decision_fixture.mjs';

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const HERE = import.meta.dirname ?? new URL('.', import.meta.url).pathname;
const MIGRATIONS_DIR = resolve(HERE, '..', 'migrations');
const ENV = { TRADING_FLAG_TRADING_AGENT: 'true', TRADING_FLAG_REVENUE_ENGINE: 'true' };
const ENV_MODE_B = { ...ENV, TRADING_FLAG_MANDATE_MODE_B: 'true' };
const SPEC = defineInstrument({ canonical: 'BTC-USDT', venue: 'mock', venueSymbol: 'BTCUSDT', quoteCurrency: 'USDT', quoteDecimals: 2, tickSize: '0.01', lotSize: '0.0001', minQuantity: '0.0001', minNotional: '1' });
const alice = { principalId: 'prn_alice', kind: 'human', role: 'user' };
const RAW_DSL = {
  dsl: 'satelink.strategy/1.0', name: 'Band', universe: { venue: 'binance', instruments: ['BTC-USDT'] }, timeframe: '1h',
  entry: { cmp: { op: 'lt', left: { price: 'close' }, right: { const: '97' } } },
  exit: { cmp: { op: 'gt', left: { price: 'close' }, right: { const: '103' } } },
  position: { side: 'long', sizing: { mode: 'fixed_quantity', quantity: '1' } }, risk: { stopLossPct: '50' },
};
const REPLIES: Record<string, unknown> = {
  Market: { summary: 'Ranging market; spread tight.', observations: [] }, 'Regime-interpreter': { interpretation: 'Ranging, normal volatility.', cautions: [] },
  'Risk-explainer': { explanation: 'All 20 checks apply; the mandate caps notional.' }, Portfolio: { note: 'Small addition; low concentration.' },
  Review: { lessons: ['entry respected the band'], failureModes: [] },
};

function assertLocal(url: string): void {
  const u = new URL(url);
  const socketHost = u.searchParams.get('host');
  const local = ['localhost', '127.0.0.1', '::1', ''].includes(u.hostname) && (u.hostname !== '' || (socketHost ?? '').startsWith('/'));
  if (!local) throw new Error(`TRADING_FOUNDATION_TEST_DB must point at a local server, got "${u.hostname || socketHost}"`);
}

describe('Phase 6 item 14 — full loop (paper), one trace id per leg', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let adminUrl: string | undefined;
  let dbName: string | undefined;
  let pool: pg.Pool;
  let traced: Any;
  const t = { now: NOW };
  const clock = () => new Date(t.now);
  let n = 0;
  const ids = (p: string) => `${p}_${String(++n).padStart(6, '0')}`;
  const W: Any = {}; // wiring

  /** Every trace id written by a leg, across all trace-bearing tables. */
  async function traceIdsFor({ runIds = [], orderIds = [], decisionIds = [], proposalIds = [], keyId = null }: Any) {
    const q = async (sql: string, args: unknown[]) => (await pool.query(sql, args)).rows.map((r: Any) => r.trace_id);
    const all = [
      ...(await q('SELECT trace_id FROM agent_runs WHERE id = ANY($1)', [runIds])),
      ...(await q('SELECT trace_id FROM tool_calls WHERE run_id = ANY($1)', [runIds])),
      ...(await q('SELECT trace_id FROM model_traces WHERE run_id = ANY($1)', [runIds])),
      ...(await q('SELECT trace_id FROM orders WHERE id = ANY($1)', [orderIds])),
      ...(await q('SELECT trace_id FROM order_events WHERE order_id = ANY($1)', [orderIds])),
      ...(await q('SELECT trace_id FROM fills WHERE order_id = ANY($1)', [orderIds])),
      ...(await q(`SELECT trace_id FROM audit_events WHERE action = 'risk.decision' AND target_id = ANY($1)`, [proposalIds.map((p: string) => `prp_${p}`)])),
      ...(await q('SELECT trace_id FROM trading_decisions WHERE id = ANY($1)', [decisionIds])),
      ...(await q('SELECT trace_id FROM trading_proposals WHERE id = ANY($1)', [proposalIds])),
      ...(await q('SELECT trace_id FROM trading_proposal_events WHERE proposal_id = ANY($1)', [proposalIds])),
      ...(await q('SELECT trace_id FROM decision_memory WHERE decision_id = ANY($1)', [decisionIds])),
      ...(await q('SELECT trace_id FROM trade_memory WHERE decision_id = ANY($1)', [decisionIds])),
      ...(keyId ? await q('SELECT trace_id FROM trading_agent_usage WHERE key_id = $1', [keyId]) : []),
    ];
    return { count: all.length, distinct: [...new Set(all)] };
  }

  beforeAll(async () => {
    let conn: string;
    const local = process.env.TRADING_FOUNDATION_TEST_DB;
    if (local) {
      assertLocal(local);
      adminUrl = local;
      dbName = `trading_full_loop_${Date.now()}`;
      const a = new pg.Client({ connectionString: local });
      await a.connect();
      await a.query(`CREATE DATABASE ${dbName}`);
      await a.end();
      const u = new URL(local);
      u.pathname = `/${dbName}`;
      conn = u.toString();
    } else {
      container = await new PostgreSqlContainer('postgres:16-alpine').start();
      conn = container.getConnectionUri();
    }
    const result = await applyMigrationsForTest(conn, MIGRATIONS_DIR);
    expect(result.errors).toHaveLength(0);
    expect(result.applied).toContain('037_trading_trace_coverage.sql');
    pool = new pg.Pool({ connectionString: conn, max: 8 });
    await pool.query(`INSERT INTO principals (id, kind, display_name, state) VALUES ('prn_alice', 'human', 'alice', 'active')`);
    await pool.query(`INSERT INTO principals (id, kind, parent_id, display_name, state) VALUES ('prn_bot', 'agent', 'prn_alice', 'research bot', 'active'), ('prn_exec', 'machine', 'prn_alice', 'exec machine', 'active')`);
    await pool.query(`INSERT INTO broker_accounts (id, principal_id, broker, environment, status) VALUES ('bka_0001', 'prn_alice', 'binance', 'paper', 'active')`);
    traced = tracedPool(pool);

    // strategy in PAPER (Mode B binds it)
    W.strategies = new StrategyService({ store: new PgStrategyStore(traced), idFactory: ids, env: ENV, clock });
    const s = await W.strategies.createStrategy({ actor: alice, name: 'Band' });
    W.version = await W.strategies.createVersion({ actor: alice, strategyId: s.id, dsl: RAW_DSL });
    await W.strategies.transition({ actor: alice, versionId: W.version.id, to: S.BACKTESTED, expectedFrom: S.DRAFT, evidence: { backtest: { backtestId: 'bkt_00000001', definitionHash: W.version.definitionHash, bars: 1000, passed: true } } });
    await W.strategies.transition({ actor: alice, versionId: W.version.id, to: S.PAPER, expectedFrom: S.BACKTESTED, evidence: { approval: { approvedBy: 'prn_alice', note: 'paper' } } });

    // mandates: A (copilot, human approval per order) and B (bound to the strategy version)
    W.mandates = new MandateService({
      store: new PgMandateStore(traced), signer: { keyId: 'fl-k1', secret: Buffer.alloc(32, 9) }, clock, idFactory: ids, strategies: W.strategies,
      stepUp: { async availability() { return { available: true }; }, async verify() { return { ok: true, method: 'totp', userId: 'u1' }; } },
      accounts: { async get() { return { id: 'bka_0001', principalId: 'prn_alice', broker: 'mock', environment: 'paper', status: 'active' }; } },
    });
    const limits = { currency: 'USDT', decimals: 2, maxOrderNotionalMinor: '100000', maxDailyNotionalMinor: '500000' };
    const validUntil = new Date(NOW + 30 * 86_400_000).toISOString();
    const pa = await W.mandates.propose({ actor: alice, principalId: 'prn_alice', draft: { brokerAccountId: 'bka_0001', environment: 'paper', mode: 'A', strategy: null, instruments: ['BTC-USDT'], limits, validUntil } });
    await W.mandates.sign({ actor: alice, mandateId: pa.mandateId, termsHash: pa.termsHash, nonce: pa.nonce, code: '123456' });
    const pb = await W.mandates.propose({ actor: alice, principalId: 'prn_alice', draft: { brokerAccountId: 'bka_0001', environment: 'paper', mode: 'B', strategy: { strategyId: s.id, versionId: W.version.id, definitionHash: W.version.definitionHash }, instruments: ['BTC-USDT'], limits, validUntil } });
    await W.mandates.sign({ actor: alice, mandateId: pb.mandateId, termsHash: pb.termsHash, nonce: pb.nonce, code: '654321' }); // replay guard: a fresh code
    W.mandateA = pa.mandateId; W.mandateB = pb.mandateId;
    t.now += 60_000;

    // keys, decisions, memory, revenue
    W.keyStore = new PgAgentKeyStore(traced);
    W.keys = new AgentKeyService({ store: W.keyStore, idFactory: ids, clock, principals: { get: async (id: string) => { const r = (await pool.query('SELECT id, kind, parent_id, state FROM principals WHERE id = $1', [id])).rows[0]; return r ? { id: r.id, kind: r.kind, parentId: r.parent_id, state: r.state } : null; } } });
    W.decisionStore = new PgDecisionStore(traced);
    W.decisions = new DecisionService({ store: W.decisionStore, idFactory: ids, clock });
    W.memory = new MemoryService({ store: new PgMemoryStore(traced), idFactory: ids, clock });
    W.revenue = new ShadowRevenueEngine({ env: ENV });

    // risk context: the real mandate, the real strategy version, plus Mode B proposer + scorecard lookups
    const riskStore = new PgRiskStore(traced);
    const ctxFor = async (o: Any) => {
      const key = o.proposedBy ? (await pool.query('SELECT principal_id, owner_principal_id, scope, mandate_id FROM trading_agent_keys WHERE principal_id = $1 AND revoked_at IS NULL', [o.proposedBy])).rows[0] : null;
      const dec = o.decisionId ? (await pool.query('SELECT id, decision, expires_at, principal_id, instrument, side FROM trading_decisions WHERE id = $1', [o.decisionId])).rows[0] : null;
      const v = o.strategyVersionId ? await W.strategies.getVersion(o.strategyVersionId) : null;
      return {
        now: t.now, flagsEnv: W.flags ?? ENV,
        policy: { id: 'rsk_1', version: 1, hash: `sha256:${'a'.repeat(64)}`, currency: 'USDT', decimals: 2, maxOrderNotionalMinor: '100000', maxDailyNotionalMinor: '500000', maxDailyLossMinor: '20000', maxLeverage: '2', maxOpenPositions: 3, allowedInstruments: ['BTC-USDT'], killSwitch: false,
          limits: { maxPositionNotionalMinor: '200000', maxPriceDeviationBps: 100, maxQuoteAgeMs: 5000, maxOrdersPerMinute: 10, maxOrdersPerDay: 200, duplicateWindowMs: 2000, allowShort: false, breakers: { maxConsecutiveLosses: 5, maxConsecutiveRejects: 10, maxBrokerErrors: 5 } } },
        killSwitchEvents: await riskStore.killSwitchEvents({ principalId: 'prn_alice' }),
        brokerAccount: { id: 'bka_0001', principalId: 'prn_alice', broker: 'binance', environment: 'paper', status: 'active' },
        mandate: await W.mandates.verifyForOrder(o.mandateId).catch(() => null),
        strategy: v ? { versionId: v.id, strategyId: v.strategyId, state: v.state, instruments: ['BTC-USDT'] } : null,
        instrument: { canonical: 'BTC-USDT', venue: 'mock', tickSize: '0.01', lotSize: '0.0001', minQuantity: '0.0001', minNotional: '5', quoteCurrency: 'USDT' },
        quote: { instrument: 'BTC-USDT', bid: '29990', ask: '30010', sourceTime: t.now - 500, stale: false },
        account: { equityMinor: '1000000', cashAvailableMinor: '800000', grossExposureMinor: '0' },
        activity: { idempotencyKeyUsed: false, ordersLastMinute: 0, ordersToday: 0, todayNotionalMinor: '0', realizedPnlTodayMinor: '0', unrealizedPnlMinor: '0', openPositions: [], lastSimilarOrderAt: null, consecutiveLosses: 0, consecutiveRejects: 0, brokerErrorsInWindow: 0 },
        proposer: key ? { principalId: key.principal_id, ownerPrincipalId: key.owner_principal_id, scope: key.scope, mandateId: key.mandate_id } : null,
        scorecardDecision: dec ? { id: dec.id, decision: dec.decision, expires_at: dec.expires_at.toISOString(), subject: { principalId: dec.principal_id, instrument: dec.instrument, side: dec.side } } : null,
      };
    };
    W.broker = new MockBroker({ credentialLoader: { async load() { return {}; } }, instruments: new InstrumentRegistry([SPEC]), clock, marketPrices: { 'BTC-USDT': '30000' }, defaultScenario: MockScenario.FILL });
    W.omsStore = new PgOmsStore(traced);
    W.acceptance = new OrderAcceptanceService({ store: W.omsStore, mandates: W.mandates, risk: new RiskEngine({ loadContext: ctxFor, store: riskStore, clock, idFactory: ids }), venues: { capabilities: () => W.broker.capabilities() }, idFactory: ids, clock });
    W.proposals = new ProposalService({
      store: new PgProposalStore(traced), idFactory: ids, clock, acceptance: W.acceptance, strategies: W.strategies,
      ownerOf: async (p: string) => (await pool.query('SELECT COALESCE(parent_id, id) AS owner FROM principals WHERE id = $1', [p])).rows[0]?.owner ?? null,
      orderContext: async () => ({ brokerAccountId: 'bka_0001', venue: 'mock', mode: 'paper' }),
    });

    // AI layer: real orchestrator, scripted model replies, READ tools
    const read = {
      marketData: { async getQuote(_p: string, instrument: string) { return { data: { kind: 'quote', instrument, bid: '29990', ask: '30010' }, freshness: { stale: false, ageMs: 500 } }; }, async getCandles() { return { data: [], freshness: { stale: false } }; } },
      intelligence: { async getMetric(metric: string) { return { metric, rows: [] }; } }, positions: { async list() { return []; } }, orders: { async list() { return []; } },
      risk: { async getActivePolicy() { return { killSwitch: false }; } }, mandates: { async get() { return { status: 'active' }; } }, strategies: { async get() { return {}; } }, accounts: { async summary() { return { balances: [] }; } },
    };
    const tools = new ToolRegistry({ read, proposals: W.proposals });
    for (const tool of createDefaultTools()) tools.register(tool);
    const provider = new ScriptedProvider({ id: 'anthropic', script: Array.from({ length: 60 }, () => (messages: Any[]) => {
      const role = Object.keys(REPLIES).find((k) => messages.some((m) => String(m.content).startsWith(`You are the ${k} agent`)))!;
      return { content: JSON.stringify(REPLIES[role]), model: 'claude-sonnet-5', usage: { inputTokens: 1000, outputTokens: 100 } };
    }) });
    W.recorder = () => new TraceRecorder({ store: new PgTraceStore(traced), clock, idFactory: ids });
    W.orchestrator = new Orchestrator({
      tools, router: new TieredModelRouter({ providers: { anthropic: provider, groq: provider } }), recorder: W.recorder(), decisions: W.decisions,
      buildDecisionInput: async (task: Any) => ({ ...goodInput(), opportunityId: task.opportunityId ?? null }), parseStrategy: parseStrategyDsl, idFactory: ids,
    });
    W.assistant = createAssistant({ orchestrator: W.orchestrator, proposals: W.proposals });

    // bots (the separate worker's library), driven by explicit ticks
    W.botDeps = {
      dispatcher: new OrderDispatcher({ store: new PgOmsStore(traced), adapters: { forVenue: () => W.broker }, mandates: W.mandates, clock }),
      fillConsumer: new FillConsumer({ store: new PgPortfolioStore(traced), adapters: { forVenue: () => W.broker }, clock }),
      killSwitchEvents: async () => riskStore.killSwitchEvents({ principalId: null }),
      proposals: W.proposals, orchestrator: W.orchestrator, memory: W.memory,
    };
    W.bots = (env: Any) => new BotRunner({ deps: W.botDeps, env, clock, log: { info() {}, error() {} } });
  }, 300_000);

  afterAll(async () => {
    await pool?.end();
    if (container) await container.stop();
    if (adminUrl && dbName) {
      const a = new pg.Client({ connectionString: adminUrl });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await a.end();
    }
  });

  /** After acceptance: dispatcher + fill consumer bots → filled; memory + review. Returns the order row. */
  async function executeAndLearn(trace: Any, orderId: string, decision: Any) {
    const bots = W.bots(ENV);
    t.now += 1_000;
    await runWithTrace(trace, async () => {
      expect((await bots.tick('oms_dispatcher')).outcome).toBe('ok');
      expect((await bots.tick('fill_consumer')).outcome).toBe('ok');
      await W.memory.recordDecision(decision);
      await W.memory.recordAuthorization({ decisionId: decision.id, principalId: 'prn_alice', mandateId: W.mandateA });
      const snap = await new PortfolioSnapshotter({ store: new PgPortfolioStore(traced), marks: { async mark() { return { price: '31000', stale: false }; } }, clock }).take({ principalId: 'prn_alice', brokerAccountId: 'bka_0001', mode: 'paper' });
      const [review] = await bots.emit('trade.closed', { principalId: 'prn_alice', instrument: 'BTC-USDT', decisionId: decision.id, orderId, pnl: (Number(snap.unrealizedPnlMinor) / 100).toFixed(2), closedAt: clock().toISOString() });
      expect(review.outcome).toBe('ok');
      await W.memory.recordOutcome({ decisionId: decision.id, principalId: 'prn_alice', outcome: 'profit', pnl: (Number(snap.unrealizedPnlMinor) / 100).toFixed(2) });
    });
    const o = (await pool.query('SELECT id, status, filled_quantity::text AS q FROM orders WHERE id = $1', [orderId])).rows[0];
    expect(o.status).toBe('filled');
    return o;
  }

  it('A. human: intent → assistant → agents → engines → scorecard GO → proposal → step-up approval → risk → OMS → paper fill → portfolio → memory → review, one trace', async () => {
    const trace = newTrace();
    let res: Any; let approved: Any;
    await runWithTrace(trace, async () => {
      res = await W.assistant.evaluate({ principalId: 'prn_alice', kind: 'human' }, { intent: { capital: '1000', maxLoss: '50', broker: 'binance', markets: ['BTC-USDT'] }, order: { mandateId: W.mandateA, side: 'buy', quantity: '0.002' } }, 'req-human-1');
      expect(res.card.decision).toBe('GO');
      expect(res.proposal.status).toBe('pending_review');
      approved = await W.proposals.approve({ principalId: 'prn_alice', kind: 'human' }, res.proposal.proposalId, {}, 'idem-human-1', 'totp');
      expect(approved).toMatchObject({ status: 'approved' });
    });
    const decision = await W.decisionStore.get(res.card.receipt_id);
    const o = await executeAndLearn(trace, approved.orderId, { id: decision.id, decision: decision.decision, score: decision.score, dimension_scores: decision.dimension_scores, evidence_refs: decision.evidence_refs, strategy_version: decision.strategy_version_id, subject: { principalId: 'prn_alice', opportunityId: decision.opportunity_id } });
    expect(o.q).toMatch(/^0\.002/);
    const runIds = (await pool.query(`SELECT id FROM agent_runs WHERE trace_id = $1`, [trace.traceId])).rows.map((r: Any) => r.id);
    expect(runIds.length).toBeGreaterThanOrEqual(2); // evaluation + post-trade review
    const tr = await traceIdsFor({ runIds, orderIds: [o.id], decisionIds: [decision.id], proposalIds: [res.proposal.proposalId] });
    expect(tr.distinct).toEqual([trace.traceId]);
    expect(tr.count).toBeGreaterThan(20);
    const ctx = await W.memory.contextFor({ principalId: 'prn_alice' });
    expect(ctx.decisions.byOutcome).toMatchObject({ profit: 1 });
    expect(ctx.trades.total).toBe(1);
  }, 120_000);

  it('B. machine API: key (scope + budget) → evaluate → propose → human approval → … → metered, one trace', async () => {
    const issued = await W.keys.issue({ actor: alice, principalId: 'prn_bot', scope: 'PROPOSE', budgetCalls: 10, budgetUsdMicro: 100_000 });
    const principal = await W.keys.resolve(issued.apiKey);
    const machine = createMachineInterface({ orchestrator: W.orchestrator, decisionStore: W.decisionStore, proposals: W.proposals, guard: new AgentAccessGuard({ store: W.keyStore, idFactory: ids, clock, revenue: W.revenue }) });
    const trace = newTrace();
    let ev: Any; let prop: Any; let approved: Any;
    await runWithTrace(trace, async () => {
      ev = await machine.evaluate(principal, { instrument: 'BTC-USDT', opportunityId: 'opp_machine_1' }, 'req-machine-1');
      expect(ev.decision).toBe('GO');
      prop = await machine.propose(principal, { mandateId: W.mandateA, instrument: 'BTC-USDT', side: 'buy', quantity: '0.001', decisionId: ev.receipt_id, rationale: 'machine GO' }, 'req-machine-2');
      approved = await W.proposals.approve({ principalId: 'prn_alice', kind: 'human' }, prop.proposalId, {}, 'idem-machine-1', 'totp');
    });
    const decision = await W.decisionStore.get(ev.receipt_id);
    const o = await executeAndLearn(trace, approved.orderId, { id: decision.id, decision: decision.decision, score: decision.score, dimension_scores: decision.dimension_scores, evidence_refs: decision.evidence_refs, strategy_version: decision.strategy_version_id, subject: { principalId: 'prn_alice', opportunityId: decision.opportunity_id } });
    const runIds = (await pool.query(`SELECT id FROM agent_runs WHERE trace_id = $1`, [trace.traceId])).rows.map((r: Any) => r.id);
    const tr = await traceIdsFor({ runIds, orderIds: [o.id], decisionIds: [decision.id], proposalIds: [prop.proposalId], keyId: issued.keyId });
    expect(tr.distinct).toEqual([trace.traceId]);
    expect(tr.count).toBeGreaterThan(20);
    expect((await pool.query('SELECT count(*)::int AS n FROM trading_agent_usage WHERE key_id = $1', [issued.keyId])).rows[0].n).toBe(2);
    expect((await pool.query(`SELECT count(*)::int AS n FROM model_traces WHERE machine_request_id = 'req-machine-1'`)).rows[0].n).toBeGreaterThan(0);
    expect(W.revenue.varianceReport('sim').streams[0]).toMatchObject({ stream: 'usage', expectedMinor: '6000' }); // draft pricing → sim book
    expect(W.revenue.entries('real')).toHaveLength(0);
  }, 120_000);

  it('C. Mode B: EXECUTE key bound to a signed Mode B mandate → candidate → mode_b_executor (flag) → risk Mode B rule → paper fill, one trace', async () => {
    const issued = await W.keys.issue({ actor: alice, principalId: 'prn_exec', scope: 'EXECUTE_UNDER_MANDATE', mandateId: W.mandateB, budgetCalls: 10, budgetUsdMicro: 100_000 });
    const principal = await W.keys.resolve(issued.apiKey);
    const machine = createMachineInterface({ orchestrator: W.orchestrator, decisionStore: W.decisionStore, proposals: W.proposals, guard: new AgentAccessGuard({ store: W.keyStore, idFactory: ids, clock }) });
    const trace = newTrace();
    let ev: Any; let prop: Any;
    await runWithTrace(trace, async () => {
      ev = await machine.evaluate(principal, { instrument: 'BTC-USDT', opportunityId: 'opp_modeb_1' }, 'req-modeb-1');
      expect(ev.decision).toBe('GO');
      prop = await machine.propose(principal, { mandateId: W.mandateB, instrument: 'BTC-USDT', side: 'buy', quantity: '0.001', decisionId: ev.receipt_id, strategyVersionId: W.version.id }, 'req-modeb-2');
      expect(prop.executionPath).toBe('mode_b_candidate');
    });
    const pendingBefore = await W.proposals.listModeBCandidates();
    expect(pendingBefore.map((p: Any) => p.id)).toContain(prop.proposalId);
    // flag OFF → the acting bot does nothing
    await runWithTrace(trace, async () => { expect((await W.bots(ENV).tick('mode_b_executor')).outcome).toBe('skipped_flag'); });
    expect((await pool.query(`SELECT status FROM trading_proposals WHERE id = $1`, [prop.proposalId])).rows[0].status).toBe('pending_review');
    // flag ON → executed without a click; the risk engine's Mode B rule decided (strategy version from the payload)
    W.flags = ENV_MODE_B;
    let tick: Any;
    await runWithTrace(trace, async () => { tick = await W.bots(ENV_MODE_B).tick('mode_b_executor'); });
    W.flags = ENV;
    expect(tick.outcome).toBe('ok');
    expect(tick.value[0], JSON.stringify(tick.value)).toMatchObject({ executed: true });
    const orderId = tick.value[0].orderId;
    const risk = (await pool.query(`SELECT payload FROM audit_events WHERE action = 'risk.decision' AND target_id = $1`, [`prp_${prop.proposalId}`])).rows[0].payload;
    expect(risk).toMatchObject({ decision: 'APPROVE', checksVersion: 'risk-checks/1.1' });
    const ev2 = (await pool.query(`SELECT action, actor_id FROM trading_proposal_events WHERE proposal_id = $1 ORDER BY id`, [prop.proposalId])).rows;
    expect(ev2.map((e: Any) => e.action)).toEqual(['created', 'mode_b_executed']);
    const intentRow = (await pool.query(`SELECT * FROM orders WHERE id = $1`, [orderId])).rows[0];
    expect(intentRow.mode).toBe('paper');
    const bots = W.bots(ENV);
    t.now += 1_000;
    await runWithTrace(trace, async () => { await bots.tick('oms_dispatcher'); await bots.tick('fill_consumer'); });
    expect((await pool.query('SELECT status FROM orders WHERE id = $1', [orderId])).rows[0].status).toBe('filled');
    const runIds = (await pool.query(`SELECT id FROM agent_runs WHERE trace_id = $1`, [trace.traceId])).rows.map((r: Any) => r.id);
    const tr = await traceIdsFor({ runIds, orderIds: [orderId], decisionIds: [ev.receipt_id], proposalIds: [prop.proposalId], keyId: issued.keyId });
    expect(tr.distinct).toEqual([trace.traceId]);
    expect(tr.count).toBeGreaterThan(15);
  }, 120_000);

  it('order list on Postgres is newest first across the three legs', async () => {
    const orders = await new PgOmsStore(pool).listOrders({ principalId: 'prn_alice' });
    expect(orders).toHaveLength(3);
    for (let i = 1; i < orders.length; i += 1) expect(orders[i - 1].createdAt).toBeGreaterThanOrEqual(orders[i].createdAt);
    expect((await new PgOmsStore(pool).listOrders({ principalId: 'prn_alice', limit: 1 }))).toHaveLength(1);
  });
});
