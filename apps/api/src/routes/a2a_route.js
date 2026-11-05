// A2A v1.0 surface for the Release A preview (Slice S5): Agent Card + JSON-RPC binding over the ONE task engine.
// Spec: a2aproject/A2A specification/a2a.proto (package lf.a2a.v1) + docs/specification.md — ProtoJSON (camelCase
// fields, enums as their proto names), PascalCase JSON-RPC methods, A2A error codes -32001…-32009, `A2A-Version`.
// Implemented methods: SendMessage, GetTask, CancelTask. Everything else → UnsupportedOperationError (-32004).
// Agent spend pre-authorization is $0: a task that needs money stops at TASK_STATE_AUTH_REQUIRED until the human
// approves it in the console. Card signatures (JWS) are not produced in the preview (no KeyProvider key) — the
// `signatures` field is omitted rather than faked.

import express from 'express';
import crypto from 'node:crypto';
import { TaskError } from '../workflows/errors.js';

const PROTOCOL_VERSION = '1.0';
const SIM_LABEL = 'SIMULATED — NO MONEY MOVED';

const STATE = {
  CREATED: 'TASK_STATE_SUBMITTED', UNDERSTANDING: 'TASK_STATE_WORKING', PLANNING: 'TASK_STATE_WORKING', QUOTED: 'TASK_STATE_WORKING',
  AWAITING_INPUT: 'TASK_STATE_INPUT_REQUIRED', AWAITING_APPROVAL: 'TASK_STATE_AUTH_REQUIRED',
  AUTHORIZED: 'TASK_STATE_WORKING', RESERVED: 'TASK_STATE_WORKING', EXECUTING: 'TASK_STATE_WORKING', UNKNOWN_EXECUTION_OUTCOME: 'TASK_STATE_WORKING',
  VERIFYING: 'TASK_STATE_WORKING', REQUIRES_RECONCILIATION: 'TASK_STATE_WORKING',
  SUCCEEDED: 'TASK_STATE_COMPLETED', FAILED: 'TASK_STATE_FAILED', REFUNDED: 'TASK_STATE_FAILED', EXPIRED: 'TASK_STATE_FAILED',
  REJECTED: 'TASK_STATE_REJECTED', CANCELLED: 'TASK_STATE_CANCELED',
};
export const a2aState = (s) => STATE[s] || 'TASK_STATE_WORKING';

/** Satelink task view → A2A Task (lf.a2a.v1.Task, ProtoJSON). */
export function toA2aTask(t, { consoleOrigin }) {
  const say = (text) => ({ messageId: `msg_${crypto.createHash('sha256').update(`${t.id}|${t.state}|${t.version}`).digest('hex').slice(0, 24)}`,
    taskId: t.id, contextId: t.id, role: 'ROLE_AGENT', parts: [{ text }] });
  let message;
  if (t.state === 'AWAITING_APPROVAL') message = say(`Approval needed: ${t.quote?.total_usd ?? '?'} USD quoted (${SIM_LABEL}). A person must approve it at ${consoleOrigin}/tasks/${t.id} — agent spend is not pre-authorized.`);
  else if (t.state === 'AWAITING_INPUT') message = say(t.question?.text || 'More input is needed.');
  else if (t.error) message = say(t.error.message);
  const artifacts = [];
  if (t.state === 'SUCCEEDED') {
    artifacts.push({ artifactId: `art_${t.id}_receipt`, name: 'receipt', parts: [{ data: { receipt_id: t.receipt_id, simulated: true, simulation_label: SIM_LABEL } }] });
    if (t.output) artifacts.push({ artifactId: `art_${t.id}_output`, name: 'result', description: 'Supplier output (simulated; untrusted data).', parts: [{ data: t.output }] });
  }
  return {
    id: t.id, contextId: t.id,
    status: { state: a2aState(t.state), ...(message ? { message } : {}), timestamp: t.updated_at },
    ...(artifacts.length ? { artifacts } : {}),
    metadata: { satelink_state: t.state, simulated: true, simulation_label: SIM_LABEL, quote: t.quote ? { quote_id: t.quote.quote_id, version: t.quote.version, total_usd: t.quote.total_usd, fees: 'PROPOSED — NOT APPROVED' } : null },
  };
}

