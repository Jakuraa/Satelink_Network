/**
 * Release A · Slice S5 — AI agent commerce: Satelink MCP tools generated from the registry, A2A v1.0 Agent Card +
 * JSON-RPC binding, agent spend pre-authorization $0 (every spend approved by a person). Real Postgres, the mock
 * "Demo Data API (MOCK)" as a separate process, the real HTTP routers and the official MCP SDK client.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freshMigratedDb } from './fresh-db.js';
import { Pool } from 'pg';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TaskService } from '../../apps/api/src/workflows/task_service.js';
import { CapabilityRegistry } from '../../apps/api/src/workflows/capability_registry.js';
import { createModelRouter } from '../../apps/api/src/workflows/model_router.js';
import { loadPricing } from '../../apps/api/src/workflows/pricing.js';
import { DeveloperKeys } from '../../apps/api/src/workflows/developer_keys.js';
import { createOpenApiDataConnector } from '../../apps/api/src/workflows/connectors/rest_openapi_driver.js';
import { createTasksRouter } from '../../apps/api/src/routes/tasks_route.js';
import { createA2aRouter } from '../../apps/api/src/routes/a2a_route.js';
import { PgDurableStore } from '../../apps/api/src/vnext/reliability/pg_durable_store.js';
import { PgRunStore } from '../../apps/api/src/workflows/run_store.js';
import { createSatelinkMcpServer } from '../../apps/mcp-server/src/server-factory.mjs';
import { createTaskTools, TASK_TOOL_NAMES } from '../../apps/mcp-server/src/task-tools.mjs';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const ROOT = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..', '..');
const PORT = 5700 + Math.floor(Math.random() * 250);
const DATA = `http://127.0.0.1:${PORT}`;
const U = { id: 'user:agent-owner', via: 'session' };
const EXTRACT = 'Extract the contacts from: renewal 2026-12-31, write to owner@example.com';
let db: Awaited<ReturnType<typeof freshMigratedDb>>; let pool: Pool; let mock: ChildProcess; let svc: Any; let keys: DeveloperKeys;
let server: Server; let BASE = ''; let agentKey = ''; let approverKey = ''; let approverKeyId = '';

beforeAll(async () => {
  db = await freshMigratedDb('s5agent', join(ROOT, 'database', 'migrations'));
  pool = new Pool({ connectionString: db.url, max: 8 });
  mock = spawn(process.execPath, [join(ROOT, 'tools', 'mock-data-api', 'server.mjs')], {
    env: { ...process.env, MOCK_DATA_PORT: String(PORT), MOCK_DATA_STATE: join(mkdtempSync(join(tmpdir(), 'data-')), 'jobs.json') }, stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${DATA}/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
  svc = await TaskService.create({
    pool, registry: new CapabilityRegistry(pool), router: createModelRouter({ env: {} }), pricing: loadPricing(),
    connectors: { rest_openapi_data: createOpenApiDataConnector({ baseUrl: DATA }) },
    workflowOptions: { store: new PgDurableStore(pool, { prefix: 'wf_' }), runStore: new PgRunStore(pool), env: {} },
  });
  keys = new DeveloperKeys({ pool });
  const resolvePrincipal = async (req: Any) => {
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') || '')?.[1] || '';
    if (bearer) { const k = await keys.authenticate(bearer); return k ? { id: k.principal, via: 'api_key', actor_type: 'developer', scopes: k.scopes, key_id: k.key_id, agent_spend_preauth_minor: k.agent_spend_preauth_minor } : null; }
    return req.get('X-Test-Session') === U.id ? U : null;
  };
  const app = express();
  await new Promise<void>((r) => { server = app.listen(0, '127.0.0.1', () => r()); });
  BASE = `http://127.0.0.1:${(server.address() as Any).port}`;
  app.use(createA2aRouter(svc, { resolvePrincipal, publicBaseUrl: BASE, consoleOrigin: 'http://localhost:3400' }));
  app.use('/v1', createTasksRouter(svc, { resolvePrincipal, developerKeys: keys }));
  agentKey = (await keys.create(U.id, { name: 'agent', scopes: ['tasks:create', 'tasks:read', 'receipts:read'] })).secret;
  const ak = await keys.create(U.id, { name: 'approver', scopes: ['tasks:create', 'tasks:read', 'tasks:approve', 'receipts:read'] });
  approverKey = ak.secret; approverKeyId = ak.key_id;
}, 180_000);
afterAll(async () => { server?.close(); mock?.kill(); await pool?.end(); await db?.stop(); });

const rpc = (method: string, params: Any, { key = agentKey, version = '1.0', id = 1 }: Any = {}): Promise<Any> =>
  fetch(`${BASE}/a2a/v1`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, ...(version ? { 'A2A-Version': version } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }).then((r) => r.json());
const userMsg = (text: string, messageId: string) => ({ message: { messageId, role: 'ROLE_USER', parts: [{ text }] } });
const sessionApprove = async (t: Any) => fetch(`${BASE}/v1/tasks/${t.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Test-Session': U.id, 'X-Satelink-Console': '1' }, body: JSON.stringify({ quote_id: t.quote.quote_id, quote_version: t.quote.version, idempotency_key: `ui-${t.id.slice(4, 20)}` }) });

describe('A2A v1.0 Agent Card (lf.a2a.v1.AgentCard, ProtoJSON)', () => {
  it('has every REQUIRED field, one JSONRPC 1.0 interface, skills from the registry, no faked signature', async () => {
    const card = await (await fetch(`${BASE}/.well-known/agent-card.json`)).json() as Any;
    for (const f of ['name', 'description', 'supportedInterfaces', 'version', 'capabilities', 'defaultInputModes', 'defaultOutputModes', 'skills']) expect(card, f).toHaveProperty(f);
    expect(card.supportedInterfaces).toEqual([{ url: `${BASE}/a2a/v1`, protocolBinding: 'JSONRPC', protocolVersion: '1.0' }]);
    expect(card.provider).toEqual({ organization: 'Jakuraa', url: 'https://satelink.network' });
    expect(card.securitySchemes.bearer.httpAuthSecurityScheme.scheme).toBe('Bearer');
    expect(card.securityRequirements).toEqual([{ schemes: { bearer: { list: [] } } }]);
    expect(card).not.toHaveProperty('signatures');
    const registry = (await svc.registry.search({ q: '', limit: 200 })).map((c: Any) => c.id).sort();
    expect(card.skills.map((s: Any) => s.id).sort()).toEqual(registry);
    for (const s of card.skills) { for (const f of ['id', 'name', 'description', 'tags']) expect(s[f], `${s.id}.${f}`).toBeTruthy(); expect(s.tags.length).toBeGreaterThan(0); }
    expect(JSON.stringify(card)).not.toMatch(/eulerpool|ai\.model\.inference/i);
    const caps = await (await fetch(`${BASE}/.well-known/satelink-capabilities.json`)).json() as Any;
    expect(caps.capabilities.map((c: Any) => c.id).sort()).toEqual(registry);
    expect(caps).toMatchObject({ simulated: true, fees_status: 'PROPOSED — NOT APPROVED' });
  });
});

describe('A2A JSON-RPC binding', () => {
  it('version, auth and method errors use the spec codes', async () => {
    expect((await rpc('GetTask', { id: 'run_00000000' }, { version: '' })).error.code).toBe(-32009);
    expect((await rpc('GetTask', { id: 'run_00000000' }, { version: '0.3' })).error.code).toBe(-32009);
    expect((await rpc('GetTask', { id: 'run_0000000000000000' })).error.code).toBe(-32001);
    expect((await rpc('ListTasks', {})).error.code).toBe(-32004);
    expect((await rpc('tasks/get', {})).error.code).toBe(-32601);
    expect((await rpc('SendMessage', { message: { messageId: 'm1', role: 'ROLE_AGENT', parts: [] } })).error.code).toBe(-32602);
    const unauth = await fetch(`${BASE}/a2a/v1`, { method: 'POST', headers: { 'content-type': 'application/json', 'A2A-Version': '1.0' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'GetTask', params: { id: 'x' } }) });
    expect(unauth.status).toBe(401);
  });

  it('SendMessage → task stops at TASK_STATE_AUTH_REQUIRED with the console link; resend is idempotent; agents cannot approve; a person can', async () => {
    const a = await rpc('SendMessage', userMsg(EXTRACT, 'msg-agent-0001'));
    const task = a.result.task;
    expect(task.status.state).toBe('TASK_STATE_AUTH_REQUIRED');
    expect(task.status.message).toMatchObject({ role: 'ROLE_AGENT', taskId: task.id });
    expect(task.status.message.parts[0].text).toContain(`http://localhost:3400/tasks/${task.id}`);
    expect(task.metadata).toMatchObject({ satelink_state: 'AWAITING_APPROVAL', simulated: true });
    expect((await rpc('SendMessage', userMsg(EXTRACT, 'msg-agent-0001'))).result.task.id).toBe(task.id);
    const view = await svc.getTask(U, task.id);
    expect(view.actor_type).toBe('agent');
    expect(view.approval_request).toMatchObject({ channel: 'a2a' });

    // Even a key WITH tasks:approve cannot approve an agent's spend: pre-authorization is $0.
    const body = JSON.stringify({ quote_id: view.quote.quote_id, quote_version: view.quote.version });
    const denied = await fetch(`${BASE}/v1/tasks/${task.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${approverKey}`, 'Idempotency-Key': 'agent-approve-01' }, body });
    expect(denied.status).toBe(403); expect(((await denied.json()) as Any).error.code).toBe('HUMAN_APPROVAL_REQUIRED');
    expect((await fetch(`${BASE}/v1/tasks/${task.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${agentKey}`, 'Idempotency-Key': 'agent-approve-02' }, body })).status).toBe(403);

    expect((await sessionApprove(view)).status).toBe(200);
    await svc.drain();
    const done = (await rpc('GetTask', { id: task.id })).result;
    expect(done.status.state).toBe('TASK_STATE_COMPLETED');
    const receiptPart = done.artifacts.find((x: Any) => x.name === 'receipt').parts[0].data;
    expect(receiptPart).toMatchObject({ simulated: true, simulation_label: 'SIMULATED — NO MONEY MOVED' });
    expect(done.artifacts.find((x: Any) => x.name === 'result').parts[0].data.result.emails).toEqual(['owner@example.com']);
    expect((await rpc('CancelTask', { id: task.id })).error.code).toBe(-32002);
  });

  it('a raised pre-authorization lets the key approve within it (and only then)', async () => {
    await pool.query('UPDATE developer_api_keys SET agent_spend_preauth_minor = 1000000 WHERE key_id = $1', [approverKeyId]);
    const t = (await rpc('SendMessage', userMsg('Extract the emails from: preauth@example.com', 'msg-agent-0002'), { key: approverKey })).result.task;
    const v = await svc.getTask(U, t.id);
    const ok = await fetch(`${BASE}/v1/tasks/${t.id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${approverKey}`, 'Idempotency-Key': 'agent-approve-03' }, body: JSON.stringify({ quote_id: v.quote.quote_id, quote_version: v.quote.version }) });
    expect(ok.status).toBe(200);
    await pool.query('UPDATE developer_api_keys SET agent_spend_preauth_minor = 0 WHERE key_id = $1', [approverKeyId]);
  });

  it('CancelTask before approval → TASK_STATE_CANCELED; another principal sees -32001', async () => {
    const t = (await rpc('SendMessage', userMsg('Extract the dates from: 2027-01-01', 'msg-agent-0003'))).result.task;
    const other = (await keys.create('user:someone-else', { name: 'x', scopes: ['tasks:read'] })).secret;
    expect((await rpc('GetTask', { id: t.id }, { key: other })).error.code).toBe(-32001);
    expect((await rpc('CancelTask', { id: t.id })).result.status.state).toBe('TASK_STATE_CANCELED');
  });
});

describe('Satelink MCP server (official SDK client) → task API', () => {
  it('initialize → tools/list (registry) → discover → quote → approval requested → human approves → receipt', async () => {
    const taskTools = createTaskTools({ fetch: globalThis.fetch, apiBase: BASE, apiKey: agentKey, consoleUrl: 'http://localhost:3400', pollMs: 50 });
    const mcp = createSatelinkMcpServer({ executeRpc: async () => ({ ok: false }), taskTools, rpcUrl: 'n/a', wallet: null, canPay: false });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 's5-agent', version: '1.0.0' });
    await Promise.all([mcp.connect(a), client.connect(b)]);
    expect(client.getServerVersion()).toMatchObject({ name: 'satelink-mcp', version: '2.2.0' });
    const tools = (await client.listTools()).tools;
    for (const n of TASK_TOOL_NAMES) expect(tools.map((t) => t.name)).toContain(n);
    const registry = (await svc.registry.search({ q: '', limit: 200 })).map((c: Any) => c.id).sort();
    expect([...(tools.find((t) => t.name === 'satelink_quote')!.inputSchema.properties as Any).capability_id.enum].sort()).toEqual(registry);
    const text = (r: Any) => JSON.parse(String(r.content[0].text).split('\n\n')[0]);

    const found = text(await client.callTool({ name: 'satelink_discover', arguments: { query: 'extract emails' } }));
    expect(found.capabilities[0].id).toBe('dev.data.extract');
    const q = text(await client.callTool({ name: 'satelink_quote', arguments: { capability_id: 'dev.data.extract', request: 'Extract the emails from: mcp-agent@example.com' } }));
    expect(q).toMatchObject({ state: 'AWAITING_APPROVAL', simulation_label: 'SIMULATED — NO MONEY MOVED' });
    expect(q.quote.fees).toBe('PROPOSED — NOT APPROVED');
    const runs = await pool.query('SELECT actor_type FROM workflow_runs WHERE run_id = $1', [q.task_id]);
    expect(runs.rows[0].actor_type).toBe('agent');
    const ar = text(await client.callTool({ name: 'satelink_request_approval', arguments: { task_id: q.task_id } }));
    expect(ar.approve_in_console).toBe(`http://localhost:3400/tasks/${q.task_id}`);
    expect((await svc.getTask(U, q.task_id)).approval_request).toMatchObject({ channel: 'mcp' });
    const early = await client.callTool({ name: 'satelink_receipt', arguments: { task_id: q.task_id } });
    expect(early.isError).toBe(true);

    expect((await sessionApprove(await svc.getTask(U, q.task_id))).status).toBe(200); // the person, in the console
    await svc.drain();
    expect(text(await client.callTool({ name: 'satelink_task_status', arguments: { task_id: q.task_id } }))).toMatchObject({ state: 'SUCCEEDED' });
    const receipt = text(await client.callTool({ name: 'satelink_receipt', arguments: { task_id: q.task_id } }));
    expect(receipt).toMatchObject({ outcome: 'succeeded', simulation_label: 'SIMULATED — NO MONEY MOVED', origin: 'simulated' });
    const { rows: [rev] } = await pool.query('SELECT COALESCE(SUM(revenue_minor), 0)::text AS r FROM revenue_truth');
    expect(rev.r).toBe('0');
  });
});
