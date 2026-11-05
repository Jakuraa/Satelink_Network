// /v1 task API (Release A). Mounted ONLY by the local preview server (apps/api/scripts/preview_release_a.mjs);
// app_factory.mjs (production) does not mount it — a production mount is a founder decision (Release B).
//
//   POST /v1/tasks                      create (intent → plan → quote)        body { text, idempotency_key, actor_type? }
//   GET  /v1/tasks                      list (owner only)
//   GET  /v1/tasks/:id                  detail
//   GET  /v1/tasks/:id/events           SSE timeline (hash-chained journal stream)
//   POST /v1/tasks/:id/input            answer the pending question         body { field, value }
//   POST /v1/tasks/:id/approve          approve the exact quote             body { quote_id, quote_version, idempotency_key }
//   POST /v1/tasks/:id/cancel
//   GET  /v1/receipts/:id               immutable receipt (?format=csv)
//   GET  /v1/usage                      usage + simulated spend + promo credit + external revenue ($0.00)
//   POST /v1/onboarding                 accounts + one-time $1 promotional credit (simulated)
//   GET  /v1/capabilities               registry search (?q=&intent=&market=&status=)
//   GET  /v1/capabilities/:id
//   POST /v1/assistant/messages         one assistant turn (conversation or task)  body { text, idempotency_key }
//
// Errors are { code, message, retryable, correlation_id } (R11). Session mutations need X-Satelink-Console: 1.

import express from 'express';
import { randomUUID } from 'node:crypto';
import { TaskError, ERR } from '../workflows/errors.js';
import { SIM } from '../workflows/task_service.js';
import { formatUsd } from '../workflows/pricing.js';

const send = (res, e) => {
  const err = e instanceof TaskError ? e : new TaskError('INTERNAL', 'Something went wrong. Nothing was charged.', { status: 500, retryable: true });
  if (!(e instanceof TaskError)) console.error('[tasks] unexpected', e?.message || e);
  const correlation = randomUUID();
  res.status(err.status || 500).json({ ok: false, error: err.toJSON(correlation) });
};

