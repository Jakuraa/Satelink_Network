// Beta waitlist capture (Phase 7 amendment, #511) — POST /beta/request and
// GET /admin/beta-requests. Uses an in-memory stub pool (same technique as
// plans_console_routes.test.js) rather than a real Postgres: the SQL surface
// here is small and deterministic enough that a stub gives real coverage in
// CI (no CONSOLE_ACCOUNTS_TEST_DB / local DB required).
import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { createBetaRequestsRouter } from '../src/routes/beta_requests.js';
import { requireAdminAuth, createAdminRouter } from '../src/admin/admin_router.js';
import { __resetBetaRequestsSchemaCache } from '../src/beta/beta_requests.mjs';

function makeStorePool() {
  const byEmail = new Map();
  let nextId = 1;
  return {
    _byEmail: byEmail,
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      if (s.startsWith('CREATE TABLE') || s.startsWith('CREATE UNIQUE INDEX') || s.startsWith('CREATE INDEX')) {
        return { rows: [], rowCount: 0 };
      }
      if (s.startsWith('INSERT INTO beta_requests')) {
        const [email, name, role, useCase, capitalBand, broker, source, ipHash] = params;
        const key = email.toLowerCase();
        if (!byEmail.has(key)) {
          byEmail.set(key, {
            id: nextId++, email, name, role, use_case: useCase,
            capital_band: capitalBand, broker, source, ip_hash: ipHash,
            created_at: new Date().toISOString(),
          });
        }
        return { rows: [], rowCount: 0 };
      }
      if (s.startsWith('SELECT * FROM beta_requests WHERE lower(email)')) {
        const key = String(params[0]).toLowerCase();
        const row = byEmail.get(key);
        return { rows: row ? [row] : [] };
      }
      if (s.includes("to_regclass('public.beta_requests')")) {
        return { rows: [{ t: 'beta_requests' }] };
      }
      if (s.startsWith('SELECT id, email, name, role, use_case, capital_band, broker, source, created_at')) {
        const rows = [...byEmail.values()].sort((a, b) => b.id - a.id);
        return { rows };
      }
      if (s.startsWith('SELECT COUNT(*)::int AS c FROM beta_requests')) {
        return { rows: [{ c: byEmail.size }] };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

const VALID_BODY = {
  email: 'Trader@Example.com',
  name: 'Ada Trader',
  role: 'human',
  useCase: 'Paper-trading my own momentum strategy',
  capitalBand: '$10k-$50k',
};

describe('POST /beta/request', () => {
  beforeEach(() => { __resetBetaRequestsSchemaCache(); });

  it('stores a valid request', async () => {
    const pool = makeStorePool();
    const app = express();
    app.use('/beta', createBetaRequestsRouter(pool, { sendEmails: async () => ({ founder: 'skipped_no_recipient', requester: 'skipped_no_sender' }) }));

    const res = await request(app).post('/beta/request').send(VALID_BODY);
    expect(res.status).to.equal(200);
    expect(res.body.ok).to.equal(true);
    expect(pool._byEmail.get('trader@example.com')).to.exist;
    expect(pool._byEmail.get('trader@example.com').role).to.equal('human');
  });

  it('is idempotent on a duplicate email', async () => {
    const pool = makeStorePool();
    const app = express();
    app.use('/beta', createBetaRequestsRouter(pool, { sendEmails: async () => ({}) }));

    const first = await request(app).post('/beta/request').send(VALID_BODY);
    const second = await request(app).post('/beta/request').send({ ...VALID_BODY, name: 'Ada Second Submit' });

    expect(first.status).to.equal(200);
    expect(second.status).to.equal(200);
    expect(pool._byEmail.size).to.equal(1);
    // First submission wins — no overwrite on conflict.
    expect(pool._byEmail.get('trader@example.com').name).to.equal('Ada Trader');
  });

  it('rejects an invalid email with 400', async () => {
    const pool = makeStorePool();
    const app = express();
    app.use('/beta', createBetaRequestsRouter(pool, { sendEmails: async () => ({}) }));

    const res = await request(app).post('/beta/request').send({ ...VALID_BODY, email: 'not-an-email' });
    expect(res.status).to.equal(400);
    expect(res.body.ok).to.equal(false);
    expect(res.body.issues).to.have.property('email');
    expect(pool._byEmail.size).to.equal(0);
  });

  it('rejects an unknown role with 400', async () => {
    const pool = makeStorePool();
    const app = express();
    app.use('/beta', createBetaRequestsRouter(pool, { sendEmails: async () => ({}) }));

    const res = await request(app).post('/beta/request').send({ ...VALID_BODY, role: 'robot_overlord' });
    expect(res.status).to.equal(400);
    expect(res.body.issues).to.have.property('role');
  });

  it('still stores the row when email sending fails', async () => {
    const pool = makeStorePool();
    const app = express();
    app.use('/beta', createBetaRequestsRouter(pool, {
      sendEmails: async () => { throw new Error('resend_down'); },
    }));

    const res = await request(app).post('/beta/request').send(VALID_BODY);
    expect(res.status).to.equal(200);
    expect(res.body.ok).to.equal(true);
    expect(pool._byEmail.get('trader@example.com')).to.exist;
  });

  it('rate-limits repeated requests from the same IP', async function () {
    this.timeout(20000);
    const pool = makeStorePool();
    const app = express();
    app.use('/beta', createBetaRequestsRouter(pool, { sendEmails: async () => ({}) }));

    let sawRateLimited = false;
    for (let i = 0; i < 30 && !sawRateLimited; i++) {
      const res = await request(app).post('/beta/request').send({ ...VALID_BODY, email: `rl-${i}@example.com` });
      if (res.status === 429) sawRateLimited = true;
    }
    expect(sawRateLimited).to.equal(true);
  });
});

describe('GET /admin/beta-requests', () => {
  const savedToken = process.env.ADMIN_SECRET_TOKEN;
  beforeEach(() => { process.env.ADMIN_SECRET_TOKEN = 'test-admin-token'; });
  after(() => { if (savedToken === undefined) delete process.env.ADMIN_SECRET_TOKEN; else process.env.ADMIN_SECRET_TOKEN = savedToken; });

  it('requires the admin token', async () => {
    const pool = makeStorePool();
    const app = express();
    app.use('/admin', requireAdminAuth, createAdminRouter(pool, null));

    const res = await request(app).get('/admin/beta-requests');
    expect(res.status).to.equal(401);
  });

  it('lists stored requests for the admin', async () => {
    const pool = makeStorePool();
    pool._byEmail.set('a@example.com', { id: 1, email: 'a@example.com', name: 'A', role: 'human', use_case: 'x', capital_band: null, broker: null, source: null, created_at: new Date().toISOString() });
    const app = express();
    app.use('/admin', requireAdminAuth, createAdminRouter(pool, null));

    const res = await request(app).get('/admin/beta-requests').set('x-admin-token', 'test-admin-token');
    expect(res.status).to.equal(200);
    expect(res.body.ok).to.equal(true);
    expect(res.body.data.requests).to.have.length(1);
    expect(res.body.data.requests[0].email).to.equal('a@example.com');
  });
});
