// The version a client sees must be the same everywhere: npm (package.json),
// the MCP registry manifest (mcp.json), and the serverInfo both transports send.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('package.json, mcp.json and both transports report one version', () => {
  const version = JSON.parse(read('package.json')).version;
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(read('mcp.json')).version, version);
  for (const file of ['src/server-factory.mjs', 'http.mjs']) {
    const found = [...read(file).matchAll(/version: '([^']+)'/g)].map((m) => m[1]);
    assert.ok(found.length > 0, `${file} declares no version`);
    for (const v of found) assert.equal(v, version, `${file} reports ${v}`);
  }
});
