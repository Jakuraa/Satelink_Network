// Contract: what agents/node-agent signs is exactly what the API verifies. Runs in the API
// suite (CI) so a format change on either side fails here, not in an operator's terminal.
import { expect } from 'chai';
import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { verifyNodeRegistration, verifyNodeHeartbeat } from '../src/services/node_registry/heartbeat_auth.js';

const require = createRequire(import.meta.url);
const agent = require('../../../agents/node-agent/src/protocol.js');

describe('node-agent ↔ API signed-message contract', () => {
  const wallet = ethers.Wallet.createRandom();

  it('an agent-signed registration verifies on the server', async () => {
    const body = await agent.signedRegistration(wallet, {
      nodeType: 'rpc', endpointUrl: 'https://node.example:8545', region: 'us-east-1', chainIds: [137, 1] });
    const r = verifyNodeRegistration({ walletAddress: body.wallet_address, nodeType: body.node_type, endpointUrl: body.endpoint_url,
      region: body.region, chainIds: body.chain_ids, timestamp: body.timestamp, signature: body.signature });
    expect(r).to.deep.equal({ ok: true });
  });

  it('an agent-signed heartbeat (with and without endpoint) verifies on the server', async () => {
    const clock = agent.createHeartbeatClock();
    for (const endpointUrl of [undefined, 'https://node.example:8545']) {
      const body = await agent.signedHeartbeat(wallet, { nodeId: 'NODE-us-east-1-abc', timestamp: clock(), endpointUrl });
      const r = verifyNodeHeartbeat({ nodeId: 'NODE-us-east-1-abc', wallet: wallet.address, timestamp: body.timestamp,
        signature: body.signature, endpointUrl: body.endpoint_url });
      expect(r, String(endpointUrl)).to.deep.equal({ ok: true });
    }
  });

  it('the agent and server message builders are byte-identical', async () => {
    const server = await import('../src/services/node_registry/heartbeat_auth.js');
    const reg = { walletAddress: wallet.address, nodeType: 'rpc', endpointUrl: 'https://n.example', region: 'eu-west-1', chainIds: [137], timestamp: 42 };
    expect(agent.registrationMessage(reg)).to.equal(server.registrationMessage(reg));
    const hb = { nodeId: 'NODE-x', timestamp: 43, endpointUrl: 'https://n.example' };
    expect(agent.heartbeatMessage(hb)).to.equal(server.heartbeatMessage(hb));
    expect(agent.heartbeatMessage({ nodeId: 'NODE-x', timestamp: 44 })).to.equal(server.heartbeatMessage({ nodeId: 'NODE-x', timestamp: 44 }));
  });
});
