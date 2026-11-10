// Workflow service — customer workflows on the vNext RoutingKernel.
//
// Trading (strategy evaluation) and agent procurement (capability calls) are two
// workload adapters on ONE kernel: same DISCOVER→QUOTE→ROUTE→EXECUTE→SETTLE
// phases, same durable idempotency, same hash-chained journal, same saga
// compensation. This module adds only the customer-facing run lifecycle:
//
//   create  → plan + quote (no side effects) → blocked | awaiting_approval | run
//   approve → kernel.submit (txId = run id, exactly-once per phase)
//   verify  → adapter result contract; failure = FAILED, no SETTLE, hold released
//   receipt → charge / supplier cost / settlement refs / verification
//
// Run state is event-sourced into the same journal (stream `run:<id>`), so the
// customer-visible trace and the kernel trace are one durable record.

import { DurableKernel } from '../vnext/reliability/durable_kernel.js';
import { MemoryDurableStore } from '../vnext/reliability/memory_durable_store.js';
import { Registry } from '../vnext/kernel/registry.js';
import { deriveTxId } from '../vnext/kernel/idempotency.js';
import { DecisionEngine } from '../vnext/routing/decision_engine.js';
import { Policies } from '../vnext/routing/policies.js';
import { SupplierRegistry } from '../vnext/registry/supplier_registry.js';
import { SupplierCatalog, usdToMicros, microsToUsd } from './supplier_catalog.js';
import { compileStrategy, normalizeSpec } from './strategy_compiler.js';
import { parseReason, createJsonRpcBalanceConnector, createX402HttpConnector } from './connectors.js';
import { MemoryRunStore } from './run_store.js';
import { canonicalJSON } from '../utils/canonical_json.js';
import {
  WORKLOADS, procurementWorkload, StrategyEvaluationAdapter, CapabilityProcurementAdapter,
  WithheldSettlement, createCandleSource, SIMULATION_LABEL,
} from './workload_adapters.js';

export const TEMPLATES = Object.freeze({
  'strategy_lab.backtest.v1': {
    id: 'strategy_lab.backtest.v1',
    name: 'Strategy Lab — backtest & scorecard',
    version: 1,
    summary: 'Turn a strategy description into a validated spec, select licensed market data, run a walk-forward backtest and produce an evidence scorecard.',
    approval: 'over_budget',
    nodes: [
      { id: 'compile', label: 'Strategy spec', kind: 'input', phases: [] },
      { id: 'data', label: 'Select market data', kind: 'discover', phases: ['DISCOVER', 'QUOTE', 'ROUTE'] },
      { id: 'licence', label: 'Data licence check', kind: 'gate', phases: ['ROUTE'] },
      { id: 'backtest', label: 'Walk-forward backtest', kind: 'execute', phases: ['EXECUTE'] },
      { id: 'scorecard', label: 'Verify & scorecard', kind: 'verify', phases: ['EXECUTE'] },
      { id: 'settle', label: 'Usage record', kind: 'settle', phases: ['SETTLE', 'CLOSED'] },
      { id: 'paper', label: 'Paper trading (your confirmation)', kind: 'manual', phases: [] },
    ],
  },
  'procurement.capability_call.v1': {
    id: 'procurement.capability_call.v1',
    name: 'Agent procurement — capability call',
    version: 1,
    summary: 'Find suppliers for a capability, compare them, quote, approve a capped purchase, execute, verify the result and issue a receipt.',
    approval: 'always',
    nodes: [
      { id: 'discover', label: 'Discover suppliers', kind: 'discover', phases: ['DISCOVER'] },
      { id: 'compare', label: 'Compare & quote', kind: 'quote', phases: ['QUOTE', 'ROUTE'] },
      { id: 'approval', label: 'Your approval', kind: 'gate', phases: [] },
      { id: 'execute', label: 'Execute service', kind: 'execute', phases: ['EXECUTE'] },
      { id: 'verify', label: 'Verify result', kind: 'verify', phases: ['EXECUTE'] },
      { id: 'settle', label: 'Settle & receipt', kind: 'settle', phases: ['SETTLE', 'CLOSED'] },
    ],
  },
});

