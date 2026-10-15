// rpc_traffic_daily — persistent /rpc traffic aggregates (2026-10-15).
// Covers: no raw IP stored or logged; admin endpoint 401 without token; cardinality
// cap; flush failure never throws; a DB outage never affects RPC responses; latency
// overhead of the middleware; real-SQL upsert + report against a LOCAL throwaway schema.

import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import http from 'node:http';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createRpcTrafficRecorder, uaFamilyRaw, originHostRaw, methodRaw, statusClass, authState,
} from '../src/analytics/rpc_traffic_recorder.mjs';
import { getRpcTrafficReport, parseDays } from '../src/analytics/rpc_traffic_report.mjs';
import { createAdminRouter, requireAdminAuth } from '../src/admin/admin_router.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RAW_IP = '203.0.113.77';
const RAW_IP6 = '2001:db8::1';

// Pool double that records every query + param and can be told to fail or hang.
function fakePool({ mode = 'ok' } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (mode === 'fail') throw new Error('connect ECONNREFUSED');
      if (mode === 'hang') return new Promise(() => {});
      return { rows: [{ c: 0 }] };
    },
  };
}

function req({ ip = RAW_IP, ua = 'ethers/6.13.0', origin, body, headers = {}, method = 'POST' } = {}) {
  return {
    method,
    body,
    socket: { remoteAddress: '10.0.0.1' },
    headers: { 'x-forwarded-for': `${ip}, 10.1.1.1`, 'user-agent': ua, ...(origin ? { origin } : {}), ...headers },
  };
}

function captureLog() {
  const lines = [];
  const push = (...a) => lines.push(a.map(String).join(' '));
  return { lines, log: { warn: push, error: push, info: push, log: push } };
}

describe('rpc traffic analytics — normalizers', () => {
  it('ua_family maps known clients and keeps only the product token of unknown ones', () => {
    expect(uaFamilyRaw('ethers/6.13.0 (node 20)')).to.equal('ethers');
    expect(uaFamilyRaw('curl/8.4.0')).to.equal('curl');
    expect(uaFamilyRaw('Mozilla/5.0 (Macintosh) AppleWebKit Chrome/120 Safari/537')).to.equal('browser-chrome');
    expect(uaFamilyRaw('RPCHub/1.0 (iPhone; iOS 17.2) user@example.com')).to.equal('ua:rpchub');
    expect(uaFamilyRaw('')).to.equal('none');
    expect(uaFamilyRaw('!!!')).to.equal('other');
  });

  it('origin_host never stores an IP literal or junk', () => {
    expect(originHostRaw({ origin: 'https://App.Example.com:8443' })).to.equal('app.example.com');
    expect(originHostRaw({ referer: 'https://dapp.xyz/path?q=1' })).to.equal('dapp.xyz');
    expect(originHostRaw({ origin: `http://${RAW_IP}:3000` })).to.equal('ip-literal');
    expect(originHostRaw({ origin: `http://[${RAW_IP6}]` })).to.equal('ip-literal');
    expect(originHostRaw({ origin: 'null' })).to.equal('null-origin');
    expect(originHostRaw({ origin: 'not a url' })).to.equal('invalid');
    expect(originHostRaw({})).to.equal('none');
  });

  it('method: unread before body parse, batch, allowlisted names, other', () => {
    expect(methodRaw({ method: 'POST', body: undefined })).to.equal('unread');
    expect(methodRaw({ method: 'POST', body: [{ method: 'eth_call' }] })).to.equal('batch');
    expect(methodRaw({ method: 'POST', body: { method: 'eth_getBalance' } })).to.equal('eth_getBalance');
    expect(methodRaw({ method: 'POST', body: { method: 'drop table x' } })).to.equal('other');
    expect(methodRaw({ method: 'GET' })).to.equal('GET');
  });

  it('status_class and auth_state', () => {
    expect([200, 402, 401, 429, 404, 503, 0].map(statusClass)).to.deep.equal(['2xx', '402', '401', '429', '4xx', '5xx', 'other']);
    expect(authState({ headers: {} }, 402)).to.equal('none');
    expect(authState({ headers: { 'x-api-key': 'k' } }, 402)).to.equal('key-unfunded');
    expect(authState({ headers: { 'x-api-key': 'k' } }, 401)).to.equal('key-unfunded');
    expect(authState({ headers: { 'x-api-key': 'k' } }, 200)).to.equal('key-funded');
    expect(authState({ headers: { 'x-api-key': 'k' } }, 502)).to.equal('key-funded');
    expect(authState({ headers: {}, x402: { settled: true } }, 200)).to.equal('x402');
  });
});