/** Agent Card (lf.a2a.v1.AgentCard) — skills generated from the registry. */
export async function agentCard(svc, { publicBaseUrl }) {
  const caps = await svc.registry.search({ q: '', limit: 200 });
  return {
    name: 'Satelink AI Assistance (preview)',
    description: 'Plans, quotes and runs tasks through one engine. Release A local preview: everything is simulated — no money moves, nothing is purchased. Every spend needs a human approval in the Satelink console.',
    supportedInterfaces: [{ url: `${publicBaseUrl}/a2a/v1`, protocolBinding: 'JSONRPC', protocolVersion: PROTOCOL_VERSION }],
    provider: { organization: 'Jakuraa', url: 'https://satelink.network' },
    version: '0.1.0-preview',
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    securitySchemes: { bearer: { httpAuthSecurityScheme: { scheme: 'Bearer', bearerFormat: 'slk_preview', description: 'Satelink developer key (Developer Hub), scoped; tasks:create + tasks:read.' } } },
    securityRequirements: [{ schemes: { bearer: { list: [] } } }],
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['application/json', 'text/plain'],
    skills: caps.map((c) => ({
      id: c.id, name: c.name, description: `${c.description} [${c.release_status}; ${SIM_LABEL}]`,
      tags: [...new Set([c.category, ...(c.tags || []).slice(0, 6)].filter(Boolean))],
      inputModes: ['text/plain'], outputModes: ['application/json'],
    })),
  };
}

/** Machine-readable capability list (registry → JSON). Prices are fee POLICIES, never computed amounts. */
export async function capabilitiesDocument(svc) {
  const caps = await svc.registry.search({ q: '', limit: 200 });
  return {
    version: 1, generated_from: 'capability registry', environment: 'preview', simulated: true, simulation_label: SIM_LABEL,
    fees_status: 'PROPOSED — NOT APPROVED',
    interfaces: { rest_openapi: '/v1/openapi.json', a2a_agent_card: '/.well-known/agent-card.json', mcp: 'satelink-mcp (stdio; SATELINK_MCP_TASK_TOOLS=1)' },
    capabilities: caps.map((c) => ({ id: c.id, name: c.name, category: c.category, release_status: c.release_status, fee_policy_id: c.fee_policy_id,
      providers: c.providers.map((p) => ({ name: p.name, kind: p.kind })), input_schema: c.input_schema })),
  };
}

const RPC = (id, result) => ({ jsonrpc: '2.0', id, result });
const RPC_ERR = (id, code, message, data) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });
const UNSUPPORTED = new Set(['SendStreamingMessage', 'ListTasks', 'SubscribeToTask', 'CreateTaskPushNotificationConfig', 'GetTaskPushNotificationConfig',
  'ListTaskPushNotificationConfigs', 'DeleteTaskPushNotificationConfig', 'GetExtendedAgentCard']);