export class WorkflowError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const KEY = /^[A-Za-z0-9._:-]{8,128}$/;

function graph(template, run, kernelPhases) {
  const t = TEMPLATES[template];
  const done = new Set(kernelPhases);
  const failed = run.status === 'failed';
  let firstPending = null;
  const nodes = t.nodes.map((n) => {
    let status = 'pending';
    if (n.id === 'compile') status = 'done';
    else if (n.id === 'approval') status = run.approval?.approved_at ? 'done' : run.status === 'awaiting_approval' ? 'waiting' : run.status === 'cancelled' ? 'cancelled' : 'pending';
    else if (n.id === 'paper') status = run.status === 'completed' ? 'available' : 'pending';
    else if (n.phases.length && n.phases.every((p) => done.has(p))) status = 'done';
    // The pre-approval quote already discovered and compared suppliers (the kernel
    // re-discovers at execution; this only reflects what the customer has seen).
    else if (run.quote?.available && ['discover', 'quote'].includes(n.kind)) status = 'done';
    if (status === 'pending' && firstPending === null) firstPending = n.id;
    return { id: n.id, label: n.label, kind: n.kind, status };
  });
  for (const n of nodes) {
    if (run.status === 'blocked' && n.id === firstPending) n.status = 'blocked';
    if (failed && n.id === firstPending) n.status = 'failed';
  }
  const edges = t.nodes.slice(1).map((n, i) => ({ from: t.nodes[i].id, to: n.id }));
  return { nodes, edges };
}

export class WorkflowService {
  /**
   * @param {object} o
   *  - catalog: SupplierCatalog (default: config/supplier_catalog.v1.json)
   *  - store: DurableStore (default: in-memory; pass PgDurableStore for production)
   *  - connectors: {[type]: connector}  (default: JSON-RPC balance + refusing x402)
   *  - candleSource: {load(instrumentId, startIso)}
   *  - runStore: MemoryRunStore | PgRunStore (default: memory)
   *  - evaluationStore: append-only StrategyEvaluation store (PgEvaluationStore in production)
   *  - clock
   */
  static async create(o = {}) {
    const svc = new WorkflowService(o);
    await svc._boot(o);
    return svc;
  }

  constructor({ catalog, clock, runStore } = {}) {
    this.catalog = catalog || SupplierCatalog.fromFile();
    this.clock = clock || (() => Date.now());
    this.runs = runStore || new MemoryRunStore();
  }

  async _boot({ store, connectors, candleSource, evaluationStore = null, env = process.env, fetchImpl, extraAdapters = [], registerExtraSuppliers = null } = {}) {
    await this.runs.ensureDefinitions(Object.values(TEMPLATES));
    this.connectors = connectors || {
      jsonrpc_balance: createJsonRpcBalanceConnector({ env, fetchImpl }),
      x402_http: createX402HttpConnector(),
    };
    this.settlement = new WithheldSettlement();
    this.supplierRegistry = new SupplierRegistry({ clock: this.clock });
    const workloadFor = (offer) => (offer.capability === 'market_data.candles' ? WORKLOADS.STRATEGY : procurementWorkload(offer.capability));
    // A first-party offer whose connector is not configured is not routable.
    const configured = new SupplierCatalog({
      ...this.catalog.raw,
      offers: this.catalog.raw.offers.map((o) => {
        const c = this.connectors[o.connector?.type];
        return c && c.configured && !c.configured(o) && ['live', 'preview'].includes(o.status) ? { ...o, status: 'not_authorized' } : o;
      }),
    });
    this.unconfigured = new Set(this.catalog.raw.offers.filter((o) => configured.offer(o.id).status !== o.status).map((o) => o.id));
    configured.registerInto(this.supplierRegistry, workloadFor);

    const registry = new Registry();
    registry.register(new StrategyEvaluationAdapter({ catalog: this.catalog, candleSource: candleSource || createCandleSource({ clock: this.clock }), evaluationStore, clock: this.clock }));
    for (const c of this.catalog.capabilities.values()) {
      if (c.id === 'market_data.candles') continue;
      registry.register(new CapabilityProcurementAdapter({ catalog: this.catalog, connectors: this.connectors, capability: c.id }));
    }
    // Release A: generic task-step adapters register on the SAME kernel (one engine, R1).
    for (const a of extraAdapters) registry.register(a);
    if (registerExtraSuppliers) registerExtraSuppliers(this.supplierRegistry);
    this.registry = registry;
    this.dk = await DurableKernel.boot({
      store: store || new MemoryDurableStore(),
      registry,
      settlement: this.settlement,
      clock: this.clock,
      decisionEngine: new DecisionEngine({ clock: this.clock }),
      policy: Policies.balanced,
      supplierRegistry: this.supplierRegistry,
    });
    // DurableKernel.boot already resumed interrupted kernel transactions; now bring
    // every run still marked 'running' to its terminal state.
    this.lastRecovery = await this.recover();
  }