describe('rpc traffic analytics — privacy', () => {
  it('never writes a raw IP (v4, v6, or IP-literal origin) to the DB, and never logs one', async () => {
    const pool = fakePool();
    const { lines, log } = captureLog();
    const rec = createRpcTrafficRecorder(pool, { secret: 's3cret', log });
    rec.record(req({ ip: RAW_IP, origin: `http://${RAW_IP}` }), 402);
    rec.record(req({ ip: RAW_IP6, origin: `http://[${RAW_IP6}]:80` }), 200);
    expect(await rec.flush()).to.equal(true);
    const written = JSON.stringify(pool.calls);
    expect(written).to.not.include(RAW_IP);
    expect(written).to.not.include('2001:db8');
    const insert = pool.calls.find((c) => /INSERT INTO rpc_traffic_daily/.test(c.sql));
    for (const h of insert.params[1]) expect(h).to.match(/^[0-9a-f]{16}$/);

    // A failing flush logs, but the log line carries no IP either.
    const bad = createRpcTrafficRecorder(fakePool({ mode: 'fail' }), { secret: 's3cret', log });
    bad.record(req({ ip: RAW_IP }), 402);
    await bad.flush();
    expect(lines.length).to.be.greaterThan(0);
    expect(lines.join('\n')).to.not.include(RAW_IP);
  });

  it('client_hash is keyed: differs per secret, and with no secret no hash is computed', async () => {
    const a = fakePool(); const b = fakePool(); const c = fakePool();
    for (const [pool, secret] of [[a, 'one'], [b, 'two'], [c, '']]) {
      const rec = createRpcTrafficRecorder(pool, { secret });
      rec.record(req(), 402);
      await rec.flush();
    }
    const hashOf = (p) => p.calls.find((x) => /INSERT/.test(x.sql)).params[1][0];
    expect(hashOf(a)).to.not.equal(hashOf(b));
    expect(hashOf(c)).to.equal('nosecret');
  });
});

describe('rpc traffic analytics — cardinality cap', () => {
  it('caps distinct rows per day and buckets overflow as other', async () => {
    const pool = fakePool();
    const rec = createRpcTrafficRecorder(pool, { secret: 's', rowCapPerDay: 50 });
    for (let i = 0; i < 500; i++) rec.record(req({ ip: `198.51.100.${i % 256}`, ua: `Tool${i}/1.0` }), 402);
    expect(rec._pendingSize()).to.be.at.most(51);
    expect(rec.stats.overflowed).to.be.greaterThan(0);
    await rec.flush();
    const insert = pool.calls.find((c) => /INSERT/.test(c.sql));
    const rows = insert.params[1].length;
    expect(rows).to.be.at.most(51);
    const total = insert.params[7].reduce((s, n) => s + n, 0);
    expect(total).to.equal(500); // nothing silently uncounted
    expect(insert.params[1]).to.include('other');
  });

  it('caps unknown UA product tokens per day', () => {
    const rec = createRpcTrafficRecorder(fakePool(), { secret: 's', maxUaTokensPerDay: 3 });
    for (let i = 0; i < 20; i++) rec.record(req({ ip: '198.51.100.1', ua: `Tool${i}/1.0` }), 402);
    expect(rec._pendingSize()).to.equal(4); // 3 tokens + 'other'
  });

  it('bounds the in-memory batch even if flushes never run', () => {
    const rec = createRpcTrafficRecorder(fakePool(), { secret: 's', rowCapPerDay: 1e9, maxPendingKeys: 100 });
    for (let i = 0; i < 1000; i++) rec.record(req({ ip: `10.0.${i >> 8}.${i & 255}` }), 402);
    expect(rec._pendingSize()).to.equal(100);
    expect(rec.stats.dropped).to.equal(900);
  });
});

