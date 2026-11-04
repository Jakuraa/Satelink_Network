// Release A task service: the generic assistant-task lifecycle on #609's engine (one kernel, one journal,
// one run table — R1). Flow:
//
//   create   CREATED → UNDERSTANDING → PLANNING → (AWAITING_INPUT | REJECTED | QUOTED → AWAITING_APPROVAL)
//   approve  AWAITING_APPROVAL → AUTHORIZED (bound to quote id + version; expired → EXPIRED)
//   dispatch AUTHORIZED → RESERVED (simulated hold) → EXECUTING (kernel) → VERIFYING (supplier lookup)
//            → SUCCEEDED (capture, then receipt)  |  FAILED (release, failed receipt)
//            |  REQUIRES_RECONCILIATION (effect does not match the quote — nothing captured)
//   recover  at boot: AUTHORIZED/RESERVED re-dispatch; EXECUTING/UNKNOWN verify-then-decide; VERIFYING re-verify
//
// Capabilities and providers come ONLY from the registry (R9); connectors are looked up by the provider's
// `connector` field. Every money-like object carries simulated:true + simulation_label (R10).

import crypto from 'node:crypto';
import { TaskError, ERR } from './errors.js';
import { TaskStore, TASK_TEMPLATE } from './task_store.js';
import { TaskStepAdapter, TASK_STEP_WORKLOAD } from './task_step_adapter.js';
import { planTask } from './planner.js';
import { priceLines, formatUsd, FEE_STATUS } from './pricing.js';
import { SimLedger, ledgerHash, PROMO_DEMO_CREDIT_MINOR } from './sim_ledger.js';
import { WorkflowService } from './workflow_service.js';
import { idemKey } from '../vnext/kernel/idempotency.js';
import { IN_FLIGHT } from './task_state_machine.js';

export const SIMULATION_LABEL = 'SIMULATED — NO MONEY MOVED';
export const SIM = Object.freeze({ simulated: true, simulation_label: SIMULATION_LABEL });
const KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const h = (s, n = 24) => crypto.createHash('sha256').update(s).digest('hex').slice(0, n);
const DISCLOSURE = 'Preview: nothing is charged. Merchant amounts are shown as paid by you directly at the merchant\'s checkout (simulated). '
  + 'Satelink credits pay only Satelink\'s fee (simulated promotional credit). Fees are PROPOSED — NOT APPROVED. Taxes are not computed in the preview.';

const amountsOut = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v]));

export class TaskService {
  /**
   * @param {object} o — pool (pg), registry (CapabilityRegistry), router (createModelRouter()), pricing (loadPricing()),
   *   connectors ({ [connectorType]: connector }), clock, quoteTtlMs, workflowOptions (passed to WorkflowService.create)
   */
  static async create(o) {
    const svc = new TaskService(o);
    await svc._boot(o);
    return svc;
  }

  constructor({ pool, registry, router, pricing, connectors = {}, clock = () => Date.now(), quoteTtlMs = 10 * 60_000 }) {
    if (!pool) throw new Error('TaskService requires a Postgres pool (R2)');
    Object.assign(this, { pool, registry, router, pricing, connectors, clock, quoteTtlMs });
    this.store = new TaskStore(pool);
    this.sim = new SimLedger(pool);
    this.inflight = new Map(); // runId → promise (per-run serialization inside this process)
    this.providerConnector = new Map(); // providerId → connector type
  }

  async _boot({ workflowOptions = {} }) {
    await this.store.ensureDefinition();
    await this.sim.ensurePlatformAccounts();
    await this.registry.seed();
    for (const e of await this.registry.all()) for (const p of e.providers) if (p.connector && this.connectors[p.connector]) this.providerConnector.set(p.id, p.connector);
    // ONE kernel: the task-step adapter and providers register on #609's DurableKernel.
    this.wf = await WorkflowService.create({
      ...workflowOptions,
      extraAdapters: [new TaskStepAdapter({ connectorFor: (id) => this.connectors[this.providerConnector.get(id)] })],
      registerExtraSuppliers: (sr) => {
        for (const [providerId] of this.providerConnector) {
          sr.register({ supplierId: providerId, adapterId: this.providerConnector.get(providerId), capabilities: ['task_step'], supportedWorkloads: [TASK_STEP_WORKLOAD],
            supportedSettlementModes: ['POST'], supportedPaymentRails: ['none'], supportedChains: ['none'], basePrice: 0, currency: 'uUSD', reputation: 50 });
        }
      },
    });
    this.dk = this.wf.dk;
    this.lastRecovery = await this.recover();
  }

