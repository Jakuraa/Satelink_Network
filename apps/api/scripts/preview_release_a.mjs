#!/usr/bin/env node
// Release A local preview API: the task engine (#609 kernel + registry + router + planner + simulated money)
// on a LOCAL Postgres. Refuses NODE_ENV=production and any non-loopback database. Binds 127.0.0.1.
// Nothing here can move money: credits are simulated, the only supplier is the local mock store.
//
//   DATABASE_URL_LOCAL=postgresql://…@127.0.0.1:5432/satelink_local MOCK_STORE_URL=http://127.0.0.1:4410 \
//     node apps/api/scripts/preview_release_a.mjs
//
// Auth (preview only): a Better Auth session cookie when the console provides one (S1), or the local dev
// header `X-Preview-Key: sk_preview_local_<name>` (scripts and drills). Both are rejected in production.
import express from 'express';
import pg from 'pg';
import { TaskService } from '../src/workflows/task_service.js';
import { CapabilityRegistry } from '../src/workflows/capability_registry.js';
import { createModelRouter } from '../src/workflows/model_router.js';
import { loadPricing } from '../src/workflows/pricing.js';
import { createMockStoreConnector } from '../src/workflows/mock_store_connector.js';
import { PgDurableStore } from '../src/vnext/reliability/pg_durable_store.js';
import { PgRunStore } from '../src/workflows/run_store.js';
import { createTasksRouter } from '../src/routes/tasks_route.js';

if (process.env.NODE_ENV === 'production') { console.error('[preview] refusing to start with NODE_ENV=production'); process.exit(1); }
const DB_URL = process.env.DATABASE_URL_LOCAL || '';
const host = (() => { try { return new URL(DB_URL).hostname; } catch { return ''; } })();
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) { console.error(`[preview] refusing non-local database host '${host}' (set DATABASE_URL_LOCAL)`); process.exit(1); }
const PORT = Number(process.env.PREVIEW_API_PORT || 4500);

const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });
const svc = await TaskService.create({
  pool, registry: new CapabilityRegistry(pool), router: createModelRouter(), pricing: loadPricing(),
  connectors: { mock_store: createMockStoreConnector({ baseUrl: process.env.MOCK_STORE_URL || 'http://127.0.0.1:4410' }) },
  workflowOptions: { store: new PgDurableStore(pool, { prefix: 'wf_' }), runStore: new PgRunStore(pool), env: {} },
});
console.log(`[preview] recovered at boot: ${JSON.stringify(svc.lastRecovery)}`);

const resolvePrincipal = async (req) => {
  const key = req.get('X-Preview-Key') || '';
  const m = /^sk_preview_local_([a-z0-9-]{3,40})$/.exec(key);
  if (m) return { id: `user:preview-${m[1]}`, via: 'api_key', actor_type: 'human' };
  if (svc.sessionResolver) return svc.sessionResolver(req); // wired by the console auth slice (S1)
  return null;
};

const app = express();
app.disable('x-powered-by');
app.get('/health', async (_req, res) => {
  const { rows } = await pool.query('SELECT 1 AS ok');
  res.json({ ok: rows[0].ok === 1, preview: true, simulated: true, model: svc.router.fixture ? 'fixture' : 'openrouter', model_badge: svc.router.badge });
});
app.use('/v1', createTasksRouter(svc, { resolvePrincipal }));
// Local operator check (preview only): ledger ↔ steps ↔ receipts.
app.post('/preview/reconcile', async (_req, res) => { res.json({ ok: true, ...(await svc.reconcile()) }); });
app.use((_req, res) => res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not available in the preview.', retryable: false } }));

const sweep = setInterval(() => { svc.sweep().catch((e) => console.error('[preview] sweep', e?.message)); }, 30_000);
sweep.unref();
app.listen(PORT, '127.0.0.1', () => console.log(`[preview] Release A API on http://127.0.0.1:${PORT} (model: ${svc.router.fixture ? 'fixture' : 'openrouter'})`));
