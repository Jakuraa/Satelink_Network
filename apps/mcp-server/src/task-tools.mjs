// apps/mcp-server/src/task-tools.mjs
// Release A (Slice S5): agent-commerce tools GENERATED FROM THE CAPABILITY REGISTRY of the Satelink task API
// (GET /v1/capabilities). The capability enum, descriptions and categories are read from the registry at
// tools/list time — nothing about a capability is hardcoded here (R9).
//
//   satelink_discover          registry search (read-only)
//   satelink_quote             creates a task run → plan + quote (nothing executes before approval)
//   satelink_request_approval  advances the run: records the agent's approval request; returns the console link
//   satelink_task_status       reads the run
//   satelink_receipt           reads the run's immutable receipt
//
// There is NO approve tool. Agent spend pre-authorization is $0: every spend is approved by a person in the
// console (the API enforces this too: HUMAN_APPROVAL_REQUIRED). Local preview only — the API base must be loopback.
// Supplier/model text inside results is untrusted data (R7); it is returned as JSON, never as instructions.

import { createHash } from 'node:crypto';

export const TASK_TOOL_NAMES = new Set(['satelink_discover', 'satelink_quote', 'satelink_request_approval', 'satelink_task_status', 'satelink_receipt']);
const RUN_ID = /^run_[0-9a-f]{8,64}$/;
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const SIM = 'SIMULATED — NO MONEY MOVED';

const keyFor = (tool, args) => {
  const { idempotency_key: _k, ...rest } = args || {};
  return `mcp-${createHash('sha256').update(`${tool}|${JSON.stringify(rest, Object.keys(rest).sort())}`).digest('hex').slice(0, 40)}`;
};

/** Tool definitions from registry entries (pure; unit-tested). */
export function taskToolDefs(capabilities) {
  const ids = capabilities.map((c) => c.id);
  const categories = [...new Set(capabilities.map((c) => c.category).filter(Boolean))].sort();
  const catalogue = capabilities.map((c) => `${c.id} — ${c.name} [${c.release_status}]`).join('; ');
  const runId = { type: 'string', pattern: RUN_ID.source, description: 'Task id returned by satelink_quote (run_…).' };
  return [
    { name: 'satelink_discover', description: `Search the Satelink capability registry. Read-only. Available now: ${catalogue}. Preview: ${SIM}.`,
      inputSchema: { type: 'object', additionalProperties: false, properties: {
        query: { type: 'string', maxLength: 200, description: 'Free text, e.g. "extract emails" or "buy an e-book".' },
        ...(categories.length ? { category: { type: 'string', enum: categories } } : {}) } } },
    { name: 'satelink_quote', description: 'Create a task for one registry capability and get its plan and quote. Nothing executes and nothing is charged until a person approves it in the Satelink console. Fees are PROPOSED — NOT APPROVED.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['capability_id', 'request'], properties: {
        capability_id: { type: 'string', enum: ids, description: 'Registry capability id (from satelink_discover).' },
        request: { type: 'string', minLength: 2, maxLength: 2000, description: 'What you need, in plain language, including the details the capability needs.' },
        idempotency_key: { type: 'string', pattern: '^[A-Za-z0-9._:-]{8,128}$', description: 'Optional. Same key → same task (safe retries). Default: derived from the arguments.' } } } },
    { name: 'satelink_request_approval', description: 'Ask the account owner to approve the quoted task. Agents cannot approve spend (pre-authorization $0); this returns the console link the person uses.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['task_id'], properties: { task_id: runId, note: { type: 'string', maxLength: 200 } } } },
    { name: 'satelink_task_status', description: 'Current state of a task: plan, quote, pending question, result and receipt id.',
      inputSchema: { type: 'object', additionalProperties: false, required: ['task_id'], properties: { task_id: runId } } },
    { name: 'satelink_receipt', description: `The immutable receipt of a finished task (${SIM}).`,
      inputSchema: { type: 'object', additionalProperties: false, required: ['task_id'], properties: { task_id: runId } } },
  ];
}

/** Compact, agent-facing task summary (labels kept). */
function summary(t, consoleUrl) {
  return {
    task_id: t.id, state: t.state, simulated: true, simulation_label: SIM,
    plan: (t.plan?.steps || []).map((s) => ({ capability_id: s.capability_id, provider: s.provider_name, item: s.offer?.title ?? null })),
    quote: t.quote ? { quote_id: t.quote.quote_id, version: t.quote.version, total_usd: t.quote.total_usd, from_credits_usd: t.quote.credit_charge_usd, fees: 'PROPOSED — NOT APPROVED' } : null,
    question: t.question, error: t.error, receipt_id: t.receipt_id, result: t.output ?? null,
    approval_requested: Boolean(t.approval_request),
    ...(t.state === 'AWAITING_APPROVAL' ? { approve_in_console: `${consoleUrl}/tasks/${t.id}` } : {}),
  };
}

/**
 * @param {object} o
 * @param {typeof fetch} o.fetch
 * @param {string} o.apiBase      loopback preview API, e.g. http://127.0.0.1:4500
 * @param {string|undefined} o.apiKey  slk_preview_… developer key (tasks:create, tasks:read, receipts:read)
 * @param {string} o.consoleUrl
 */