  isRoutable = (_entry, provider) => this.providerConnector.has(provider.id);

  // ───────────────────────── events (the run's stream in #609's hash-chained journal) ─────────────────────────
  async _event(runId, phase, payload) { await this.dk.journal.append(`task:${runId}`, phase, payload, this.clock()); }
  events(runId) { return this.dk.journal.read(`task:${runId}`).map((e) => ({ seq: e.seq, phase: e.phase, ...e.payload, at: new Date(e.ts).toISOString() })); }

  async _move(run, to, patch = {}, detail = null) {
    const next = await this.store.transition(run.id, run.state, to, run.version, patch, new Date(this.clock()));
    if (!next) return null; // lost the race; caller re-reads
    await this._event(run.id, 'STATE', { from: run.state, to, detail });
    return next;
  }

  async _own(principal, id) {
    const run = principal?.id && typeof id === 'string' ? await this.store.get(principal.id, id) : null;
    if (!run) throw new TaskError(ERR.NOT_FOUND, 'Task not found.', { status: 404 });
    return run;
  }

  // ───────────────────────────────────────────── create / plan / quote ────────────────────────────────────────
  async createTask(principal, { text, actor_type = 'human', idempotency_key, market = 'GLOBAL' } = {}) {
    if (!principal?.id) throw new TaskError('UNAUTHENTICATED', 'Sign in first.', { status: 401 });
    if (typeof text !== 'string' || text.trim().length < 2 || text.length > 2000) throw new TaskError(ERR.VALIDATION, 'Describe the task in 2–2000 characters.');
    if (typeof idempotency_key !== 'string' || !KEY.test(idempotency_key)) throw new TaskError(ERR.VALIDATION, 'idempotency_key must be 8–128 characters [A-Za-z0-9._:-].');
    if (!['human', 'developer', 'agent', 'machine'].includes(actor_type)) throw new TaskError(ERR.VALIDATION, 'actor_type must be human, developer, agent or machine.');
    const runId = `run_${h(`${principal.id}|${idempotency_key}`)}`;
    const { run, replayed } = await this.store.insert({ runId, principal: principal.id, idempotencyKey: idempotency_key, actorType: actor_type,
      intent: text.trim(), input: { text: text.trim(), market }, now: new Date(this.clock()) });
    if (replayed) return { task: await this.view(run), replayed: true };
    await this._event(run.id, 'STATE', { from: null, to: 'CREATED', detail: null });
    return { task: await this.view(await this._plan(run)), replayed: false };
  }

  async _plan(run, { priorPlan = null, priorInputs = {} } = {}) {
    let r = run;
    if (r.state === 'CREATED') r = await this._move(r, 'UNDERSTANDING', {}, { route: this.router.classify(r.intent) });
    if (r.state === 'UNDERSTANDING') r = await this._move(r, 'PLANNING');
    if (r.state === 'AWAITING_INPUT') r = await this._move(r, 'PLANNING');
    let out;
    try {
      out = await planTask({ text: r.intent, actorType: r.actor_type, market: r.input?.market || 'GLOBAL', registry: this.registry, router: this.router,
        isRoutable: this.isRoutable, priorPlan, priorInputs });
    } catch (e) {
      const code = e instanceof TaskError ? e.code : 'PLANNING_FAILED';
      return this._move(r, 'FAILED', { error: { code, message: e instanceof TaskError ? e.message : 'Planning failed.', retryable: Boolean(e?.retryable) } });
    }
    if (out.outcome === 'AWAITING_INPUT') {
      return this._move(r, 'AWAITING_INPUT', { plan: out.plan, blocked: { question: out.question, field: out.field, step_no: out.step_no, inputs: { ...priorInputs } } });
    }
    if (out.outcome === 'REJECTED') return this._move(r, 'REJECTED', { plan: out.model ? { steps: [], model: out.model } : null, error: { code: 'NOT_PLANNABLE', message: out.reason, retryable: false } });
    try { return await this._quote(r, out.plan); } catch (e) {
      // Supplier/catalogue unreachable while pricing: fail cleanly — never leave a task stuck in PLANNING.
      const cur = await this.store.getInternal(r.id);
      if (cur?.state !== 'PLANNING') throw e;
      return this._move(cur, 'FAILED', { error: { code: e instanceof TaskError ? e.code : 'QUOTE_FAILED', message: 'Could not get a price right now. Nothing was charged.', retryable: true } });
    }
  }

