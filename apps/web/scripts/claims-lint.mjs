#!/usr/bin/env node
// Stage 26 — claims lint for the Trading Agent public pages (honest positioning).
// Scans rendered copy (pages, components, copy module) with comments, imports and class names
// removed, and the approved disclaimer sentences (src/lib/trading-agent/disclaimers.json)
// exempted word for word. Fails on:
//   PARTNERSHIP / APPROVAL  — partner, affiliated, endorsed, approved by, certified, licensed, regulated, official, backed by, trusted by …
//   PERFORMANCE / GUARANTEE — returns, profit, gains, earn, income, yield, win rate, beat the market, alpha, guarantee, risk-free …
//   AVAILABILITY            — available now, start trading, trade now, sign up to trade, live trading is on …
//   AI OVERCLAIM            — predicts the market, never wrong, autonomous trading, fully automated, AI-powered profits …
//   UNLABELLED NUMBERS      — a % figure or a currency amount outside a <Hypothetical> block
//   LEGAL WITHOUT REVIEW    — a legal placeholder that is not marked RPrC
// Two tiers (Phase 7):
//   STRICT — the Trading AI pages and the homepage: every rule above, numbers must be <Hypothetical>.
//   PUBLIC — every other public page, docs, markdown content and copy module: financial-claim rules
//            only (published list prices of the legacy RPC product are factual and allowed).
// Usage: node scripts/claims-lint.mjs   (exit 1 on any finding)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SCOPE = ["src/app/(marketing)/trading-agent", "src/components/trading-agent", "src/lib/trading-agent", "src/app/(marketing)/page.tsx", "src/components/home"];
export const PUBLIC_SCOPE = ["src/app/(marketing)", "src/app/docs", "src/content", "src/components", "src/lib"];
// Not rendered copy (tests, server-side data access, generated fixtures).
const PUBLIC_IGNORE = [/\.test\.tsx?$/, /\/__tests__\//, /^src\/lib\/task-orders\//, /^src\/lib\/dodo\//];

export const RULES = [
  ["PARTNERSHIP", /\bpartner(s|ed|ship|ships)?\b|\baffiliat(e|ed|ion)\b|\bendorse(d|ment)?\b|\bapproved by\b|\bapproval (from|of) (the )?(sebi|sec|finra|fca|rbi|regulator)|\bcertified\b|\blicensed\b|\bregulated\b|\bofficial\b|\bbacked by\b|\btrusted by\b|\bin collaboration with\b|\bintegrated with\b|\bas seen (in|on)\b|\bsebi\b|\bfinra\b/i],
  ["PERFORMANCE", /\breturns?\b|\bprofit(s|able)?\b|\bgains?\b|\bearn(s|ed|ing|ings)?\b|\bincome\b|\byield\b|\bapy\b|\broi\b|\bwin rate\b|\bbeat the market\b|\boutperform/i],
  ["PERFORMANCE", /\balpha\b|\bguarantee(d|s)?\b|\brisk[- ]free\b|\bpassive\b|\bget rich\b|\bsignals to (buy|sell|trade|profit)\b/i],
  ["AVAILABILITY", /\bavailable now\b|\bnow available\b|\bavailable today\b|\bstart trading\b|\btrade now\b|\bsign up to trade\b|\bjoin now\b|\blive trading is (on|open|available)\b|\bget started\b/i],
  ["AI_OVERCLAIM", /\bpredicts? (the )?(market|prices?)\b|\bnever (wrong|loses?)\b|\bautonomous trading\b|\bfully automated\b|\bai[- ]powered (profits?|returns?|trading)\b|\bsmart money\b/i],
];
// Financial-claim rules for the PUBLIC tier: scoped to money / endorsement meaning, so technical
// copy ("returns HTTP 402", "MIT-licensed", "gain unauthorized access") is not a finding.
export const PUBLIC_RULES = [
  ["PARTNERSHIP", /\b(official |strategic |exchange |broker )?partner(s|ed|ship|ships)? (with|of)\b|\baffiliated with\b|\bendorsed by\b|\bbacked by\b|\bcertified by\b|\blicensed by\b|\bregulated by\b|\btrusted by\b|\bas seen (in|on)\b|\bin collaboration with\b/i],
  ["PERFORMANCE", /\bearn(s|ed|ing|ings)?\b|\bincome\b|\byield\b|\bapy\b|\broi\b|\bprofit(s|able)?\b|\bwin rate\b|\bbeat the market\b|\boutperform|\bguaranteed (returns?|profits?|income|earnings|payouts?)\b|\brisk[- ]free\b|\bpassive income\b|\bget rich\b|\b(annual|monthly|daily|high|investment|expected|trading) returns\b/i],
  ["AVAILABILITY", /\bstart trading\b|\btrade now\b|\bsign up to trade\b|\blive trading is (on|open|available)\b/i],
  ["AI_OVERCLAIM", RULES[4][1]],
  // Mandate §9 (2026-10-20): unmeasured performance/status claims and implied endorsements that
  // were live on jakuraa.com / satelink.network. Allowed again only with a shown measurement.
  ["UNMEASURED_CLAIM", /\bsub-?second\b|\bsub-?\d+\s?ms\b|\bmainnet operational\b|\bverifiable oracle\b|\bzero[- ](external )?(sdk )?dependenc|\bsoc ?2[- ]compliant\b|\b(claude|anthropic)\b[^.<]{0,20}\bcompatible\b|\bx402: a standard for\b/i],
];
const NUMBER = /\d[\d,.]*\s?%|[$₹€£]\s?\d|\b\d[\d,.]*\s?(USDT|USD|INR|USDC)\b/i;

function walk(dir, out = []) {
  let names;
  try { if (statSync(dir).isFile()) { out.push(dir); return out; } names = readdirSync(dir); } catch { return out; }
  for (const n of names) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(tsx?|json|md)$/.test(f) && !f.endsWith("disclaimers.json")) out.push(f);
  }
  return out;
}