describe('rpc traffic analytics — fail open', () => {
  it('flush failure resolves false, never throws, and drops (not re-queues) the batch', async () => {
    const rec = createRpcTrafficRecorder(fakePool({ mode: 'fail' }), { secret: 's', log: captureLog().log });
    rec.record(req(), 402);
    expect(await rec.flush()).to.equal(false);
    expect(rec._pendingSize()).to.equal(0);
    expect(rec.stats.flushFailures).to.equal(1);
  });

  it('a hung DB times out the flush instead of wedging it', async () => {
    const rec = createRpcTrafficRecorder(fakePool({ mode: 'hang' }), { secret: 's', flushTimeoutMs: 50, log: captureLog().log });
    rec.record(req(), 402);
    expect(await rec.flush()).to.equal(false);
  });

  it('a hung write never takes a second pool connection (single in-flight write)', async () => {
    const pool = fakePool({ mode: 'hang' });
    const rec = createRpcTrafficRecorder(pool, { secret: 's', flushTimeoutMs: 20, log: captureLog().log });
    for (let i = 0; i < 5; i++) {
      rec.record(req({ ip: `192.0.2.${i}` }), 402);
      expect(await rec.flush()).to.equal(false);
    }
    // Only the first flush reached the DB (ensureSchema hung); later ones were skipped.
    expect(pool.calls.length).to.equal(1);
    expect(rec._pendingSize()).to.equal(4); // kept, bounded, for when the DB recovers
  });

  it('record() swallows malformed requests', () => {
    const rec = createRpcTrafficRecorder(fakePool(), { secret: 's' });
    expect(() => rec.record(null, 200)).to.not.throw();
    expect(() => rec.record({ headers: { 'x-forwarded-for': 42 } }, 200)).to.not.throw();
  });

  function rpcApp(recorder) {
    const app = express();
    if (recorder) app.use('/rpc', recorder.middleware);
    app.use('/rpc', express.json(), (req, res) => {
      if (!req.headers['x-api-key']) return res.status(402).json({ error: 'payment_required' });
      res.json({ jsonrpc: '2.0', id: req.body?.id ?? 1, result: '0x1' });
    });
    return app;
  }

  it('a DB outage does not change RPC responses (status, body) while metrics are dropped', async () => {
    const outage = createRpcTrafficRecorder(fakePool({ mode: 'fail' }), { secret: 's', flushIntervalMs: 5, log: captureLog().log });
    outage.start();
    try {
      const app = rpcApp(outage);
      const base = rpcApp(null);
      for (let i = 0; i < 20; i++) {
        const body = { jsonrpc: '2.0', id: i, method: 'eth_blockNumber', params: [] };
        const [x, y] = await Promise.all([
          request(app).post('/rpc/polygon').set('x-api-key', 'k').send(body),
          request(base).post('/rpc/polygon').set('x-api-key', 'k').send(body),
        ]);
        expect(x.status).to.equal(y.status);
        expect(x.body).to.deep.equal(y.body);
        const anon = await request(app).post('/rpc/polygon').send(body);
        expect(anon.status).to.equal(402);
        await new Promise((r) => setTimeout(r, 2));
      }
      expect(outage.stats.flushFailures).to.be.greaterThan(0);
    } finally { outage.stop(); }
  });

  it('latency: middleware overhead is negligible (before/after on a live HTTP server)', async function () {
    this.timeout(30000);
    const N = 1500;
    async function bench(app) {
      const server = http.createServer(app).listen(0);
      const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
      const port = server.address().port;
      const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] });
      const one = () => new Promise((resolve, reject) => {
        const r = http.request({ port, path: '/rpc/polygon', method: 'POST', agent,
          headers: { 'content-type': 'application/json', 'x-api-key': 'k', 'user-agent': 'ethers/6' } }, (res) => {
          res.resume(); res.on('end', resolve);
        });
        r.on('error', reject); r.end(payload);
      });
      for (let i = 0; i < 200; i++) await one(); // warm-up
      const t = [];
      for (let i = 0; i < N; i++) { const s = process.hrtime.bigint(); await one(); t.push(Number(process.hrtime.bigint() - s) / 1e6); }
      agent.destroy(); server.close();
      t.sort((a, b) => a - b);
      return { p50: t[N >> 1], p99: t[Math.floor(N * 0.99)], mean: t.reduce((a, b) => a + b, 0) / N };
    }
    const rec = createRpcTrafficRecorder(fakePool(), { secret: 's', flushIntervalMs: 60_000 });
    const before = await bench(rpcApp(null));
    const after = await bench(rpcApp(rec));
    const fmt = (o) => `p50 ${o.p50.toFixed(3)}ms p99 ${o.p99.toFixed(3)}ms mean ${o.mean.toFixed(3)}ms`;
    console.log(`      before: ${fmt(before)}\n      after:  ${fmt(after)}  (delta p50 ${(after.p50 - before.p50).toFixed(3)}ms)`);
    // Generous bound so CI noise can't flake it; the printed numbers are the evidence.
    expect(after.p50 - before.p50).to.be.lessThan(0.5);
    expect(rec.stats.recorded).to.equal(N + 200);
  });
});