  async _quote(run, plan) {
    const lines = []; const offers = [];
    for (const s of plan.steps) {
      const entry = await this.registry.get(s.capability_id);
      const connector = this.connectors[this.providerConnector.get(s.provider_id)];
      const q = await connector.quoteStep({ inputs: s.inputs });
      if (!q) {
        return this._move(run, 'REJECTED', { plan, error: { code: 'NO_MATCHING_OFFER', message: `${s.provider_name} has nothing matching that within your price.`, retryable: false } });
      }
      offers.push(q.offer);
      lines.push({ capability_id: s.capability_id, description: `${entry.name}: ${q.description}`, fee_policy_id: entry.fee_policy_id, supplier_cost_minor: q.supplier_cost_minor });
    }
    const model = plan.model || {};
    const inference = await this.registry.getInternal('ai.model.inference');
    lines.push({ capability_id: 'ai.model.inference', description: `Model routing (${model.served_by || 'fixture'})`, fee_policy_id: inference.fee_policy_id, supplier_cost_minor: BigInt(model.cost_minor || 0) });
    const priced = priceLines(this.pricing, lines);
    const version = await this.store.nextQuoteVersion(run.id);
    const quoteId = `q_${h(`${run.id}|${version}`, 32)}`;
    const expiresAt = new Date(this.clock() + this.quoteTtlMs);
    await this.store.insertQuote({ quote_id: quoteId, run_id: run.id, version, ...priced, lines: priced.lines.map(amountsOut),
      fee_policy_status: FEE_STATUS, disclosure: DISCLOSURE, expires_at: expiresAt, origin: 'simulated', environment: 'preview' });
    const planned = { ...plan, steps: plan.steps.map((s, i) => ({ ...s, offer: offers[i] })) };
    const q = await this._move(run, 'QUOTED', { plan: planned, quote_id: quoteId, expires_at: expiresAt });
    return this._move(q, 'AWAITING_APPROVAL');
  }

  async provideInput(principal, id, { field, value } = {}) {
    const run = await this._own(principal, id);
    if (run.state !== 'AWAITING_INPUT') throw new TaskError(ERR.ILLEGAL_TRANSITION, `A ${run.state} task is not waiting for input.`, { status: 409 });
    if (field !== run.blocked?.field) throw new TaskError(ERR.VALIDATION, `This task is waiting for "${run.blocked?.field}".`);
    let v = value;
    if (/usd_minor$/.test(field) && typeof v === 'string') {
      const m = /^\$?\s*(\d{1,6})(?:\.(\d{1,2}))?$/.exec(v.trim());
      if (!m) throw new TaskError(ERR.VALIDATION, 'Enter an amount like 12 or 12.50.');
      v = Number(m[1]) * 1_000_000 + Number((m[2] || '').padEnd(2, '0').slice(0, 2)) * 10_000;
    }
    return { task: await this.view(await this._plan(run, { priorPlan: run.plan, priorInputs: { ...(run.blocked?.inputs || {}), [field]: v } })) };
  }

