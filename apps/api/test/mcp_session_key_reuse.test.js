// MCP client 402-loop fix (2026-10-12): after a paid call the API returns a
// one-time X-Satelink-API-Key; the MCP executor must send it as X-API-Key on
// later calls (drawing down the bundle) instead of re-paying $0.10 per call.
// x-payer-address is no longer a credential and must not be sent.
import { expect } from 'chai';
import { createRpcExecutor } from '../../mcp-server/src/rpc.mjs';

describe('MCP rpc executor reuses the x402 session key', () => {
  it('captures X-Satelink-API-Key once and sends it as X-API-Key afterwards', async () => {
    const key = 'x402_' + 'ab'.repeat(32);
    const seen = [];
    let n = 0;
    const fetch = async (url, init) => {
      seen.push({ ...init.headers });
      n++;
      const headers = new Map(n === 1 ? [['x-satelink-api-key', key], ['payment-response', 'tx1']] : []);
      return { ok: true, status: 200, headers: { get: (h) => headers.get(h.toLowerCase()) ?? null }, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x1' }) };
    };
    const exec = createRpcExecutor({ fetch, wallet: '0x' + '1'.repeat(40), rpcUrl: 'https://rpc.example.test/rpc/polygon' });
    for (let i = 0; i < 6; i++) expect((await exec({ method: 'eth_blockNumber' })).ok).to.equal(true);
    expect(seen[0]['X-API-Key']).to.equal(undefined);
    for (const h of seen.slice(1)) expect(h['X-API-Key']).to.equal(key);
    for (const h of seen) expect(h['x-payer-address']).to.equal(undefined);
  });

  it('ignores a malformed key header and prefers an explicit API key', async () => {
    const seen = [];
    const fetch = async (url, init) => { seen.push({ ...init.headers }); return { ok: true, status: 200, headers: { get: (h) => (h === 'x-satelink-api-key' ? 'x402_0xpublic' : null) }, text: async () => '{}' }; };
    const exec = createRpcExecutor({ fetch, wallet: null, rpcUrl: 'https://rpc.example.test', apiKey: 'sk_basic_' + 'c'.repeat(32) });
    await exec({ method: 'eth_chainId' }); await exec({ method: 'eth_chainId' });
    expect(seen.every((h) => h['X-API-Key'].startsWith('sk_basic_'))).to.equal(true);
  });

  it('clears sessionKey on 402 so subsequent requests can re-trigger payment', async () => {
    const key = 'x402_' + 'cd'.repeat(32);
    const seen = [];
    let n = 0;
    const fetch = async (url, init) => {
      seen.push({ ...init.headers });
      n++;
      if (n === 1) {
        const headers = new Map([['x-satelink-api-key', key], ['payment-response', 'tx1']]);
        return { ok: true, status: 200, headers: { get: (h) => headers.get(h.toLowerCase()) ?? null }, text: async () => '{"jsonrpc":"2.0","id":1,"result":"0x1"}' };
      }
      if (n === 2) {
        // Second call reuses key, but bundle is now exhausted -> 402
        return { ok: false, status: 402, headers: { get: () => null }, text: async () => '{"error":"insufficient_credits"}' };
      }
      // Third call should NOT send the dead session key!
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => '{"jsonrpc":"2.0","id":1,"result":"0x2"}' };
    };

    const exec = createRpcExecutor({ fetch, wallet: '0x' + '2'.repeat(40), rpcUrl: 'https://rpc.example.test/rpc/polygon' });
    const r1 = await exec({ method: 'eth_blockNumber' });
    expect(r1.ok).to.equal(true);
    expect(seen[0]['X-API-Key']).to.equal(undefined);

    const r2 = await exec({ method: 'eth_blockNumber' });
    expect(r2.status).to.equal(402);
    expect(seen[1]['X-API-Key']).to.equal(key);

    await exec({ method: 'eth_blockNumber' });
    expect(seen[2]['X-API-Key']).to.equal(undefined); // dead key was cleared!
  });
});

