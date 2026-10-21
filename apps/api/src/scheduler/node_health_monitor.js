/**
 * Node Health Monitor (S2-008)
 *
 * Scheduled job that pings registered nodes every 2 minutes to verify they're alive.
 * Records response time and status for each node.
 * Feeds data into reputation scoring and offline detection (S2-009).
 */

import { nodeEndpointFetch } from '../services/node_registry/node_endpoint_fetch.js';

const HEALTH_CHECK_INTERVAL_MS = 120000; // 2 minutes
const HEALTH_CHECK_TIMEOUT_MS = 10000; // 10 second timeout per node
const MAX_CONCURRENT_CHECKS = 10;

export const healthMonitorStatus = {
  last_run_time: null,
  last_status: null,
  last_error: null,
  nodes_checked: 0,
  nodes_healthy: 0,
  nodes_unhealthy: 0
};

async function ensureHealthLogsTable(pool) {
  if (!pool || !pool.query) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS node_health_logs (
        id SERIAL PRIMARY KEY,
        node_id TEXT NOT NULL,
        status TEXT NOT NULL,
        response_time_ms INTEGER,
        error_message TEXT,
        checked_at BIGINT NOT NULL
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_node_health_logs_node ON node_health_logs(node_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_node_health_logs_checked ON node_health_logs(checked_at)
    `);
  } catch (e) {
    // Table may already exist
  }
}

async function checkNodeHealth(node, timeoutMs = HEALTH_CHECK_TIMEOUT_MS) {
  const endpointUrl = node.endpoint_url;
  if (!endpointUrl) {
    return { nodeId: node.node_id, status: 'error', error: 'No endpoint URL', responseTimeMs: null };
  }

  const healthUrl = endpointUrl.endsWith('/') ? `${endpointUrl}health` : `${endpointUrl}/health`;
  const startTime = Date.now();

  try {
    // Resolve-then-check at connect time, no redirects (node_endpoint_fetch.js).
    const response = await nodeEndpointFetch(healthUrl, { method: 'GET', timeoutMs, headersOnly: true });
    const responseTimeMs = Date.now() - startTime;

    if (response.ok) {
      return { nodeId: node.node_id, status: 'healthy', responseTimeMs, error: null };
    } else {
      return {
        nodeId: node.node_id,
        status: 'unhealthy',
        responseTimeMs,
        error: `HTTP ${response.status}`
      };
    }
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    // Fixed categories only (timeout / unreachable / blocked_address / ...): raw error text can
    // carry internal hosts and is served by GET /api/nodes/:id/health.
    const errorMsg = err.code || 'unreachable';
    return { nodeId: node.node_id, status: 'unreachable', responseTimeMs, error: errorMsg };
  }
}

async function runHealthCheckCycle(pool) {
  if (!pool || !pool.query) {
    console.warn('[HealthMonitor] No database pool available');
    return;
  }

  await ensureHealthLogsTable(pool);

  try {
    const result = await pool.query(`
      SELECT node_id, endpoint_url, status
      FROM registered_nodes
      WHERE status IN ('active', 'pending') AND endpoint_url IS NOT NULL AND endpoint_url != ''
      ORDER BY last_heartbeat_at DESC NULLS LAST
    `);

    const nodes = result.rows;
    if (nodes.length === 0) {
      console.log('[HealthMonitor] No nodes to check');
      healthMonitorStatus.last_run_time = Date.now();
      healthMonitorStatus.last_status = 'skipped';
      healthMonitorStatus.nodes_checked = 0;
      return;
    }

    console.log(`[HealthMonitor] Checking ${nodes.length} nodes...`);
    const now = Math.floor(Date.now() / 1000);
    let healthy = 0;
    let unhealthy = 0;

    // Process nodes in batches to limit concurrent connections
    for (let i = 0; i < nodes.length; i += MAX_CONCURRENT_CHECKS) {
      const batch = nodes.slice(i, i + MAX_CONCURRENT_CHECKS);
      const results = await Promise.all(batch.map(node => checkNodeHealth(node)));

      for (const result of results) {
        if (result.status === 'healthy') {
          healthy++;
        } else {
          unhealthy++;
        }

        // Log health check result
        try {
          await pool.query(
            `INSERT INTO node_health_logs (node_id, status, response_time_ms, error_message, checked_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [result.nodeId, result.status, result.responseTimeMs, result.error, now]
          );
        } catch (e) {
          console.error(`[HealthMonitor] Failed to log health for ${result.nodeId}:`, e.message);
        }

        // Update node's last health check in registered_nodes
        try {
          await pool.query(
            `UPDATE registered_nodes
             SET updated_at = $1
             WHERE node_id = $2`,
            [now, result.nodeId]
          );
        } catch (e) { /* ignore update errors */ }
      }
    }

    console.log(`[HealthMonitor] Complete: ${healthy} healthy, ${unhealthy} unhealthy`);

    healthMonitorStatus.last_run_time = Date.now();
    healthMonitorStatus.last_status = 'success';
    healthMonitorStatus.last_error = null;
    healthMonitorStatus.nodes_checked = nodes.length;
    healthMonitorStatus.nodes_healthy = healthy;
    healthMonitorStatus.nodes_unhealthy = unhealthy;

  } catch (err) {
    console.error('[HealthMonitor] ERROR:', err.message);
    healthMonitorStatus.last_run_time = Date.now();
    healthMonitorStatus.last_status = 'error';
    healthMonitorStatus.last_error = err.message;
  }
}

