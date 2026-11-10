// Release A task tools (S5): generated from the registry, no approve tool, loopback-only, human approval enforced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createSatelinkMcpServer } from '../src/server-factory.mjs';
import { createTaskTools, taskToolDefs, TASK_TOOL_NAMES } from '../src/task-tools.mjs';

const CAPS = [
  { id: 'dev.data.extract', name: 'Extract structured data', description: 'd', category: 'developer', release_status: 'SIMULATED', fee_policy_id: 'f', providers: [{ name: 'Demo Data API (MOCK)' }], input_schema: { properties: { source_text: {} } } },
  { id: 'shop.digital_goods.purchase', name: 'Buy a digital good', description: 'd', category: 'shopping', release_status: 'SIMULATED', fee_policy_id: 'f', providers: [{ name: 'Demo Digital Store (MOCK)' }], input_schema: { properties: {} } },
];
const RUN = 'run_0123456789abcdef01234567';

function fakeApi({ planned = 'dev.data.extract' } = {}) {
  const calls = [];
  const task = { id: RUN, state: 'AWAITING_APPROVAL', plan: { steps: [{ capability_id: planned, provider_name: 'P', offer: { title: 'x' } }] },
    quote: { quote_id: 'q_1', version: 1, total_usd: '0.004000', credit_charge_usd: '0.002000' }, receipt_id: null, approval_request: null };
  const f = async (url, init = {}) => {
    const u = new URL(url); const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method || 'GET', path: u.pathname + u.search, auth: init.headers?.Authorization, body });
    let out = { ok: true };
    if (u.pathname === '/v1/capabilities') out = { ok: true, capabilities: CAPS };
    else if (u.pathname === '/v1/tasks' && init.method === 'POST') out = { ok: true, task };
    else if (u.pathname.endsWith('/approval-request')) { task.approval_request = { channel: 'mcp' }; out = { ok: true, task, approval_path: `/tasks/${RUN}` }; }
    else if (u.pathname === `/v1/tasks/${RUN}`) out = { ok: true, task };
    return { status: 200, json: async () => out };
  };
  return { f, calls };
}

test('tool definitions are generated from the registry (ids, categories), five tools, no approve tool', () => {
  const defs = taskToolDefs(CAPS);
  assert.deepEqual(defs.map((d) => d.name).sort(), [...TASK_TOOL_NAMES].sort());
  assert.ok(!defs.some((d) => /approve$|^satelink_approve/.test(d.name)));
  const quote = defs.find((d) => d.name === 'satelink_quote');
  assert.deepEqual(quote.inputSchema.properties.capability_id.enum, CAPS.map((c) => c.id));
  assert.deepEqual(defs.find((d) => d.name === 'satelink_discover').inputSchema.properties.category.enum, ['developer', 'shopping']);
  assert.match(defs.find((d) => d.name === 'satelink_discover').description, /dev\.data\.extract/);
});

test('refuses a non-loopback API base (local preview only)', () => {
  assert.throws(() => createTaskTools({ fetch: async () => {}, apiBase: 'https://api.satelink.network', apiKey: 'k' }), /loopback/);
});

test('MCP: tools/list includes registry tools; quote creates an agent task with a derived idempotency key; approval request returns the console link', async () => {
  const { f, calls } = fakeApi();
  const taskTools = createTaskTools({ fetch: f, apiBase: 'http://127.0.0.1:4500', apiKey: 'slk_preview_test', consoleUrl: 'http://localhost:3400', pollMs: 1 });
  const server = createSatelinkMcpServer({ executeRpc: async () => ({ ok: true }), taskTools, rpcUrl: 'x', wallet: null, canPay: false });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 't', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  const names = (await client.listTools()).tools.map((t) => t.name);
  for (const n of TASK_TOOL_NAMES) assert.ok(names.includes(n), n);
  const args = { capability_id: 'dev.data.extract', request: 'Extract the emails from: a@b.co' };
  const q = await client.callTool({ name: 'satelink_quote', arguments: args });
  assert.equal(q.isError, false);
  const r = JSON.parse(q.content[0].text.split('\n\nNext:')[0]);
  assert.equal(r.state, 'AWAITING_APPROVAL'); assert.equal(r.quote.fees, 'PROPOSED — NOT APPROVED');
  assert.equal(r.approve_in_console, `http://localhost:3400/tasks/${RUN}`);
  const post = calls.find((c) => c.path === '/v1/tasks');
  assert.equal(post.body.actor_type, 'agent'); assert.match(post.body.idempotency_key, /^mcp-[0-9a-f]{40}$/); assert.equal(post.auth, 'Bearer slk_preview_test');
  await client.callTool({ name: 'satelink_quote', arguments: args });
  assert.equal(calls.filter((c) => c.path === '/v1/tasks').map((c) => c.body.idempotency_key).reduce((s, k) => s.add(k), new Set()).size, 1, 'retries replay');
  const ar = JSON.parse((await client.callTool({ name: 'satelink_request_approval', arguments: { task_id: RUN } })).content[0].text);
  assert.equal(ar.approval_requested, true); assert.match(ar.message, /pre-authorization \$0/);
  assert.ok(!calls.some((c) => c.path.endsWith('/approve')), 'the MCP server never calls approve');
  const bad = await client.callTool({ name: 'satelink_task_status', arguments: { task_id: '../../admin' } });
  assert.equal(bad.isError, true);
});

test('a request planned as a different capability is cancelled, not quoted', async () => {
  const { f, calls } = fakeApi({ planned: 'shop.digital_goods.purchase' });
  const t = createTaskTools({ fetch: f, apiBase: 'http://127.0.0.1:4500', apiKey: 'k', pollMs: 1 });
  const out = await t.call('satelink_quote', { capability_id: 'dev.data.extract', request: 'buy an e-book' });
  assert.equal(out.ok, false); assert.equal(out.error, 'capability_mismatch');
  assert.ok(calls.some((c) => c.path === `/v1/tasks/${RUN}/cancel`));
});

test('without a key only discovery works', async () => {
  const { f } = fakeApi();
  const t = createTaskTools({ fetch: f, apiBase: 'http://127.0.0.1:4500', apiKey: undefined });
  assert.equal((await t.call('satelink_quote', { capability_id: 'dev.data.extract', request: 'x y' })).error, 'api_key_required');
  assert.equal((await t.call('satelink_discover', { query: 'extract' })).ok, true);
});
