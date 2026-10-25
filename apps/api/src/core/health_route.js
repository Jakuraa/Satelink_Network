// Public /health. Always 200 (Railway's healthcheck), and reports which commit is running so
// every post-deploy probe can prove what is live (2026-10-21: three merges sat undeployed for
// hours and only process uptime hinted at it).

const SHA_RE = /^[0-9a-f]{7,40}$/i;

/**
 * The git commit this process was built from. Railway sets RAILWAY_GIT_COMMIT_SHA on
 * GitHub-triggered deploys; GIT_SHA covers other builders. Anything that is not a hex SHA
 * is reported as "unknown" rather than echoed.
 */
export function deployedCommit(env = process.env) {
  const sha = (env.RAILWAY_GIT_COMMIT_SHA || env.GIT_SHA || '').trim();
  return SHA_RE.test(sha) ? sha.toLowerCase() : 'unknown';
}

export function createHealthHandler(pool, env = process.env) {
  const commit = deployedCommit(env);
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    const checks = { server: 'ok', db: 'unknown', uptime: Math.floor(process.uptime()) };
    try {
      await pool.query('SELECT 1');
      checks.db = 'ok';
    } catch (e) {
      checks.db = 'degraded: ' + (e.message || 'unknown').slice(0, 50);
    }
    res.status(200).json({
      ok: true,
      ...checks,
      commit,
      timestamp: new Date().toISOString(),
    });
  };
}
