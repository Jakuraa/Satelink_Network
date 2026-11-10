// Postgres store for Release A tasks — the SAME tables as #609 (workflow_runs, workflow_run_steps,
// workflow_receipts) plus 043's workflow_quotes. Every state change is ONE compare-and-set UPDATE on
// (state, version): a lost race returns null and the caller re-reads (optimistic locking).

import { assertTransition, legacyStatus } from './task_state_machine.js';
import { canonicalJSON } from '../utils/canonical_json.js';
import { receiptHash, ReceiptIntegrityError } from './run_store.js';

export const TASK_TEMPLATE = 'assistant.task.v1';
const JSONB = new Set(['plan', 'blocked', 'approval', 'budget_hold', 'result', 'error', 'decision']);
const PATCHABLE = new Set(['plan', 'blocked', 'approval', 'budget_hold', 'result', 'error', 'decision', 'receipt_id', 'quote_id', 'expires_at']);

const view = (r) => r && ({
  id: r.run_id, principal: r.principal, idempotency_key: r.idempotency_key, template: r.template_id,
  state: r.state, status: r.status, version: Number(r.version), tenant_id: r.tenant_id, actor_type: r.actor_type,
  environment: r.environment, origin: r.origin, intent: r.intent, input: r.input, plan: r.plan, quote_id: r.quote_id,
  expires_at: r.expires_at, blocked: r.blocked, approval: r.approval, result: r.result, error: r.error,
  receipt_id: r.receipt_id, created_at: r.created_at, updated_at: r.updated_at,
});

export class TaskStore {
  constructor(pool) { this.pool = pool; }

  async ensureDefinition() {
    await this.pool.query(
      `INSERT INTO workflow_definitions (template_id, version, definition) VALUES ($1, 1, $2::jsonb) ON CONFLICT DO NOTHING`,
      [TASK_TEMPLATE, JSON.stringify({ id: TASK_TEMPLATE, name: 'Assistant task', lifecycle: 'release_a' })],
    );
  }

  /** Insert a new task; replays (same principal + idempotency key) return the existing row. */
  async insert({ runId, principal, idempotencyKey, actorType, intent, input, environment = 'preview', origin = 'simulated', now }) {
    const { rows } = await this.pool.query(
      `INSERT INTO workflow_runs (run_id, principal, idempotency_key, template_id, template_version, status, input, quote, approval,
          budget_hold, is_simulation, is_test_data, created_at, updated_at, state, version, tenant_id, actor_type, environment, origin, intent)
       VALUES ($1,$2,$3,$4,1,'blocked',$5::jsonb,'{}','{}','{}',true,true,$6,$6,'CREATED',0,$2,$7,$8,$9,$10)
       ON CONFLICT (principal, idempotency_key) DO NOTHING RETURNING *`,
      [runId, principal, idempotencyKey, TASK_TEMPLATE, JSON.stringify(input || {}), now, actorType, environment, origin, intent],
    );
    if (rows[0]) return { run: view(rows[0]), replayed: false };
    const prior = await this.pool.query('SELECT * FROM workflow_runs WHERE principal = $1 AND idempotency_key = $2', [principal, idempotencyKey]);
    return { run: view(prior.rows[0]), replayed: true };
  }

  async get(principal, id) {
    const { rows } = await this.pool.query('SELECT * FROM workflow_runs WHERE run_id = $1 AND principal = $2 AND template_id = $3', [id, principal, TASK_TEMPLATE]);
    return view(rows[0]) || null;
  }

  async getInternal(id) {
    const { rows } = await this.pool.query('SELECT * FROM workflow_runs WHERE run_id = $1 AND template_id = $2', [id, TASK_TEMPLATE]);
    return view(rows[0]) || null;
  }

