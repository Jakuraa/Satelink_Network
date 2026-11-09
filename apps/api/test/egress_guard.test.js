// apps/api/test/egress_guard.test.js — Release A P4 (SSRF). Every connector's outbound URL goes through one guard:
// preview = loopback only; beta/live = https and no private/loopback/link-local/metadata targets; redirects refused.
import { expect } from 'chai';
import { assertEgressUrl, egressFetch, isForbiddenAddress, EgressError } from '../src/workflows/connectors/egress_guard.js';

describe('egress guard (SSRF)', () => {
  it('preview mode allows only loopback http(s)', () => {
    for (const ok of ['http://127.0.0.1:4430', 'http://localhost:4410/x', 'http://[::1]:4420/mcp']) expect(() => assertEgressUrl(ok)).not.to.throw();
    for (const bad of ['http://169.254.169.254/latest/meta-data', 'http://10.0.0.5', 'https://api.example.com', 'http://metadata.google.internal', 'file:///etc/passwd', 'gopher://127.0.0.1', 'http://user:pw@127.0.0.1', 'not a url']) {
      expect(() => assertEgressUrl(bad), bad).to.throw(EgressError);
    }
  });

  it('beta/live mode requires https and blocks private, loopback, link-local and metadata targets', () => {
    expect(() => assertEgressUrl('https://api.example.com/v1', { mode: 'live' })).not.to.throw();
    for (const bad of ['http://api.example.com', 'https://127.0.0.1', 'https://localhost', 'https://10.1.2.3', 'https://172.16.0.1', 'https://172.31.255.255', 'https://192.168.1.1',
      'https://169.254.169.254', 'https://100.64.0.1', 'https://0.0.0.0', 'https://[::1]', 'https://[fd00::1]', 'https://[fe80::1]', 'https://[::ffff:10.0.0.1]', 'https://[::ffff:a9fe:a9fe]', 'https://[::ffff:7f00:1]',
      'https://metadata.google.internal', 'https://foo.internal', 'https://x.localhost', 'https://224.0.0.1']) {
      expect(() => assertEgressUrl(bad, { mode: 'live' }), bad).to.throw(EgressError);
    }
    expect(isForbiddenAddress('172.32.0.1')).to.equal(false);
    expect(isForbiddenAddress('8.8.8.8')).to.equal(false);
  });

  it('egressFetch checks every URL and always refuses redirects', async () => {
    const seen = [];
    const f = egressFetch(async (url, init) => { seen.push([url, init.redirect]); return new Response('{}'); });
    await f('http://127.0.0.1:4430/pricing', { method: 'GET' });
    expect(seen).to.deep.equal([['http://127.0.0.1:4430/pricing', 'error']]);
    expect(() => f('http://169.254.169.254/latest/meta-data')).to.throw(EgressError);
    expect(seen).to.have.length(1);
  });
});