function csv(receipt) {
  const rows = [['field', 'value'], ['receipt_id', receipt.receipt_id], ['outcome', receipt.outcome], ['simulation_label', receipt.simulation_label],
    ['intent', receipt.intent], ['served_by', receipt.served_by || ''], ['currency', receipt.charges?.currency || 'USD'],
    ['credits_charged_usd', receipt.charges?.credits_charged_usd || '0.000000'], ['merchant_paid_by_user_usd', receipt.charges?.merchant_paid_by_user_usd || '0.000000'],
    ['ledger_hash', receipt.ledger?.ledger_hash || ''], ['issued_at', receipt.issued_at]];
  for (const l of receipt.quote?.lines || []) rows.push([`line:${l.capability_id}`, `${l.description} | supplier ${l.supplier_cost_usd} | fee ${l.satelink_fee_usd} | tax ${l.tax_usd}`]);
  return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`).join(',')).join('\n') + '\n';
}

/**
 * @param {import('../workflows/task_service.js').TaskService} svc
 * @param {{ resolvePrincipal(req): Promise<{id:string, via:'session'|'api_key', actor_type?:string}|null> }} opts
 */
export function createTasksRouter(svc, { resolvePrincipal }) {
  const r = express.Router();
  r.use(express.json({ limit: '32kb' }));

  const authed = (fn, { mutating = false } = {}) => async (req, res) => {
    try {
      const p = await resolvePrincipal(req);
      if (!p?.id) throw new TaskError('UNAUTHENTICATED', 'Sign in first.', { status: 401 });
      if (mutating && p.via === 'session' && req.get('X-Satelink-Console') !== '1') throw new TaskError('CSRF', 'Missing console request header.', { status: 403 });
      await fn(req, res, p);
    } catch (e) { send(res, e); }
  };

  r.get('/capabilities', async (req, res) => {
    try {
      const { q = '', intent = null, market = null, status = null } = req.query;
      const items = await svc.registry.search({ q: String(q).slice(0, 200), intent: intent && String(intent), market: market && String(market), status: status && String(status) });
      res.json({ ok: true, capabilities: items });
    } catch (e) { send(res, e); }
  });
  r.get('/capabilities/:id', async (req, res) => {
    try {
      const c = await svc.registry.get(String(req.params.id));
      if (!c) throw new TaskError(ERR.NOT_FOUND, 'Capability not found.', { status: 404 });
      res.json({ ok: true, capability: c });
    } catch (e) { send(res, e); }
  });

  r.post('/onboarding', authed(async (req, res, p) => {
    const actor = ['human', 'developer', 'agent', 'machine'].includes(req.body?.actor_type) ? req.body.actor_type : 'human';
    res.json({ ok: true, onboarding: await svc.onboard(p, { actor_type: actor }) });
  }, { mutating: true }));

  r.post('/assistant/messages', authed(async (req, res, p) => {
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    if (text.trim().length < 1 || text.length > 2000) throw new TaskError(ERR.VALIDATION, 'Message must be 1–2000 characters.');
    if (svc.router.classify(text) === 'plan') {
      const { task, replayed } = await svc.createTask(p, { text, idempotency_key: req.body?.idempotency_key, actor_type: p.actor_type || 'human' });
      return res.status(replayed ? 200 : 201).json({ ok: true, kind: 'task', task, model_badge: svc.router.badge });
    }
    const candidates = await svc.registry.search({ q: text });
    const out = await svc.router.complete({ policy: 'conversation', messages: [{ role: 'user', content: text }], context: { candidates } });
    res.json({ ok: true, kind: 'reply', reply: out.text, served_by: out.served_by, cost_usd: formatUsd(out.cost_minor), fixture: out.fixture, model_badge: svc.router.badge });
  }, { mutating: true }));

  r.post('/tasks', authed(async (req, res, p) => {
    const { task, replayed } = await svc.createTask(p, { text: req.body?.text, idempotency_key: req.body?.idempotency_key, actor_type: req.body?.actor_type || p.actor_type || 'human' });
    res.status(replayed ? 200 : 201).json({ ok: true, task, replayed });
  }, { mutating: true }));
  r.get('/tasks', authed(async (req, res, p) => {
    res.json({ ok: true, ...SIM, tasks: await svc.listTasks(p, { limit: Number(req.query.limit) || 50 }) });
  }));
  r.get('/tasks/:id', authed(async (req, res, p) => { res.json({ ok: true, task: await svc.getTask(p, req.params.id) }); }));
  r.post('/tasks/:id/input', authed(async (req, res, p) => { res.json({ ok: true, ...(await svc.provideInput(p, req.params.id, req.body || {})) }); }, { mutating: true }));
  r.post('/tasks/:id/approve', authed(async (req, res, p) => { res.json({ ok: true, ...(await svc.approve(p, req.params.id, req.body || {})) }); }, { mutating: true }));
  r.post('/tasks/:id/cancel', authed(async (req, res, p) => { res.json({ ok: true, ...(await svc.cancel(p, req.params.id)) }); }, { mutating: true }));

  r.get('/tasks/:id/events', authed(async (req, res, p) => {
    await svc.getTask(p, req.params.id); // owner check (404 otherwise) before streaming anything
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    let sent = 0; let closed = false;
    const push = async () => {
      if (closed) return;
      const evs = svc.events(req.params.id);
      for (; sent < evs.length; sent++) res.write(`id: ${evs[sent].seq}\nevent: state\ndata: ${JSON.stringify(evs[sent])}\n\n`);
      const t = await svc.getTask(p, req.params.id).catch(() => null);
      if (t && ['SUCCEEDED', 'FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'PARTIALLY_SUCCEEDED', 'REQUIRES_RECONCILIATION', 'AWAITING_INPUT', 'AWAITING_APPROVAL'].includes(t.state)) {
        res.write(`event: task\ndata: ${JSON.stringify(t)}\n\n`);
      }
    };
    const timer = setInterval(() => { push().catch(() => {}); }, 500);
    req.on('close', () => { closed = true; clearInterval(timer); });
    await push();
  }));

  r.get('/receipts/:id', authed(async (req, res, p) => {
    const receipt = await svc.getReceipt(p, req.params.id);
    if (req.query.format === 'csv') {
      res.set('content-type', 'text/csv; charset=utf-8').set('content-disposition', `attachment; filename="${receipt.receipt_id}.csv"`);
      return res.send(csv(receipt));
    }
    res.json({ ok: true, receipt });
  }));
  r.get('/usage', authed(async (_req, res, p) => { res.json({ ok: true, usage: await svc.usage(p) }); }));

  return r;
}
