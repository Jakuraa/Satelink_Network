/**
 * Release A AC5 — ONE engine (R1). The six journeys reach the same task engine by different doors; none has its own.
 * Walks the preview server's import graph and requires: exactly one TaskService built, by the preview entry point only;
 * surfaces (task/A2A/x402 routes), connectors and the MCP tools never write engine or ledger tables and never build an
 * engine; every journey's connector is registered on that one service. Tripwire-verified.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const ENTRY = join(ROOT, 'apps/api/scripts/preview_release_a.mjs');
const SURFACES = [/^apps\/api\/src\/routes\//, /^apps\/api\/src\/workflows\/connectors\//, /^apps\/api\/src\/workflows\/mock_store_connector\.js$/, /^apps\/mcp-server\/src\/task-tools\.mjs$/];
const ENGINE_WRITE = /\b(INSERT INTO|UPDATE|DELETE FROM)\s+(workflow_|ledger_|wf_|accounts\b)/i;
const ENGINE_BUILD = /\bnew\s+(TaskService|DurableKernel|RoutingKernel|WorkflowService|SimLedger)\b|\b(TaskService|WorkflowService)\.create\s*\(/;

function reachable(entry: string): string[] {
  const seen = new Set<string>(); const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!; if (seen.has(f)) continue; seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:import|export)[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const p = resolve(dirname(f), m[1] || m[2]); if (existsSync(p)) stack.push(p);
    }
  }
  return [...seen];
}
const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
function offenders(files: string[], root = ROOT) {
  const out: string[] = [];
  for (const f of files) {
    const rel = relative(root, f);
    if (!SURFACES.some((re) => re.test(rel))) continue;
    const src = code(f);
    if (ENGINE_WRITE.test(src)) out.push(`${rel}: writes engine/ledger tables`);
    if (ENGINE_BUILD.test(src)) out.push(`${rel}: builds an engine`);
  }
  return out;
}

const FIXTURE = join(ROOT, 'apps/api/src/routes/__one_engine_fixture__.js');
afterEach(() => rmSync(FIXTURE, { force: true }));

describe('AC5: one engine for all six journeys', () => {
  const files = reachable(ENTRY);
  const rels = files.map((f) => relative(ROOT, f));

  it('the preview builds exactly one TaskService and mounts every surface on it', () => {
    const entry = code(ENTRY);
    expect(entry.match(/TaskService\.create\s*\(/g)).toHaveLength(1);
    expect(entry.match(/WorkflowService\.create\s*\(|new DurableKernel\b/g)).toBeNull();
    for (const mount of ['createTasksRouter(svc', 'createA2aRouter(svc', 'createX402PreviewRouter(svc']) expect(entry, mount).toContain(mount);
    for (const r of ['apps/api/src/routes/tasks_route.js', 'apps/api/src/routes/a2a_route.js', 'apps/api/src/routes/x402_preview_route.js']) expect(rels).toContain(r);
  });

  it('every journey has its connector on that one service (S1, S2, S3, S4–S6)', () => {
    const entry = code(ENTRY);
    const block = /connectors:\s*\{([\s\S]*?)\n\s*\},/.exec(entry)?.[1] ?? '';
    for (const c of ['mock_store:', 'mcp_food:', 'trading_engine:', 'rest_openapi_data:']) expect(block, c).toContain(c);
  });

  it('only TaskService builds the workflow engine', () => {
    const builders = files.filter((f) => /\bWorkflowService\.create\s*\(/.test(code(f))).map((f) => relative(ROOT, f));
    expect(builders).toEqual(['apps/api/src/workflows/task_service.js']);
  });

  it('no surface or connector writes engine/ledger tables or builds an engine', () => {
    const scoped = [...files, join(ROOT, 'apps/mcp-server/src/task-tools.mjs')];
    expect(offenders(scoped)).toEqual([]);
  });

  it('tripwire: a route that writes the ledger or builds an engine is caught', () => {
    mkdirSync(dirname(FIXTURE), { recursive: true });
    writeFileSync(FIXTURE, "const a = () => pool.query('INSERT INTO ledger_entries VALUES (1)');\nconst b = new TaskService({});\n");
    expect(offenders([FIXTURE])).toHaveLength(2);
  });
});
