import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { mountTradingRoutes, TRADING_MOUNT_PATH } from '../src/trading_agent/index.mjs';
import { createServicePorts, InMemoryIdempotencyStore } from '../src/trading_agent/api/index.mjs';
import { OrderAcceptanceService, InMemoryOmsStore } from '../src/trading_agent/oms/index.mjs';
import { ProposalService, InMemoryProposalStore, createAssistant } from '../src/trading_agent/proposals/index.mjs';
import { StrategyService, InMemoryStrategyStore } from '../src/trading_agent/strategies/index.mjs';
import { ToolRegistry, createDefaultTools } from '../src/trading_agent/agent/index.mjs';
import { DecisionService, InMemoryDecisionStore } from '../src/trading_agent/decision/index.mjs';
import { goodInput, NOW } from './helpers/decision_fixture.mjs';
import { ORDER_INTENT_SCHEMA } from '../src/trading_agent/risk/index.mjs';
import { validateAgainst } from '../src/trading_agent/strategies/validator.mjs';

// Phase 6 item 13 — proposal review queue + order list (replacing the Stage 24 501s) + assistant.
const ENV = { TRADING_FLAG_TRADING_AGENT: 'true' };
const TERMS = `sha256:${'a'.repeat(64)}`;
const USERS = {
  alice: { principalId: 'prn_alice', kind: 'human', via: 'session' },
  bob: { principalId: 'prn_bob', kind: 'human', via: 'session' },
  bot: { principalId: 'prn_bot', kind: 'agent', via: 'api_key' },
};

