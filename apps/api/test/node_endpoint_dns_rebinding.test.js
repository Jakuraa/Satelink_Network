// DNS-rebinding / private-resolution guard for node endpoints (SEC-5 follow-up, 2026-10-21).
//
// validateNodeEndpoint() checks the URL; a public-looking hostname that resolves (or re-binds)
// to an internal address still reached it. nodeEndpointFetch checks the addresses inside the
// socket's own DNS lookup — the exact addresses it connects to — and never follows redirects.
//
// Hermetic: a real local HTTP server on 127.0.0.1 and an injected resolver that maps test
// hostnames to it, so no external DNS is needed.
import { expect } from 'chai';
import http from 'node:http';
import { createNodeEndpointFetch, createGuardedLookup, nodeEndpointFetch } from '../src/services/node_registry/node_endpoint_fetch.js';

describe('node endpoints: resolve-then-check at connect time (DNS rebinding)', function () {
  this.timeout(15000);
  let server, port, hits, lastHeaders;

  before(async () => {
    hits = [];
    server = http.createServer((req, res) => {
      hits.push(req.url);
      lastHeaders = req.headers;
      if (req.url === '/reset') { res.writeHead(200); res.write('partial'); setTimeout(() => res.socket.destroy(), 20); return; }
      if (req.url === '/redirect') { res.writeHead(302, { location: `http://node.test:${port}/target` }); return res.end(); }
      if (req.url === '/big') { res.writeHead(200); res.end(Buffer.alloc(64 * 1024, 'a')); return; }
      if (req.url === '/drip') { res.writeHead(200); const t = setInterval(() => res.write('a'), 50); req.on('close', () => clearInterval(t)); return; }
      if (req.url === '/slow') { setTimeout(() => { res.writeHead(200); res.end('{}'); }, 2000); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x10' }));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });
  after(() => new Promise((r) => server.close(r)));
  beforeEach(() => { hits.length = 0; });

  // Every hostname "resolves" to the local server (127.0.0.1), as a rebinding DNS name would.
  const toLoopback = (hostname, opts, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]);

  it('a public-looking hostname that resolves to 127.0.0.1 is refused before connecting', async () => {
    const f = createNodeEndpointFetch({ baseLookup: toLoopback });
    let err;
    try { await f(`http://node.test:${port}/health`); } catch (e) { err = e; }
    expect(err?.code).to.equal('blocked_address');
    expect(hits).to.deep.equal([]);
  });

  it('control: with the address check disabled the same request reaches the server (transport works)', async () => {
    const f = createNodeEndpointFetch({ baseLookup: toLoopback, isBlocked: () => false });
    const res = await f(`http://node.test:${port}/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(res.ok).to.equal(true);
    expect((await res.json()).result).to.equal('0x10');
    expect(hits).to.deep.equal(['/']);
  });

  it('redirects are not followed (a 302 into the private network is just a non-ok response)', async () => {
    const f = createNodeEndpointFetch({ baseLookup: toLoopback, isBlocked: () => false });
    const res = await f(`http://node.test:${port}/redirect`);
    expect(res.status).to.equal(302);
    expect(res.ok).to.equal(false);
    expect(hits).to.deep.equal(['/redirect']);
  });

  it('caps the response size and times out slow endpoints', async () => {
    const f = createNodeEndpointFetch({ baseLookup: toLoopback, isBlocked: () => false });
    let big; try { await f(`http://node.test:${port}/big`, { maxBytes: 1024 }); } catch (e) { big = e; }
    expect(big?.code).to.equal('response_too_large');
    let slow; try { await f(`http://node.test:${port}/slow`, { timeoutMs: 200 }); } catch (e) { slow = e; }
    expect(slow?.code).to.equal('timeout');
    const t0 = Date.now();
    let drip; try { await f(`http://node.test:${port}/drip`, { timeoutMs: 300 }); } catch (e) { drip = e; }
    expect(drip?.code, 'a drip-feeding endpoint hits the total deadline').to.equal('timeout');
    expect(Date.now() - t0).to.be.below(1500);
  });

  it('POST bodies carry Content-Length (not chunked) and a User-Agent', async () => {
    const f = createNodeEndpointFetch({ baseLookup: toLoopback, isBlocked: () => false });
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] });
    await f(`http://node.test:${port}/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    expect(lastHeaders['content-length']).to.equal(String(Buffer.byteLength(body)));
    expect(lastHeaders['transfer-encoding']).to.equal(undefined);
    expect(lastHeaders['user-agent']).to.equal('satelink-gateway');
  });

  it('headersOnly resolves on the status line even when the body never ends (health probes)', async () => {
    const f = createNodeEndpointFetch({ baseLookup: toLoopback, isBlocked: () => false });
    const t0 = Date.now();
    const res = await f(`http://node.test:${port}/drip`, { timeoutMs: 2000, headersOnly: true });
    expect(res.ok).to.equal(true);
    expect(Date.now() - t0).to.be.below(1000);
  });

  it('a connection reset mid-body is a fixed category (unreachable), not raw error text', async () => {
    const f = createNodeEndpointFetch({ baseLookup: toLoopback, isBlocked: () => false });
    let err; try { await f(`http://node.test:${port}/reset`); } catch (e) { err = e; }
    expect(err?.code).to.equal('unreachable');
    expect(err?.message).to.equal('unreachable');
  });

  it('literal private addresses and bad schemes are refused by the URL check', async () => {
    for (const url of [`http://127.0.0.1:${port}/`, `http://10.0.0.1/`, 'file:///etc/passwd', 'http://localhost./']) {
      let err; try { await nodeEndpointFetch(url); } catch (e) { err = e; }
      expect(err?.code, url).to.equal('invalid_endpoint');
    }
    expect(hits).to.deep.equal([]);
  });

  describe('createGuardedLookup', () => {
    const run = (answers, opts = {}) => new Promise((resolve) => {
      const lookup = createGuardedLookup({ baseLookup: (h, o, cb) => cb(null, answers) });
      lookup('x.test', opts, (err, address, family) => resolve({ err, address, family }));
    });

    it('refuses when ANY resolved address is private (mixed public/private answers)', async () => {
      const r = await run([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }]);
      expect(r.err?.code).to.equal('blocked_address');
    });

    it('refuses metadata, CGNAT, IPv6 loopback and IPv4-mapped answers', async () => {
      for (const a of [{ address: '169.254.169.254', family: 4 }, { address: '100.64.0.1', family: 4 },
        { address: '::1', family: 6 }, { address: '::ffff:10.0.0.1', family: 6 }]) {
        expect((await run([a])).err?.code, a.address).to.equal('blocked_address');
      }
    });

    it('passes public answers through in both single and all modes', async () => {
      const single = await run([{ address: '93.184.216.34', family: 4 }]);
      expect([single.err, single.address, single.family]).to.deep.equal([null, '93.184.216.34', 4]);
      const all = await run([{ address: '2606:4700:4700::1111', family: 6 }], { all: true });
      expect(all.err).to.equal(null);
      expect(all.address).to.deep.equal([{ address: '2606:4700:4700::1111', family: 6 }]);
    });

    it('an empty answer is an error, not a pass', async () => {
      expect((await run([])).err?.code).to.equal('dns_no_address');
    });
  });
});

// Review follow-ups (Session A): paid-path size cap, failure codes, fail-closed lookup.
import { RPC_RESPONSE_MAX_BYTES } from '../src/workloads/rpc_gateway/node_dispatcher.js';
import { createGuardedLookup as guardedLookupFactory } from '../src/services/node_registry/node_endpoint_fetch.js';
describe('node endpoint fetch — review follow-ups', () => {
  it('forwardToNode uses a paid-RPC response cap far above the 1 MB probe default', () => {
    if (!(RPC_RESPONSE_MAX_BYTES >= 16 * 1024 * 1024)) throw new Error(`cap too small: ${RPC_RESPONSE_MAX_BYTES}`);
  });
  it('the guarded lookup refuses an answer that is not an IP address (fail closed)', (done) => {
    const lookup = guardedLookupFactory({ baseLookup: (_h, _o, cb) => cb(null, [{ address: 'not-an-ip', family: 4 }]) });
    lookup('example.test', {}, (err) => {
      try { if (!err || err.code !== 'blocked_address') throw new Error(`expected blocked_address, got ${err && err.code}`); done(); } catch (e) { done(e); }
    });
  });
});
