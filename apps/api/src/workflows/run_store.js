// Workflow run store — the customer-facing read model (migration 041).
//
// Two bindings with one contract: MemoryRunStore (tests) and PgRunStore (preview and
// production). The audit trail is NOT here — it is the workflow kernel's hash-chained
// journal (wf_journal). This store answers "whose run is this, what state is it in,
// what was quoted, approved, returned and receipted".
//
// Invariants enforced by both bindings:
//   - every customer read is scoped by principal (no cross-tenant reads)
//   - (principal, idempotency_key) is unique: a duplicate create returns the existing run
//   - status changes are compare-and-set (`transition(id, from[], patch)`), so two
//     approvals — in one process or across instances — can only start one execution
//   - receipts are append-only and carry a sha256 of their canonical body
//   - usage records are never revenue and never move money (also CHECKed in SQL)

import crypto from 'node:crypto';
import { canonicalJSON } from '../utils/canonical_json.js';
import { usdToMicros, microsToUsd } from './supplier_catalog.js';

export function receiptHash(body) {
  return crypto.createHash('sha256').update(canonicalJSON(body)).digest('hex');
}

export class ReceiptIntegrityError extends Error {
  constructor(id) { super(`receipt ${id} failed its integrity check`); this.name = 'ReceiptIntegrityError'; }
}

const clone = (v) => (v == null ? v : structuredClone(v));

// ---------------------------------------------------------------------------

export class MemoryRunStore {
  constructor() {
    this.runs = new Map();
    this.byIdem = new Map();
    this.definitions = new Map();
    this.strategies = new Map();
    this.receipts = new Map();
    this.usage = new Map();
    this.steps = new Map();
  }

  async ensureDefinitions(templates) {
    for (const t of templates) {
      const k = `${t.id}@${t.version}`;
      const existing = this.definitions.get(k);
      if (existing && canonicalJSON(existing) !== canonicalJSON(t)) throw new Error(`workflow definition ${k} changed without a version bump`);
      this.definitions.set(k, clone(t));
    }
  }

  async insertRun(run) {
    const ik = `${run.principal}|${run.idempotency_key}`;
    if (this.byIdem.has(ik)) return { inserted: false, run: clone(this.runs.get(this.byIdem.get(ik))) };
    this.runs.set(run.id, clone(run));
    this.byIdem.set(ik, run.id);
    return { inserted: true, run: clone(run) };
  }

  async getRun(principal, id) {
    const r = this.runs.get(id);
    return r && r.principal === principal ? this._withReceipt(r) : null;
  }

  async getRunInternal(id) { const r = this.runs.get(id); return r ? this._withReceipt(r) : null; }

  _withReceipt(r) {
    const out = clone(r);
    if (r.receipt_id && this.receipts.has(r.receipt_id)) {
      const rec = this.receipts.get(r.receipt_id);
      if (receiptHash(rec.body) !== rec.body_sha256) throw new ReceiptIntegrityError(r.receipt_id);
      out.receipt = clone(rec.body);
      out.receipt_sha256 = rec.body_sha256;
    }
    return out;
  }

  async transition(id, from, patch) {
    const r = this.runs.get(id);
    if (!r || !from.includes(r.status)) return null;
    Object.assign(r, clone(patch));
    return this._withReceipt(r);
  }

  async listRuns(principal, { limit = 50, strategyId = null } = {}) {
    return [...this.runs.values()]
      .filter((r) => r.principal === principal && (!strategyId || r.input?.spec?.id === strategyId))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit)
      .map((r) => this._withReceipt(r));
  }

  async listOpenRuns() { return [...this.runs.values()].filter((r) => r.status === 'running').map(clone); }

  async upsertSteps(id, nodes) { this.steps.set(id, nodes.map((n) => ({ node_id: n.id, status: n.status }))); }

  async insertUsage(rec) {
    if (rec.counted_as_revenue || rec.money_moved) throw new Error('workflow usage can never be revenue or move money');
    if (!this.usage.has(rec.run_id)) this.usage.set(rec.run_id, clone(rec));
  }

  async insertReceipt({ receipt_id, run_id, principal, body, issued_at }) {
    if (this.receipts.has(receipt_id)) return false;
    this.receipts.set(receipt_id, { receipt_id, run_id, principal, body: clone(body), body_sha256: receiptHash(body), issued_at });
    return true;
  }

  async getReceipt(principal, receiptId) {
    const rec = this.receipts.get(receiptId);
    if (!rec || rec.principal !== principal) return null;
    if (receiptHash(rec.body) !== rec.body_sha256) throw new ReceiptIntegrityError(receiptId);
    return { ...clone(rec.body), receipt_sha256: rec.body_sha256 };
  }

  async saveStrategy(principal, spec) {
    const k = `${principal}|${spec.id}`;
    if (!this.strategies.has(k)) this.strategies.set(k, { principal, strategy_id: spec.id, name: spec.name, spec: clone(spec), created_at: new Date().toISOString() });
    return clone(this.strategies.get(k));
  }

  async listStrategies(principal) {
    return [...this.strategies.values()].filter((s) => s.principal === principal).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map(clone);
  }

  async getStrategy(principal, strategyId) { return clone(this.strategies.get(`${principal}|${strategyId}`)) || null; }
}

