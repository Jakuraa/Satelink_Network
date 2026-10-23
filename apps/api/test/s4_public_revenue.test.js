import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import revenueRoutes from '../src/routes/revenue.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// S4 (mandate W1, 2026-10-20): public endpoints must not expose revenue figures.
// /api/revenue, /api/revenue/events and /api/epochs are staff-only; the public
// /api/economics/summary keeps its shape with every money field null.

const ADMIN = 'test-only-admin-token-s4';
let saved;

function app(pool) {
  const a = express();
  a.use('/api', revenueRoutes(pool));
  return a;
}

function pool() {
  const sql = [];
  return {
    sql,
    async query(q) {
      sql.push(q);
      if (/FROM epochs/.test(q)) return { rows: [{ id: 42, closed_at: '2026-10-19T00:00:00Z', total_revenue_usdt: 20.5 }] };
      return { rows: [{ total: 20.5 }] };
    },
  };
}

describe('S4 — no public revenue figures', () => {
  before(() => { saved = process.env.ADMIN_SECRET_TOKEN; process.env.ADMIN_SECRET_TOKEN = ADMIN; });
  after(() => { if (saved === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = saved; });

  for (const path of ['/api/revenue', '/api/revenue/events', '/api/epochs']) {
    it(`${path} without staff auth → 401 and no query`, async () => {
      const p = pool();
      const res = await request(app(p)).get(path);
      expect(res.status).to.equal(401);
      expect(p.sql).to.have.length(0);
    });

    it(`${path} with staff auth → 200`, async () => {
      const res = await request(app(pool())).get(path).set('x-admin-token', ADMIN);
      expect(res.status).to.equal(200);
    });
  }

  it('/api/economics/summary is public, carries no money figures, and never sums revenue', async () => {
    const p = pool();
    const res = await request(app(p)).get('/api/economics/summary');
    expect(res.status).to.equal(200);
    for (const k of ['totalRevenueUsdt', 'totalNodePoolUsdt', 'totalPlatformShareUsdt', 'totalDistributorShareUsdt', 'lastEpochRevenueUsdt']) {
      expect(res.body[k], k).to.equal(null);
    }
    expect(res.body.lastEpochId).to.equal(42);
    expect(res.body.revenueVisibility).to.equal('staff_only');
    expect(p.sql.join('\n')).to.not.match(/SUM\(|total_revenue_usdt/i);
  });

  it('/api/diagnostics (inline in app_factory) neither sums revenue nor returns a revenue figure', () => {
    const af = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app_factory.mjs'), 'utf8');
    const a = af.indexOf('app.get("/api/diagnostics"');
    expect(a, 'diagnostics handler present').to.be.greaterThan(-1);
    const handler = af.slice(a, af.indexOf('\n  });', a));
    expect(handler).to.not.match(/revenue_events_v2/);
    expect(handler).to.match(/totalRevenueUsdt:\s+null/);
    // No raw error text in the public response (review follow-up).
    expect(handler).to.not.match(/json\(\{[^}]*e\.message/);
  });
});
