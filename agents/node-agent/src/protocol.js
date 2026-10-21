// Satelink node protocol: the signed messages the API verifies
// (apps/api/src/services/node_registry/heartbeat_auth.js). Plain CommonJS so the CLI (TS) and
// the API's contract test (apps/api/test/node_agent_protocol_contract.test.js) share one copy.
// Signing is EIP-191 personal_sign with the node's payout wallet.
'use strict';
const { Wallet } = require('ethers');

/** Exact registration message (POST /api/nodes/register). */
function registrationMessage({ walletAddress, nodeType, endpointUrl, region, chainIds, timestamp }) {
  return [
    'Satelink node registration',
    `wallet: ${String(walletAddress).toLowerCase()}`,
    `node_type: ${nodeType}`,
    `endpoint: ${endpointUrl}`,
    `region: ${region}`,
    `chain_ids: ${chainIds.join(',')}`,
    `timestamp: ${timestamp}`,
  ].join('\n');
}

/** Exact heartbeat message (POST /api/nodes/:nodeId/heartbeat). */
function heartbeatMessage({ nodeId, timestamp, endpointUrl }) {
  return ['Satelink node heartbeat', `node: ${nodeId}`, `timestamp: ${timestamp}`, `endpoint: ${endpointUrl || '-'}`].join('\n');
}

/**
 * Load the signing wallet from an environment variable — never from a CLI argument (it would
 * land in shell history and the process list).
 */
function walletFromEnv(env = process.env, name = 'SATELINK_NODE_PRIVATE_KEY') {
  const key = env[name];
  if (!key) throw new Error(`${name} is not set (the payout wallet's private key, used only to sign)`);
  return new Wallet(key.trim());
}

/** Build a signed registration body. chainIds must be positive integers. */
async function signedRegistration(wallet, { nodeType, endpointUrl, region, chainIds, timestamp = Date.now() }) {
  if (!Array.isArray(chainIds) || !chainIds.every((c) => Number.isSafeInteger(c) && c > 0)) {
    throw new Error('chain ids must be positive integers');
  }
  const body = { wallet_address: wallet.address, node_type: nodeType, endpoint_url: endpointUrl, region, chain_ids: chainIds, timestamp };
  body.signature = await wallet.signMessage(registrationMessage({
    walletAddress: wallet.address, nodeType, endpointUrl, region, chainIds, timestamp }));
  return body;
}

/** Heartbeat timestamps must strictly increase per node (server replay guard). */
function createHeartbeatClock(now = () => Date.now()) {
  let last = 0;
  return () => { const t = Math.max(now(), last + 1); last = t; return t; };
}

/** Build a signed heartbeat body; endpointUrl is optional (covered by the signature when sent). */
async function signedHeartbeat(wallet, { nodeId, timestamp, endpointUrl, metrics = {} }) {
  const body = { ...metrics, timestamp };
  if (endpointUrl) body.endpoint_url = endpointUrl;
  body.signature = await wallet.signMessage(heartbeatMessage({ nodeId, timestamp, endpointUrl }));
  return body;
}

module.exports = { registrationMessage, heartbeatMessage, walletFromEnv, signedRegistration, createHeartbeatClock, signedHeartbeat };
