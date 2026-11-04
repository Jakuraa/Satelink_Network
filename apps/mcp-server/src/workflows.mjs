// apps/mcp-server/src/workflows.mjs
// Workflow tools (beta): a thin client of the Satelink workflows API
// (/v1/marketplace, /v1/strategy-lab, /v1/workflows). No business logic lives here —
// pricing, supplier selection, approval state, idempotency, tenant scoping and the
// audit journal are all the API's. This file only adds the agent-side spending cap.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const WORKFLOW_TOOLS = JSON.parse(readFileSync(new URL('./workflow-tools.json', import.meta.url), 'utf8'));
export const WORKFLOW_TOOL_NAMES = new Set(WORKFLOW_TOOLS.tools.map((t) => t.name));

/** Tool definitions as MCP advertises them. */
export function workflowToolDefs() {
  return WORKFLOW_TOOLS.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

const RUN_ID = /^run_[0-9a-f]{8,64}$/;

/** Stable key from the tool name + arguments, so a retried tool call is a replay. */
export function derivedKey(tool, args) {
  const { idempotency_key: _k, ...rest } = args || {};
  const sorted = JSON.stringify(rest, Object.keys(rest).sort());
  return `mcp_${createHash('sha256').update(`${tool}|${sorted}`).digest('hex').slice(0, 32)}`;
}

/** "0.01" → 10000 micro-USD; null when not a plain non-negative decimal. */
function micros(s) {
  if (typeof s !== 'string' || !/^\d+(\.\d{1,6})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return BigInt(w) * 1_000_000n + BigInt((f + '000000').slice(0, 6));
}

/**
 * @param {object} o
 * @param {typeof fetch} o.fetch
 * @param {string} o.apiBase       e.g. https://api.satelink.network
 * @param {string|undefined} o.apiKey
 * @param {string} [o.autoApproveMaxUsd]  default '0'
 * @param {string} [o.consoleUrl]
 */
export function createWorkflowExecutor({ fetch: f, apiBase, apiKey, autoApproveMaxUsd = '0', consoleUrl = 'https://console.satelink.network' }) {
  const cap = micros(autoApproveMaxUsd) ?? 0n;

  async function call(method, path, body) {
    const headers = { Accept: 'application/json', 'User-Agent': 'satelink-mcp' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await f(`${apiBase}/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({ ok: false, error: 'non_json_response' }));
    return { status: res.status, data };
  }

  const needsKey = () => ({ ok: false, error: 'api_key_required', message: 'Set SATELINK_API_KEY to a Satelink API key to use workflow tools.' });

  return async function executeWorkflowTool(name, args = {}) {
    switch (name) {
      case 'list_capabilities': {
        const qs = new URLSearchParams();
        if (args.query) qs.set('q', String(args.query).slice(0, 120));
        if (args.network) qs.set('network', String(args.network).slice(0, 64));
        const r = await call('GET', `/marketplace/capabilities${qs.size ? `?${qs}` : ''}`);
        return r.data.ok ? { ok: true, result: r.data.capabilities } : { ok: false, ...r.data };
      }
      case 'quote_capability': {
        const r = await call('POST', '/marketplace/quote', { capability: args.capability, network: args.network });
        return r.data.ok ? { ok: true, result: r.data.quote } : { ok: false, ...r.data };
      }
      case 'compile_strategy': {
        const r = await call('POST', '/strategy-lab/compile', { prompt: args.prompt, answers: args.answers || {} });
        return { ok: r.status < 500, result: r.data };
      }
      case 'request_capability_purchase': {
        if (!apiKey) return needsKey();
        const r = await call('POST', '/workflows/runs', {
          template: 'procurement.capability_call.v1',
          input: { capability: args.capability, network: args.network, address: args.address },
          budget_usd: args.budget_usd,
          idempotency_key: args.idempotency_key || derivedKey(name, args),
        });
        return r.data.ok ? { ok: true, result: r.data.run } : { ok: false, ...r.data };
      }
      case 'approve_purchase': {
        if (!apiKey) return needsKey();
        if (!RUN_ID.test(args.run_id || '')) return { ok: false, error: 'invalid_run_id' };
        const cur = await call('GET', `/workflows/runs/${args.run_id}`);
        if (!cur.data.ok) return { ok: false, ...cur.data };
        const run = cur.data.run;
        if (run.status !== 'awaiting_approval') return { ok: true, result: run, note: `Run is ${run.status}; nothing to approve.` };
        const charge = micros(run.quote?.customer_charge_usd ?? '');
        if (charge === null || charge > cap) {
          return {
            ok: false, error: 'approval_required_in_console',
            message: `This purchase (${run.quote?.customer_charge_usd ?? '?'} USD) exceeds the agent auto-approve limit (${autoApproveMaxUsd} USD). Approve it in the console: ${consoleUrl}/workflows/${run.id}`,
          };
        }
        const r = await call('POST', `/workflows/runs/${args.run_id}/approve`, {});
        return r.data.ok ? { ok: true, result: r.data.run } : { ok: false, ...r.data };
      }
      case 'run_backtest': {
        if (!apiKey) return needsKey();
        const input = args.spec ? { spec: args.spec } : { prompt: args.prompt, answers: args.answers || {} };
        const r = await call('POST', '/workflows/runs', { template: 'strategy_lab.backtest.v1', input, idempotency_key: args.idempotency_key || derivedKey(name, args) });
        return r.data.ok ? { ok: true, result: r.data.run } : { ok: false, ...r.data };
      }
      case 'get_run': {
        if (!apiKey) return needsKey();
        if (!RUN_ID.test(args.run_id || '')) return { ok: false, error: 'invalid_run_id' };
        const r = await call('GET', `/workflows/runs/${args.run_id}`);
        return r.data.ok ? { ok: true, result: r.data.run } : { ok: false, ...r.data };
      }
      case 'list_runs': {
        if (!apiKey) return needsKey();
        const limit = Math.min(Math.max(Number.parseInt(args.limit, 10) || 20, 1), 200);
        const r = await call('GET', `/workflows/runs?limit=${limit}`);
        return r.data.ok ? { ok: true, result: r.data.runs } : { ok: false, ...r.data };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };
}
