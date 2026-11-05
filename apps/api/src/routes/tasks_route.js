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
    ...(receipt.trading_label ? [['trading_label', receipt.trading_label], ['notice', receipt.notice]] : []),
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
export function createTasksRouter(svc, { resolvePrincipal, connections = null, developerKeys = null, consoleOrigin = 'http://localhost:3400' }) {
  const r = express.Router();
  r.use(express.json({ limit: '32kb' }));

  // scope: required scope for API-key callers ('session' = console session only). Session users hold every scope.
  const authed = (fn, { mutating = false, scope = null } = {}) => async (req, res) => {
    try {
      const p = await resolvePrincipal(req);
      if (!p?.id) throw new TaskError('UNAUTHENTICATED', 'Sign in first.', { status: 401 });
      if (mutating && p.via === 'session' && req.get('X-Satelink-Console') !== '1') throw new TaskError('CSRF', 'Missing console request header.', { status: 403 });
      if (p.via === 'api_key' && scope === 'session') throw new TaskError('FORBIDDEN_SCOPE', 'This action needs a signed-in console session.', { status: 403 });
      if (p.via === 'api_key' && scope && p.scopes && !p.scopes.includes(scope)) throw new TaskError('FORBIDDEN_SCOPE', `This key lacks the "${scope}" scope.`, { status: 403 });
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
  }, { mutating: true, scope: 'session' }));

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
  }, { mutating: true, scope: 'tasks:create' }));

  r.post('/tasks', authed(async (req, res, p) => {
    const { task, replayed } = await svc.createTask(p, { text: req.body?.text, idempotency_key: req.body?.idempotency_key, actor_type: req.body?.actor_type || p.actor_type || 'human' });
    res.status(replayed ? 200 : 201).json({ ok: true, task, replayed });
  }, { mutating: true, scope: 'tasks:create' }));
  r.get('/tasks', authed(async (req, res, p) => {
    res.json({ ok: true, ...SIM, tasks: await svc.listTasks(p, { limit: Number(req.query.limit) || 50 }) });
  }, { scope: 'tasks:read' }));
  r.get('/tasks/:id', authed(async (req, res, p) => { res.json({ ok: true, task: await svc.getTask(p, req.params.id) }); }, { scope: 'tasks:read' }));
  r.post('/tasks/:id/input', authed(async (req, res, p) => { res.json({ ok: true, ...(await svc.provideInput(p, req.params.id, req.body || {})) }); }, { mutating: true, scope: 'tasks:create' }));
  r.post('/tasks/:id/approve', authed(async (req, res, p) => {
    const key = req.get('Idempotency-Key') || req.body?.idempotency_key;
    // Machine callers must make approval replay-safe explicitly.
    if (p.via === 'api_key' && (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))) throw new TaskError('IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (8–128 characters) to approve via the API.', { status: 400 });
    if (p.via === 'api_key' && p.key_id) {
      // Agent spend pre-authorization (S5): a task an agent created is approvable by its key only up to the key's
      // pre-authorized amount — default $0, so every agent spend needs the human in the console.
      const t = await svc.getTask(p, req.params.id);
      const charge = BigInt(t.quote?.credit_charge_minor ?? 0);
      if (t.actor_type === 'agent' && charge > (p.agent_spend_preauth_minor ?? 0n)) {
        throw new TaskError('HUMAN_APPROVAL_REQUIRED', 'Agent spend is not pre-authorized: a person must approve this in the console.', { status: 403 });
      }
    }
    res.json({ ok: true, ...(await svc.approve(p, req.params.id, { ...(req.body || {}), idempotency_key: key })) });
  }, { mutating: true, scope: 'tasks:approve' }));
  r.post('/tasks/:id/approval-request', authed(async (req, res, p) => {
    res.json({ ok: true, ...(await svc.requestApproval(p, req.params.id, { channel: String(req.body?.channel || p.via), note: req.body?.note })) });
  }, { mutating: true, scope: 'tasks:create' }));
  r.post('/tasks/:id/cancel', authed(async (req, res, p) => { res.json({ ok: true, ...(await svc.cancel(p, req.params.id)) }); }, { mutating: true, scope: 'tasks:create' }));

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
  }, { scope: 'tasks:read' }));

  r.get('/receipts/:id', authed(async (req, res, p) => {
    const receipt = await svc.getReceipt(p, req.params.id);
    if (req.query.format === 'csv') {
      res.set('content-type', 'text/csv; charset=utf-8').set('content-disposition', `attachment; filename="${receipt.receipt_id}.csv"`);
      return res.send(csv(receipt));
    }
    res.json({ ok: true, receipt });
  }, { scope: 'receipts:read' }));
  r.get('/usage', authed(async (_req, res, p) => { res.json({ ok: true, usage: await svc.usage(p) }); }, { scope: 'usage:read' }));

  // ── Connector connections (OAuth 2.1 + PKCE; S2). The callback is bound to its single-use state, not a session.
  if (connections) {
    r.get('/connections', authed(async (_req, res, p) => { res.json({ ok: true, connections: await connections.list(p.id) }); }, { scope: 'session' }));
    r.post('/connections/:id/start', authed(async (req, res, p) => {
      res.json({ ok: true, ...(await connections.start(p.id, req.params.id, { returnTo: req.body?.return_to || '/connections' })) });
    }, { mutating: true, scope: 'session' }));
    r.post('/connections/:id/revoke', authed(async (req, res, p) => { res.json({ ok: true, ...(await connections.revoke(p.id, req.params.id)) }); }, { mutating: true, scope: 'session' }));
    r.get('/connections/:id/callback', async (req, res) => {
      try {
        const done = await connections.finish({ state: req.query.state, code: req.query.code, error: req.query.error });
        const back = new URL(done.return_to || '/connections', consoleOrigin);
        back.searchParams.set('connected', done.connector_id);
        res.redirect(302, back.toString());
      } catch (e) {
        const back = new URL(e?.extra?.return_to || '/connections', consoleOrigin);
        back.searchParams.set('connection_error', e?.code || 'OAUTH_FAILED');
        res.redirect(302, back.toString());
      }
    });
  }

  // ── Developer keys (S4) — managed from a console session only; a key can never mint or list keys.
  if (developerKeys) {
    r.get('/developer/keys', authed(async (_req, res, p) => { res.json({ ok: true, keys: await developerKeys.list(p.id) }); }, { scope: 'session' }));
    r.post('/developer/keys', authed(async (req, res, p) => { res.status(201).json({ ok: true, key: await developerKeys.create(p.id, req.body || {}) }); }, { mutating: true, scope: 'session' }));
    r.post('/developer/keys/:id/revoke', authed(async (req, res, p) => { res.json({ ok: true, ...(await developerKeys.revoke(p.id, req.params.id)) }); }, { mutating: true, scope: 'session' }));
  }

  // ── Generated OpenAPI (routes + registry capabilities). Public.
  r.get('/openapi.json', async (_req, res) => {
    try { res.json(await openApiDocument(svc)); } catch (e) { send(res, e); }
  });

  return r;
}

