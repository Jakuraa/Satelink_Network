// apps/api/src/routes/workflows_route.js
//
// Customer workflows beta — Strategy Lab, Agent Marketplace, Workflow runs.
// Mounted under /v1. Inert unless WORKFLOWS_BETA_ENABLED=true: when off, every
// request falls through (next()) so existing /v1 routes and 404s are unchanged.
//
//   GET  /v1/workflows/templates
//   GET  /v1/workflows/openapi.json           (contract; config/workflows_openapi.v1.json)
//   GET  /v1/workflows/mcp-tools              (MCP tool manifest)
//   GET  /v1/marketplace/capabilities?q=&network=&category=
//   GET  /v1/marketplace/capabilities/:id?network=
//   POST /v1/marketplace/quote                {capability, network}
//   POST /v1/strategy-lab/compile             {prompt, answers?}
//   POST /v1/workflows/runs                   {template, input, budget_usd?, idempotency_key}
//   GET  /v1/workflows/runs
//   GET  /v1/workflows/runs/:id               (graph + journal trace + receipt)
//   POST /v1/workflows/runs/:id/approve
//   POST /v1/workflows/runs/:id/cancel
//   GET  /v1/workflows/receipts/:id           (hash-verified receipt)
//   POST /v1/strategy-lab/strategies          {spec} | {prompt, answers?}  save a strategy
//   GET  /v1/strategy-lab/strategies[/:id]    saved strategies (+ their runs)
//
// Discovery (templates, capabilities, quote, compile) is public. Runs require an
// API key (X-API-Key, resolved via the canonical api_credits account; the customer
// id is a key reference, never the key) or a console session (accounts V1). No route here charges money:
// pricing is withheld until approved (see supplier_catalog.v1.json).

import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAccount } from '../billing/credit_service.mjs';
import { keyRef } from '../security/key_mask.mjs';
import { compileStrategy, describeSupported } from '../workflows/strategy_compiler.js';
import { WorkflowService, WorkflowError } from '../workflows/workflow_service.js';
import { PgRunStore } from '../workflows/run_store.js';
import { PgDurableStore } from '../vnext/reliability/pg_durable_store.js';
import { PgEvaluationStore } from '../trading/engine/index.js';

const CONFIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'config');
const OPENAPI = JSON.parse(fs.readFileSync(path.join(CONFIG, 'workflows_openapi.v1.json'), 'utf8'));
const MCP_TOOLS = JSON.parse(fs.readFileSync(path.join(CONFIG, 'mcp_workflow_tools.v1.json'), 'utf8'));

const RUN_ID = /^run_[0-9a-f]{8,64}$/;
const RECEIPT_ID = /^rcpt_[0-9a-f]{8,64}$/;
const STRATEGY_ID = /^strat_[0-9a-f]{16}$/;

export function workflowsEnabled(env = process.env) { return env.WORKFLOWS_BETA_ENABLED === 'true'; }

/**
 * @param {object} pool  pg pool (account resolution)
 * @param {object} [opts]
 *  - service: a WorkflowService (default: created lazily, in-memory store)
 *  - resolvePrincipal(req): override customer resolution (preview server / tests only)
 *  - enabled: override the env flag (tests)
 */
