import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { requireAdminAuth } from '../src/admin/admin_router.js';
import { createLedgerParityRouter } from '../src/internal/ledger_parity.js';
import { createDrawParityRouter } from '../src/ledger/draw_parity.js';
import { createCapacityParityRouter } from '../src/internal/capacity_parity.js';
import { createDodoInternalRouter } from '../src/routes/internal_dodo.js';
import { secretEquals } from '../src/security/header_secret.js';

// W1 review follow-up: prove the parity guard through Express's real routing (same mount
// order as app_factory.mjs), including case / trailing-slash / query variants, and that
// /internal/dodo keeps its own shared-secret auth.

const ADMIN = 'test-only-admin-token-parity';
const DODO = 'test-only-dodo-value';
let saved;

function build() {
  const pool = { async query() { return { rows: [{}], rowCount: 0 }; }, async connect() { return { async query() { return { rows: [] }; }, release() {} }; } };
  const app = express();
  app.use(express.json());
  app.use(['/internal/ledger-parity', '/internal/draw-parity', '/internal/capacity-parity'], requireAdminAuth);
  app.use('/internal', createLedgerParityRouter(pool));
  app.use('/internal', createDrawParityRouter(pool));
  app.use('/internal', createCapacityParityRouter(pool));
  app.use('/internal/dodo', createDodoInternalRouter(pool));
  return app;
}

describe('W1 — /internal parity reports are staff-only (real routing)', () => {
  before(() => { saved = process.env.ADMIN_SECRET_TOKEN; process.env.ADMIN_SECRET_TOKEN = ADMIN; });
  after(() => { if (saved === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = saved; });

  for (const path of [
    '/internal/ledger-parity', '/internal/draw-parity', '/internal/capacity-parity',
    '/INTERNAL/Ledger-Parity', '/internal/ledger-parity/', '/internal/ledger-parity?x=1',
    '/internal/ledger-parity/detail', '/internal/draw-parity/any/sub/path',
  ]) {
    it(`${path} without a token → 401`, async () => {
      expect((await request(build()).get(path)).status).to.equal(401);
    });
  }

  it('non-GET methods on a parity prefix are gated too (POST → 401)', async () => {
    expect((await request(build()).post('/internal/ledger-parity').send({})).status).to.equal(401);
  });

  it('with the admin token the guard passes through to the parity router', async () => {
    const res = await request(build()).get('/internal/ledger-parity').set('x-admin-token', ADMIN);
    expect(res.status).to.not.equal(401);
  });

  it('/internal/dodo/credit is not behind the admin guard (it keeps DODO_INTERNAL_SECRET)', async () => {
    // Pin the dodo secret so the result does not depend on what other suites left in env:
    // the dodo router's own check must answer (its error), never the admin guard's.
    const prev = process.env.DODO_INTERNAL_SECRET;
    process.env.DODO_INTERNAL_SECRET = DODO;
    try {
      const res = await request(build()).post('/internal/dodo/credit').send({});
      expect(res.body?.error).to.equal('invalid_dodo_internal_secret');
      expect(res.body?.error).to.not.equal('Unauthorized');
    } finally {
      if (prev === undefined) delete process.env.DODO_INTERNAL_SECRET; else process.env.DODO_INTERNAL_SECRET = prev;
    }
  });

  it('secretEquals is digest-based: wrong lengths and empties are false, equal is true', () => {
    expect(secretEquals('abc', 'abc')).to.equal(true);
    expect(secretEquals('abc', 'abcd')).to.equal(false);
    expect(secretEquals('', '')).to.equal(false);
    expect(secretEquals(undefined, 'abc')).to.equal(false);
  });
});
