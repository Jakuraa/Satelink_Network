// Workflow tools (beta): opt-in listing, customer-key auth, spending cap on approval,
// derived idempotency keys, and a one-to-one manifest with apps/api/config.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { advertisedTools, createSatelinkMcpServer } from '../src/server-factory.mjs';
import { createWorkflowExecutor, derivedKey, WORKFLOW_TOOL_NAMES } from '../src/workflows.mjs';

const RUN = 'run_0123456789abcdef01234567';

function fakeApi(runs) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = new URL(url); const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, path: u.pathname + u.search, key: init.headers['X-API-Key'], body });
    let out = { ok: true };
    if (u.pathname.endsWith(`/workflows/runs/${RUN}`)) out = { ok: true, run: runs[RUN] };
    else if (u.pathname.endsWith('/approve')) { runs[RUN].status = 'completed'; out = { ok: true, run: runs[RUN] }; }
    else if (u.pathname.endsWith('/workflows/runs') && init.method === 'POST') out = { ok: true, run: { id: RUN, status: 'awaiting_approval' } };
    else if (u.pathname.endsWith('/marketplace/capabilities')) out = { ok: true, capabilities: [{ id: 'wallet.balance' }] };
    return { status: 200, json: async () => out };
  };
  return { f, calls };
}

test('workflow tools are listed only on explicit opt-in', () => {
  assert.equal(advertisedTools({ includeInternal: false, includeWorkflows: false }).some((t) => WORKFLOW_TOOL_NAMES.has(t.name)), false);
  const names = advertisedTools({ includeInternal: false, includeWorkflows: true }).map((t) => t.name);
  for (const n of WORKFLOW_TOOL_NAMES) assert.ok(names.includes(n), n);
});

test('the MCP manifest is identical to the API copy the console shows', () => {
  const a = readFileSync(new URL('../src/workflow-tools.json', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../../api/config/mcp_workflow_tools.v1.json', import.meta.url), 'utf8');
  assert.equal(a, b);
});

test('customer-scoped calls carry the API key; without one, mutating tools refuse', async () => {
  const { f, calls } = fakeApi({});
  const noKey = createWorkflowExecutor({ fetch: f, apiBase: 'https://api.test' });
  assert.equal((await noKey('request_capability_purchase', { capability: 'wallet.balance', network: 'polygon', address: '0x' + '1'.repeat(40), budget_usd: '0.01' })).error, 'api_key_required');
  assert.equal(calls.length, 0);
  const ex = createWorkflowExecutor({ fetch: f, apiBase: 'https://api.test', apiKey: 'sk_fx_customer' });
  await ex('list_capabilities', { query: 'balance' });
  assert.equal(calls[0].key, 'sk_fx_customer');
});

test('a retried purchase request reuses one derived idempotency key', async () => {
  const { f, calls } = fakeApi({});
  const ex = createWorkflowExecutor({ fetch: f, apiBase: 'https://api.test', apiKey: 'sk_fx_customer' });
  const args = { capability: 'wallet.balance', network: 'polygon', address: '0x' + '1'.repeat(40), budget_usd: '0.01' };
  await ex('request_capability_purchase', args); await ex('request_capability_purchase', { ...args });
  assert.equal(calls[0].body.idempotency_key, calls[1].body.idempotency_key);
  assert.equal(calls[0].body.idempotency_key, derivedKey('request_capability_purchase', args));
});

test('approve_purchase respects the auto-approve cap; above it the agent is sent to the console', async () => {
  const runs = { [RUN]: { id: RUN, status: 'awaiting_approval', quote: { customer_charge_usd: '0.02' } } };
  const { f, calls } = fakeApi(runs);
  const capped = createWorkflowExecutor({ fetch: f, apiBase: 'https://api.test', apiKey: 'sk_fx_customer', autoApproveMaxUsd: '0.01' });
  const refused = await capped('approve_purchase', { run_id: RUN });
  assert.equal(refused.error, 'approval_required_in_console');
  assert.ok(!calls.some((c) => c.path.endsWith('/approve')));
  const allowed = createWorkflowExecutor({ fetch: f, apiBase: 'https://api.test', apiKey: 'sk_fx_customer', autoApproveMaxUsd: '0.05' });
  const ok = await allowed('approve_purchase', { run_id: RUN });
  assert.equal(ok.ok, true);
  assert.equal(ok.result.status, 'completed');
});

test('end to end over MCP: tools/list and a tools/call reach the workflow API', async () => {
  const { f, calls } = fakeApi({});
  const server = createSatelinkMcpServer({
    executeRpc: async () => ({ ok: true, result: null }), rpcUrl: 'x', wallet: null, canPay: false, includeInternal: false, includeWorkflows: true,
    executeWorkflowTool: createWorkflowExecutor({ fetch: f, apiBase: 'https://api.test', apiKey: 'sk_fx_customer' }),
  });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: 't', version: '1' });
  await client.connect(ct);
  const { tools } = await client.listTools();
  assert.ok(tools.some((t) => t.name === 'list_capabilities'));
  const r = await client.callTool({ name: 'list_capabilities', arguments: { query: 'balance' } });
  assert.equal(r.isError, false);
  assert.match(r.content[0].text, /wallet\.balance/);
  assert.ok(calls.some((c) => c.path.startsWith('/v1/marketplace/capabilities')));
  await client.close();
});
