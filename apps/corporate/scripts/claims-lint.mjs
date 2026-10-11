#!/usr/bin/env node
// Phase 7 — claims lint for jakuraa.com. Same PUBLIC-tier rules as satelink.network
// (apps/web/scripts/claims-lint.mjs): no investment, return, partnership or availability claims.
// Usage: node scripts/claims-lint.mjs   (exit 1 on any finding)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lintPublicSource } from "../../web/scripts/claims-lint.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CORPORATE_SCOPE = ["app", "components", "content"];

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(tsx?|md)$/.test(f)) out.push(f);
  }
  return out;
}

export function lintCorporate(root = ROOT) {
  const files = CORPORATE_SCOPE.flatMap((d) => walk(join(root, d))).map((f) => relative(root, f));
  // Approved disclaimer sentences are exempt word for word (same mechanism as apps/web).
  const exempt = Object.values(JSON.parse(readFileSync(join(root, "content/disclaimers.json"), "utf8")));
  return { files, findings: files.flatMap((f) => lintPublicSource(f, readFileSync(join(root, f), "utf8"), exempt)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, findings } = lintCorporate();
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.rule}  "${f.match}"`);
  console.log(`claims-lint (jakuraa.com): ${files.length} files, ${findings.length} finding(s)`);
  process.exit(findings.length ? 1 : 0);
}