  // ---------- read models ----------

  templates() {
    return Object.values(TEMPLATES).map((t) => ({ ...t, edges: t.nodes.slice(1).map((n, i) => ({ from: t.nodes[i].id, to: n.id })) }));
  }

  /** Effective catalog view (unconfigured first-party offers shown as not_authorized). */
  offerStatus(offerId) { return this.unconfigured.has(offerId) ? 'not_authorized' : this.catalog.offer(offerId)?.status; }

  searchCapabilities(q) { return this.catalog.search(q).map((c) => this._withRuntime(c)); }

  describeCapability(id, network) {
    const c = this.catalog.describeCapability(id, { network });
    return c ? this._withRuntime(c) : null;
  }

  _withRuntime(c) {
    const offers = c.offers.map((o) => (this.unconfigured.has(o.id)
      ? { ...o, status: 'not_authorized', status_detail: 'Connector not configured in this environment.', purchasable: o.purchasable ? { ok: false, reason: 'offer_not_authorized', detail: 'Connector not configured in this environment.' } : null }
      : o));
    const executable = offers.filter((o) => ['live', 'preview'].includes(o.status) && o.networks.some((n) => n.status === 'live'));
    return { ...c, offers, executable_offer_count: executable.length, availability: executable.length ? 'available' : offers.some((o) => o.status === 'evaluation') ? 'evaluation' : 'unavailable' };
  }

  /**
   * Compare all offers for (capability, network) and pick the one the kernel would
   * route to. Pure: no journal writes, no supplier calls.
   */
  quote({ capability, network }) {
    const cap = this.catalog.capability(capability);
    if (!cap) throw new WorkflowError(404, 'unknown_capability', `Unknown capability '${capability}'.`);
    const workload = capability === 'market_data.candles' ? WORKLOADS.STRATEGY : procurementWorkload(capability);
    const candidates = this.supplierRegistry.findCandidates({ workload, chain: network });
    const compared = this.catalog.offersFor(capability).map((o) => {
      const d = this.catalog.describeOffer(o, network);
      const runtime = this.unconfigured.has(o.id) ? { ok: false, reason: 'offer_not_authorized', detail: 'Connector not configured in this environment.' } : d.purchasable;
      return { offer_id: o.id, provider: o.provider.name, status: this.offerStatus(o.id), pricing: d.pricing, purchasable: runtime, last_verified: o.last_verified };
    });
    if (candidates.length === 0) {
      return { capability, network, available: false, chosen: null, compared, decision: null };
    }
    const decision = new DecisionEngine({ clock: this.clock }).select(candidates, Policies.balanced, {});
    const offer = this.catalog.offer(decision.chosen.supplierId);
    const p = this.catalog.price(offer);
    return {
      capability, network, available: true,
      chosen: { offer_id: offer.id, provider: offer.provider.name },
      customer_charge_usd: microsToUsd(p.chargeMicros),
      list_price_usd: p.listPriceMicros == null ? null : microsToUsd(p.listPriceMicros),
      supplier_cost_usd: microsToUsd(p.supplierCostMicros),
      pricing_approved: p.approved,
      pricing_note: p.approved ? null : 'Pricing not yet approved — this call is not charged.',
      compared,
      decision: { policy: decision.policy.name, scores: decision.scores ?? null },
    };
  }

  // ---------- run lifecycle ----------

