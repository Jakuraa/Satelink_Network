// Proposal stores (Phase 6 item 13): trading_proposals (status moves once) + append-only events.
export class InMemoryProposalStore {
  rows = new Map(); events = [];
  async insert(p) { if (this.rows.has(p.id)) throw new Error('duplicate'); this.rows.set(p.id, structuredClone(p)); }
  async get(id) { return structuredClone(this.rows.get(id) ?? null); }
  async list({ principalId, status = null, limit = 50 }) {
    return structuredClone([...this.rows.values()].filter((p) => p.principalId === principalId && (!status || p.status === status))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit));
  }
  /** Compare-and-set from pending_review only. Returns true if this call moved it. */
  async decide(id, { status, decidedAt, resultRef = null }) {
    const p = this.rows.get(id);
    if (!p || p.status !== 'pending_review') return false;
    Object.assign(p, { status, decidedAt, resultRef });
    return true;
  }
  async appendEvent(e) { this.events.push(structuredClone(e)); }
}

const fromRow = (r) => ({
  id: r.id, principalId: r.principal_id, proposedBy: r.proposed_by, proposedByKind: r.proposed_by_kind, kind: r.kind, mandateId: r.mandate_id,
  decisionId: r.decision_id, executionPath: r.execution_path, payload: r.payload, rationale: r.rationale, status: r.status, resultRef: r.result_ref,
  createdAt: r.created_at.toISOString(), expiresAt: r.expires_at.toISOString(), decidedAt: r.decided_at?.toISOString() ?? null,
});

export class PgProposalStore {
  #pool;
  constructor(pool) { if (!pool?.query) throw new Error('PgProposalStore needs a pg pool'); this.#pool = pool; }
  async insert(p) {
    await this.#pool.query(
      `INSERT INTO trading_proposals (id, principal_id, proposed_by, proposed_by_kind, kind, mandate_id, decision_id, execution_path, payload, rationale, status, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending_review',$11,$12)`,
      [p.id, p.principalId, p.proposedBy, p.proposedByKind, p.kind, p.mandateId, p.decisionId, p.executionPath, JSON.stringify(p.payload), p.rationale, p.createdAt, p.expiresAt]);
  }
  async get(id) { const { rows } = await this.#pool.query('SELECT * FROM trading_proposals WHERE id = $1', [id]); return rows[0] ? fromRow(rows[0]) : null; }
  async list({ principalId, status = null, limit = 50 }) {
    const { rows } = await this.#pool.query(
      `SELECT * FROM trading_proposals WHERE principal_id = $1 AND ($2::text IS NULL OR status = $2) ORDER BY created_at DESC, id DESC LIMIT $3`,
      [principalId, status, Math.min(Math.max(1, Number(limit) || 50), 200)]);
    return rows.map(fromRow);
  }
  async decide(id, { status, decidedAt, resultRef = null }) {
    const r = await this.#pool.query(`UPDATE trading_proposals SET status = $2, decided_at = $3, result_ref = $4 WHERE id = $1 AND status = 'pending_review'`, [id, status, decidedAt, resultRef]);
    return r.rowCount === 1;
  }
  async appendEvent(e) {
    await this.#pool.query(`INSERT INTO trading_proposal_events (proposal_id, action, actor_id, step_up_method, detail, at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [e.proposalId, e.action, e.actorId, e.stepUpMethod ?? null, e.detail ? JSON.stringify(e.detail) : null, e.at]);
  }
}