  // ─────────────────────────────────────────────────── approve ────────────────────────────────────────────────
  async approve(principal, id, { quote_id, quote_version, idempotency_key } = {}) {
    let run = await this._own(principal, id);
    if (run.state === 'EXPIRED') throw new TaskError(ERR.QUOTE_EXPIRED, 'The quote expired before approval. Ask for a new quote.', { status: 409, retryable: true });
    if (run.state !== 'AWAITING_APPROVAL') {
      // Double approve of the same quote is idempotent: report the current state, change nothing.
      if (run.approval?.quote_id && run.approval.quote_id === quote_id) return { task: await this.view(run), changed: false };
      throw new TaskError(ERR.ILLEGAL_TRANSITION, `A ${run.state} task cannot be approved.`, { status: 409 });
    }
    const quote = typeof quote_id === 'string' ? await this.store.getQuote(quote_id) : null;
    if (!quote || quote.run_id !== run.id || quote.quote_id !== run.quote_id || Number(quote_version) !== quote.version) {
      throw new TaskError(ERR.QUOTE_MISMATCH, 'Approve the current quote (id and version).', { status: 409 });
    }
    if (this.clock() > new Date(quote.expires_at).getTime()) {
      await this._move(run, 'EXPIRED', { error: { code: ERR.QUOTE_EXPIRED, message: 'The quote expired before approval. Ask for a new quote.', retryable: true } });
      throw new TaskError(ERR.QUOTE_EXPIRED, 'The quote expired before approval. Ask for a new quote.', { status: 409, retryable: true });
    }
    const next = await this._move(run, 'AUTHORIZED', { approval: {
      approved_at: new Date(this.clock()).toISOString(), approved_by: principal.id, quote_id: quote.quote_id, quote_version: quote.version,
      idempotency_key: typeof idempotency_key === 'string' ? idempotency_key.slice(0, 128) : null } });
    if (!next) { run = await this._own(principal, id); return { task: await this.view(run), changed: false }; } // a concurrent approve won
    this.dispatch(next.id);
    return { task: await this.view(next), changed: true };
  }

  async cancel(principal, id) {
    const run = await this._own(principal, id);
    if (!['CREATED', 'UNDERSTANDING', 'PLANNING', 'AWAITING_INPUT', 'QUOTED', 'AWAITING_APPROVAL', 'AUTHORIZED', 'RESERVED'].includes(run.state)) {
      throw new TaskError(ERR.ILLEGAL_TRANSITION, `A ${run.state} task can no longer be cancelled.`, { status: 409 });
    }
    const next = await this._move(run, 'CANCELLED', { error: { code: 'CANCELLED', message: 'Cancelled by you. Nothing was charged.', retryable: false } });
    if (!next) throw new TaskError(ERR.VERSION_CONFLICT, 'The task changed; reload and try again.', { status: 409, retryable: true });
    await this._releaseIfHeld(next.id, 'released');
    return { task: await this.view(next) };
  }

  // ─────────────────────────────────────────── dispatch (execution) ───────────────────────────────────────────
  /** Serialize per run; returns a promise (tests await it via drain()). */
  dispatch(runId) {
    const prev = this.inflight.get(runId) || Promise.resolve();
    const p = prev.then(() => this._drive(runId)).catch((e) => { console.error('[tasks] drive failed', runId, e?.code || e?.message); });
    this.inflight.set(runId, p);
    p.finally(() => { if (this.inflight.get(runId) === p) this.inflight.delete(runId); });
    return p;
  }

  async drain() { while (this.inflight.size) await Promise.all([...this.inflight.values()]); }

  _rsvId(runId) { return `rsv_${runId.slice(4)}`; }
  _stepTx(runId, n) { return `step_${runId.slice(4)}_${n}`; }

  async _drive(runId) {
    let run = await this.store.getInternal(runId);
    for (let guard = 0; run && guard < 12; guard++) {
      const before = run.state;
      if (run.state === 'AUTHORIZED') run = await this._reserve(run);
      else if (run.state === 'RESERVED') run = await this._move(run, 'EXECUTING');
      else if (run.state === 'EXECUTING') run = await this._execute(run);
      else if (run.state === 'UNKNOWN_EXECUTION_OUTCOME' || run.state === 'VERIFYING') run = await this._verify(run);
      else return run;
      if (!run) run = await this.store.getInternal(runId); // lost a race: re-read and continue from the truth
      if (run?.state === before) return run;
    }
    return run;
  }

  async _reserve(run) {
    const quote = await this.store.getQuote(run.approval.quote_id);
    const amount = BigInt(quote.credit_charge_minor);
    const accounts = await this.sim.ensureCustomer(run.principal, run.actor_type || 'human');
    await this.sim.grantDemoCredit(accounts); // idempotent; the preview's $1 promotional credit
    try {
      await this.sim.reserve({ reservationId: this._rsvId(run.id), runId: run.id, quoteId: quote.quote_id, accounts, amount, idempotencyKey: `${run.id}:reserve` });
    } catch (e) {
      if (e?.code === ERR.INSUFFICIENT_CREDIT) return this._move(run, 'FAILED', { error: { code: e.code, message: 'Not enough simulated credit for this task. Nothing was charged.', retryable: false } });
      throw e;
    }
    return this._move(run, 'RESERVED', {}, { reservation_id: this._rsvId(run.id), amount_minor: amount.toString() });
  }