// ---------------------------------------------------------------------------

const RUN_COLS = `r.run_id, r.principal, r.idempotency_key, r.template_id, r.template_version, r.status,
  r.input, r.request, r.quote, r.approval, r.blocked, r.budget_micros, r.budget_hold, r.result,
  r.receipt_id, r.error, r.decision, r.is_simulation, r.is_test_data, r.created_at, r.updated_at,
  rc.body AS receipt_body, rc.body_sha256 AS receipt_sha256`;

function rowToRun(row) {
  if (!row) return null;
  const run = {
    id: row.run_id,
    principal: row.principal,
    idempotency_key: row.idempotency_key,
    template: row.template_id,
    template_version: row.template_version,
    status: row.status,
    input: row.input,
    _request: row.request,
    quote: row.quote,
    approval: row.approval,
    blocked: row.blocked,
    budget_usd: row.budget_micros == null ? null : microsToUsd(BigInt(row.budget_micros)),
    budget_hold: row.budget_hold,
    result: row.result,
    receipt_id: row.receipt_id,
    receipt: null,
    error: row.error,
    decision: row.decision,
    is_simulation: row.is_simulation,
    is_test_data: row.is_test_data,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
  if (row.receipt_body) {
    if (receiptHash(row.receipt_body) !== row.receipt_sha256) throw new ReceiptIntegrityError(row.receipt_id);
    run.receipt = row.receipt_body;
    run.receipt_sha256 = row.receipt_sha256;
  }
  return run;
}

// Patchable columns → how to write them. Anything else in a patch is rejected.
const PATCH_COLS = {
  status: (v) => v,
  approval: (v) => JSON.stringify(v),
  budget_hold: (v) => JSON.stringify(v),
  result: (v) => (v == null ? null : JSON.stringify(v)),
  receipt_id: (v) => v,
  error: (v) => (v == null ? null : JSON.stringify(v)),
  decision: (v) => (v == null ? null : JSON.stringify(v)),
  updated_at: (v) => v,
};

export class PgRunStore {
  /** @param {{query: Function}} pool  pg pool */
  constructor(pool) {
    if (!pool?.query) throw new Error('PgRunStore requires a pg pool');
    this.pool = pool;
  }

  async ensureDefinitions(templates) {
    for (const t of templates) {
      await this.pool.query(
        `INSERT INTO workflow_definitions (template_id, version, definition) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (template_id, version) DO NOTHING`,
        [t.id, t.version, canonicalJSON(t)],
      );
      const { rows } = await this.pool.query('SELECT definition FROM workflow_definitions WHERE template_id = $1 AND version = $2', [t.id, t.version]);
      if (canonicalJSON(rows[0].definition) !== canonicalJSON(t)) throw new Error(`workflow definition ${t.id}@${t.version} changed without a version bump`);
    }
  }

  async insertRun(run) {
    const { rows } = await this.pool.query(
      `INSERT INTO workflow_runs (run_id, principal, idempotency_key, template_id, template_version, status,
         strategy_id, capability, network, input, request, quote, approval, blocked, budget_micros, budget_hold,
         result, error, is_simulation, is_test_data, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16::jsonb,
               $17::jsonb,$18::jsonb,$19,$20,$21,$22)
       ON CONFLICT (principal, idempotency_key) DO NOTHING
       RETURNING run_id`,
      [run.id, run.principal, run.idempotency_key, run.template, run.template_version, run.status,
        run.input?.spec?.id ?? null, run.input?.capability ?? null, run.input?.network ?? null,
        JSON.stringify(run.input), JSON.stringify(run._request ?? null), JSON.stringify(run.quote),
        JSON.stringify(run.approval), run.blocked ? JSON.stringify(run.blocked) : null,
        run.budget_usd == null ? null : usdToMicros(run.budget_usd).toString(), JSON.stringify(run.budget_hold),
        run.result ? JSON.stringify(run.result) : null, run.error ? JSON.stringify(run.error) : null,
        run.is_simulation, run.is_test_data, run.created_at, run.updated_at],
    );
    if (rows.length) return { inserted: true, run: await this.getRunInternal(run.id) };
    const { rows: ex } = await this.pool.query(
      `SELECT ${RUN_COLS} FROM workflow_runs r LEFT JOIN workflow_receipts rc ON rc.receipt_id = r.receipt_id
       WHERE r.principal = $1 AND r.idempotency_key = $2`, [run.principal, run.idempotency_key]);
    return { inserted: false, run: rowToRun(ex[0]) };
  }

  async getRun(principal, id) {
    const { rows } = await this.pool.query(
      `SELECT ${RUN_COLS} FROM workflow_runs r LEFT JOIN workflow_receipts rc ON rc.receipt_id = r.receipt_id
       WHERE r.run_id = $1 AND r.principal = $2`, [id, principal]);
    return rowToRun(rows[0]);
  }

  async getRunInternal(id) {
    const { rows } = await this.pool.query(
      `SELECT ${RUN_COLS} FROM workflow_runs r LEFT JOIN workflow_receipts rc ON rc.receipt_id = r.receipt_id
       WHERE r.run_id = $1`, [id]);
    return rowToRun(rows[0]);
  }

  async transition(id, from, patch) {
    const sets = []; const vals = [id, from];
    for (const [k, v] of Object.entries(patch)) {
      if (!PATCH_COLS[k]) throw new Error(`run field '${k}' is not patchable`);
      vals.push(PATCH_COLS[k](v));
      sets.push(`${k} = $${vals.length}${['approval', 'budget_hold', 'result', 'error', 'decision'].includes(k) ? '::jsonb' : ''}`);
    }
    const { rowCount } = await this.pool.query(`UPDATE workflow_runs SET ${sets.join(', ')} WHERE run_id = $1 AND status = ANY($2::text[])`, vals);
    return rowCount ? this.getRunInternal(id) : null;
  }

  async listRuns(principal, { limit = 50, strategyId = null } = {}) {
    const { rows } = await this.pool.query(
      `SELECT ${RUN_COLS} FROM workflow_runs r LEFT JOIN workflow_receipts rc ON rc.receipt_id = r.receipt_id
       WHERE r.principal = $1 AND ($2::text IS NULL OR r.strategy_id = $2)
       ORDER BY r.created_at DESC LIMIT $3`, [principal, strategyId, Math.min(Math.max(1, limit), 200)]);
    return rows.map(rowToRun);
  }

  async listOpenRuns() {
    const { rows } = await this.pool.query(
      `SELECT ${RUN_COLS} FROM workflow_runs r LEFT JOIN workflow_receipts rc ON rc.receipt_id = r.receipt_id
       WHERE r.status = 'running' ORDER BY r.created_at`);
    return rows.map(rowToRun);
  }

  async upsertSteps(id, nodes) {
    for (const n of nodes) {
      await this.pool.query(
        `INSERT INTO workflow_run_steps (run_id, node_id, status, updated_at) VALUES ($1,$2,$3,now())
         ON CONFLICT (run_id, node_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()
         WHERE workflow_run_steps.status IS DISTINCT FROM EXCLUDED.status`, [id, n.id, n.status]);
    }
  }

  async insertUsage(rec) {
    if (rec.counted_as_revenue || rec.money_moved) throw new Error('workflow usage can never be revenue or move money');
    await this.pool.query(
      `INSERT INTO workflow_usage_records (run_id, principal, offer_id, capability, supplier_cost_micros,
         customer_charge_micros, list_price_micros, pricing_approved, is_test_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (run_id) DO NOTHING`,
      [rec.run_id, rec.principal, rec.offer_id, rec.capability, rec.supplier_cost_micros, rec.customer_charge_micros,
        rec.list_price_micros, rec.pricing_approved, rec.is_test_data]);
  }

  async insertReceipt({ receipt_id, run_id, principal, body, issued_at }) {
    const { rowCount } = await this.pool.query(
      `INSERT INTO workflow_receipts (receipt_id, run_id, principal, body, body_sha256, issued_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT (receipt_id) DO NOTHING`,
      [receipt_id, run_id, principal, canonicalJSON(body), receiptHash(body), issued_at]);
    return rowCount === 1;
  }

  async getReceipt(principal, receiptId) {
    const { rows } = await this.pool.query('SELECT body, body_sha256 FROM workflow_receipts WHERE receipt_id = $1 AND principal = $2', [receiptId, principal]);
    if (!rows[0]) return null;
    if (receiptHash(rows[0].body) !== rows[0].body_sha256) throw new ReceiptIntegrityError(receiptId);
    return { ...rows[0].body, receipt_sha256: rows[0].body_sha256 };
  }

  async saveStrategy(principal, spec) {
    await this.pool.query(
      `INSERT INTO workflow_strategies (principal, strategy_id, name, spec) VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (principal, strategy_id) DO NOTHING`, [principal, spec.id, spec.name, canonicalJSON(spec)]);
    return this.getStrategy(principal, spec.id);
  }

  async listStrategies(principal) {
    const { rows } = await this.pool.query(
      'SELECT principal, strategy_id, name, spec, created_at FROM workflow_strategies WHERE principal = $1 ORDER BY created_at DESC LIMIT 200', [principal]);
    return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
  }

  async getStrategy(principal, strategyId) {
    const { rows } = await this.pool.query(
      'SELECT principal, strategy_id, name, spec, created_at FROM workflow_strategies WHERE principal = $1 AND strategy_id = $2', [principal, strategyId]);
    return rows[0] ? { ...rows[0], created_at: new Date(rows[0].created_at).toISOString() } : null;
  }
}