  // Payloads are cloned: the journal hashes what it stores, so a later mutation
  // of a live object would break the chain on the next boot.
  async _event(runId, phase, payload) {
    await this.dk.journal.append(`run:${runId}`, phase, structuredClone(payload), this.clock());
  }

  /** Compare-and-set a status change; journals it only if it happened. */
  async _transition(run, from, patch) {
    const full = { ...patch, updated_at: new Date(this.clock()).toISOString() };
    const next = await this.runs.transition(run.id, from, full);
    if (next) {
      await this._event(run.id, 'RUN_UPDATED', full);
      await this.runs.upsertSteps(run.id, this.view(next).graph.nodes);
    }
    return next;
  }

  _validateBudget(budget) {
    if (budget == null || budget === '') return null;
    try { return usdToMicros(String(budget)); } catch { throw new WorkflowError(422, 'invalid_budget', 'budget_usd must be a non-negative decimal with up to 6 places.'); }
  }

  /**
   * Create a run. Idempotent per (principal, idempotency_key): a repeat returns the
   * existing run and never executes or charges twice.
   */
  async createRun(principal, { template, input = {}, budget_usd = null, idempotency_key } = {}) {
    if (!principal?.id) throw new WorkflowError(401, 'unauthenticated', 'A customer identity is required.');
    if (!TEMPLATES[template]) throw new WorkflowError(422, 'unknown_template', `Unknown template '${template}'.`);
    if (!KEY.test(idempotency_key || '')) throw new WorkflowError(422, 'idempotency_key_required', 'idempotency_key (8–128 chars, [A-Za-z0-9._:-]) is required.');
    const budget = this._validateBudget(budget_usd);
    const id = 'run_' + deriveTxId(`${principal.id}|${idempotency_key}`).slice(3);

    let request; let quote; let planInput;
    if (template === 'strategy_lab.backtest.v1') {
      const spec = this._spec(input, 'run');
      const network = `${spec.market.instrument_id}@${spec.timeframe}`;
      quote = this.quote({ capability: 'market_data.candles', network });
      request = { workload: WORKLOADS.STRATEGY, query: { chain: network, ...(quote.chosen ? { supplierId: quote.chosen.offer_id } : {}) }, payload: { spec }, payer: principal.id };
      planInput = { spec };
    } else {
      const { capability, network, address } = input;
      if (!this.catalog.capability(capability)) throw new WorkflowError(422, 'unknown_capability', `Unknown capability '${capability}'.`);
      if (typeof network !== 'string' || !network) throw new WorkflowError(422, 'network_required', 'network is required.');
      if (!ADDRESS.test(address || '')) throw new WorkflowError(422, 'invalid_address', 'address must be a public 0x address (40 hex characters).');
      quote = this.quote({ capability, network });
      request = { workload: procurementWorkload(capability), query: { chain: network, ...(quote.chosen ? { supplierId: quote.chosen.offer_id } : {}) }, payload: { capability, network, address }, payer: principal.id };
      planInput = { capability, network, address };
    }

    // Idempotent replay — but only for the SAME request. A reused key with a different
    // workflow, input or budget is a client bug and must not silently return old work.
    const existing = await this.runs.getRun(principal.id, id);
    if (existing) return this._replay(existing, template, planInput, budget);

    const now = new Date(this.clock()).toISOString();
    const charge = quote.available ? usdToMicros(quote.customer_charge_usd) : 0n;
    const overBudget = budget != null && charge > budget;
    const t = TEMPLATES[template];
    let status = 'running';
    let approval = { required: false, reason: null, approved_at: null };
    let blocked = null;
    if (!quote.available) {
      status = 'blocked';
      const reasons = quote.compared.map((c) => ({ offer_id: c.offer_id, provider: c.provider, reason: c.purchasable?.reason, detail: c.purchasable?.detail }));
      blocked = { code: 'no_executable_supplier', detail: `No supplier can execute '${quote.capability}' on '${quote.network}' right now.`, offers: reasons };
    } else if (t.approval === 'always' || overBudget) {
      status = 'awaiting_approval';
      approval = { required: true, reason: overBudget ? 'quote_exceeds_budget' : 'purchase_requires_approval', approved_at: null };
    }

    const run = {
      id, template, template_version: t.version, principal: principal.id, idempotency_key,
      status, created_at: now, updated_at: now,
      input: planInput, budget_usd: budget == null ? null : microsToUsd(budget),
      quote, approval, blocked,
      budget_hold: { amount_usd: microsToUsd(charge), status: status === 'blocked' ? 'none' : 'held', money_moved: false },
      result: null, receipt: null, error: null, decision: null,
      // Beta: every run is test data (never revenue); Strategy Lab runs are simulations.
      is_simulation: template === 'strategy_lab.backtest.v1',
      is_test_data: true,
      _request: request,
    };
    const ins = await this.runs.insertRun(run);
    if (!ins.inserted) return this._replay(ins.run, template, planInput, budget); // lost a concurrent create race
    if (planInput.spec) await this.runs.saveStrategy(principal.id, planInput.spec);
    const { _request: _r, ...audit } = run;
    await this._event(id, 'RUN_CREATED', audit);
    await this.runs.upsertSteps(id, this.view(run).graph.nodes);
    if (status === 'running') return { run: this.view(await this._execute(run)), replayed: false };
    return { run: this.view(run), replayed: false };
  }