  _request(run, step) {
    return { workload: TASK_STEP_WORKLOAD, query: { chain: 'none', supplierId: step.provider_id }, payer: run.principal,
      payload: { run_id: run.id, step_no: step.step_no, capability_id: step.capability_id, inputs: step.inputs, offer: step.offer } };
  }

  async _execute(run) {
    const step = run.plan.steps[0];
    const txId = this._stepTx(run.id, step.step_no);
    await this.store.upsertStep(run.id, { ...this._stepRow(step, txId), status: 'running', attempts: 1 });
    let tx;
    try { tx = await this.dk.submit(this._request(run, step), { txId }); } catch (e) {
      // The kernel itself failed: we cannot know whether the supplier acted → verify before anything else.
      return this._move(run, 'UNKNOWN_EXECUTION_OUTCOME', { error: { code: 'UNKNOWN_EXECUTION_OUTCOME', message: 'Checking with the supplier…', retryable: true } });
    }
    if (tx.state === 'CLOSED') return this._move(run, 'VERIFYING', { result: { steps: [{ step_no: step.step_no, data: tx.result?.data ?? null }] } });
    const code = /\[supplier_failed\]/.test(String(tx.reason)) ? 'SUPPLIER_FAILED' : 'EXECUTION_FAILED';
    await this.store.upsertStep(run.id, { ...this._stepRow(step, txId), status: 'failed', attempts: 1, last_error_code: code });
    return this._fail(run, code, code === 'SUPPLIER_FAILED' ? 'The supplier could not complete the order. Nothing was charged.' : 'The task could not be completed. Nothing was charged.');
  }

  _stepRow(step, txId) {
    return { step_no: step.step_no, capability_id: step.capability_id, provider_id: step.provider_id, idempotency_key: txId };
  }

  async _verify(run) {
    const step = run.plan.steps[0];
    const txId = this._stepTx(run.id, step.step_no);
    const connector = this.connectors[this.providerConnector.get(step.provider_id)];
    let v;
    try { v = await connector.verifyStep({ idempotencyKey: idemKey(txId, 'EXECUTE'), offer: step.offer }); } catch (e) {
      return run; // supplier unreachable: stay put; recovery/sweep retries verification (never guesses)
    }
    if (run.state === 'UNKNOWN_EXECUTION_OUTCOME') {
      if (v.found) return this._move(run, 'VERIFYING', {}, { recovered: 'order_found_at_supplier' });
      // No order at the supplier. Only if the kernel never recorded EXECUTE is it safe to say nothing happened.
      const executed = this.dk.journal.read(txId).some((e) => e.phase === 'EXECUTE');
      if (executed) return this._move(run, 'REQUIRES_RECONCILIATION', { error: { code: 'REQUIRES_RECONCILIATION', message: 'The supplier result could not be matched. Nothing was captured; an operator will reconcile.', retryable: false } });
      return this._fail(run, 'EXECUTION_FAILED', 'The task could not be completed. Nothing was charged.');
    }
    if (!v.verified) {
      if (v.found) return this._move(run, 'REQUIRES_RECONCILIATION', { error: { code: 'VERIFICATION_MISMATCH', message: 'The supplier order does not match the quote. Nothing was captured; an operator will reconcile.', retryable: false } });
      return this._fail(run, 'VERIFICATION_FAILED', 'The supplier has no record of the order. Nothing was charged.');
    }
    await this.store.upsertStep(run.id, { ...this._stepRow(step, txId), status: 'verified', attempts: 1, result: v.evidence, verified_at: new Date(this.clock()) });
    return this._succeed(run, step, v.evidence);
  }

