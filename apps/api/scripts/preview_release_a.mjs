#!/usr/bin/env node
// Release A local preview API: the task engine (#609 kernel + registry + router + planner + simulated money)
// on a LOCAL Postgres. Refuses NODE_ENV=production and any non-loopback database. Binds 127.0.0.1.
// Nothing here can move money: credits are simulated, the only supplier is the local mock store.
//
//   DATABASE_URL_LOCAL=postgresql://…@127.0.0.1:5432/satelink_local MOCK_STORE_URL=http://127.0.0.1:4410 \
//     node apps/api/scripts/preview_release_a.mjs
//
// Auth (preview only): the real Better Auth (magic link, local mail sink, host-only cookies) or the local dev
// header `X-Preview-Key: sk_preview_local_<name>` (scripts and drills). The whole server refuses production.
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
import { ConnectionStore } from '../src/workflows/connectors/oauth_pkce.js';
import { createMcpFoodConnector } from '../src/workflows/connectors/mcp_food_connector.js';
import { createTradingConnector } from '../src/workflows/connectors/trading_connector.js';
import { PgEvaluationStore } from '../src/trading/engine/index.js';
import { getBetterAuth, mountBetterAuth } from '../src/auth/better_auth.mjs';
import { getMigrations } from 'better-auth/db/migration';
import { fromNodeHeaders } from 'better-auth/node';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

if (process.env.NODE_ENV === 'production') { console.error('[preview] refusing to start with NODE_ENV=production'); process.exit(1); }
const DB_URL = process.env.DATABASE_URL_LOCAL || '';
const host = (() => { try { return new URL(DB_URL).hostname; } catch { return ''; } })();
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) { console.error(`[preview] refusing non-local database host '${host}' (set DATABASE_URL_LOCAL)`); process.exit(1); }
const PORT = Number(process.env.PREVIEW_API_PORT || 4500);

