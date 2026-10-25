// node --test agents/node-agent/test — the agent's signed messages match the documented formats
// and recover to the payout wallet. Server-side verification is the contract test in
// apps/api/test/node_agent_protocol_contract.test.js.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Wallet, verifyMessage } = require('ethers');
const p = require('../src/protocol');

const wallet = Wallet.createRandom();

test('registration message is the documented 7 lines, wallet lowercased', () => {
  const m = p.registrationMessage({ walletAddress: '0xABCDEF0000000000000000000000000000000001', nodeType: 'rpc',
    endpointUrl: 'https://node.example:8545', region: 'us-east-1', chainIds: [137, 1], timestamp: 123 });
  assert.equal(m, 'Satelink node registration\nwallet: 0xabcdef0000000000000000000000000000000001\nnode_type: rpc\n'
    + 'endpoint: https://node.example:8545\nregion: us-east-1\nchain_ids: 137,1\ntimestamp: 123');
});

test('heartbeat message is the documented 4 lines; endpoint "-" when absent', () => {
  assert.equal(p.heartbeatMessage({ nodeId: 'NODE-x', timestamp: 5 }), 'Satelink node heartbeat\nnode: NODE-x\ntimestamp: 5\nendpoint: -');
});

test('signed bodies recover to the payout wallet', async () => {
  const reg = await p.signedRegistration(wallet, { nodeType: 'rpc', endpointUrl: 'https://n.example', region: 'us-east-1', chainIds: [137], timestamp: 9 });
  assert.equal(verifyMessage(p.registrationMessage({ walletAddress: reg.wallet_address, nodeType: 'rpc', endpointUrl: 'https://n.example',
    region: 'us-east-1', chainIds: [137], timestamp: 9 }), reg.signature), wallet.address);
  const hb = await p.signedHeartbeat(wallet, { nodeId: 'NODE-x', timestamp: 10, endpointUrl: 'https://n.example' });
  assert.equal(hb.endpoint_url, 'https://n.example');
  assert.equal(verifyMessage(p.heartbeatMessage({ nodeId: 'NODE-x', timestamp: 10, endpointUrl: 'https://n.example' }), hb.signature), wallet.address);
});

test('heartbeat clock strictly increases even if the system clock stalls or steps back', () => {
  let t = 1000; const clock = p.createHeartbeatClock(() => t);
  const a = clock(); t = 1000; const b = clock(); t = 900; const c = clock();
  assert.ok(a < b && b < c);
});

test('non-integer chain ids are refused before signing', async () => {
  await assert.rejects(p.signedRegistration(wallet, { nodeType: 'rpc', endpointUrl: 'https://n.example', region: 'us-east-1', chainIds: ['137'] }));
});

test('the key comes from the environment, never an argument', () => {
  assert.throws(() => p.walletFromEnv({}), /SATELINK_NODE_PRIVATE_KEY is not set/);
  assert.equal(p.walletFromEnv({ SATELINK_NODE_PRIVATE_KEY: wallet.privateKey }).address, wallet.address);
});

test('a malformed key never appears in the error (it would leak into logs)', () => {
  const good = wallet.privateKey.slice(2);
  for (const bad of [good.slice(0, 63), good.slice(0, 63) + 'z', good, '0x' + good + '"']) {
    let msg = '';
    try { p.walletFromEnv({ SATELINK_NODE_PRIVATE_KEY: bad }); } catch (e) { msg = String(e.message) + String(e.stack) + String(e.cause || ''); }
    if (bad === good) continue; // a bare 64-hex key without 0x is accepted by ethers
    assert.ok(msg.includes('is not a valid 32-byte hex private key'), msg);
    assert.ok(!msg.includes(good.slice(4, 40)), 'key material leaked');
  }
});
