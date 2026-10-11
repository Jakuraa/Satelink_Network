// Proposal review queue (Phase 6 item 13). Agents, machines and the assistant PROPOSE; a human
// DECIDES. Approval (step-up verified by the API) turns an order proposal into a human-approved order
// intent that goes through OMS acceptance → mandate → the full risk engine (nothing bypasses it). A
// refusal there closes the proposal as rejected with the reason; nothing is retried silently.
import { ApiError } from '../api/errors.mjs';

const KIND = Object.freeze({ order_intent: 'order', order: 'order', cancel_intent: 'cancel', cancel: 'cancel', strategy: 'strategy', alert: 'alert', note: 'note' });
const PRP = /^prp_[A-Za-z0-9_-]{3,64}$/;
const notFound = () => new ApiError(404, 'NOT_FOUND', 'proposal not found');

export class ProposalService {
  #store; #ids; #clock; #ttlMs; #deps;
  /**
   * @param deps.ownerOf        async principalId → the human owner (agent/machine → parent; human → itself)
   * @param deps.orderContext   async (mandateId, principalId) → { brokerAccountId, venue, mode } from the mandate
   * @param deps.acceptance     OMS OrderAcceptanceService (Stage 17)
   * @param deps.strategies     StrategyService (Stage 13) — approved strategy proposals become DRAFT versions
   * @param deps.cancel         async (principal, orderId) → cancel request (Stage 17 ports)
   */
  constructor({ store, idFactory, clock = () => new Date(), ttlMs = 24 * 3_600_000, ownerOf = async (p) => p, orderContext, acceptance, strategies = null, cancel = null }) {
    if (!store || typeof idFactory !== 'function' || typeof orderContext !== 'function' || !acceptance?.accept) throw new Error('ProposalService needs store, idFactory, orderContext and acceptance');
    this.#store = store; this.#ids = idFactory; this.#clock = clock; this.#ttlMs = ttlMs;
    this.#deps = { ownerOf, orderContext, acceptance, strategies, cancel };
  }

  /** The proposal sink (Stage 12 tools, MCP, machine interface, assistant). */
  async create(raw) {
    const kind = KIND[raw?.kind] ?? (raw?.instrument && raw?.side ? 'order' : null);
    if (!kind) throw new ApiError(400, 'INVALID', `unknown proposal kind ${raw?.kind}`);
    const actor = raw.proposedBy ?? raw.principalId;
    const owner = await this.#deps.ownerOf(raw.principalId);
    if (!owner) throw new ApiError(404, 'NOT_FOUND', 'no owner for this principal');
    const src = raw.payload ?? raw;
    let payload;
    if (kind === 'order') {
      if (!src.mandateId && !raw.mandateId) throw new ApiError(400, 'INVALID', 'order proposals are bound to a mandate');
      if (!['buy', 'sell'].includes(src.side) || typeof src.quantity !== 'string' || typeof src.instrument !== 'string') throw new ApiError(400, 'INVALID', 'instrument, side and quantity required');
      payload = { instrument: src.instrument, side: src.side, type: src.type ?? (src.limitPrice ? 'limit' : 'market'), quantity: src.quantity, limitPrice: src.limitPrice ?? null, timeInForce: src.timeInForce ?? 'gtc' };
    } else payload = { ...src };
    const now = this.#clock();
    const p = {
      id: this.#ids('prp'), principalId: owner, proposedBy: String(actor ?? raw.runId ?? 'unknown').slice(0, 80),
      proposedByKind: raw.proposedByKind ?? (raw.runId ? 'agent' : actor === owner ? 'human' : 'agent'), kind,
      mandateId: src.mandateId ?? raw.mandateId ?? null, decisionId: raw.decisionId ?? null, executionPath: raw.executionPath ?? 'human_review',
      payload, rationale: String(src.rationale ?? raw.rationale ?? '').slice(0, 2000) || null,
      status: 'pending_review', resultRef: null, decidedAt: null,
      createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + this.#ttlMs).toISOString(),
    };
    await this.#store.insert(p);
    await this.#store.appendEvent({ proposalId: p.id, action: 'created', actorId: p.proposedBy, at: p.createdAt });
    return Object.freeze({ proposalId: p.id, status: 'pending_review' });
  }

  async list(principal, query = {}) {
    const status = ['pending_review', 'approved', 'rejected', 'expired'].includes(query.status) ? query.status : null;
    const rows = await this.#store.list({ principalId: principal.principalId, status, limit: Number(query.limit) || 50 });
    const now = this.#clock().toISOString();
    return rows.map((r) => ({ ...r, expired: r.status === 'pending_review' && r.expiresAt <= now }));
  }

