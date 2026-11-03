#!/usr/bin/env node
// Local customer preview of the workflows beta (Strategy Lab, Marketplace, Workflows).
//
// Serves ONLY the workflows router on 127.0.0.1 with an in-memory kernel store —
// no database, no Redis, no schedulers, no settlement, no production access.
// A stub session lets the real console (apps/console, `next dev`) sign in as a
// preview user. Everything the console renders comes from the real workflow code:
// real Binance public klines for backtests, a real public Polygon RPC for wallet
// balances, real supplier statuses from config/supplier_catalog.v1.json.
//
//   node apps/api/scripts/preview_workflows_beta.mjs      (see scripts/preview/README.md)
//
// Runs are lost when this process stops (in-memory store).

import express from 'express';
import { createWorkflowsRouter } from '../src/routes/workflows_route.js';
import { WorkflowService } from '../src/workflows/workflow_service.js';

if (process.env.NODE_ENV === 'production') {
  console.error('[preview] refusing to start with NODE_ENV=production');
  process.exit(1);
}

const PORT = Number(process.env.PREVIEW_API_PORT || 4400);
const CONSOLE = process.env.PREVIEW_CONSOLE_ORIGIN || 'http://localhost:3400';
const PREVIEW_KEY = 'sk_preview_local_only_0000000000';
const RPC_URL = process.env.WORKFLOWS_POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com';

const service = await WorkflowService.create({ env: { WORKFLOWS_POLYGON_RPC_URL: RPC_URL } });
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

app.use('/v1', createWorkflowsRouter(null, {
  enabled: true,
  service,
  resolvePrincipal: async (req) => (req.get('X-API-Key') === PREVIEW_KEY ? { id: 'kref_preview_customer' } : null),
}));

app.get('/health', (_req, res) => res.json({ ok: true, preview: true, kernel: 'in-memory' }));
app.use((_req, res) => res.status(404).json({ ok: false, error: 'not_available_in_preview' }));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[preview] workflows beta API on http://127.0.0.1:${PORT}`);
  console.log(`[preview] Polygon RPC (wallet balance supplier): ${RPC_URL}`);
  console.log(`[preview] sign in: http://localhost:${PORT}/preview/login  →  ${CONSOLE}/strategy-lab`);
});