  async list(principal, { limit = 50 } = {}) {
    const { rows } = await this.pool.query(
      'SELECT * FROM workflow_runs WHERE principal = $1 AND template_id = $2 ORDER BY created_at DESC LIMIT $3',
      [principal, TASK_TEMPLATE, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map(view);
  }

  async listByStates(states) {
    const { rows } = await this.pool.query('SELECT * FROM workflow_runs WHERE template_id = $1 AND state = ANY($2::text[]) ORDER BY created_at', [TASK_TEMPLATE, states]);
    return rows.map(view);
  }

  /** CAS transition. Returns the updated task, or null if the state/version moved underneath us. */
  async transition(id, from, to, expectedVersion, patch = {}, now = new Date()) {
    assertTransition(from, to);
    const sets = ['state = $4', 'status = $5', 'version = version + 1', 'updated_at = $6'];
    const vals = [id, from, expectedVersion, to, legacyStatus(to), now];
    for (const [k, v] of Object.entries(patch)) {
      if (!PATCHABLE.has(k)) throw new Error(`task field '${k}' is not patchable`);
      vals.push(JSONB.has(k) ? (v == null ? null : JSON.stringify(v)) : v);
      sets.push(`${k} = $${vals.length}${JSONB.has(k) ? '::jsonb' : ''}`);
    }
    const { rows } = await this.pool.query(
      `UPDATE workflow_runs SET ${sets.join(', ')} WHERE run_id = $1 AND template_id = '${TASK_TEMPLATE}' AND state = $2 AND version = $3 RETURNING *`,
      vals,
    );
    return view(rows[0]) || null;
  }

  // ── quotes (immutable) ──
  async insertQuote(q) {
    await this.pool.query(
      `INSERT INTO workflow_quotes (quote_id, run_id, version, currency, minor_decimals, lines, supplier_cost_minor, satelink_fee_minor,
          tax_minor, total_minor, credit_charge_minor, fee_policy_status, disclosure, expires_at, origin, environment)
       VALUES ($1,$2,$3,'USD',6,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (quote_id) DO NOTHING`,
      [q.quote_id, q.run_id, q.version, JSON.stringify(q.lines), q.supplier_cost_minor.toString(), q.satelink_fee_minor.toString(),
        q.tax_minor.toString(), q.total_minor.toString(), q.credit_charge_minor.toString(), q.fee_policy_status, q.disclosure,
        q.expires_at, q.origin, q.environment],
    );
  }

  async getQuote(quoteId) {
    const { rows } = await this.pool.query('SELECT * FROM workflow_quotes WHERE quote_id = $1', [quoteId]);
    return rows[0] || null;
  }

  async nextQuoteVersion(runId) {
    const { rows } = await this.pool.query('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM workflow_quotes WHERE run_id = $1', [runId]);
    return Number(rows[0].v);
  }

  // ── steps ──
  async upsertStep(runId, s) {
    await this.pool.query(
      `INSERT INTO workflow_run_steps (run_id, node_id, status, step_no, capability_id, provider_id, idempotency_key, attempts, last_error_code, result, verified_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,now())
       ON CONFLICT (run_id, node_id) DO UPDATE SET status = EXCLUDED.status, attempts = EXCLUDED.attempts,
         last_error_code = EXCLUDED.last_error_code, result = EXCLUDED.result, verified_at = EXCLUDED.verified_at, updated_at = now()`,
      [runId, `step-${s.step_no}`, s.status, s.step_no, s.capability_id, s.provider_id, s.idempotency_key, s.attempts || 0,
        s.last_error_code || null, s.result == null ? null : JSON.stringify(s.result), s.verified_at || null],
    );
  }

  async steps(runId) {
    const { rows } = await this.pool.query('SELECT * FROM workflow_run_steps WHERE run_id = $1 ORDER BY step_no NULLS LAST, node_id', [runId]);
    return rows;
  }

  // ── receipts (append-only table from 041; hash checked on read) ──
  async insertReceipt({ receipt_id, run_id, principal, body, issued_at }) {
    const { rowCount } = await this.pool.query(
      `INSERT INTO workflow_receipts (receipt_id, run_id, principal, body, body_sha256, issued_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6) ON CONFLICT (receipt_id) DO NOTHING`,
      [receipt_id, run_id, principal, canonicalJSON(body), receiptHash(body), issued_at],
    );
    return rowCount === 1;
  }

  async getReceipt(principal, receiptId) {
    const { rows } = await this.pool.query(
      `SELECT r.body, r.body_sha256 FROM workflow_receipts r JOIN workflow_runs w ON w.run_id = r.run_id
        WHERE r.receipt_id = $1 AND r.principal = $2 AND w.template_id = $3`,
      [receiptId, principal, TASK_TEMPLATE],
    );
    if (!rows[0]) return null;
    if (receiptHash(rows[0].body) !== rows[0].body_sha256) throw new ReceiptIntegrityError(receiptId);
    return { ...rows[0].body, receipt_sha256: rows[0].body_sha256 };
  }

  async receiptsFor(principal, { limit = 100 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT r.receipt_id, r.run_id, r.body, r.body_sha256, r.issued_at FROM workflow_receipts r JOIN workflow_runs w ON w.run_id = r.run_id
        WHERE r.principal = $1 AND w.template_id = $2 ORDER BY r.issued_at DESC LIMIT $3`,
      [principal, TASK_TEMPLATE, limit],
    );
    return rows;
  }
}
