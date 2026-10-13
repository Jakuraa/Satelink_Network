import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPublicStatsRouter, PUBLIC_STATS_SHAPE } from '../src/routes/public_stats.js';
import { createFinancialTruthRouter } from '../src/services/financial/truth.js';
import { requireAdminAuth } from '../src/admin/admin_router.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Substrings that must never appear in a public key (revenue, treasury,
// account, balance and money-adjacent fields).
const RESTRICTED = /revenue|treasury|account|balance|usdt|usd|deposit|withdraw|settle|claim|earning|wallet|key|payer|credit|metered|unpaid|warning|pipeline/i;

function allKeys(obj, prefix = '') {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj).flatMap(([k, v]) => [prefix + k, ...allKeys(v, `${prefix}${k}.`)]);
}

// Every query returns its expected column PLUS restricted extras, so a
// sanitizer that passes rows through would leak them.
function leakyPool({ fail = false } = {}) {
  let calls = 0;
  return {
    get calls() { return calls; },
    query: async (sql) => {
      calls++;
      if (fail) throw new Error('db down');
      const extras = { revenue_usdt: 9.99, treasury_real_usdt: 1, wallet_address: '0xabc' };
      if (sql.includes('FROM registered_nodes')) return { rows: [{ count: 2, ...extras }] };
      if (sql.includes('FROM nodes')) return { rows: [{ count: 1, ...extras }] };
      if (sql.includes('node_health_logs')) return { rows: [{ uptime: 99.5, ...extras }] };
      return { rows: [] };
    },
  };
}

const freeTier = async () => ({ totalCalls: 496273, revenue_usdt: 5, topIps: ['1.2.3.4'] });

describe('GET /api/public/stats', () => {
  it('returns only allowlisted fields, none restricted, even when sources return extra columns', async () => {
    const app = express();
    app.use('/api/public', createPublicStatsRouter(leakyPool(), { getFreeTierStats: freeTier }));
    const res = await request(app).get('/api/public/stats');

    expect(res.status).to.equal(200);
    const keys = allKeys(res.body);
    expect(keys).to.have.members(Object.keys(PUBLIC_STATS_SHAPE));
    for (const k of keys) expect(k, `restricted key ${k}`).to.not.match(RESTRICTED);
    expect(JSON.stringify(res.body)).to.not.include('0xabc');
    expect(JSON.stringify(res.body)).to.not.include('1.2.3.4');
  });

  it('allowlist itself contains no restricted field names', () => {
    for (const k of Object.keys(PUBLIC_STATS_SHAPE)) expect(k).to.not.match(RESTRICTED);
  });

  it('reports node count, uptime and request volume with the declared types', async () => {
    const app = express();
    app.use('/api/public', createPublicStatsRouter(leakyPool(), { getFreeTierStats: freeTier }));
    const { body } = await request(app).get('/api/public/stats');

    expect(body).to.include({ ok: true, nodes_online: 3, uptime_pct_24h: 99.5, requests_24h: 496273 });
    expect(body.api_uptime_seconds).to.be.a('number');
    expect(Date.parse(body.generated_at)).to.not.be.NaN;
  });

  it('reports unknown as null, never 0, when the sources fail', async () => {
    const app = express();
    const failing = async () => { throw new Error('redis down'); };
    app.use('/api/public', createPublicStatsRouter(leakyPool({ fail: true }), { getFreeTierStats: failing }));
    const { status, body } = await request(app).get('/api/public/stats');

    expect(status).to.equal(200);
    expect(body).to.include({ nodes_online: null, uptime_pct_24h: null, requests_24h: null });
  });

  it('caches for 60s so a public caller cannot drive the Redis scan', async () => {
    let t = 1_000_000;
    let scans = 0;
    const pool = leakyPool();
    const app = express();
    app.use('/api/public', createPublicStatsRouter(pool, {
      getFreeTierStats: async () => { scans++; return { totalCalls: 1 }; },
      now: () => t,
    }));

    await request(app).get('/api/public/stats');
    await request(app).get('/api/public/stats');
    expect(scans).to.equal(1);
    t += 60_000;
    await request(app).get('/api/public/stats');
    expect(scans).to.equal(2);
  });
});

describe('GET /api/public/stats concurrency', () => {
  it('concurrent cold requests share one source read', async () => {
    let scans = 0;
    const app = express();
    app.use('/api/public', createPublicStatsRouter(leakyPool(), {
      getFreeTierStats: async () => { scans++; await new Promise((r) => setTimeout(r, 20)); return { totalCalls: 1 }; },
    }));
    await Promise.all([1, 2, 3, 4, 5].map(() => request(app).get('/api/public/stats')));
    expect(scans).to.equal(1);
  });
});

describe('GET /api/financial/truth is admin-only', () => {
  const TOKEN = 'test-admin-token-public-stats';
  let saved;
  before(() => { saved = process.env.ADMIN_SECRET_TOKEN; process.env.ADMIN_SECRET_TOKEN = TOKEN; });
  after(() => { if (saved === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = saved; });

  function app() {
    const pool = { query: async () => ({ rows: [] }) };
    const a = express();
    a.use('/api/financial', requireAdminAuth, createFinancialTruthRouter(pool));
    return a;
  }

  it('no token → 401 with no financial fields', async () => {
    const res = await request(app()).get('/api/financial/truth');
    expect(res.status).to.equal(401);
    expect(res.body).to.not.have.any.keys('metered_value_usdt', 'treasury_real_usdt', 'external_revenue_usdt');
  });

  it('wrong token → 401', async () => {
    const res = await request(app()).get('/api/financial/truth').set('X-Admin-Token', 'nope');
    expect(res.status).to.equal(401);
  });

  it('admin token → not 401', async () => {
    const res = await request(app()).get('/api/financial/truth').set('X-Admin-Token', TOKEN);
    expect(res.status).to.not.equal(401);
  });

  it('app_factory mounts /api/financial behind requireAdminAuth and /api/public/stats', () => {
    const src = readFileSync(path.join(here, '..', 'app_factory.mjs'), 'utf8');
    expect(src).to.match(/app\.use\(\s*["']\/api\/financial["']\s*,\s*requireAdminAuth\s*,\s*createFinancialTruthRouter/);
    expect(src).to.not.match(/app\.use\(\s*["']\/api\/financial["']\s*,\s*createFinancialTruthRouter/);
    expect(src).to.match(/app\.use\(\s*["']\/api\/public["']\s*,\s*createPublicStatsRouter/);
  });
});
