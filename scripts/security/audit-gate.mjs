#!/usr/bin/env node
// Release A P4 — dependency audit gate. Runs `npm audit --omit=dev --json` and FAILS on any high/critical advisory
// that is not in the committed baseline (docs/build/evidence/npm-audit-baseline.json). Existing advisories are
// founder actions (OB-14): they are printed every run so they stay visible, and removing one from the tree simply
// shrinks the report. Usage: node scripts/security/audit-gate.mjs [--write-baseline]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const BASELINE = join(ROOT, 'docs', 'build', 'evidence', 'npm-audit-baseline.json');
let raw;
try { raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { raw = e.stdout; } // npm exits 1 when advisories exist
const audit = JSON.parse(raw);
const found = new Map();
for (const v of Object.values(audit.vulnerabilities || {})) {
  for (const x of v.via || []) if (typeof x === 'object' && ['high', 'critical'].includes(x.severity)) found.set(x.url, { package: x.name, severity: x.severity, range: x.range, title: x.title });
}
if (process.argv.includes('--write-baseline')) {
  writeFileSync(BASELINE, JSON.stringify({ note: 'High/critical production advisories present when the Release A gate was introduced. Founder action OB-14: remediate; never add entries to hide new ones.', generated_at: new Date().toISOString(), advisories: Object.fromEntries([...found].sort()) }, null, 2) + '\n');
  console.log(`baseline written: ${found.size} advisories`);
  process.exit(0);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8')).advisories;
const fresh = [...found].filter(([url]) => !base[url]);
const still = [...found].filter(([url]) => base[url]);
const crit = still.filter(([, a]) => a.severity === 'critical');
console.log(`npm audit (production deps): ${found.size} high/critical — ${still.length} known (OB-14), ${fresh.length} NEW; fixed since baseline: ${Object.keys(base).length - still.length}`);
for (const [url, a] of crit) console.log(`  KNOWN CRITICAL ${a.package} ${a.range} — ${a.title} ${url}`);
for (const [url, a] of fresh) console.log(`  NEW ${a.severity.toUpperCase()} ${a.package} ${a.range} — ${a.title} ${url}`);
process.exit(fresh.length ? 1 : 0);
