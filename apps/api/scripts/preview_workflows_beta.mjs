#!/usr/bin/env node
// Local customer preview of the workflows beta (Strategy Lab, Marketplace, Workflows).
//
// Serves ONLY the workflows router on 127.0.0.1, backed by a LOCAL PostgreSQL database
// (migrations 040 + 041) — runs, receipts, strategies and the hash-chained journal
// survive restarts. No production access: the database URL must point at localhost,
// NODE_ENV=production is refused, and nothing here schedules, settles or charges.
// A stub session lets the real console (apps/console, `next dev`) sign in as a preview
// user. Everything rendered comes from the real workflow code: real Binance public
// klines for backtests, a real public Polygon RPC for wallet balances, real supplier
// statuses from config/supplier_catalog.v1.json.
//
//   bash scripts/preview/beta-preview.sh      (see scripts/preview/README.md)

import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createWorkflowsRouter } from '../src/routes/workflows_route.js';
import { WorkflowService } from '../src/workflows/workflow_service.js';
import { PgRunStore } from '../src/workflows/run_store.js';
import { PgDurableStore } from '../src/vnext/reliability/pg_durable_store.js';
import { PgEvaluationStore } from '../src/trading/engine/index.js';

if (process.env.NODE_ENV === 'production') {
  console.error('[preview] refusing to start with NODE_ENV=production');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(__dirname, '..', '..', '..', 'database', 'migrations');
const PORT = Number(process.env.PREVIEW_API_PORT || 4400);
const CONSOLE = process.env.PREVIEW_CONSOLE_ORIGIN || 'http://localhost:3400';
const PREVIEW_KEY = 'sk_preview_local_only_0000000000';
const RPC_URL = process.env.WORKFLOWS_POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com';
const DB_URL = process.env.PREVIEW_DATABASE_URL || `postgresql://${os.userInfo().username}@127.0.0.1:5432/satelink_beta_preview`;

const host = new URL(DB_URL).hostname;
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.error(`[preview] refusing non-local database host '${host}'`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DB_URL, max: 5 });
// Apply 040 + 041 once on a fresh preview database (the canonical runner needs the full
// production chain, which an empty local DB cannot satisfy — see BASELINE.md).
const { rows: [has] } = await pool.query("SELECT to_regclass('workflow_runs') AS t, to_regclass('trading_strategy_evaluations') AS e");
if (!has.e) await pool.query(fs.readFileSync(path.join(MIGRATIONS, '040_trading_strategy_evaluations.sql'), 'utf8'));
if (!has.t) await pool.query(fs.readFileSync(path.join(MIGRATIONS, '041_customer_workflows.sql'), 'utf8'));

const service = await WorkflowService.create({
  store: new PgDurableStore(pool, { prefix: 'wf_' }),
  runStore: new PgRunStore(pool),
  evaluationStore: new PgEvaluationStore((t, p) => pool.query(t, p)),
  env: { WORKFLOWS_POLYGON_RPC_URL: RPC_URL },
});
const app = express();

const hasSession = (req) => /(?:^|;\s*)satelink\.session_token=preview(?:;|$)/.test(req.get('cookie') || '');

// Stub Better Auth session for the console (preview only).
app.get('/api/identity/get-session', (req, res) => {
  if (!hasSession(req)) return res.json(null);
  return res.json({
    user: { id: 'preview-user', name: 'Preview Customer', email: 'preview@localhost', emailVerified: true },
    session: { id: 'preview', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
  });
});
app.post('/api/identity/sign-out', (_req, res) => res.json({ ok: true }));

// One click "sign in": sets the console session cookie and a connected preview key
// (cookies are per host, not per port, so localhost:3400 receives them).
app.get('/preview/login', (_req, res) => {
  const keys = encodeURIComponent(JSON.stringify([{ k: PREVIEW_KEY, label: 'Preview key', addedAt: new Date().toISOString() }]));
  res.setHeader('Set-Cookie', [
    'satelink.session_token=preview; Path=/; HttpOnly; SameSite=Lax',
    `slc_keys=${keys}; Path=/; HttpOnly; SameSite=Strict`,
  ]);
  res.redirect(`${CONSOLE}/strategy-lab`);
});

app.use('/v1', createWorkflowsRouter(pool, {
  enabled: true,
  service,
  resolvePrincipal: async (req) => (req.get('X-API-Key') === PREVIEW_KEY ? { id: 'kref_preview_customer' } : null),
}));

app.get('/health', async (_req, res) => {
  const { rows: [r] } = await pool.query('SELECT count(*)::int AS runs FROM workflow_runs');
  res.json({ ok: true, preview: true, store: 'postgres', database: new URL(DB_URL).pathname.slice(1), runs: r.runs, recovered: service.lastRecovery });
});
app.use((_req, res) => res.status(404).json({ ok: false, error: 'not_available_in_preview' }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[preview] workflows beta API on http://127.0.0.1:${PORT} (Postgres ${new URL(DB_URL).pathname.slice(1)})`);
  console.log(`[preview] recovery on boot: ${JSON.stringify(service.lastRecovery)}`);
  console.log(`[preview] Polygon RPC (wallet balance supplier): ${new URL(RPC_URL).host}`); // host only — keyed URLs must not be logged
  console.log(`[preview] sign in: http://localhost:${PORT}/preview/login  →  ${CONSOLE}/strategy-lab`);
});