  async _succeed(run, step, evidence) {
    const quote = await this.store.getQuote(run.approval.quote_id);
    const credit = BigInt(quote.credit_charge_minor);
    if (credit > 0n) await this.sim.settle(this._rsvId(run.id), 'captured', credit); // capture only after verification
    const txns = credit > 0n ? await this.sim.transactionsFor(this._rsvId(run.id)) : [];
    const receiptId = `rcpt_${run.id.slice(4)}`;
    const issuedAt = new Date(this.clock()).toISOString();
    const body = {
      receipt_id: receiptId, run_id: run.id, ...SIM, outcome: 'succeeded', intent: run.intent,
      plan: run.plan.steps.map((s) => ({ step_no: s.step_no, capability_id: s.capability_id, provider: s.provider_name })),
      served_by: run.plan.model?.served_by || null, model_fixture: Boolean(run.plan.model?.fixture),
      quote: this._quoteOut(quote),
      charges: { currency: 'USD', credits_charged_minor: credit.toString(), credits_charged_usd: formatUsd(credit),
        merchant_paid_by_user_minor: quote.supplier_cost_minor.toString(), merchant_paid_by_user_usd: formatUsd(BigInt(quote.supplier_cost_minor)),
        merchant_payment: 'paid by you directly at the merchant\'s checkout (simulated)' },
      verification: { method: 'order_status_lookup', verified: true, evidence: { order_id: evidence.order_id, status: evidence.status, sku: evidence.sku, price_usd_minor: evidence.price_usd_minor } },
      ledger: { transactions: txns.map((t) => ({ txn_id: t.txnId, kind: t.kind })), ledger_hash: ledgerHash(txns) },
      origin: 'simulated', environment: 'preview', issued_at: issuedAt,
    };
    await this.store.insertReceipt({ receipt_id: receiptId, run_id: run.id, principal: run.principal, body, issued_at: issuedAt });
    return this._move(run, 'SUCCEEDED', { receipt_id: receiptId }, { receipt_id: receiptId });
  }

  async _fail(run, code, message) {
    await this._releaseIfHeld(run.id, 'released');
    const quote = run.approval?.quote_id ? await this.store.getQuote(run.approval.quote_id) : null;
    const txns = await this.sim.transactionsFor(this._rsvId(run.id));
    const receiptId = `rcpt_${run.id.slice(4)}`;
    const issuedAt = new Date(this.clock()).toISOString();
    const body = {
      receipt_id: receiptId, run_id: run.id, ...SIM, outcome: 'failed', outcome_label: 'failed — no charge', intent: run.intent, error_code: code,
      quote: quote ? this._quoteOut(quote) : null,
      charges: { currency: 'USD', credits_charged_minor: '0', credits_charged_usd: formatUsd(0n), merchant_paid_by_user_minor: '0', merchant_payment: 'none' },
      ledger: { transactions: txns.map((t) => ({ txn_id: t.txnId, kind: t.kind })), ledger_hash: ledgerHash(txns) },
      origin: 'simulated', environment: 'preview', issued_at: issuedAt,
    };
    await this.store.insertReceipt({ receipt_id: receiptId, run_id: run.id, principal: run.principal, body, issued_at: issuedAt });
    return this._move(run, 'FAILED', { receipt_id: receiptId, error: { code, message, retryable: false } });
  }

  async _releaseIfHeld(runId, outcome) {
    const { rows } = await this.pool.query(`SELECT state FROM workflow_reservations WHERE run_id = $1`, [runId]);
    if (rows[0]?.state === 'held') await this.sim.settle(this._rsvId(runId), outcome);
  }

  // ───────────────────────────────────────── recovery + sweep (ADR-6) ─────────────────────────────────────────
  async recover() {
    const runs = await this.store.listByStates(['AUTHORIZED', ...IN_FLIGHT]);
    for (const r of runs) {
      if (r.state === 'EXECUTING') {
        // Crashed mid-execution: never blindly re-execute. Mark unknown, then verify-then-decide.
        const u = await this._move(r, 'UNKNOWN_EXECUTION_OUTCOME', {}, { recovered: 'boot' });
        if (u) await this._resolveUnknown(u);
      } else if (r.state === 'UNKNOWN_EXECUTION_OUTCOME') await this._resolveUnknown(r);
      else await this.dispatch(r.id);
    }
    return { recovered: runs.map((r) => r.id) };
  }

  /** Unknown outcome: found at supplier → verify; kernel never executed → resubmit (same key); else reconcile. */
  async _resolveUnknown(run) {
    const step = run.plan.steps[0];
    const txId = this._stepTx(run.id, step.step_no);
    const connector = this.connectors[this.providerConnector.get(step.provider_id)];
    let v; try { v = await connector.verifyStep({ idempotencyKey: idemKey(txId, 'EXECUTE'), offer: step.offer }); } catch { return run; }
    if (!v.found && !this.dk.journal.read(txId).some((e) => e.phase === 'EXECUTE')) {
      // The supplier has no order AND the kernel never ran EXECUTE: safe to execute now (idempotent key).
      const back = await this._move(run, 'VERIFYING', {}, { recovered: 'resubmit' });
      if (!back) return run;
      return this.dispatchVerifiedResubmit(back);
    }
    return this.dispatch(run.id);
  }

