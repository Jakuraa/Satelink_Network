#!/usr/bin/env node
// Staged-file secret scan used by scripts/pre-commit-gate.sh.
//
// Same patterns the gate always blocked (PEM private keys, `private_key`,
// Stripe-style live/test keys), with ONE narrow allowlist entry: a key prefix
// immediately followed by mask characters ("•", "…", "*", "...") is a display
// placeholder (e.g. the masked key in apps/web console docs), not a key.
// Every occurrence on a line is checked on its own, so a placeholder cannot
// hide a real key on the same line. Tests: scripts/security/secret_scan.test.mjs.
//
// Patterns are written so this file does not match itself.
import { execFileSync } from 'node:child_process';

const KEY_PREFIX = /sk_(?:live|test)_/g;
const MASKED_AFTER_PREFIX = /^(?:[•…*]|\.\.\.)/;
const ALWAYS_BLOCK = [/PRIVATE[ ]KEY/, /private[_]key/];

/** @returns {{line: number, reason: string}[]} findings for one file's text */
export function findSecrets(text) {
  const findings = [];
  text.split('\n').forEach((line, i) => {
    for (const re of ALWAYS_BLOCK) {
      if (re.test(line)) findings.push({ line: i + 1, reason: `matches ${re.source}` });
    }
    for (const m of line.matchAll(KEY_PREFIX)) {
      const rest = line.slice(m.index + m[0].length);
      if (!MASKED_AFTER_PREFIX.test(rest)) findings.push({ line: i + 1, reason: 'API key prefix not followed by a mask' });
    }
  });
  return findings;
}

// CLI: node secret_scan.mjs <staged paths...> — scans the STAGED blob of each path.
if (import.meta.url === `file://${process.argv[1]}`) {
  let blocked = false;
  for (const path of process.argv.slice(2)) {
    let text;
    try { text = execFileSync('git', ['show', `:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch { continue; }
    for (const f of findSecrets(text)) {
      console.log(`${path}:${f.line}: ${f.reason}`); // location only, never the matched value
      blocked = true;
    }
  }
  process.exit(blocked ? 1 : 0);
}
