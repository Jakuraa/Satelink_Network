// GET /api/public/stats — sanitized network facts for public pages.
//
// Decision 2026-10-13: /api/financial/truth is admin-only. Public pages
// (/node, /machine-console, mission-control's network panels) read this
// endpoint instead. It carries ONLY node count, uptime and request volume —
// never revenue, treasury, account, balance, deposit or settlement fields.
//
// The response is built from PUBLIC_STATS_SHAPE alone (an allowlist, not a
// denylist): adding a field means adding it here, and the allowlist test in
// test/public_stats.test.js fails on any key it does not know.
//
// Request volume reuses getFreeTierStats() (a Redis scan), so the result is
// cached in-process for CACHE_MS to keep a public endpoint from amplifying
// load.

import { Router } from 'express';

export const PUBLIC_STATS_SHAPE = Object.freeze({
  ok: 'boolean',
  generated_at: 'string',
  nodes_online: 'number|null',
  uptime_pct_24h: 'number|null',
  api_uptime_seconds: 'number',
  requests_24h: 'number|null',
});

const CACHE_MS = 60_000;

function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function readStats(pool, getFreeTierStats) {
  const [nodes, regNodes, health, freeTier] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM nodes WHERE status = 'online' OR status = 'active'`).catch(() => null),
    pool.query(`SELECT COUNT(*)::int AS count FROM registered_nodes WHERE status = 'active'`).catch(() => null),
    pool.query(
      `SELECT ROUND(100.0*COUNT(*) FILTER (WHERE status IN ('healthy','ok','up','online'))/NULLIF(COUNT(*),0),2)::float AS uptime
         FROM node_health_logs WHERE checked_at >= extract(epoch from now())-86400`
    ).catch(() => null),
    getFreeTierStats ? getFreeTierStats().catch(() => null) : Promise.resolve(null),
  ]);

  // Unknown stays null (never 0) when a source failed.
  const nodeCounts = [nodes, regNodes].map((r) => toNumberOrNull(r?.rows?.[0]?.count));
  const nodesOnline = nodeCounts.every((c) => c === null) ? null : nodeCounts.reduce((a, c) => a + (c ?? 0), 0);

  return {
    nodes_online: nodesOnline,
    uptime_pct_24h: toNumberOrNull(health?.rows?.[0]?.uptime),
    requests_24h: toNumberOrNull(freeTier?.totalCalls),
  };
}

// Builds the response strictly from the allowlist.
export function sanitizePublicStats(raw) {
  const out = {};
  for (const key of Object.keys(PUBLIC_STATS_SHAPE)) {
    if (key in raw) out[key] = raw[key];
  }
  return out;
}

export function createPublicStatsRouter(pool, { getFreeTierStats, now = () => Date.now() } = {}) {
  const router = Router();
  // Caches the in-flight promise too, so concurrent cold requests share one read.
  let cache = null; // { at, stats: Promise }

  router.get('/stats', async (req, res) => {
    try {
      if (!cache || now() - cache.at >= CACHE_MS) {
        cache = { at: now(), stats: readStats(pool, getFreeTierStats) };
      }
      const { at, stats } = cache;
      res.set('Cache-Control', 'public, max-age=60');
      res.json(sanitizePublicStats({
        ok: true,
        generated_at: new Date(at).toISOString(),
        ...(await stats),
        api_uptime_seconds: Math.floor(process.uptime()),
      }));
    } catch (err) {
      console.error('[public-stats] failed:', err.message);
      res.status(500).json({ ok: false, error: 'stats_unavailable' });
    }
  });

  return router;
}