function disclaimerSentences() {
  return Object.values(JSON.parse(readFileSync(join(WEB, "src/lib/trading-agent/disclaimers.json"), "utf8")));
}

// Attribute values that are not rendered copy.
const NON_COPY_ATTRS = new Set(["className", "href", "id", "key", "variant", "align", "as", "data-rprc", "aria-label", "rel", "target", "src", "type", "name"]);

/**
 * Rendered copy only, via the TypeScript AST: string literals, template text and JSX text —
 * minus imports, type positions, non-copy attributes, object keys and the approved disclaimers.
 * Each piece knows whether it sits inside a <Hypothetical> element.
 */
export function copyPieces(file, source, exempt = disclaimerSentences()) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const pieces = [];
  const inHypothetical = (node) => {
    for (let p = node.parent; p; p = p.parent) if (ts.isJsxElement(p) && p.openingElement.tagName.getText(sf) === "Hypothetical") return true;
    return false;
  };
  const skip = (node) => {
    const p = node.parent;
    if (!p) return false;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isExternalModuleReference(p)) return true;
    if (ts.isJsxAttribute(p) && NON_COPY_ATTRS.has(p.name.getText(sf))) return true;
    if (ts.isPropertyAssignment(p) && p.name === node) return true; // object keys
    if (ts.isElementAccessExpression(p) || ts.isCaseClause(p)) return true; // lookups / switch labels
    if (ts.isBinaryExpression(p) && /===|!==|==|!=/.test(p.operatorToken.getText(sf))) return true; // comparisons
    if (ts.isCallExpression(p) && /\b(includes|startsWith|endsWith|indexOf|test|match|replace|split|get)$/.test(p.expression.getText(sf))) return true;
    return false;
  };
  const visit = (node) => {
    let text = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = skip(node) ? null : node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text;
    if (text && text.trim()) {
      let t = text;
      for (const d of exempt) t = t.split(d).join(" ");
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      pieces.push({ text: t, line: line + 1, hypothetical: inHypothetical(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return pieces;
}

/** Markdown / JSON content: every line is copy. */
function textPieces(source, exempt) {
  return source.split("\n").map((t, i) => { for (const d of exempt) t = t.split(d).join(" "); return { text: t, line: i + 1, hypothetical: false }; }).filter((p) => p.text.trim());
}

/** PUBLIC tier: financial-claim rules only. */
export function lintPublicSource(file, source, exempt = disclaimerSentences()) {
  const pieces = /\.(md|json)$/.test(file) ? textPieces(source, exempt) : copyPieces(file, source, exempt);
  const findings = [];
  for (const p of pieces) for (const [rule, re] of PUBLIC_RULES) { const m = p.text.match(re); if (m) findings.push({ file, line: p.line, rule, match: m[0], tier: "public" }); }
  return findings;
}

export function lintSource(file, source, exempt) {
  const findings = [];
  for (const p of (/\.(md|json)$/.test(file) ? textPieces(source, exempt ?? disclaimerSentences()) : copyPieces(file, source, exempt))) {
    for (const [rule, re] of RULES) { const m = p.text.match(re); if (m) findings.push({ file, line: p.line, rule, match: m[0] }); }
    if (!p.hypothetical && !/stage \d+ \(PR #\d+\)/.test(p.text)) { const m = p.text.match(NUMBER); if (m) findings.push({ file, line: p.line, rule: "UNLABELLED_NUMBER", match: m[0] }); }
  }
  if (/function LegalPlaceholder/.test(source) && !/RPrC/.test(source)) findings.push({ file, line: 1, rule: "LEGAL_WITHOUT_REVIEW", match: "LegalPlaceholder" });
  return findings;
}

export function lintClaims(root = WEB) {
  const exempt = disclaimerSentences();
  const files = SCOPE.flatMap((d) => walk(join(root, d)));
  return { files: files.map((f) => relative(root, f)), findings: files.flatMap((f) => lintSource(relative(root, f), readFileSync(f, "utf8"), exempt)) };
}

export function lintPublicClaims(root = WEB) {
  const exempt = disclaimerSentences();
  const files = [...new Set(PUBLIC_SCOPE.flatMap((d) => walk(join(root, d))))].map((f) => relative(root, f)).filter((f) => !PUBLIC_IGNORE.some((re) => re.test(f)));
  return { files, findings: files.flatMap((f) => lintPublicSource(f, readFileSync(join(root, f), "utf8"), exempt)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const strict = lintClaims();
  const pub = lintPublicClaims();
  for (const f of [...strict.findings, ...pub.findings]) console.log(`${f.file}:${f.line}  ${f.tier ?? "strict"}  ${f.rule}  "${f.match}"`);
  console.log(`claims-lint: strict ${strict.files.length} files / ${strict.findings.length} finding(s); public ${pub.files.length} files / ${pub.findings.length} finding(s)`);
  process.exit(strict.findings.length + pub.findings.length ? 1 : 0);
}
