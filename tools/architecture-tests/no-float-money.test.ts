/**
 * R4 "no float money" — source-level rule for the Release A money path (task engine, simulated ledger, pricing,
 * connectors, task/A2A/x402 routes, MCP task tools, local mocks). Money is integer minor units (BigInt or integer
 * strings); floats, toFixed and Number() on money values are forbidden.
 *
 * Tripwire-verified (like forbid-database-url): a fixture with each forbidden pattern must be caught, so a rule that
 * never fires is not mistaken for one that works. A line may opt out only with `// money-ok: <reason>`.
 * Files listed in ALLOWLIST are known tech debt (STATUS_MATRIX) and must shrink, never grow.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const SCOPE = [
  'apps/api/src/workflows', 'apps/api/src/routes/tasks_route.js', 'apps/api/src/routes/a2a_route.js', 'apps/api/src/routes/x402_preview_route.js',
  'apps/mcp-server/src/task-tools.mjs', 'tools/mock-data-api', 'tools/mock-x402-facilitator', 'tools/mock-food-mcp', 'tools/mock-digital-store',
];
// Known debt from #609 (pre-Release A); listed in STATUS_MATRIX "Release A tech debt". Do not add files.
const ALLOWLIST = new Set(['apps/api/src/workflows/supplier_catalog.js', 'apps/api/src/workflows/workload_adapters.js']);
const MONEY = '(?:minor|micros?|amount|price|usd|cost|fee|credit|charge|total|balance)';
const RULES: [string, RegExp][] = [
  ['parseFloat', /\bparseFloat\s*\(/],
  ['toFixed', /\.toFixed\s*\(/],
  ['Number() on a money value', new RegExp(`\\bNumber\\s*\\([^)]*${MONEY}`, 'i')],
  ['float rounding of money', new RegExp(`Math\\.(?:round|floor|ceil)\\s*\\([^)]*${MONEY}`, 'i')],
  ['decimal scaling of money', new RegExp(`${MONEY}\\w*\\s*[*/]\\s*(?:1e[2-9]|100(?:0{1,6})?)\\b`, 'i')],
];

function files(p: string): string[] {
  const abs = join(ROOT, p);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).flatMap((d) => d.name === 'node_modules' || d.name.startsWith('__') ? [] : d.isDirectory() ? files(join(p, d.name)) : /\.(m?js|ts)$/.test(d.name) && !/\.test\./.test(d.name) ? [join(abs, d.name)] : []);
}
function offenders(paths: string[]) {
  const out: string[] = [];
  for (const f of paths) {
    const rel = relative(ROOT, f);
    if (ALLOWLIST.has(rel)) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (/money-ok:/.test(line)) return;
      for (const [name, re] of RULES) if (re.test(code)) out.push(`${rel}:${i + 1} ${name}: ${line.trim().slice(0, 120)}`);
    });
  }
  return out;
}

const FIXTURE = join(ROOT, 'tools/architecture-tests/__float_money_fixture__');
afterEach(() => rmSync(FIXTURE, { recursive: true, force: true }));

describe('R4: no float money on the Release A money path', () => {
  it('scans a non-empty scope and finds no float money', () => {
    const all = SCOPE.flatMap(files);
    expect(all.length).toBeGreaterThan(20);
    const bad = offenders(all);
    expect(bad, `float money (use BigInt minor units; opt out only with // money-ok: <reason>):\n${bad.join('\n')}`).toEqual([]);
  });

  it('tripwire: every rule fires on a fixture', () => {
    mkdirSync(FIXTURE, { recursive: true });
    const f = join(FIXTURE, 'bad.js');
    writeFileSync(f, ['const a = parseFloat(x);', 'const b = price.toFixed(2);', 'const c = Number(quote.total_minor);', 'const d = Math.round(amount * 1.1);', 'const e = cost_usd * 100;', 'const ok = Number(qty); // fine', 'const z = Number(total_minor); // money-ok: test'].join('\n'));
    const hits = offenders([f]).map((h) => h.split(' ')[1]);
    expect(hits.length).toBe(5);
  });
});
