// Pins the root cause of the macOS rate-limit test flakes (Step 4.5) and why
// test/_helpers/local_request.mjs fixes it.
import { expect } from 'chai';
import http from 'node:http';
import { bindLocal, closeLocalServers, localRequest } from './_helpers/local_request.mjs';
import express from 'express';

const listen = (s, port, host) => new Promise((resolve) => {
  s.once('error', (e) => resolve(e.code));
  host ? s.listen(port, host, () => resolve('ok')) : s.listen(port, () => resolve('ok'));
});
const get = (port) => new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: '/' }, (r) => {
  let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => resolve(d));
}).on('error', (e) => resolve(e.code)));

describe('test helper: servers bound to 127.0.0.1 cannot be hijacked', () => {
  afterEach(closeLocalServers);

  it('the hazard: a wildcard listener can share a port with a 127.0.0.1 listener (BSD/macOS) and loses 127.0.0.1 traffic to it', async () => {
    const squatter = http.createServer((q, r) => r.end('squatter'));
    await listen(squatter, 0, '127.0.0.1');
    const port = squatter.address().port;
    const wildcard = http.createServer((q, r) => r.end('mine'));
    const bound = await listen(wildcard, port); // supertest's default: wildcard bind
    try {
      if (bound === 'ok') {
        expect(await get(port)).to.equal('squatter'); // BSD/macOS: the request meant for "mine" was hijacked
      } else {
        expect(bound).to.equal('EADDRINUSE'); // Linux refuses the shared port — no hazard there (CI)
      }
    } finally { squatter.close(); wildcard.close(); }
  });

  it('the fix: a 127.0.0.1 bind cannot coexist with a 127.0.0.1 occupant, so the kernel never hands it a taken port', async () => {
    const squatter = http.createServer((q, r) => r.end('squatter'));
    await listen(squatter, 0, '127.0.0.1');
    const port = squatter.address().port;
    const mine = http.createServer((q, r) => r.end('mine'));
    try {
      expect(await listen(mine, port, '127.0.0.1')).to.equal('EADDRINUSE');
    } finally { squatter.close(); mine.close(); }
  });

  it('bindLocal / localRequest serve the app on 127.0.0.1 and reach it', async () => {
    const app = express(); app.get('/', (q, r) => r.send('app'));
    const s = await bindLocal(app);
    expect(s.address().address).to.equal('127.0.0.1');
    expect((await (await localRequest(app)).get('/')).text).to.equal('app');
  });
});