let isRunning = false;

export function startHealthMonitor(pool) {
  if (global.__HEALTH_MONITOR_STARTED__) return;
  global.__HEALTH_MONITOR_STARTED__ = true;

  console.log(`[HealthMonitor] Started (interval: ${HEALTH_CHECK_INTERVAL_MS}ms)`);

  // Run initial check after 30 seconds (let server stabilize)
  setTimeout(() => runHealthCheckCycle(pool), 30000);

  const handle = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      await runHealthCheckCycle(pool);
    } catch (err) {
      console.error('[HealthMonitor] Tick error:', err.message);
    } finally {
      isRunning = false;
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  handle.unref();
  return handle;
}

export async function getNodeHealthSummary(nodeId, pool, limit = 10) {
  if (!pool || !pool.query) return { checks: [], summary: null };

  try {
    const logs = await pool.query(
      `SELECT status, response_time_ms, error_message, checked_at
       FROM node_health_logs
       WHERE node_id = $1
       ORDER BY checked_at DESC
       LIMIT $2`,
      [nodeId, limit]
    );

    const summary = await pool.query(
      `SELECT
         COUNT(*) as total_checks,
         COUNT(*) FILTER (WHERE status = 'healthy') as healthy_count,
         AVG(response_time_ms) FILTER (WHERE status = 'healthy') as avg_response_ms,
         MAX(checked_at) as last_check
       FROM node_health_logs
       WHERE node_id = $1 AND checked_at > $2`,
      [nodeId, Math.floor(Date.now() / 1000) - 86400] // last 24 hours
    );

    const summaryRow = summary.rows[0];
    const totalChecks = parseInt(summaryRow?.total_checks) || 0;
    const healthyCount = parseInt(summaryRow?.healthy_count) || 0;

    return {
      checks: logs.rows.map(row => ({
        status: row.status,
        responseTimeMs: row.response_time_ms,
        error: row.error_message,
        checkedAt: row.checked_at
      })),
      summary: {
        totalChecks,
        healthyCount,
        unhealthyCount: totalChecks - healthyCount,
        healthRate: totalChecks > 0 ? (healthyCount / totalChecks * 100).toFixed(1) : 0,
        avgResponseMs: Math.round(parseFloat(summaryRow?.avg_response_ms) || 0),
        lastCheck: summaryRow?.last_check
      }
    };
  } catch (e) {
    return { checks: [], summary: null, error: e.message };
  }
}