describe('rpc traffic analytics — admin endpoint auth + wiring', () => {
  const TOKEN = 'test-admin-token-rpc-traffic';
  let saved;
  before(() => { saved = process.env.ADMIN_SECRET_TOKEN; process.env.ADMIN_SECRET_TOKEN = TOKEN; });
  after(() => { if (saved === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = saved; });

  function app(pool) {
    const a = express();
    a.use('/admin', requireAdminAuth, createAdminRouter(pool, null));
    return a;
  }

  it('GET /admin/traffic/rpc → 401 without a token and with a wrong token, never touching the DB', async () => {
    const pool = fakePool();
    expect((await request(app(pool)).get('/admin/traffic/rpc')).status).to.equal(401);
    expect((await request(app(pool)).get('/admin/traffic/rpc').set('x-admin-token', 'nope')).status).to.equal(401);
    expect(pool.calls.filter((c) => /rpc_traffic_daily/.test(c.sql))).to.have.length(0);
  });

  it('with a token, days is clamped to 1..30', () => {
    expect(parseDays(undefined)).to.equal(7);
    expect(parseDays('0')).to.equal(1);
    expect(parseDays('9999')).to.equal(30);
    expect(parseDays('abc')).to.equal(7);
  });

  it('app_factory mounts the recorder on /rpc BEFORE x402 + freeTierGate, and /admin behind requireAdminAuth', () => {
    const src = readFileSync(path.join(here, '..', 'app_factory.mjs'), 'utf8');
    const rec = src.indexOf('app.use("/rpc", rpcTrafficRecorder.middleware)');
    const gate = src.indexOf('app.use("/rpc", x402Middleware, freeTierGateUnlessX402Paid');
    expect(rec).to.be.greaterThan(-1);
    expect(gate).to.be.greaterThan(rec);
    expect(src).to.match(/app\.use\("\/admin", requireAdminAuth,/);
  });
});

describe('rpc traffic analytics — real SQL (local Postgres, throwaway schema)', function () {
  // Never DATABASE_URL (apps/api/.env points at production). Local only.
  const url = process.env.RPC_TRAFFIC_TEST_PG || 'postgresql://localhost:5432/postgres';
  const schema = `rpc_traffic_test_${process.pid}`;
  let pool;

  before(async function () {
    if (!/@?(localhost|127\.0\.0\.1)(:|\/)/.test(url)) this.skip();
    pool = new pg.Pool({ connectionString: url, max: 2, options: `-c search_path=${schema}` });
    try { await pool.query(`CREATE SCHEMA ${schema}`); } catch { await pool?.end().catch(() => {}); pool = null; this.skip(); }
  });
  after(async () => {
    if (!pool) return;
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  it('migration file and ensureSchema produce the same table; upsert accumulates', async () => {
    const mig = readFileSync(path.join(here, '..', 'migrations', '047_rpc_traffic_daily.sql'), 'utf8');
    await pool.query(mig);
    await pool.query(mig); // idempotent
    const rec = createRpcTrafficRecorder(pool, { secret: 's' });
    rec.record(req({ ip: RAW_IP }), 402);
    rec.record(req({ ip: RAW_IP }), 402);
    expect(await rec.flush()).to.equal(true);
    rec.record(req({ ip: RAW_IP }), 402);
    expect(await rec.flush()).to.equal(true);
    const r = await pool.query(`SELECT count::int AS c FROM rpc_traffic_daily`);
    expect(r.rows).to.deep.equal([{ c: 3 }]);
    const dump = JSON.stringify((await pool.query('SELECT * FROM rpc_traffic_daily')).rows);
    expect(dump).to.not.include(RAW_IP);
  });

  it('report: auth_state split, repeat callers (3+ days), 402-then-paid', async () => {
    await pool.query('TRUNCATE rpc_traffic_daily');
    const ins = (daysAgo, client, status, auth, n, origin = 'none', ua = 'ethers') => pool.query(
      `INSERT INTO rpc_traffic_daily VALUES ((now() AT TIME ZONE 'utc')::date - $1::int, $2, $3, $4, 'eth_call', $5, $6, $7)`,
      [daysAgo, client, ua, origin, status, auth, n]);
    // A: anon 402 for 3 days, then paid with a funded key today.
    await ins(3, 'aaaaaaaaaaaaaaaa', '402', 'none', 100, 'dapp.xyz');
    await ins(2, 'aaaaaaaaaaaaaaaa', '402', 'none', 100, 'dapp.xyz');
    await ins(1, 'aaaaaaaaaaaaaaaa', '402', 'none', 100, 'dapp.xyz');
    await ins(0, 'aaaaaaaaaaaaaaaa', '2xx', 'key-funded', 7, 'dapp.xyz');
    // B: 402 only, 2 days (not a repeat caller).
    await ins(1, 'bbbbbbbbbbbbbbbb', '402', 'none', 50, 'none', 'curl');
    await ins(0, 'bbbbbbbbbbbbbbbb', '402', 'none', 50, 'none', 'curl');
    // C: paid BEFORE its 402 — must not count as 402-then-paid.
    await ins(4, 'cccccccccccccccc', '2xx', 'x402', 5);
    await ins(2, 'cccccccccccccccc', '402', 'none', 1);
    // Overflow bucket is excluded from client counts.
    await ins(0, 'other', '402', 'none', 999);
    // Outside the window.
    await ins(40, 'dddddddddddddddd', '402', 'none', 1);

    const rep = await getRpcTrafficReport(pool, { days: 7 });
    expect(Number(rep.totals.requests)).to.equal(100 * 3 + 7 + 100 + 6 + 999);
    expect(Number(rep.totals.overflow_requests)).to.equal(999);
    expect(rep.repeat_callers.repeat_clients).to.equal(1);
    expect(rep.repeat_callers.top[0].client_hash).to.equal('aaaaaaaaaaaaaaaa');
    expect(rep.repeat_callers.top[0].top_origin_host).to.equal('dapp.xyz');
    expect(rep.sent_402_then_paid.clients_sent_402).to.equal(3);
    expect(rep.sent_402_then_paid.clients_402_then_paid).to.equal(1);
    expect(rep.sent_402_then_paid.clients.map((c) => c.client_hash)).to.deep.equal(['aaaaaaaaaaaaaaaa']);
    expect(rep.top_origin_hosts[0].origin_host).to.equal('none');
    const today = rep.distinct_clients_per_day.at(-1);
    expect(today.distinct_clients).to.equal(2); // a + b; 'other' excluded
    const authToday = rep.requests_by_day_auth_state.filter((r) => r.day === today.day);
    expect(authToday.map((r) => r.auth_state).sort()).to.deep.equal(['key-funded', 'none']);
  });

  it('down migration removes only the analytics table', async () => {
    const down = readFileSync(path.join(here, '..', 'migrations', 'down', '047_rpc_traffic_daily.sql'), 'utf8');
    await pool.query(down);
    const r = await pool.query(`SELECT to_regclass('rpc_traffic_daily') AS t`);
    expect(r.rows[0].t).to.equal(null);
  });
});