  _replay(existing, template, planInput, budget) {
    const same = existing.template === template
      && canonicalJSON(existing.input) === canonicalJSON(planInput)
      && (existing.budget_usd ?? null) === (budget == null ? null : microsToUsd(budget));
    if (!same) throw new WorkflowError(409, 'idempotency_conflict', 'idempotency_key was already used for a different request.');
    return { run: this.view(existing), replayed: true };
  }

  async _own(principal, id) {
    const run = principal?.id ? await this.runs.getRun(principal.id, id) : null;
    if (!run) throw new WorkflowError(404, 'run_not_found', 'Run not found.');
    return run;
  }

  async approve(principal, id) {
    const run = await this._own(principal, id);
    const next = await this._transition(run, ['awaiting_approval'], {
      status: 'running',
      approval: { ...run.approval, approved_at: new Date(this.clock()).toISOString(), approved_by: principal.id },
    });
    // Not awaiting approval (already approved, finished or cancelled): report the current state.
    if (!next) return { run: this.view(await this._own(principal, id)), changed: false };
    return { run: this.view(await this._execute(next)), changed: true };
  }

  async cancel(principal, id) {
    const run = await this._own(principal, id);
    const next = await this._transition(run, ['awaiting_approval'], { status: 'cancelled', budget_hold: { ...run.budget_hold, status: 'released' } });
    if (!next) throw new WorkflowError(409, 'not_cancellable', `A ${run.status} run cannot be cancelled.`);
    return { run: this.view(next) };
  }

  async _execute(run) {
    // The customer approved a specific offer at a specific price. If either changed, stop
    // before anything runs (the kernel is pinned to the quoted offer via query.supplierId).
    const now = this.quote({ capability: run.quote.capability, network: run.quote.network });
    if (run.quote.available && (!now.available || now.chosen?.offer_id !== run.quote.chosen?.offer_id || now.customer_charge_usd !== run.quote.customer_charge_usd)) {
      return this._finalize(run, { state: 'FAILED', reason: '[quote_expired] the quoted supplier or price changed; request a new quote' });
    }
    let tx;
    try { tx = await this.dk.submit(run._request, { txId: run.id }); } catch (e) {
      console.error('[workflows] kernel submit failed:', e?.message || e);
      tx = { state: 'FAILED', reason: '[execution_failed] the workflow could not be executed' };
    }
    return this._finalize(run, tx);
  }

