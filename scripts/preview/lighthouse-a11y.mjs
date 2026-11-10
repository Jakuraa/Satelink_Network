#!/usr/bin/env node
// Release A · P3 — Lighthouse accessibility scores for the main preview pages (local preview only).
// Signs up a fresh preview user with Playwright, then runs a PINNED Lighthouse (npx lighthouse@12.8.2, accessibility
// category only) against each page with that session cookie, using Playwright's Chromium. Fails if any score < 90.
// Writes artifacts/lighthouse/p3-a11y.json. Not part of CI (Lighthouse is not a repo dependency).
// Usage: node scripts/preview/lighthouse-a11y.mjs [--console http://localhost:3400]
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..');
const i = process.argv.indexOf('--console');
const CONSOLE = i > 0 ? process.argv[i + 1] : 'http://localhost:3400';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(CONSOLE)) { console.error('console must be a local URL'); process.exit(2); }
const PAGES = ['/home', '/assistant', '/tasks', '/explore', '/agent-marketplace', '/trading-ai', '/connections', '/wallet', '/developer-hub', '/activity', '/settings'];
const LIGHTHOUSE = 'lighthouse@12.8.2';

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(`${CONSOLE}/signup`);
await page.getByPlaceholder('Enter your email').fill(`lh.${Date.now().toString(36)}@example.com`);
await page.getByRole('button', { name: 'Continue with email' }).click();
await page.getByTestId('preview-open-link').click();
await page.getByTestId('onboarding-submit').click();
await page.getByTestId('onboarding-continue').click();
await page.waitForURL(/\/assistant/);
const cookie = (await page.context().cookies(CONSOLE)).map((c) => `${c.name}=${c.value}`).join('; ');
await browser.close();

const tmp = mkdtempSync(join(tmpdir(), 'lh-'));
const results = [];
for (const p of PAGES) {
  const out = join(tmp, `${p.slice(1)}.json`);
  const r = spawnSync('npx', ['--yes', LIGHTHOUSE, `${CONSOLE}${p}`, '--only-categories=accessibility', '--output=json', `--output-path=${out}`, '--quiet',
    '--chrome-flags=--headless=new --no-sandbox', `--extra-headers=${JSON.stringify({ Cookie: cookie })}`], { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, encoding: 'utf8', timeout: 180_000 });
  if (r.status !== 0) { results.push({ page: p, score: null, error: (r.stderr || '').slice(-300) }); continue; }
  const lhr = JSON.parse(readFileSync(out, 'utf8'));
  const failing = Object.values(lhr.audits).filter((a) => a.score === 0 && a.scoreDisplayMode === 'binary').map((a) => a.id);
  results.push({ page: p, final_url: lhr.finalDisplayedUrl, score: Math.round(lhr.categories.accessibility.score * 100), failing_audits: failing });
}
mkdirSync(join(ROOT, 'artifacts', 'lighthouse'), { recursive: true });
writeFileSync(join(ROOT, 'artifacts', 'lighthouse', 'p3-a11y.json'), JSON.stringify({ tool: LIGHTHOUSE, console: CONSOLE, measured_at: new Date().toISOString(), results }, null, 2));
for (const r of results) console.log(`${String(r.score ?? 'ERR').padStart(4)}  ${r.page}${r.final_url && !r.final_url.endsWith(r.page) ? `  (landed on ${r.final_url})` : ''}${r.failing_audits?.length ? `  failing: ${r.failing_audits.join(', ')}` : ''}${r.error ? `  ${r.error}` : ''}`);
const bad = results.filter((r) => r.score === null || r.score < 90 || (r.final_url && !r.final_url.endsWith(r.page)));
console.log(bad.length ? `LIGHTHOUSE_A11Y_FAIL ${bad.length}` : 'LIGHTHOUSE_A11Y_OK');
process.exit(bad.length ? 1 : 0);