export function createTaskTools({ fetch: f, apiBase, apiKey, consoleUrl = 'http://localhost:3400', pollMs = 250, maxWaitMs = 15_000 }) {
  const base = new URL(apiBase);
  if (!LOOPBACK.has(base.hostname)) throw new Error('Release A task tools only talk to a loopback preview API (SATELINK_API_BASE).');
  let cache = { at: 0, caps: [] };

  async function call(method, path, body) {
    const headers = { Accept: 'application/json', 'User-Agent': 'satelink-mcp' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await f(`${base.origin}/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({ ok: false, error: { code: 'BAD_UPSTREAM', message: 'Non-JSON response.' } }));
    return { status: res.status, data };
  }
  const fail = (data) => ({ ok: false, error: data?.error?.code || 'ERROR', message: data?.error?.message || 'Request failed.' });
  async function capabilities() {
    if (Date.now() - cache.at < 30_000 && cache.caps.length) return cache.caps;
    const r = await call('GET', '/capabilities?q=');
    if (!r.data.ok) throw new Error('capability registry unavailable');
    cache = { at: Date.now(), caps: r.data.capabilities };
    return cache.caps;
  }
  async function getTask(id) { return call('GET', `/tasks/${id}`); }

  return {
    async list() { return taskToolDefs(await capabilities()); },
    async call(name, args = {}) {
      if (!apiKey && name !== 'satelink_discover') return { ok: false, error: 'api_key_required', message: 'Set SATELINK_API_KEY to a Satelink developer key (Developer Hub).' };
      switch (name) {
        case 'satelink_discover': {
          const qs = new URLSearchParams({ q: String(args.query || '').slice(0, 200) });
          const r = await call('GET', `/capabilities?${qs}`);
          if (!r.data.ok) return fail(r.data);
          const list = r.data.capabilities.filter((c) => !args.category || c.category === args.category);
          return { ok: true, result: { simulated: true, simulation_label: SIM, capabilities: list.map((c) => ({ id: c.id, name: c.name, description: c.description, category: c.category, release_status: c.release_status, fee_policy_id: c.fee_policy_id, providers: c.providers.map((p) => p.name), inputs: Object.keys(c.input_schema?.properties || {}) })) } };
        }
        case 'satelink_quote': {
          const ids = (await capabilities()).map((c) => c.id);
          if (!ids.includes(args.capability_id)) return { ok: false, error: 'unknown_capability', message: `capability_id must be one of: ${ids.join(', ')}` };
          const created = await call('POST', '/tasks', { text: String(args.request || ''), idempotency_key: args.idempotency_key || keyFor(name, args), actor_type: 'agent' });
          if (!created.data.ok) return fail(created.data);
          let t = created.data.task;
          for (let waited = 0; ['CREATED', 'UNDERSTANDING', 'PLANNING', 'QUOTED'].includes(t.state) && waited < maxWaitMs; waited += pollMs) {
            await new Promise((r) => setTimeout(r, pollMs));
            const g = await getTask(t.id); if (g.data.ok) t = g.data.task;
          }
          const planned = t.plan?.steps?.[0]?.capability_id;
          if (planned && planned !== args.capability_id) {
            await call('POST', `/tasks/${t.id}/cancel`, {});
            return { ok: false, error: 'capability_mismatch', message: `The request was planned as ${planned}, not ${args.capability_id}. The task was cancelled; nothing was charged. Rephrase the request.` };
          }
          return { ok: true, result: summary(t, consoleUrl), note: t.state === 'AWAITING_APPROVAL' ? 'Next: satelink_request_approval, then poll satelink_task_status until a person approves in the console.' : undefined };
        }
        case 'satelink_request_approval': {
          if (!RUN_ID.test(args.task_id || '')) return { ok: false, error: 'invalid_task_id' };
          const r = await call('POST', `/tasks/${args.task_id}/approval-request`, { channel: 'mcp', note: args.note });
          if (!r.data.ok) return fail(r.data);
          return { ok: true, result: { ...summary(r.data.task, consoleUrl), approval_requested: true, approve_in_console: `${consoleUrl}${r.data.approval_path}`,
            message: 'Approval requested. A person must approve this in the Satelink console; agents cannot approve spend (pre-authorization $0).' } };
        }
        case 'satelink_task_status': {
          if (!RUN_ID.test(args.task_id || '')) return { ok: false, error: 'invalid_task_id' };
          const r = await getTask(args.task_id);
          return r.data.ok ? { ok: true, result: summary(r.data.task, consoleUrl) } : fail(r.data);
        }
        case 'satelink_receipt': {
          if (!RUN_ID.test(args.task_id || '')) return { ok: false, error: 'invalid_task_id' };
          const t = await getTask(args.task_id);
          if (!t.data.ok) return fail(t.data);
          if (!t.data.task.receipt_id) return { ok: false, error: 'no_receipt_yet', message: `The task is ${t.data.task.state}; a receipt is issued when it finishes.` };
          const r = await call('GET', `/receipts/${t.data.task.receipt_id}`);
          return r.data.ok ? { ok: true, result: r.data.receipt } : fail(r.data);
        }
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    },
  };
}