export function createA2aRouter(svc, { resolvePrincipal, publicBaseUrl, consoleOrigin }) {
  const r = express.Router();
  r.get('/.well-known/agent-card.json', async (_req, res) => { res.json(await agentCard(svc, { publicBaseUrl })); });
  r.get('/.well-known/satelink-capabilities.json', async (_req, res) => { res.json(await capabilitiesDocument(svc)); });

  r.post('/a2a/v1', express.json({ limit: '64kb' }), async (req, res) => {
    const body = req.body;
    const id = body && typeof body === 'object' ? body.id : null;
    if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') return res.json(RPC_ERR(id, -32600, 'Invalid Request'));
    const version = req.get('A2A-Version') ?? req.query['A2A-Version'] ?? '';
    // Spec: an empty value means 0.3, which this server does not implement.
    if (version !== PROTOCOL_VERSION) return res.json(RPC_ERR(id, -32009, 'Version not supported', { supported: [PROTOCOL_VERSION], received: version || '0.3' }));
    try {
      const p = await resolvePrincipal(req);
      if (!p?.id) return res.status(401).json(RPC_ERR(id, -32600, 'Unauthenticated: send Authorization: Bearer <slk_preview key>'));
      const need = (scope) => { if (p.via === 'api_key' && p.scopes && !p.scopes.includes(scope)) throw new TaskError('FORBIDDEN_SCOPE', `This key lacks the "${scope}" scope.`, { status: 403 }); };
      const params = body.params && typeof body.params === 'object' ? body.params : {};
      switch (body.method) {
        case 'SendMessage': {
          need('tasks:create');
          const m = params.message;
          if (!m || typeof m.messageId !== 'string' || m.role !== 'ROLE_USER' || !Array.isArray(m.parts)) return res.json(RPC_ERR(id, -32602, 'Invalid params: message.messageId, role ROLE_USER and parts are required'));
          const text = m.parts.filter((x) => typeof x?.text === 'string').map((x) => x.text).join('\n').trim();
          if (!text) return res.json(RPC_ERR(id, -32005, 'Content type not supported: send a text part'));
          if (m.taskId) {
            // Follow-up message on an existing task = the answer to its pending question.
            const t = await svc.getTask(p, m.taskId);
            if (t.state !== 'AWAITING_INPUT') return res.json(RPC_ERR(id, -32602, `Invalid params: task is ${a2aState(t.state)}, not waiting for input`));
            await svc.provideInput(p, m.taskId, { field: t.question.field, value: text });
            const next = await svc.getTask(p, m.taskId);
            if (next.state === 'AWAITING_APPROVAL') await svc.requestApproval(p, next.id, { channel: 'a2a' });
            return res.json(RPC(id, { task: toA2aTask(await svc.getTask(p, m.taskId), { consoleOrigin }) }));
          }
          // messageId is the client's idempotency key: a resent message returns the same task.
          const key = `a2a-${crypto.createHash('sha256').update(m.messageId).digest('hex').slice(0, 40)}`;
          const { task } = await svc.createTask(p, { text, idempotency_key: key, actor_type: 'agent' });
          if (task.state === 'AWAITING_APPROVAL') await svc.requestApproval(p, task.id, { channel: 'a2a' });
          return res.json(RPC(id, { task: toA2aTask(await svc.getTask(p, task.id), { consoleOrigin }) }));
        }
        case 'GetTask': {
          need('tasks:read');
          if (typeof params.id !== 'string') return res.json(RPC_ERR(id, -32602, 'Invalid params: id is required'));
          return res.json(RPC(id, toA2aTask(await svc.getTask(p, params.id), { consoleOrigin })));
        }
        case 'CancelTask': {
          need('tasks:create');
          if (typeof params.id !== 'string') return res.json(RPC_ERR(id, -32602, 'Invalid params: id is required'));
          try { await svc.cancel(p, params.id); } catch (e) {
            if (e?.code === 'ILLEGAL_TRANSITION') return res.json(RPC_ERR(id, -32002, 'Task not cancelable'));
            throw e;
          }
          return res.json(RPC(id, toA2aTask(await svc.getTask(p, params.id), { consoleOrigin })));
        }
        default:
          if (UNSUPPORTED.has(body.method)) return res.json(RPC_ERR(id, -32004, 'Unsupported operation'));
          return res.json(RPC_ERR(id, -32601, 'Method not found'));
      }
    } catch (e) {
      if (e?.code === 'NOT_FOUND') return res.json(RPC_ERR(id, -32001, 'Task not found'));
      if (e instanceof TaskError) return res.status(e.status === 401 || e.status === 403 || e.status === 429 ? e.status : 200).json(RPC_ERR(id, e.status === 400 ? -32602 : -32603, e.message, { code: e.code }));
      return res.json(RPC_ERR(id, -32603, 'Internal error'));
    }
  });
  return r;
}