  // VERIFYING has no edge back to EXECUTING by design; a never-executed step is executed inside verification
  // through the same kernel transaction (same txId → same idempotency key) before the supplier lookup.
  async dispatchVerifiedResubmit(run) {
    const step = run.plan.steps[0];
    try { await this.dk.submit(this._request(run, step), { txId: this._stepTx(run.id, step.step_no) }); } catch { /* verification decides */ }
    return this.dispatch(run.id);
  }

  /** Expire stale quotes and unanswered questions. Safe to run repeatedly. */
  async sweep({ inputTtlMs = 24 * 3_600_000 } = {}) {
    const now = this.clock(); const out = [];
    for (const r of await this.store.listByStates(['QUOTED', 'AWAITING_APPROVAL', 'AWAITING_INPUT'])) {
      const stale = r.state === 'AWAITING_INPUT' ? now - new Date(r.updated_at).getTime() > inputTtlMs : r.expires_at && now > new Date(r.expires_at).getTime();
      if (stale && await this._move(r, 'EXPIRED', { error: { code: ERR.QUOTE_EXPIRED, message: 'This quote expired. Ask for a new quote.', retryable: true } })) out.push(r.id);
    }
    return { expired: out };
  }

  /** Ledger ↔ steps ↔ receipts. A mismatch moves the task to REQUIRES_RECONCILIATION. */
  async reconcile() {
    const problems = [];
    for (const r of await this.store.listByStates(['SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'])) {
      const { rows: [rsv] } = await this.pool.query('SELECT state FROM workflow_reservations WHERE run_id = $1', [r.id]);
      const receipt = r.receipt_id ? await this.store.getReceipt(r.principal, r.receipt_id).catch(() => 'TAMPERED') : null;
      let issue = null;
      if (r.state === 'SUCCEEDED') {
        if (!receipt || receipt === 'TAMPERED') issue = 'receipt_missing_or_tampered';
        else if (rsv && rsv.state !== 'captured') issue = 'success_without_capture';
        else if (receipt.ledger.ledger_hash !== ledgerHash(await this.sim.transactionsFor(this._rsvId(r.id)))) issue = 'receipt_ledger_hash_mismatch';
      } else if (rsv && rsv.state === 'held') issue = 'terminal_task_with_held_reservation';
      else if (rsv && rsv.state === 'captured') issue = 'capture_without_success';
      if (issue) {
        problems.push({ run_id: r.id, issue });
        if (['SUCCEEDED', 'FAILED'].includes(r.state)) await this._move(r, 'REQUIRES_RECONCILIATION', { error: { code: 'REQUIRES_RECONCILIATION', message: issue, retryable: false } });
      }
    }
    return { checked: true, problems };
  }

  // ─────────────────────────────────────────────── read models ───────────────────────────────────────────────
  _quoteOut(q) {
    return {
      quote_id: q.quote_id, version: q.version, currency: q.currency, ...SIM,
      lines: q.lines.map((l) => ({ ...l, supplier_cost_usd: formatUsd(BigInt(l.supplier_cost_minor)), satelink_fee_usd: formatUsd(BigInt(l.satelink_fee_minor)), tax_usd: formatUsd(BigInt(l.tax_minor)) })),
      supplier_cost_minor: String(q.supplier_cost_minor), satelink_fee_minor: String(q.satelink_fee_minor), tax_minor: String(q.tax_minor),
      total_minor: String(q.total_minor), credit_charge_minor: String(q.credit_charge_minor),
      total_usd: formatUsd(BigInt(q.total_minor)), credit_charge_usd: formatUsd(BigInt(q.credit_charge_minor)),
      merchant_paid_by_user_usd: formatUsd(BigInt(q.supplier_cost_minor)),
      fee_policy_status: q.fee_policy_status, disclosure: q.disclosure, expires_at: new Date(q.expires_at).toISOString(),
    };
  }

