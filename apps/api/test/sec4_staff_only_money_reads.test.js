import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { requireAdminAuth } from '../src/admin/admin_router.js';
import { createSettlementAuditRouter } from '../src/services/settlement/audit.js';
import { createNodeRegistryRouter } from '../src/services/node_registry/registration.js';

// SEC-4 (W1, 2026-10-20): public reads of treasury state, settlement history, node earnings,
// the OS event stream and /system money views are staff-only.

const API = join(dirname(fileURLToPath(import.meta.url)), '..');
const AF = readFileSync(join(API, 'app_factory.mjs'), 'utf8');
const ADMIN = 'test-only-admin-token-sec4';
let saved;

function listFromSource() {
  const m = AF.match(/export const STAFF_ONLY_MONEY_READS = \[([\s\S]*?)\];/);
  expect(m, 'STAFF_ONLY_MONEY_READS exported').to.not.equal(null);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe('SEC-4 — staff-only money reads', () => {
  before(() => { saved = process.env.ADMIN_SECRET_TOKEN; process.env.ADMIN_SECRET_TOKEN = ADMIN; });
  after(() => { if (saved === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = saved; });

  it('covers every money read found in the Step 0 route sweep', () => {
    expect(listFromSource()).to.include.members([
      '/api/treasury/status', '/api/settlement/history', '/api/settlement/epoch/:id', '/api/nodes/:nodeId/earnings',
      '/os/events', '/system/treasury', '/system/treasury-settlement', '/system/revenue-anomalies', '/system/economy',
    ]);
  });

  it('the guard is registered before the first route it protects', () => {
    const guard = AF.indexOf('app.get(STAFF_ONLY_MONEY_READS, requireAdminAuth)');
    expect(guard).to.be.greaterThan(-1);
    for (const needle of ['app.get("/api/treasury/status"', 'app.use("/api/settlement"', 'app.use("/os"', 'app.use("/api/nodes"']) {
      expect(AF.indexOf(needle), needle).to.be.greaterThan(guard);
    }
  });

  function build() {
    const pool = { async query() { return { rows: [] }; } };
    const app = express();
    app.get(listFromSource(), requireAdminAuth);
    app.use('/api/settlement', createSettlementAuditRouter(pool));
    app.use('/api/nodes', createNodeRegistryRouter(pool, null));
    return app;
  }

  for (const path of ['/api/settlement/history', '/api/settlement/epoch/7', '/api/nodes/node-1/earnings', '/API/Settlement/History/', '/api/treasury/status', '/system/treasury', '/os/events']) {
    it(`${path} without a token → 401`, async () => {
      expect((await request(build()).get(path)).status).to.equal(401);
    });
  }

  it('with a staff token the real routers answer', async () => {
    const res = await request(build()).get('/api/settlement/history').set('x-admin-token', ADMIN);
    expect(res.status).to.not.equal(401);
  });

  it('neighbouring public node routes are unaffected', async () => {
    const res = await request(build()).get('/api/nodes/node-1/reputation');
    expect(res.status).to.not.equal(401);
  });
});