  /** Move a 'running' run to completed/failed from a kernel outcome; issue receipt + usage. */
  async _finalize(run, tx) {
    const issuedAt = new Date(this.clock()).toISOString();
    const receiptId = 'rcpt_' + run.id.slice(4);
    if (tx.state === 'CLOSED') {
      const offer = this.catalog.offer(tx.supplier.supplierId);
      // Amounts come from the quote the customer approved (re-checked in _execute), not a re-price.
      const p = {
        chargeMicros: usdToMicros(run.quote.customer_charge_usd),
        supplierCostMicros: usdToMicros(run.quote.supplier_cost_usd),
        listPriceMicros: run.quote.list_price_usd == null ? null : usdToMicros(run.quote.list_price_usd),
        approved: run.quote.pricing_approved,
      };
      const receipt = {
        receipt_id: 'rcpt_' + run.id.slice(4),
        run_id: run.id,
        idempotency_key: run.idempotency_key,
        served_by: { offer_id: offer.id, provider: offer.provider.name },
        customer_charge_usd: microsToUsd(p.chargeMicros),
        list_price_usd: p.listPriceMicros == null ? null : microsToUsd(p.listPriceMicros),
        supplier_cost_usd: microsToUsd(p.supplierCostMicros),
        margin_usd: (() => { const m = p.chargeMicros - p.supplierCostMicros; return m < 0n ? '-' + microsToUsd(-m) : microsToUsd(m); })(),
        pricing_approved: p.approved,
        settlement: tx.settlementOutRef,
        verification: 'verified',
        revenue: { counted: false, reason: p.approved ? 'pending_revenue_integration' : 'pricing_not_approved' },
        is_test_data: true,
        issued_at: issuedAt,
      };
      // Receipt and usage are written before the status flips, so a completed run always
      // has both; both inserts are idempotent (a recovery replay writes nothing new).
      await this.runs.insertReceipt({ receipt_id: receiptId, run_id: run.id, principal: run.principal, body: receipt, issued_at: issuedAt });
      await this.runs.insertUsage({
        run_id: run.id, principal: run.principal, offer_id: offer.id, capability: offer.capability,
        supplier_cost_micros: p.supplierCostMicros.toString(), customer_charge_micros: p.chargeMicros.toString(),
        list_price_micros: p.listPriceMicros == null ? null : p.listPriceMicros.toString(),
        pricing_approved: p.approved, is_test_data: true, counted_as_revenue: false, money_moved: false,
      });
      return (await this._transition(run, ['running'], {
        status: 'completed',
        result: tx.result,
        receipt_id: receiptId,
        decision: tx.decision ? { chosen: tx.decision.chosen?.supplierId ?? null, policy: tx.decision.policy?.name ?? null } : null,
        budget_hold: { ...run.budget_hold, status: 'captured', captured_usd: receipt.customer_charge_usd },
      })) || this.runs.getRunInternal(run.id);
    }
    let { code, detail } = tx.state === 'REJECTED'
      ? { code: 'quoted_supplier_unavailable', detail: 'The quoted supplier is no longer available; request a new quote.' }
      : parseReason(tx.reason);
    if (code === 'execution_failed') {
      // Unknown internal error: log it, never show internals to the customer.
      console.error('[workflows] run failed:', run.id, tx.reason);
      detail = 'The workflow failed. Nothing was charged.';
    }
    await this.runs.insertReceipt({
      receipt_id: receiptId, run_id: run.id, principal: run.principal, issued_at: issuedAt,
      body: { receipt_id: receiptId, run_id: run.id, idempotency_key: run.idempotency_key, outcome: 'failed', error_code: code, customer_charge_usd: '0', supplier_payment: 'none', note: 'Failed calls are never charged.', is_test_data: true, issued_at: issuedAt },
    });
    return (await this._transition(run, ['running'], {
      status: 'failed', error: { code, detail }, receipt_id: receiptId,
      budget_hold: { ...run.budget_hold, status: 'released' },
    })) || this.runs.getRunInternal(run.id);
  }