  async view(run) {
    const quote = run.quote_id ? await this.store.getQuote(run.quote_id) : null;
    const { rows: [rsv] } = await this.pool.query('SELECT reservation_id, state, amount_minor, captured_minor FROM workflow_reservations WHERE run_id = $1', [run.id]);
    return {
      id: run.id, state: run.state, version: run.version, intent: run.intent, actor_type: run.actor_type, ...SIM,
      environment: run.environment, created_at: run.created_at, updated_at: run.updated_at,
      question: run.state === 'AWAITING_INPUT' ? { text: run.blocked?.question, field: run.blocked?.field } : null,
      plan: run.plan ? { steps: (run.plan.steps || []).map(({ offer, ...s }) => ({ ...s, offer: offer ? { title: offer.title, sku: offer.sku, price_usd: formatUsd(BigInt(offer.price_usd_minor)) } : null })), model: run.plan.model || null } : null,
      model_badge: this.router.badge,
      quote: quote ? this._quoteOut(quote) : null,
      reservation: rsv ? { ...SIM, reservation_id: rsv.reservation_id, state: rsv.state, amount_usd: formatUsd(BigInt(rsv.amount_minor)), captured_usd: rsv.captured_minor == null ? null : formatUsd(BigInt(rsv.captured_minor)) } : null,
      receipt_id: run.receipt_id, error: run.error || null,
    };
  }

  async getTask(principal, id) { return this.view(await this._own(principal, id)); }
  async listTasks(principal, opts) { return Promise.all((await this.store.list(principal.id, opts)).map((r) => this.view(r))); }
  async getReceipt(principal, receiptId) {
    const r = principal?.id && /^rcpt_[0-9a-f]{8,64}$/.test(String(receiptId)) ? await this.store.getReceipt(principal.id, receiptId) : null;
    if (!r) throw new TaskError(ERR.NOT_FOUND, 'Receipt not found.', { status: 404 });
    return r;
  }

  async usage(principal) {
    const tasks = await this.store.list(principal.id, { limit: 200 });
    const receipts = await this.store.receiptsFor(principal.id);
    const byCap = {}; let credits = 0n; let fees = 0n;
    for (const r of receipts) {
      if (r.body.outcome !== 'succeeded') continue;
      const c = BigInt(r.body.charges.credits_charged_minor); credits += c;
      fees += BigInt(r.body.quote?.satelink_fee_minor || 0);
      for (const s of r.body.plan || []) byCap[s.capability_id] = ((byCap[s.capability_id] ? BigInt(byCap[s.capability_id]) : 0n) + c).toString();
    }
    const accounts = await this.sim.ensureCustomer(principal.id, 'human');
    const { rows } = await this.pool.query('SELECT COALESCE(SUM(revenue_minor), 0)::text AS r FROM revenue_truth');
    return {
      ...SIM, currency: 'USD',
      tasks: { total: tasks.length, by_state: tasks.reduce((m, t) => ({ ...m, [t.state]: (m[t.state] || 0) + 1 }), {}) },
      simulated_spend_usd: formatUsd(credits), satelink_fees_usd: formatUsd(fees),
      simulated_spend_by_capability_usd: Object.fromEntries(Object.entries(byCap).map(([k, v]) => [k, formatUsd(BigInt(v))])),
      promo_credit: { granted_usd: formatUsd(PROMO_DEMO_CREDIT_MINOR), available_usd: formatUsd(await this.sim.available(accounts.customer)), origin: 'promotional' },
      receipts: receipts.map((r) => ({ ...SIM, receipt_id: r.receipt_id, run_id: r.run_id, outcome: r.body.outcome, credits_charged_usd: r.body.charges.credits_charged_usd, issued_at: r.issued_at })),
      external_revenue_usd: formatUsd(BigInt(rows[0].r)), external_revenue_note: 'External revenue: $0.00 (preview) — simulated and promotional activity is never revenue.',
    };
  }

  /** Ensure the customer's accounts and the one-time promotional credit (called at onboarding). */
  async onboard(principal, { actor_type = 'human' } = {}) {
    const accounts = await this.sim.ensureCustomer(principal.id, actor_type);
    const granted = await this.sim.grantDemoCredit(accounts);
    return { ...SIM, promo_credit_granted: granted, available_usd: formatUsd(await this.sim.available(accounts.customer)) };
  }

  static get TEMPLATE() { return TASK_TEMPLATE; }
}