// ── Real Better Auth (magic-link sign-up/sign-in) on the local DB, preview cookie + mail-sink mode ──
const PREVIEW_DIR = process.env.PREVIEW_STATE_DIR || path.join(os.homedir(), '.satelink-preview');
fs.mkdirSync(PREVIEW_DIR, { recursive: true, mode: 0o700 });
const secretFile = path.join(PREVIEW_DIR, 'auth-secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 }); // fresh LOCAL test secret
const CONSOLE_ORIGIN = process.env.PREVIEW_CONSOLE_ORIGIN || 'http://localhost:3400';
Object.assign(process.env, {
  AUTH_ENABLED: 'true', BETTER_AUTH_SECRET: fs.readFileSync(secretFile, 'utf8').trim(),
  BETTER_AUTH_URL: `${CONSOLE_ORIGIN}/api/identity`, BETTER_AUTH_TRUSTED_ORIGINS: CONSOLE_ORIGIN,
  AUTH_COOKIE_DOMAIN: 'none', AUTH_SECURE_COOKIES: 'false',
  ...(process.env.AUTH_PREVIEW_RATE_LIMIT === 'off' ? { AUTH_PREVIEW_RATE_LIMIT: 'off' } : {}), // E2E only (opt-in)
  AUTH_DEV_MAIL_SINK: process.env.AUTH_DEV_MAIL_SINK || path.join(PREVIEW_DIR, 'mailbox.jsonl'),
});
delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET; delete process.env.RESEND_API_KEY;

const pool = new pg.Pool({ connectionString: DB_URL, max: 8 });
// Connector token encryption key: fresh LOCAL key (D-A2), never stored in the database.
const keyFile = path.join(PREVIEW_DIR, 'connector-key');
if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const FOOD_URL = process.env.MOCK_FOOD_URL || 'http://127.0.0.1:4420';
const API_ORIGIN = `http://127.0.0.1:${Number(process.env.PREVIEW_API_PORT || 4500)}`;
const connections = new ConnectionStore({ pool, keyHex: fs.readFileSync(keyFile, 'utf8').trim(), connectors: {
  food_delivery_mock: { issuer: FOOD_URL, clientId: 'satelink-preview', scopes: 'food.read food.order', name: 'Food Delivery (MOCK — not connected to Swiggy)',
    redirectUri: `${API_ORIGIN}/v1/connections/food_delivery_mock/callback` },
} });
const auth = await getBetterAuth(pool);
const { runMigrations } = await getMigrations(auth.options);
await runMigrations(); // Better Auth's own tables (user/session/account/verification…) on the LOCAL db
const svc = await TaskService.create({
  pool, registry: new CapabilityRegistry(pool), router: createModelRouter(), pricing: loadPricing(),
  quoteTtlMs: Number(process.env.PREVIEW_QUOTE_TTL_MS) > 0 ? Number(process.env.PREVIEW_QUOTE_TTL_MS) : 10 * 60_000,
  connectors: {
    mock_store: createMockStoreConnector({ baseUrl: process.env.MOCK_STORE_URL || 'http://127.0.0.1:4410' }),
    mcp_food: createMcpFoodConnector({ url: `${FOOD_URL}/mcp`, connectorId: 'food_delivery_mock', connections }),
    trading_engine: createTradingConnector({ evaluationStore: new PgEvaluationStore((t, p) => pool.query(t, p)) }),
  },
  workflowOptions: { store: new PgDurableStore(pool, { prefix: 'wf_' }), runStore: new PgRunStore(pool), env: {} },
});
console.log(`[preview] recovered at boot: ${JSON.stringify(svc.lastRecovery)}`);

const resolvePrincipal = async (req) => {
  const key = req.get('X-Preview-Key') || '';
  const m = /^sk_preview_local_([a-z0-9-]{3,40})$/.exec(key);
  if (m) return { id: `user:preview-${m[1]}`, via: 'api_key', actor_type: 'human' };
  const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  return s?.user ? { id: `user:${s.user.id}`, via: 'session', actor_type: 'human', email: s.user.email } : null;
};

const app = express();
app.disable('x-powered-by');
app.get('/health', async (_req, res) => {
  const { rows } = await pool.query('SELECT 1 AS ok');
  res.json({ ok: rows[0].ok === 1, preview: true, simulated: true, model: svc.router.fixture ? 'fixture' : 'openrouter', model_badge: svc.router.badge });
});
mountBetterAuth(app, pool);
// Dev mail sink reader (local preview only): the latest auth email for an address — used by E2E and by
// the console's "open the sign-in link" helper. Never exists outside the preview server.
app.get('/preview/mailbox', (req, res) => {
  const to = String(req.query.to || '').toLowerCase();
  const lines = fs.existsSync(process.env.AUTH_DEV_MAIL_SINK) ? fs.readFileSync(process.env.AUTH_DEV_MAIL_SINK, 'utf8').trim().split('\n').filter(Boolean) : [];
  const mail = lines.map((l) => JSON.parse(l)).filter((m) => m.to.toLowerCase() === to).pop() || null;
  res.json({ ok: true, preview: true, mail });
});
app.use('/v1', createTasksRouter(svc, { resolvePrincipal, connections, consoleOrigin: CONSOLE_ORIGIN }));
// Local operator check (preview only): ledger ↔ steps ↔ receipts.
app.post('/preview/reconcile', async (_req, res) => { res.json({ ok: true, ...(await svc.reconcile()) }); });
app.use((_req, res) => res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not available in the preview.', retryable: false } }));

const sweep = setInterval(() => { svc.sweep().catch((e) => console.error('[preview] sweep', e?.message)); }, 30_000);
sweep.unref();
app.listen(PORT, '127.0.0.1', () => console.log(`[preview] Release A API on http://127.0.0.1:${PORT} (model: ${svc.router.fixture ? 'fixture' : 'openrouter'})`));
