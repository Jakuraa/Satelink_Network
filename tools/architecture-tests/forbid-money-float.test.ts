/**
 * Source-level enforcement of decision S-4: money is integer micro/minor units (bigint), never a
 * float. No float arithmetic in the money modules below — no parseFloat, toFixed, Math rounding,
 * decimal or exponent float literals, Number.EPSILON. (Number(...) on timestamps and counts stays
 * legal: it is a conversion, not arithmetic on money.)
 *
 * A source scan, like forbid-database-url: float arithmetic is not an import, so no
 * dependency-cruiser rule can see it. Tripwire-verified below so the guard is known to fire.
 * Comments are stripped before scanning; test files are out of scope (they may build fixtures).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../..');

/** The money modules. Add a path here when a new module handles amounts. */
export const MONEY_MODULE_ROOTS = [
  'libs/kernel/src',
  'libs/financial-domain/src',
  'services/financial/src',
  'services/sie/src/contract/cost.ts',
];

const FIXTURE_DIR = join(REPO_ROOT, 'libs/financial-domain/src/__money_float_fixture__');

const RULES: readonly { name: string; re: RegExp }[] = [
  { name: 'parseFloat', re: /\bparseFloat\s*\(/ },
  { name: 'toFixed', re: /\.toFixed\s*\(/ },
  { name: 'Math rounding', re: /\bMath\.(round|floor|ceil|trunc|fround)\s*\(/ },
  { name: 'decimal float literal', re: /(?<![\w.$])\d+\.\d+(?:[eE][+-]?\d+)?(?![\w.])/ },
  { name: 'exponent float literal', re: /(?<![\w.$])\d+[eE][+-]?\d+(?![\w.n])/ },
  { name: 'Number.EPSILON', re: /\bNumber\.EPSILON\b/ },
];

const isTest = (f: string) => /\.(test|spec)\.ts$/.test(f) || f.includes('/__tests__/');

function collect(path: string, out: string[] = []): string[] {
  const abs = join(REPO_ROOT, path);
  if (!existsSync(abs)) return out;
  if (statSync(abs).isFile()) { if (abs.endsWith('.ts') && !isTest(abs)) out.push(abs); return out; }
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    collect(join(path, e.name), out);
  }
  return out;
}

/** Remove block and line comments, keeping line numbers. Strings are kept (a float in a string used as a number would still be a smell). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\])\/\/.*$/gm, (_m, p: string) => p);
}

export function findViolations(files: readonly string[]): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const lines = stripComments(readFileSync(f, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      for (const r of RULES) if (r.re.test(line)) hits.push(`${relative(REPO_ROOT, f)}:${i + 1} ${r.name}: ${line.trim()}`);
    });
  }
  return hits;
}

describe('S-4: no float arithmetic in money modules', () => {
  afterEach(() => { rmSync(FIXTURE_DIR, { recursive: true, force: true }); });

  it('the money modules contain no float arithmetic', () => {
    const files = MONEY_MODULE_ROOTS.flatMap((p) => collect(p));
    expect(files.length).toBeGreaterThan(20); // the roots exist and are scanned
    expect(findViolations(files)).toEqual([]);
  });

  it('tripwire: each rule fires on a planted violation (and comments / bigint / integers do not)', () => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    const planted: Record<string, string> = {
      'parseFloat': 'export const a = parseFloat("1.5");',
      'toFixed': 'export const b = (3).toFixed(2);',
      'Math rounding': 'export const c = Math.round(7 / 2);',
      'decimal float literal': 'export const d = amount * 0.97;',
      'exponent float literal': 'export const e = usd * 1e6;',
      'Number.EPSILON': 'export const f = Number.EPSILON;',
    };
    for (const [rule, code] of Object.entries(planted)) {
      const f = join(FIXTURE_DIR, `${rule.replace(/\W+/g, '_')}.ts`);
      writeFileSync(f, `${code}\n`);
      const hits = findViolations([f]);
      expect(hits.some((h) => h.includes(rule)), rule).toBe(true);
    }
    const clean = join(FIXTURE_DIR, 'clean.ts');
    writeFileSync(clean, [
      '// 0.97 in a comment is fine; Math.round in a comment is fine',
      '/* parseFloat in a block comment */',
      'export const g = 10n ** 6n;',
      'export const h = 1_000_000n * 30n;',
      'export const i = Number(row.created_at) * 1000;',
      'export const j = obj.v1.v2;',
    ].join('\n'));
    expect(findViolations([clean])).toEqual([]);
  });
});
