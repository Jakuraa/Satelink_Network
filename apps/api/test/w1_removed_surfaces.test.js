// R4 guard (mandate 2026-10-20, W1): the S3-002 "AI gateway" served Groq Llama under
// gpt-4o / Claude model ids and recorded it as inference. It was removed. This test keeps
// it gone: no source file may map a third-party model id onto a different model, and
// app_factory must not mount an OpenAI-compatible chat-completions router.

import { expect } from 'chai';
import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const API = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(API, 'src');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js|ts)$/.test(name)) out.push(p);
  }
  return out;
}

// A key that names a well-known vendor model, mapped to a string value that names a
// different vendor family — e.g. 'gpt-4o-mini': 'llama3-8b-8192'.
const RELABEL = /['"](gpt-[\w.-]+|claude-[\w.-]+|gemini-[\w.-]+)['"]\s*:\s*['"]((?:llama|mixtral|gemma|qwen|mistral)[\w.-]*)['"]/i;

describe('R4 — no model relabelling', () => {
  it('no source file maps a vendor model id onto a different model family', () => {
    const offenders = walk(SRC)
      .filter((f) => RELABEL.test(readFileSync(f, 'utf8')))
      .map((f) => relative(API, f));
    expect(offenders).to.deep.equal([]);
  });

  it('the matcher catches the removed gateway mapping (guards the guard)', () => {
    expect(RELABEL.test(`const M = { 'gpt-4o-mini': 'llama3-8b-8192' };`)).to.equal(true);
    expect(RELABEL.test(`const M = { 'claude-3-haiku': 'llama3-8b-8192' };`)).to.equal(true);
    expect(RELABEL.test(`const M = { 'llama3-8b-8192': 'llama3-8b-8192' };`)).to.equal(false);
  });

  it('app_factory does not import or mount the removed AI gateway', () => {
    const src = readFileSync(join(API, 'app_factory.mjs'), 'utf8');
    expect(src).to.not.match(/ai_gateway\/index\.js/);
    expect(src).to.not.match(/createAiGatewayRouter/);
  });
});

describe('W1 — removed unauthenticated workload surfaces stay removed', () => {
  it('app_factory does not mount the bandwidth proxy', () => {
    const src = readFileSync(join(API, 'app_factory.mjs'), 'utf8');
    expect(src).to.not.match(/createBandwidthRouter/);
    expect(src).to.not.match(/["']\/api\/bandwidth["']/);
  });
});
