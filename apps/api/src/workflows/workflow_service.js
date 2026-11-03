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
import { compileStrategy, validateSpec } from './strategy_compiler.js';
import { parseReason, createJsonRpcBalanceConnector, createX402HttpConnector } from './connectors.js';
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
   *  - clock
   */
  static async create(o = {}) {
    const svc = new WorkflowService(o);
    await svc._boot(o);
    return svc;
  }

  constructor({ catalog, clock } = {}) {
    this.catalog = catalog || SupplierCatalog.fromFile();
    this.clock = clock || (() => Date.now());
    this.runs = new Map();
    this.inflight = new Map();
  }

  async _boot({ store, connectors, candleSource, env = process.env, fetchImpl } = {}) {
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
    registry.register(new StrategyEvaluationAdapter({ catalog: this.catalog, candleSource: candleSource || createCandleSource({ clock: this.clock }), clock: this.clock }));
    for (const c of this.catalog.capabilities.values()) {
      if (c.id === 'market_data.candles') continue;
      registry.register(new CapabilityProcurementAdapter({ catalog: this.catalog, connectors: this.connectors, capability: c.id }));
    }
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
    this._rehydrate();
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

  _rehydrate() {
    for (const e of this.dk.journal.all()) {
      if (!String(e.txId).startsWith('run:')) continue;
      const id = e.txId.slice(4);
      if (e.phase === 'RUN_CREATED') this.runs.set(id, structuredClone(e.payload));
      else if (e.phase === 'RUN_UPDATED' && this.runs.has(id)) Object.assign(this.runs.get(id), structuredClone(e.payload));
    }
  }

  async _update(run, patch) {
    Object.assign(run, patch, { updated_at: new Date(this.clock()).toISOString() });
    await this._event(run.id, 'RUN_UPDATED', { ...patch, updated_at: run.updated_at });
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
    const existing = this.runs.get(id);
    if (existing) {
      if (existing.template !== template) throw new WorkflowError(409, 'idempotency_conflict', 'idempotency_key was already used for a different workflow.');
      return { run: this.view(existing), replayed: true };
    }

    let request; let quote; let planInput;
    if (template === 'strategy_lab.backtest.v1') {
      const spec = input.spec || (input.prompt ? (() => {
        const c = compileStrategy(input.prompt, input.answers || {});
        if (c.status !== 'compiled') throw new WorkflowError(422, c.status, 'Strategy request needs changes before it can run.', { compile: c });
        return c.spec;
      })() : null);
      const problems = validateSpec(spec);
      if (problems.length) throw new WorkflowError(422, 'invalid_spec', problems.join('; '));
      const network = `${spec.market.instrument_id}@${spec.timeframe}`;
      quote = this.quote({ capability: 'market_data.candles', network });
      request = { workload: WORKLOADS.STRATEGY, query: { chain: network }, payload: { spec }, payer: principal.id };
      planInput = { spec };
    } else {
      const { capability, network, address } = input;
      if (!this.catalog.capability(capability)) throw new WorkflowError(422, 'unknown_capability', `Unknown capability '${capability}'.`);
      if (typeof network !== 'string' || !network) throw new WorkflowError(422, 'network_required', 'network is required.');
      if (!ADDRESS.test(address || '')) throw new WorkflowError(422, 'invalid_address', 'address must be a public 0x address (40 hex characters).');
      quote = this.quote({ capability, network });
      request = { workload: procurementWorkload(capability), query: { chain: network }, payload: { capability, network, address }, payer: principal.id };
      planInput = { capability, network, address };
    }

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
      result: null, receipt: null, error: null,
      _request: request,
    };
    this.runs.set(id, run);
    await this._event(id, 'RUN_CREATED', run);
    if (status === 'running') await this._execute(run);
    return { run: this.view(run), replayed: false };
  }

  _own(principal, id) {
    const run = this.runs.get(id);
    if (!run || run.principal !== principal?.id) throw new WorkflowError(404, 'run_not_found', 'Run not found.');
    return run;
  }

  async approve(principal, id) {
    const run = this._own(principal, id);
    if (run.status !== 'awaiting_approval') return { run: this.view(run), changed: false };
    if (this.inflight.has(id)) { await this.inflight.get(id); return { run: this.view(run), changed: false }; }
    const p = (async () => {
      await this._update(run, { status: 'running', approval: { ...run.approval, approved_at: new Date(this.clock()).toISOString(), approved_by: principal.id } });
      await this._execute(run);
    })();
    this.inflight.set(id, p);
    try { await p; } finally { this.inflight.delete(id); }
    return { run: this.view(run), changed: true };
  }

  async cancel(principal, id) {
    const run = this._own(principal, id);
    if (run.status !== 'awaiting_approval') throw new WorkflowError(409, 'not_cancellable', `A ${run.status} run cannot be cancelled.`);
    await this._update(run, { status: 'cancelled', budget_hold: { ...run.budget_hold, status: 'released' } });
    return { run: this.view(run) };
  }

  async _execute(run) {
    const tx = await this.dk.submit(run._request, { txId: run.id });
    if (tx.state === 'CLOSED') {
      const offer = this.catalog.offer(tx.supplier.supplierId);
      const p = this.catalog.price(offer);
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
        issued_at: new Date(this.clock()).toISOString(),
      };
      await this._update(run, {
        status: 'completed',
        result: tx.result,
        receipt,
        decision: tx.decision ? { chosen: tx.decision.chosen?.supplierId ?? null, policy: tx.decision.policy?.name ?? null } : null,
        budget_hold: { ...run.budget_hold, status: 'captured', captured_usd: receipt.customer_charge_usd },
      });
    } else {
      const { code, detail } = parseReason(tx.reason);
      await this._update(run, {
        status: 'failed',
        error: { code, detail },
        budget_hold: { ...run.budget_hold, status: 'released' },
        receipt: { run_id: run.id, customer_charge_usd: '0', supplier_payment: 'none', note: 'Failed calls are never charged.' },
      });
    }
  }

  listRuns(principal, { limit = 50 } = {}) {
    return [...this.runs.values()]
      .filter((r) => r.principal === principal?.id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit)
      .map((r) => this.summary(r));
  }

  getRun(principal, id) { return this.view(this._own(principal, id), { trace: true }); }

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
    const { _request, ...pub } = r;
    const out = {
      ...pub,
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
