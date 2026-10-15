// npm normalizes every "bin" target on publish (@npmcli/package-json normalize.js).
// A target it has to rewrite — e.g. "./index.js" -> "index.js" — prints the misleading
// warning `"bin[x]" script name index.js was invalid and removed` (the bin is kept, but
// the warning reads like a broken package). Keep targets in normalized form, and make
// sure each one is a real, executable, shebanged file so `npx satelink-mcp` runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const url = (p) => new URL(`../${p}`, import.meta.url);
const pkg = JSON.parse(readFileSync(url('package.json'), 'utf8'));

test('bin targets are already npm-normalized, packed, executable and shebanged', () => {
  assert.ok(pkg.bin && pkg.bin['satelink-mcp'], 'bin.satelink-mcp must exist');
  for (const [name, target] of Object.entries(pkg.bin)) {
    assert.equal(target, path.posix.normalize(target).replace(/^(\.\/)+/, ''), `bin[${name}] "${target}" would be rewritten by npm`);
    assert.ok(pkg.files.includes(target), `bin[${name}] "${target}" missing from "files"`);
    assert.ok(statSync(url(target)).mode & 0o111, `bin[${name}] "${target}" not executable`);
    assert.match(readFileSync(url(target), 'utf8').split('\n')[0], /^#!\/usr\/bin\/env node$/);
  }
});