export function createWorkflowsRouter(pool, opts = {}) {
  const router = Router();
  const enabled = opts.enabled ?? workflowsEnabled();
  if (!enabled) {
    router.use((_req, _res, next) => next());
    return router;
  }

  // Production binding: kernel store wf_* + run store + evaluation store on the API's pool
  // (needs migrations 040 + 041). A failed boot (e.g. migration missing) answers 503 and
  // is retried on the next request — it never crashes the host app.
  let servicePromise = opts.service ? Promise.resolve(opts.service) : null;
  const service = () => {
    if (!servicePromise) {
      servicePromise = (pool ? WorkflowService.create({
        store: new PgDurableStore(pool, { prefix: 'wf_' }),
        runStore: new PgRunStore(pool),
        evaluationStore: new PgEvaluationStore((t, p) => pool.query(t, p)),
      }) : WorkflowService.create()).catch((e) => {
        console.error('[workflows] boot failed:', e?.message || e);
        servicePromise = null;
        throw new WorkflowError(503, 'workflows_unavailable', 'Workflows are temporarily unavailable.');
      });
    }
    return servicePromise;
  };

  // API key (machines, developers) first; else a console Better Auth session when
  // CONSOLE_ACCOUNTS_V1 is on. Session requests must carry X-Satelink-Console: 1
  // (the console accounts CSRF contract, enforced by csrfGuard below).
  const resolvePrincipal = opts.resolvePrincipal || (async (req) => {
    const apiKey = req.get('X-API-Key');
    if (apiKey) {
      const account = await resolveAccount(pool, { apiKey });
      // Same rule as billing (credit_service precheck): only active keys act.
      if (!account || (account.status && account.status !== 'active')) return null;
      return { id: keyRef(account.api_key) };
    }
    if (process.env.CONSOLE_ACCOUNTS_V1 === 'true' && req.get('x-satelink-console') === '1') {
      const { betterAuthSession } = await import('../console_accounts/router.mjs');
      const s = await betterAuthSession(pool, req);
      return s ? { id: `user:${s.accountId}` } : null;
    }
    return null;
  });
  const sessionCsrf = async (req, res, next) => {
    if (req.get('X-API-Key') || opts.resolvePrincipal) return next();
    const { csrfGuard } = await import('../console_accounts/router.mjs');
    return csrfGuard(req, res, next);
  };

  // Note: earlier /v1 mounts in app_factory parse JSON at 16kb first; this limit only
  // applies when the router is mounted on its own (tests, preview).
  const json = express.json({ limit: '16kb' });

  // Per-customer cap on run creation: backtests cost CPU and market-data requests and
  // are free during the beta, so they must not be an amplification lever.
  const RUNS_PER_MINUTE = Number(process.env.WORKFLOWS_RUNS_PER_MINUTE || 10);
  const recent = new Map(); // principal -> timestamps (ms) within the last minute
  const rateLimited = (principal) => {
    const now = Date.now();
    const ts = (recent.get(principal.id) || []).filter((t) => now - t < 60_000);
    if (ts.length >= RUNS_PER_MINUTE) { recent.set(principal.id, ts); return true; }
    ts.push(now); recent.set(principal.id, ts);
    if (recent.size > 10_000) recent.delete(recent.keys().next().value);
    return false;
  };
  const send = (res, e) => {
    if (e instanceof WorkflowError) return res.status(e.status).json({ ok: false, error: e.code, message: e.message, ...e.extra });
    if (e?.name === 'ReceiptIntegrityError') console.error('[workflows] RECEIPT INTEGRITY FAILURE:', e.message);
    else console.error('[workflows] unexpected error:', e?.message || e);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  };
  const authed = (fn) => async (req, res) => {
    try {
      const principal = await resolvePrincipal(req);
      if (!principal) return res.status(401).json({ ok: false, error: 'api_key_required', message: 'Send a Satelink API key as X-API-Key.' });
      return await fn(req, res, principal, await service());
    } catch (e) { return send(res, e); }
  };
  const open = (fn) => async (req, res) => {
    try { return await fn(req, res, await service()); } catch (e) { return send(res, e); }
  };

  // Contracts: the OpenAPI document and the MCP tool manifest (identical to
  // apps/mcp-server/src/workflow-tools.json — enforced by a test there).
  router.get('/workflows/openapi.json', (_req, res) => res.json(OPENAPI));
  router.get('/workflows/mcp-tools', (_req, res) => res.json({ ok: true, beta: true, manifest: MCP_TOOLS }));

  router.get('/workflows/templates', open((_req, res, svc) => res.json({ ok: true, beta: true, templates: svc.templates() })));

  router.get('/marketplace/capabilities', open((req, res, svc) => {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : '';
    const network = typeof req.query.network === 'string' ? req.query.network.slice(0, 64) : null;
    const category = typeof req.query.category === 'string' ? req.query.category.slice(0, 64) : null;
    res.json({ ok: true, beta: true, statuses: svc.catalog.raw.statuses, capabilities: svc.searchCapabilities({ q, network, category }), not_listed: svc.catalog.raw.candidates_not_listed || [] });
  }));

  router.get('/marketplace/capabilities/:id', open((req, res, svc) => {
    const network = typeof req.query.network === 'string' ? req.query.network.slice(0, 64) : null;
    const c = svc.describeCapability(req.params.id, network);
    if (!c) return res.status(404).json({ ok: false, error: 'unknown_capability' });
    return res.json({ ok: true, beta: true, capability: c });
  }));

  router.post('/marketplace/quote', json, open((req, res, svc) => {
    const { capability, network } = req.body || {};
    if (typeof capability !== 'string' || typeof network !== 'string') return res.status(422).json({ ok: false, error: 'capability_and_network_required' });
    return res.json({ ok: true, beta: true, quote: svc.quote({ capability, network }) });
  }));

  router.post('/strategy-lab/compile', json, (req, res) => {
    const { prompt, answers } = req.body || {};
    const out = compileStrategy(prompt, answers && typeof answers === 'object' ? answers : {});
    res.status(out.status === 'unsupported' ? 422 : 200).json({ ok: out.status === 'compiled', beta: true, ...out, supported: describeSupported() });
  });

  router.post('/workflows/runs', json, sessionCsrf, authed(async (req, res, principal, svc) => {
    if (rateLimited(principal)) return res.status(429).set('Retry-After', '60').json({ ok: false, error: 'rate_limited', message: `At most ${RUNS_PER_MINUTE} runs per minute.` });
    const out = await svc.createRun(principal, req.body || {});
    res.status(out.replayed ? 200 : 201).json({ ok: true, beta: true, replayed: out.replayed, run: out.run });
  }));

  router.get('/workflows/runs', authed(async (req, res, principal, svc) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    res.json({ ok: true, beta: true, runs: await svc.listRuns(principal, { limit }) });
  }));

  router.get('/workflows/runs/:id', authed(async (req, res, principal, svc) => {
    if (!RUN_ID.test(req.params.id)) return res.status(404).json({ ok: false, error: 'run_not_found' });
    return res.json({ ok: true, beta: true, run: await svc.getRun(principal, req.params.id) });
  }));

  router.get('/workflows/receipts/:id', authed(async (req, res, principal, svc) => {
    if (!RECEIPT_ID.test(req.params.id)) return res.status(404).json({ ok: false, error: 'receipt_not_found' });
    return res.json({ ok: true, beta: true, receipt: await svc.getReceipt(principal, req.params.id) });
  }));

  router.post('/strategy-lab/strategies', json, sessionCsrf, authed(async (req, res, principal, svc) => {
    res.status(201).json({ ok: true, beta: true, strategy: await svc.saveStrategy(principal, req.body || {}) });
  }));

  router.get('/strategy-lab/strategies', authed(async (_req, res, principal, svc) => res.json({ ok: true, beta: true, strategies: await svc.listStrategies(principal) })));

  router.get('/strategy-lab/strategies/:id', authed(async (req, res, principal, svc) => {
    if (!STRATEGY_ID.test(req.params.id)) return res.status(404).json({ ok: false, error: 'strategy_not_found' });
    return res.json({ ok: true, beta: true, strategy: await svc.getStrategy(principal, req.params.id) });
  }));

  router.post('/workflows/runs/:id/approve', json, sessionCsrf, authed(async (req, res, principal, svc) => {
    const out = await svc.approve(principal, req.params.id);
    res.json({ ok: true, beta: true, changed: out.changed, run: out.run });
  }));

  router.post('/workflows/runs/:id/cancel', json, sessionCsrf, authed(async (req, res, principal, svc) => {
    const out = await svc.cancel(principal, req.params.id);
    res.json({ ok: true, beta: true, run: out.run });
  }));

  return router;
}