  async #own(principal, id) {
    if (!PRP.test(String(id))) throw notFound();
    const p = await this.#store.get(id);
    if (!p || p.principalId !== principal.principalId) throw notFound();
    if (p.status !== 'pending_review') throw new ApiError(409, 'CONFLICT', `proposal is ${p.status}`);
    if (p.expiresAt <= this.#clock().toISOString()) {
      await this.#close(p, 'expired', 'expired', principal.principalId, null, null, { reason: 'expired' });
      throw new ApiError(409, 'EXPIRED', 'proposal expired');
    }
    return p;
  }

  async #close(p, status, action, actorId, stepUpMethod, resultRef, detail) {
    const at = this.#clock().toISOString();
    if (!(await this.#store.decide(p.id, { status, decidedAt: at, resultRef }))) throw new ApiError(409, 'CONFLICT', 'proposal was decided concurrently');
    await this.#store.appendEvent({ proposalId: p.id, action, actorId, stepUpMethod, detail, at });
  }

  /** Human approval (step-up already verified by the router). */
  async approve(principal, id, _body, idempotencyKey, stepUpMethod) {
    if (principal?.kind !== 'human') throw new ApiError(403, 'HUMAN_REQUIRED', 'only a human can approve');
    if (!stepUpMethod) throw new ApiError(401, 'STEP_UP_REQUIRED', 'approval needs step-up');
    const p = await this.#own(principal, id);
    if (p.kind === 'order') {
      const ctx = await this.#deps.orderContext(p.mandateId, principal.principalId);
      const intent = {
        idempotencyKey: `prp_${p.id}`.slice(0, 128), principalId: principal.principalId, approvedBy: principal.principalId,
        origin: ['agent', 'machine'].includes(p.proposedByKind) ? 'agent_proposal' : 'llm_proposal',
        ...(p.proposedByKind === 'agent' || p.proposedByKind === 'machine' ? { proposedBy: /^prn_/.test(p.proposedBy) ? p.proposedBy : undefined } : {}),
        ...(p.decisionId ? { decisionId: p.decisionId } : {}),
        brokerAccountId: ctx.brokerAccountId, mandateId: p.mandateId, mode: ctx.mode, venue: ctx.venue,
        instrument: p.payload.instrument, side: p.payload.side, type: p.payload.type, timeInForce: p.payload.timeInForce, quantity: p.payload.quantity,
        ...(p.payload.limitPrice ? { limitPrice: p.payload.limitPrice } : {}),
      };
      for (const k of Object.keys(intent)) if (intent[k] === undefined) delete intent[k];
      const out = await this.#deps.acceptance.accept(intent);
      if (out?.accepted === false) {
        await this.#close(p, 'rejected', 'execution_refused', principal.principalId, null, null, { reason: out.reason, detail: String(out.detail ?? '').slice(0, 300), approvedBy: principal.principalId, stepUpMethod });
        throw new ApiError(422, 'REFUSED', `${out.reason}: ${out.detail ?? ''}`.trim());
      }
      await this.#close(p, 'approved', 'approved', principal.principalId, stepUpMethod, out.orderId, { orderId: out.orderId, idempotencyKey });
      return Object.freeze({ proposalId: p.id, status: 'approved', orderId: out.orderId, orderStatus: out.status });
    }
    if (p.kind === 'strategy') {
      if (!this.#deps.strategies) throw new ApiError(501, 'NOT_IMPLEMENTED', 'strategy proposals are not available yet');
      const actor = { principalId: principal.principalId, kind: 'human' };
      const strategyId = p.payload.strategyId ?? (await this.#deps.strategies.createStrategy({ actor, name: String(p.payload.dsl?.name ?? 'Proposed strategy').slice(0, 80) })).id;
      const v = await this.#deps.strategies.createVersion({ actor, strategyId, dsl: p.payload.dsl });
      await this.#close(p, 'approved', 'approved', principal.principalId, stepUpMethod, v.id, { strategyVersionId: v.id, state: 'DRAFT' });
      return Object.freeze({ proposalId: p.id, status: 'approved', strategyVersionId: v.id, state: 'DRAFT' });
    }
    if (p.kind === 'cancel') {
      if (!this.#deps.cancel) throw new ApiError(501, 'NOT_IMPLEMENTED', 'cancel proposals are not available yet');
      const r = await this.#deps.cancel(principal, p.payload.orderId);
      await this.#close(p, 'approved', 'approved', principal.principalId, stepUpMethod, p.payload.orderId, { cancel: r?.status ?? 'requested' });
      return Object.freeze({ proposalId: p.id, status: 'approved', orderId: p.payload.orderId });
    }
    await this.#close(p, 'approved', 'approved', principal.principalId, stepUpMethod, null, { acknowledged: p.kind });
    return Object.freeze({ proposalId: p.id, status: 'approved' });
  }

  async reject(principal, id, body = {}) {
    if (principal?.kind !== 'human') throw new ApiError(403, 'HUMAN_REQUIRED', 'only a human can reject');
    const p = await this.#own(principal, id);
    await this.#close(p, 'rejected', 'rejected', principal.principalId, null, null, { reason: String(body.reason ?? '').slice(0, 300) || null });
    return Object.freeze({ proposalId: p.id, status: 'rejected' });
  }
}