const ERROR = { type: 'object', required: ['code', 'message', 'retryable', 'correlation_id'], properties: { code: { type: 'string' }, message: { type: 'string' }, retryable: { type: 'boolean' }, correlation_id: { type: 'string' } } };
const SIMULATED = { simulated: { type: 'boolean', const: true }, simulation_label: { type: 'string', const: 'SIMULATED — NO MONEY MOVED' } };

/** OpenAPI 3.1 for the preview task API, generated from the route table above and the live registry. */
export async function openApiDocument(svc) {
  const caps = await svc.registry.search({ q: '' });
  const op = (summary, scope, extra = {}) => ({ summary, security: [{ apiKey: [] }, { session: [] }], 'x-required-scope': scope,
    responses: { 200: { description: 'OK' }, 401: { description: 'Unauthenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }, 403: { description: 'Missing scope' } }, ...extra });
  return {
    openapi: '3.1.0',
    info: { title: 'Satelink task API (preview)', version: '0.1.0-preview',
      description: 'Release A local preview. Everything is simulated: no money moves, nothing is purchased. Fees are PROPOSED — NOT APPROVED.' },
    servers: [{ url: '/v1' }],
    components: {
      securitySchemes: { apiKey: { type: 'http', scheme: 'bearer', description: 'Developer key (slk_preview_…), scoped' }, session: { type: 'apiKey', in: 'cookie', name: 'satelink.session_token' } },
      schemas: { Error: ERROR, Simulated: { type: 'object', properties: SIMULATED } },
    },
    'x-capabilities': caps.map((c) => ({ id: c.id, name: c.name, release_status: c.release_status, fee_policy_id: c.fee_policy_id, input_schema: c.input_schema })),
    paths: {
      '/capabilities': { get: { summary: 'Search the capability registry', parameters: ['q', 'intent', 'market', 'status'].map((n) => ({ name: n, in: 'query', schema: { type: 'string' } })), responses: { 200: { description: 'Capabilities' } } } },
      '/capabilities/{id}': { get: { summary: 'One capability', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Capability' }, 404: { description: 'Not found' } } } },
      '/tasks': {
        post: op('Create a task from an intent (plan + quote; nothing executes before approval)', 'tasks:create', { requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['text', 'idempotency_key'], properties: { text: { type: 'string' }, idempotency_key: { type: 'string' }, actor_type: { type: 'string', enum: ['human', 'developer', 'agent', 'machine'] } } } } } } }),
        get: op('List your tasks', 'tasks:read'),
      },
      '/tasks/{id}': { get: op('Task detail incl. plan, quote, reservation, output', 'tasks:read') },
      '/tasks/{id}/events': { get: op('Server-sent events: state timeline', 'tasks:read') },
      '/tasks/{id}/input': { post: op('Answer the pending question', 'tasks:create') },
      '/tasks/{id}/approval-request': { post: op('Ask the human owner to approve in the console (agents: spend pre-authorization defaults to $0)', 'tasks:create') },
      '/tasks/{id}/approve': { post: op('Approve the exact quote (id + version). API keys must send Idempotency-Key.', 'tasks:approve', { parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' } }] }) },
      '/tasks/{id}/cancel': { post: op('Cancel before execution', 'tasks:create') },
      '/receipts/{id}': { get: op('Immutable receipt (JSON, or ?format=csv)', 'receipts:read') },
      '/usage': { get: op('Usage, simulated spend, promotional credit, external revenue ($0.00)', 'usage:read') },
    },
  };
}
