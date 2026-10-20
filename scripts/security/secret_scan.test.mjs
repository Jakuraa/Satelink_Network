// node --test scripts/security/ — run in CI (Secret Scan job).
// Fixtures are assembled at runtime so this file never contains a literal key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSecrets } from './secret_scan.mjs';

const live = 'sk_' + 'live_';
const testp = 'sk_' + 'test_';
const hex32 = 'f6d9bef0'.repeat(4);

test('real live and test keys are caught', () => {
  assert.equal(findSecrets(`const k = "${live}${hex32}";`).length, 1);
  assert.equal(findSecrets(`KEY=${testp}${hex32}`).length, 1);
  assert.equal(findSecrets(`${live}a`).length, 1); // even a short suffix
});

test('PEM and private-key-field patterns are caught', () => {
  assert.equal(findSecrets('-----BEGIN PRIVATE' + ' KEY-----').length, 1);
  assert.equal(findSecrets('-----BEGIN EC PRIVATE' + ' KEY-----').length, 1);
  assert.equal(findSecrets('{"private' + '_key": "0xabc"}').length, 1);
});

test('the masked placeholder is allowed (the narrow allowlist entry)', () => {
  assert.deepEqual(findSecrets(`const MASKED_KEY = "${live}••••••••••••••••";`), []);
  assert.deepEqual(findSecrets(`placeholder="${live}...">`), []);
  assert.deepEqual(findSecrets(`${live}…135a`), []);
  assert.deepEqual(findSecrets(`${live}****`), []);
});

test('a placeholder does not hide a real key on the same line', () => {
  assert.equal(findSecrets(`"${live}••••" or "${live}${hex32}"`).length, 1);
});

test('a bare prefix in code is still blocked (unchanged strictness)', () => {
  assert.equal(findSecrets(`apiKey.startsWith('${live}')`).length, 1);
  assert.equal(findSecrets('`' + live + '${hex}`').length, 1);
});

test('findings report line numbers, not values', () => {
  const f = findSecrets(`ok\n${live}${hex32}`);
  assert.deepEqual(f, [{ line: 2, reason: 'API key prefix not followed by a mask' }]);
});