function rig({ riskRefuses = false, decisionInput = goodInput } = {}) {
  const t = { now: NOW };
  const clock = () => new Date(t.now);
  let n = 0;
  const ids = (p) => `${p}_${String(++n).padStart(6, '0')}`;
  const omsStore = new InMemoryOmsStore();
  const intents = [];
  const mandate = { principalId: 'prn_alice', brokerAccountId: 'bka_alice_1', currency: 'USDT', decimals: 2, termsHash: TERMS };
  const acceptance = new OrderAcceptanceService({
    store: omsStore, idFactory: ids, clock,
    venues: { capabilities: () => ({ executionSafety: 'IDEMPOTENT', supportsClientOrderId: true, supportsQueryByClientOrderId: true, clientOrderIdMaxLength: 36 }) },
    mandates: { async verifyForOrder(id) { if (id !== 'mdt_alice_1') throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' }); return mandate; } },
    risk: { async decide(intent) {
      intents.push(intent);
      const v = validateAgainst(ORDER_INTENT_SCHEMA, intent); // the real engine's check 2: proposal-built intents must be schema-valid
      if (!v.ok) throw new Error(`intent fails ORDER_INTENT_SCHEMA: ${v.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`);
      return riskRefuses ? { decision: 'REJECT', recorded: true, decisionId: ids('rdc'), failedCheck: { code: 'MAX_ORDER_NOTIONAL', detail: 'too big' } } : { decision: 'APPROVE', recorded: true, decisionId: ids('rdc') }; } },
  });
  const strategyStore = new InMemoryStrategyStore();
  const strategies = new StrategyService({ store: strategyStore, idFactory: ids, env: ENV, clock });
  const proposalStore = new InMemoryProposalStore();
  const owners = { prn_bot: 'prn_alice', prn_alice: 'prn_alice', prn_bob: 'prn_bob' };
  const proposals = new ProposalService({
    store: proposalStore, idFactory: ids, clock, ownerOf: async (p) => owners[p] ?? null,
    orderContext: async (mandateId) => ({ brokerAccountId: 'bka_alice_1', venue: 'binance', mode: 'paper', mandateId }),
    acceptance, strategies,
  });
  const decisions = new DecisionService({ store: new InMemoryDecisionStore(), idFactory: ids, clock });
  const orchestrator = { run: async (task) => { const d = await decisions.evaluate(decisionInput()); return { status: 'ok', decision: d, recommendation: d.decision, traceId: ids('run'), agents: { market: { status: 'ok', output: { summary: 'Ranging.', observations: [] } } }, task }; } };
  const assistant = createAssistant({ orchestrator, proposals });
  const services = createServicePorts({ omsStore, acceptance, proposals, assistant });
  const stepUps = [];
  const app = express();
  mountTradingRoutes(app, { env: ENV, api: {
    resolvePrincipal: async (req) => USERS[req.get('x-test-user')] ?? null, services, clock, idempotencyStore: new InMemoryIdempotencyStore(),
    stepUp: { verify: async (r) => { stepUps.push(r); return r.code === '123456' ? { ok: true, method: 'totp' } : { ok: false }; } },
    trustedOrigins: [], limits: { read: 1000, write: 1000, stepUp: 100 },
  } });
  // the Stage 12 tool sink is the same service
  const tools = new ToolRegistry({ read: {}, proposals });
  for (const tool of createDefaultTools()) tools.register(tool);
  return { app, t, omsStore, proposalStore, proposals, intents, tools, stepUps, strategyStore };
}
const call = (app, method, url, { user = 'alice', body, stepUp, idem } = {}) => {
  let r = request(app)[method.toLowerCase()](`${TRADING_MOUNT_PATH}${url}`).set('x-test-user', user);
  if (method !== 'GET') r = r.set('X-Satelink-Client', '1').set('Idempotency-Key', idem ?? `idem-${Math.random().toString(36).slice(2, 12)}`);
  if (stepUp) r = r.set('X-Satelink-Step-Up', stepUp);
  return method === 'GET' ? r : r.send(body ?? {});
};
const agentProposes = (r, over = {}) => r.tools.invoke({ name: 'propose_order', arguments: { mandateId: 'mdt_alice_1', instrument: 'BTC-USDT', side: 'buy', type: 'limit', quantity: '0.001', limitPrice: '30000', rationale: 'scorecard said GO for this', ...over } }, { principalId: 'prn_bot', runId: 'run_000001' });

describe('trading: proposal review queue + order list + assistant (Phase 6 item 13)', function () {
  this.timeout(20_000);

  it('an agent proposal (Stage 12 tool) lands in its human OWNER\'s queue — the 501 is gone', async () => {
    const r = rig();
    expect((await agentProposes(r)).status).to.equal('ok');
    const list = await call(r.app, 'GET', '/proposals');
    expect(list.status).to.equal(200);
    expect(list.body.data).to.have.length(1);
    expect(list.body.data[0]).to.include({ principalId: 'prn_alice', proposedBy: 'prn_bot', kind: 'order', status: 'pending_review', mandateId: 'mdt_alice_1' });
    expect((await call(r.app, 'GET', '/proposals', { user: 'bob' })).body.data).to.deep.equal([]); // tenant isolation
  });

  it('approve needs step-up; with it, the proposal becomes a human-approved order through OMS acceptance + risk (paper)', async () => {
    const r = rig();
    await agentProposes(r);
    const id = r.proposalStore.events[0].proposalId;
    expect((await call(r.app, 'POST', `/proposals/${id}/approve`)).status).to.equal(401);
    expect((await call(r.app, 'POST', `/proposals/${id}/approve`, { stepUp: '000000' })).status).to.equal(401);
    const ok = await call(r.app, 'POST', `/proposals/${id}/approve`, { stepUp: '123456' });
    expect(ok.status).to.equal(201);
    expect(ok.body.data).to.include({ proposalId: id, status: 'approved' });
    expect(r.intents).to.have.length(1);
    expect(r.intents[0]).to.include({ principalId: 'prn_alice', approvedBy: 'prn_alice', origin: 'agent_proposal', proposedBy: 'prn_bot', mode: 'paper', venue: 'binance', brokerAccountId: 'bka_alice_1', instrument: 'BTC-USDT', quantity: '0.001' });
    const orders = await call(r.app, 'GET', '/orders');
    expect(orders.status).to.equal(200);
    expect(orders.body.data.map((o) => o.id)).to.deep.equal([ok.body.data.orderId]);
    const ev = r.proposalStore.events.map((e) => [e.action, e.stepUpMethod ?? null]);
    expect(ev).to.deep.equal([['created', null], ['approved', 'totp']]);
    const again = await call(r.app, 'POST', `/proposals/${id}/approve`, { stepUp: '123456' });
    expect([again.status, again.body.error.message]).to.deep.equal([409, 'proposal is approved']); // decided once, refused before OMS
    expect(r.intents).to.have.length(1); // the second approval never reached OMS acceptance
  });

  it('a risk refusal on approval closes the proposal as rejected with the reason (422), no order', async () => {
    const r = rig({ riskRefuses: true });
    await agentProposes(r);
    const id = r.proposalStore.events[0].proposalId;
    const res = await call(r.app, 'POST', `/proposals/${id}/approve`, { stepUp: '123456' });
    expect([res.status, res.body.error.code]).to.deep.equal([422, 'REFUSED']);
    expect((await r.proposalStore.get(id)).status).to.equal('rejected');
    expect(r.proposalStore.events.at(-1)).to.deep.include({ action: 'execution_refused' });
    expect((await call(r.app, 'GET', '/orders')).body.data).to.deep.equal([]);
  });

  it('reject (no step-up needed), foreign proposals are 404, expired proposals cannot be approved, agents cannot decide', async () => {
    const r = rig();
    await agentProposes(r); await agentProposes(r, { quantity: '0.002' });
    const [a, b] = [...r.proposalStore.rows.keys()];
    expect((await call(r.app, 'POST', `/proposals/${a}/reject`, { body: { reason: 'not now' } })).body.data.status).to.equal('rejected');
    expect((await call(r.app, 'POST', `/proposals/${b}/approve`, { user: 'bob', stepUp: '123456' })).status).to.equal(404);
    expect((await call(r.app, 'POST', `/proposals/${b}/reject`, { user: 'bot' })).status).to.equal(403); // HUMAN_REQUIRED
    r.t.now += 25 * 3_600_000;
    const exp = await call(r.app, 'POST', `/proposals/${b}/approve`, { stepUp: '123456' });
    expect([exp.status, exp.body.error.code]).to.deep.equal([409, 'EXPIRED']);
    expect((await r.proposalStore.get(b)).status).to.equal('expired');
    expect(r.intents).to.have.length(0);
  });

  it('defence in depth at the service layer: no step-up method → refused; agents cannot approve or use the assistant', async () => {
    const r = rig();
    await agentProposes(r);
    const id = r.proposalStore.events[0].proposalId;
    const codeOf = async (fn) => { try { await fn(); } catch (e) { return e.code; } return null; };
    expect(await codeOf(() => r.proposals.approve({ principalId: 'prn_alice', kind: 'human' }, id, {}, 'idem-x', undefined))).to.equal('STEP_UP_REQUIRED');
    expect(await codeOf(() => r.proposals.approve({ principalId: 'prn_alice', kind: 'agent' }, id, {}, 'idem-x', 'totp'))).to.equal('HUMAN_REQUIRED');
    const assistant = createAssistant({ orchestrator: { run: async () => { throw new Error('must not run'); } }, proposals: r.proposals });
    expect(await codeOf(() => assistant.evaluate({ principalId: 'prn_bot', kind: 'agent' }, { intent: { capital: '1000', maxLoss: '50', broker: 'binance', markets: ['BTC-USDT'] } }, 'req-1'))).to.equal('HUMAN_REQUIRED');
    expect(r.intents).to.have.length(0);
  });

  describe('Mode B execution (no per-order click; the risk engine decides)', () => {
    const candidate = (r, over = {}) => r.proposals.create({ principalId: 'prn_bot', proposedBy: 'prn_bot', proposedByKind: 'agent', kind: 'order', executionPath: 'mode_b_candidate', mandateId: 'mdt_alice_1', decisionId: 'dec_000123', payload: { mandateId: 'mdt_alice_1', instrument: 'BTC-USDT', side: 'buy', quantity: '0.001', limitPrice: '30000', strategyVersionId: 'stv_1' }, ...over });
    it('a candidate becomes an UNAPPROVED agent_proposal intent with proposer + decision id; event mode_b_executed', async () => {
      const r = rig();
      const { proposalId } = await candidate(r);
      expect((await r.proposals.listModeBCandidates()).map((p) => p.id)).to.deep.equal([proposalId]);
      const out = await r.proposals.executeModeB(proposalId);
      expect(out.executed).to.equal(true);
      expect(r.intents[0]).to.include({ origin: 'agent_proposal', proposedBy: 'prn_bot', decisionId: 'dec_000123', strategyVersionId: 'stv_1', mode: 'paper' });
      expect(r.intents[0]).to.not.have.property('approvedBy');
      expect(r.proposalStore.events.at(-1)).to.deep.include({ action: 'mode_b_executed', actorId: 'mode_b_executor' });
      expect(await r.proposals.listModeBCandidates()).to.deep.equal([]);
      expect((await r.proposals.executeModeB(proposalId)).reason).to.equal('NOT_A_CANDIDATE'); // once
    });
    it('a risk refusal closes the candidate; human-review proposals are never executed this way', async () => {
      const r = rig({ riskRefuses: true });
      const { proposalId } = await candidate(r);
      expect(await r.proposals.executeModeB(proposalId)).to.deep.include({ executed: false });
      expect((await r.proposalStore.get(proposalId)).status).to.equal('rejected');
      const r2 = rig();
      await agentProposes(r2); // human_review path
      expect((await r2.proposals.executeModeB([...r2.proposalStore.rows.keys()][0])).reason).to.equal('NOT_A_CANDIDATE');
      expect(r2.intents).to.have.length(0);
    });
  });

  it('an approved STRATEGY proposal becomes a new DRAFT version (it must still be validated)', async () => {
    const r = rig();
    const dsl = { dsl: 'satelink.strategy/1.0', name: 'Band', universe: { venue: 'binance', instruments: ['BTC-USDT'] }, timeframe: '1h', entry: { cmp: { op: 'lt', left: { price: 'close' }, right: { const: '97' } } }, exit: { cmp: { op: 'gt', left: { price: 'close' }, right: { const: '103' } } }, position: { side: 'long', sizing: { mode: 'fixed_quantity', quantity: '1' } }, risk: { stopLossPct: '50' } };
    const { proposalId } = await r.proposals.create({ kind: 'strategy', principalId: 'prn_bot', payload: { dsl, rationale: 'mean reversion' } });
    const res = await call(r.app, 'POST', `/proposals/${proposalId}/approve`, { stepUp: '123456' });
    expect(res.body.data).to.include({ status: 'approved', state: 'DRAFT' });
    expect([...r.strategyStore.versions.values()].map((v) => v.version)).to.deep.equal([1]);
  });

  describe('assistant: "Talk to Satelink Trading AI"', () => {
    const intent = { capital: '1000', maxLoss: '50', broker: 'binance', markets: ['BTC-USDT'] };
    it('intent → GO card with evidence; with an order → a pending proposal to authorise; then approve → paper order', async () => {
      const r = rig();
      const res = await call(r.app, 'POST', '/assistant/evaluate', { body: { intent, order: { mandateId: 'mdt_alice_1', side: 'buy', quantity: '0.001', limitPrice: '30000' } } });
      expect(res.status).to.equal(200);
      expect(res.body.data.card).to.include({ decision: 'GO' });
      expect(res.body.data.card.score_meaning).to.match(/NOT a probability of profit/);
      expect(res.body.data.notes.market.summary).to.equal('Ranging.');
      expect(res.body.data.proposal.status).to.equal('pending_review');
      expect(r.intents).to.have.length(0); // nothing placed by the assistant
      const ok = await call(r.app, 'POST', `/proposals/${res.body.data.proposal.proposalId}/approve`, { stepUp: '123456' });
      expect(ok.status).to.equal(201);
      expect(r.intents[0]).to.include({ origin: 'llm_proposal', approvedBy: 'prn_alice', decisionId: res.body.data.card.receipt_id });
    });
    it('WAIT / REJECT → no proposal, just the reason; bad intent → 400; agents cannot use it', async () => {
      const r = rig({ decisionInput: () => { const i = goodInput(); i.broker = { status: 'down' }; return i; } });
      const res = await call(r.app, 'POST', '/assistant/evaluate', { body: { intent, order: { mandateId: 'mdt_alice_1', side: 'buy', quantity: '0.001', limitPrice: '30000' } } });
      expect(res.body.data.card.decision).to.equal('REJECT');
      expect(res.body.data.proposal).to.equal(null);
      expect(res.body.data.nextStep).to.match(/not GO/);
      for (const bad of [{ ...intent, maxLoss: '2000' }, { ...intent, broker: 'robinhood' }, { ...intent, markets: [] }, { ...intent, capital: '1e3' }]) {
        expect((await call(r.app, 'POST', '/assistant/evaluate', { body: { intent: bad } })).status).to.equal(400);
      }
      expect((await call(r.app, 'POST', '/assistant/evaluate', { body: { intent, order: { mandateId: 'mdt_alice_1', side: 'buy', quantity: '1', limitPrice: '30000' } } })).status).to.equal(400); // larger than capital
      expect((await call(r.app, 'POST', '/assistant/evaluate', { user: 'bot', body: { intent } })).status).to.equal(403);
    });
  });

  it('order list is newest first, filterable and capped; without a store it is 501 (never guessed)', async () => {
    const r = rig();
    for (const q of ['0.001', '0.002']) { await agentProposes(r, { quantity: q }); }
    for (const id of [...r.proposalStore.rows.keys()]) { await call(r.app, 'POST', `/proposals/${id}/approve`, { stepUp: '123456' }); r.t.now += 1000; }
    const list = (await call(r.app, 'GET', '/orders?limit=1')).body.data;
    expect(list).to.have.length(1);
    expect(list[0].quantity).to.equal('0.002');
    const app = express();
    mountTradingRoutes(app, { env: ENV, api: { resolvePrincipal: async () => USERS.alice, services: createServicePorts({}), stepUp: { verify: async () => ({ ok: false }) }, idempotencyStore: new InMemoryIdempotencyStore() } });
    expect((await request(app).get(`${TRADING_MOUNT_PATH}/orders`)).status).to.equal(501);
  });
});