  /**
   * Restart recovery. For every run still 'running':
   *  - kernel stream CLOSED  → rebuild the outcome from the memoized phases (no re-execution)
   *  - kernel stream FAILED  → fail the run with the journaled reason
   *  - dead-lettered          → fail the run (operator inspects the DLQ)
   *  - never submitted        → submit now (the crash was between create/approve and SUBMIT)
   */
  async recover() {
    const out = { finalized: [], resubmitted: [] };
    for (const run of await this.runs.listOpenRuns()) {
      // Release A task runs are recovered by TaskService (verify-then-decide), never re-driven here.
      if (!TEMPLATES[run.template]) continue;
      const phases = this.dk.journal.read(run.id).map((e) => e.phase);
      let tx;
      if (phases.includes('CLOSED')) tx = await this.dk.kernel.execute(run._request, { txId: run.id });
      else if (phases.includes('REJECTED')) tx = { state: 'REJECTED', reason: 'no_supply' };
      else if (phases.includes('FAILED')) {
        const failed = this.dk.journal.read(run.id).filter((e) => e.phase === 'FAILED').pop();
        tx = { state: 'FAILED', reason: failed.payload?.reason };
      } else if (await this.dk.store.dlqGet(run.id)) tx = { state: 'FAILED', reason: '[recovery_dead_lettered] the run could not be completed after retries' };
      else { tx = await this.dk.submit(run._request, { txId: run.id }); out.resubmitted.push(run.id); }
      await this._finalize(run, tx);
      out.finalized.push(run.id);
    }
    return out;
  }

  async listRuns(principal, { limit = 50, strategyId = null } = {}) {
    if (!principal?.id) return [];
    return (await this.runs.listRuns(principal.id, { limit, strategyId })).map((r) => this.summary(r));
  }

  async getRun(principal, id) { return this.view(await this._own(principal, id), { trace: true }); }

  async getReceipt(principal, receiptId) {
    const r = principal?.id ? await this.runs.getReceipt(principal.id, receiptId) : null;
    if (!r) throw new WorkflowError(404, 'receipt_not_found', 'Receipt not found.');
    return r;
  }

  async saveStrategy(principal, { spec, prompt, answers } = {}) {
    if (!principal?.id) throw new WorkflowError(401, 'unauthenticated', 'A customer identity is required.');
    return this.runs.saveStrategy(principal.id, this._spec({ spec, prompt, answers }, 'save'));
  }

  /** A validated spec from {spec} or {prompt, answers}. Client ids/costs are never trusted. */
  _spec({ spec, prompt, answers } = {}, verb) {
    if (spec) {
      const n = normalizeSpec(spec);
      if (n.problems) throw new WorkflowError(422, 'invalid_spec', n.problems.join('; '));
      return n.spec;
    }
    const c = compileStrategy(prompt, answers || {});
    if (c.status !== 'compiled') throw new WorkflowError(422, c.status, `Strategy request needs changes before it can ${verb === 'save' ? 'be saved' : 'run'}.`, { compile: c });
    return c.spec;
  }

  async listStrategies(principal) { return principal?.id ? this.runs.listStrategies(principal.id) : []; }

  async getStrategy(principal, strategyId) {
    const s = principal?.id ? await this.runs.getStrategy(principal.id, strategyId) : null;
    if (!s) throw new WorkflowError(404, 'strategy_not_found', 'Strategy not found.');
    return { ...s, runs: await this.listRuns(principal, { strategyId }) };
  }

  summary(r) {
    return {
      id: r.id, template: r.template, status: r.status, created_at: r.created_at, updated_at: r.updated_at,
      title: r.template === 'strategy_lab.backtest.v1' ? r.input.spec?.name : `${this.catalog.capability(r.input.capability)?.name || r.input.capability} · ${r.input.network}`,
      verdict: r.result?.scorecard?.verdict ?? null,
      charge_usd: r.receipt?.customer_charge_usd ?? null,
    };
  }

  _kernelEvents(id) { return this.dk.journal.read(id); }

  view(r, { trace = false } = {}) {
    const kernel = this._kernelEvents(r.id);
    const { _request, principal: _p, ...pub } = r;
    const out = {
      ...pub,
      title: this.summary(r).title,
      graph: graph(r.template, r, kernel.map((e) => e.phase)),
      labels: r.template === 'strategy_lab.backtest.v1' ? { simulation: SIMULATION_LABEL } : {},
    };
    if (trace) {
      const runEvents = this.dk.journal.read(`run:${r.id}`);
      out.trace = [...runEvents, ...kernel]
        .sort((a, b) => a.seq - b.seq)
        .map((e) => ({ seq: e.seq, at: new Date(Number(e.ts)).toISOString(), stream: e.txId === r.id ? 'kernel' : 'run', phase: e.phase, hash: e.hash_current }));
    }
    return out;
  }
}
