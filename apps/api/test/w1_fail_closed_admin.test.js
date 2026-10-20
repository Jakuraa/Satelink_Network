import { expect } from 'chai';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { requireHeaderSecret } from '../src/security/header_secret.js';
import { createNodeRegistryRouter } from '../src/services/node_registry/registration.js';

// W1 (2026-10-20): admin checks written as `header !== process.env.X` passed when X was
// unset and the header absent. They now fail closed (503) and compare in constant time.

const API = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = ['ADMIN_API_KEY', 'MASTER_ADMIN_TOKEN'];
let saved = {};

// Counts data writes only: the router runs CREATE/ALTER bootstrap DDL at construction.
function trapDb() {
  const hits = { n: 0 };
  return {
    hits,
    async query(sql) {
      if (/^\s*(UPDATE|INSERT|DELETE)\b/i.test(String(sql))) hits.n++;
      return { rows: [], rowCount: 0 };
    },
  };
}

describe('W1 — fail-closed admin header secrets', () => {
  beforeEach(() => { saved = {}; for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  describe('requireHeaderSecret', () => {
    const app = () => {
      const a = express();
      a.get('/x', requireHeaderSecret('x-admin-key', ['ADMIN_API_KEY', 'MASTER_ADMIN_TOKEN']), (_q, r) => r.json({ ok: true }));
      return a;
    };
    it('env unset + header absent → 503 (the old check let this through)', async () => {
      expect((await request(app()).get('/x')).status).to.equal(503);
    });
    it('env set + header absent → 403', async () => {
      process.env.ADMIN_API_KEY = 'k-123';
      expect((await request(app()).get('/x')).status).to.equal(403);
    });
    it('env set + wrong header (incl. different length) → 403', async () => {
      process.env.ADMIN_API_KEY = 'k-123';
      expect((await request(app()).get('/x').set('x-admin-key', 'k-124')).status).to.equal(403);
      expect((await request(app()).get('/x').set('x-admin-key', 'k')).status).to.equal(403);
    });
    it('matches any configured secret', async () => {
      process.env.MASTER_ADMIN_TOKEN = 'm-456';
      expect((await request(app()).get('/x').set('x-admin-key', 'm-456')).status).to.equal(200);
    });
  });

  describe('node registry admin routes', () => {
    const app = (db) => { const a = express(); a.use(express.json()); a.use('/api/nodes', createNodeRegistryRouter(db, null)); return a; };
    it('reputation/update with ADMIN_API_KEY unset and no header → 503, no DB write', async () => {
      const db = trapDb();
      const a = app(db);
      const res = await request(a).post('/api/nodes/n1/reputation/update').send({});
      expect(res.status).to.equal(503);
      expect(db.hits.n).to.equal(0);
    });
    it('PATCH /:nodeId with both secrets unset and no header → 503, no DB write', async () => {
      const db = trapDb();
      const a = app(db);
      const res = await request(a).patch('/api/nodes/n1').send({ status: 'active' });
      expect(res.status).to.equal(503);
      expect(db.hits.n).to.equal(0);
    });
  });

  describe('static wiring', () => {
    const af = readFileSync(join(API, 'app_factory.mjs'), 'utf8');
    const rpc = readFileSync(join(API, 'src/workloads/rpc_gateway/rpc_gateway.js'), 'utf8');
    it('POST /rpc/keys uses the fail-closed guard', () => {
      expect(rpc).to.match(/router\.post\('\/keys', requireHeaderSecret\('x-admin-key', \['ADMIN_API_KEY'\]\)/);
      expect(rpc).to.not.match(/adminKey !== process\.env/);
    });
    it('node-token minting is not mounted', () => {
      expect(af).to.not.match(/node_auth_route/);
    });
    it('parity reports are staff-gated by exact path, leaving /internal/dodo alone', () => {
      expect(af).to.match(/app\.get\(\["\/internal\/ledger-parity", "\/internal\/draw-parity", "\/internal\/capacity-parity"\], requireAdminAuth\)/);
      expect(af).to.not.match(/app\.use\("\/internal", requireAdminAuth/);
    });
  });
});
