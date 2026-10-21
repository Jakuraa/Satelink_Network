/**
 * Node Registry Service
 * S2-001: Node registration API for DePIN network
 *
 * Endpoints:
 * - POST /api/nodes/register — Register new node
 * - GET /api/nodes — List active nodes (public)
 * - GET /api/nodes/:nodeId — Get node details (public)
 * - GET /api/nodes/:nodeId/earnings — Get node earnings (authenticated)
 * - POST /api/nodes/:nodeId/heartbeat — Update node heartbeat
 * - GET /api/nodes/:nodeId/reputation — Get reputation score and history
 */

import { Router } from 'express';
import crypto from 'crypto';
import {
  getNodeTier,
  getTierBenefits,
  getNodeReputationHistory,
  updateNodeReputation,
  calculateReputationDelta,
  ensureReputationHistoryTable
} from './reputation_engine.js';
import { getNodeHealthSummary } from '../../scheduler/node_health_monitor.js';
import { handleNodeComeback } from './offline_detector.js';
import { getNodeEarnings } from './earnings_aggregator.js';
import { requireHeaderSecret } from '../../security/header_secret.js';
import { verifyNodeHeartbeat, validateNodeEndpoint, acceptMonotonicHeartbeat, verifyNodeRegistration } from './heartbeat_auth.js';
import { nodeEndpointFetch } from './node_endpoint_fetch.js';

const VALID_REGIONS = ['ap-south-1', 'us-east-1', 'eu-west-1', 'ap-southeast-1'];
const VALID_NODE_TYPES = ['rpc', 'bandwidth', 'compute'];
const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

async function ensureTable(db) {
  if (!db || !db.query) return;

  try {
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'registered_nodes'
      )
    `);

    if (!tableExists.rows[0]?.exists) {
      await db.query(`
        CREATE TABLE registered_nodes (
          id SERIAL PRIMARY KEY,
          node_id TEXT UNIQUE NOT NULL,
          wallet TEXT NOT NULL,
          node_type TEXT NOT NULL DEFAULT 'rpc',
          endpoint_url TEXT NOT NULL,
          region TEXT NOT NULL,
          chain_ids JSONB NOT NULL DEFAULT '[]',
          hardware_json JSONB,
          status TEXT NOT NULL DEFAULT 'pending',
          tier TEXT NOT NULL DEFAULT 'bronze',
          reputation_score INTEGER DEFAULT 0,
          uptime_pct NUMERIC(5,2) DEFAULT 0,
          registered_at BIGINT NOT NULL,
          last_heartbeat_at BIGINT,
          updated_at BIGINT
        )
      `);
      console.log('[NodeRegistry] Table created');
    } else {
      const migrations = [
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS node_type TEXT DEFAULT 'rpc'",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'unknown'",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS endpoint_url TEXT DEFAULT ''",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS chain_ids JSONB DEFAULT '[]'",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS hardware_json JSONB",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze'",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS reputation_score INTEGER DEFAULT 0",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS uptime_pct NUMERIC(5,2) DEFAULT 0",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS registered_at BIGINT DEFAULT 0",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS last_heartbeat_at BIGINT",
        "ALTER TABLE registered_nodes ADD COLUMN IF NOT EXISTS updated_at BIGINT"
      ];
      for (const sql of migrations) {
        try { await db.query(sql); } catch (e) { /* column may already exist */ }
      }
      console.log('[NodeRegistry] Table migrated');
    }

    await db.query(`CREATE INDEX IF NOT EXISTS idx_registered_nodes_wallet ON registered_nodes(wallet)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_registered_nodes_region ON registered_nodes(region)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_registered_nodes_status ON registered_nodes(status)`);

    console.log('[NodeRegistry] Table ensured');
  } catch (err) {
    console.error('[NodeRegistry] Table creation failed:', err.message);
  }
}

function generateNodeId(region) {
  const randomHex = crypto.randomBytes(4).toString('hex');
  return `NODE-${region}-${randomHex}`;
}

async function validateEndpoint(url, timeoutMs = 5000) {
  try {
    const healthUrl = url.endsWith('/') ? `${url}health` : `${url}/health`;
    // Resolve-then-check at connect time, no redirects (node_endpoint_fetch.js).
    const response = await nodeEndpointFetch(healthUrl, { method: 'GET', timeoutMs, headersOnly: true });
    return response.ok;
  } catch {
    return false;
  }
}

async function sendDiscordNotification(nodeId, region, walletPrefix) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Satelink Nodes',
        embeds: [{
          title: '🔌 New Node Registered',
          color: 0x1AFFD4,
          fields: [
            { name: 'Node ID', value: nodeId, inline: true },
            { name: 'Region', value: region, inline: true },
            { name: 'Wallet', value: `${walletPrefix}...`, inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch (err) {
    console.error('[NodeRegistry] Discord notification failed:', err.message);
  }
}

export function createNodeRegistryRouter(db, redis, { probeEndpoint = validateEndpoint } = {}) {
  const router = Router();

  ensureTable(db);
  ensureReputationHistoryTable(db);

  router.post('/register', async (req, res) => {
    try {
      const { wallet_address, node_type, endpoint_url, region, chain_ids, hardware, timestamp, signature } = req.body || {};

      if (!wallet_address || !WALLET_REGEX.test(wallet_address)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid wallet_address format. Must be 0x followed by 40 hex characters.'
        });
      }

      if (!node_type || !VALID_NODE_TYPES.includes(node_type)) {
        return res.status(400).json({
          ok: false,
          error: `Invalid node_type. Valid: ${VALID_NODE_TYPES.join(', ')}`
        });
      }

      if (!endpoint_url) {
        return res.status(400).json({
          ok: false,
          error: 'endpoint_url is required'
        });
      }

      try {
        new URL(endpoint_url);
      } catch {
        return res.status(400).json({
          ok: false,
          error: 'Invalid endpoint_url format'
        });
      }

      // SSRF guard (SEC-5): the endpoint is fetched below (validateEndpoint) before anything
      // else proves ownership, so loopback / private / metadata / circular hosts are refused.
      if (validateNodeEndpoint(endpoint_url)) {
        return res.status(400).json({ ok: false, error: 'invalid_endpoint' });
      }

      if (!region || !VALID_REGIONS.includes(region)) {
        return res.status(400).json({
          ok: false,
          error: `Invalid region. Valid: ${VALID_REGIONS.join(', ')}`
        });
      }

      if (!Array.isArray(chain_ids) || chain_ids.length === 0) {
        return res.status(400).json({
          ok: false,
          error: 'chain_ids must be a non-empty array of chain IDs'
        });
      }

      // Proof of wallet ownership (EIP-191 over every registered field + timestamp), checked
      // before the endpoint is probed, so unsigned requests cannot trigger outbound fetches.
      const proof = verifyNodeRegistration({
        walletAddress: wallet_address, nodeType: node_type, endpointUrl: endpoint_url,
        region, chainIds: chain_ids, timestamp, signature,
      });
      if (!proof.ok) {
        return res.status(proof.http).json({ ok: false, error: proof.error });
      }

      const endpointReachable = await probeEndpoint(endpoint_url);
      if (!endpointReachable) {
        return res.status(400).json({
          ok: false,
          error: 'Endpoint unreachable. Ensure /health returns 200 OK.'
        });
      }

      const nodeId = generateNodeId(region);
      const now = Math.floor(Date.now() / 1000);

      if (db && db.query) {
        const existing = await db.query(
          // Case-insensitive: the signed message lowercases the wallet, so a replay with a
          // differently-cased address must still hit this duplicate check.
          'SELECT node_id FROM registered_nodes WHERE lower(wallet) = lower($1) AND endpoint_url = $2',
          [wallet_address, endpoint_url]
        );

        if (existing.rows.length > 0) {
          return res.status(409).json({
            ok: false,
            error: 'Node with this wallet and endpoint already registered',
            existingNodeId: existing.rows[0].node_id
          });
        }

        await db.query(
          `INSERT INTO registered_nodes
           (node_id, wallet, node_type, endpoint_url, region, chain_ids, hardware_json, status, tier, registered_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'bronze', $8, $8)`,
          [nodeId, wallet_address, node_type, endpoint_url, region, JSON.stringify(chain_ids), JSON.stringify(hardware || {}), now]
        );
      }

      if (redis) {
        try {
          await redis.set(
            `node:${nodeId}`,
            JSON.stringify({
              wallet: wallet_address,
              node_type,
              endpoint_url,
              region,
              chain_ids,
              status: 'pending',
              tier: 'bronze',
              registered_at: now
            }),
            'EX',
            86400 * 7
          );
        } catch (err) {
          console.error('[NodeRegistry] Redis cache failed:', err.message);
        }
      }

      await sendDiscordNotification(nodeId, region, wallet_address.slice(0, 8));

      console.log(`[NodeRegistry] Registered: ${nodeId} region=${region} wallet=${wallet_address.slice(0, 8)}...`);

      res.status(201).json({
        ok: true,
        nodeId,
        tier: 'bronze',
        status: 'pending',
        message: 'Node registered successfully. Status will change to active after first heartbeat.',
        nextStep: 'Configure heartbeat endpoint to maintain uptime tracking'
      });
    } catch (err) {
      console.error('[NodeRegistry] Register error:', err.message);
      res.status(500).json({ ok: false, error: 'Failed to register node' });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const { region, type, status, chain_id, page = 1, limit = 20 } = req.query;

      if (!db || !db.query) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }

      const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (region && VALID_REGIONS.includes(region)) {
        conditions.push(`region = $${paramIndex++}`);
        params.push(region);
      }

      if (type && VALID_NODE_TYPES.includes(type)) {
        conditions.push(`node_type = $${paramIndex++}`);
        params.push(type);
      }

      if (status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
      }

      if (chain_id) {
        conditions.push(`chain_ids @> $${paramIndex++}::jsonb`);
        params.push(JSON.stringify([parseInt(chain_id)]));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM registered_nodes ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.total) || 0;

      params.push(parseInt(limit), offset);
      const result = await db.query(
        `SELECT node_id, node_type, region, chain_ids, status, tier, reputation_score, uptime_pct, registered_at
         FROM registered_nodes
         ${whereClause}
         ORDER BY registered_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params
      );

      res.json({
        ok: true,
        nodes: result.rows.map(row => ({
          nodeId: row.node_id,
          nodeType: row.node_type,
          region: row.region,
          chainIds: row.chain_ids,
          status: row.status,
          tier: row.tier,
          reputationScore: row.reputation_score,
          uptimePct: parseFloat(row.uptime_pct) || 0,
          registeredAt: row.registered_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (err) {
      console.error('[NodeRegistry] List error:', err.message);
      res.status(500).json({ ok: false, error: 'Failed to list nodes' });
    }
  });

  router.get('/:nodeId', async (req, res) => {
    try {
      const { nodeId } = req.params;

      if (!db || !db.query) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }

      const result = await db.query(
        `SELECT node_id, wallet, node_type, endpoint_url, region, chain_ids, hardware_json,
                status, tier, reputation_score, uptime_pct, registered_at, last_heartbeat_at, updated_at,
                consecutive_failures, total_requests_served, avg_latency_ms, last_failure_at, last_failure_reason
         FROM registered_nodes
         WHERE node_id = $1`,
        [nodeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Node not found' });
      }

      const row = result.rows[0];

      res.json({
        ok: true,
        node: {
          nodeId: row.node_id,
          wallet: row.wallet,
          nodeType: row.node_type,
          endpointUrl: row.endpoint_url,
          region: row.region,
          chainIds: row.chain_ids,
          hardware: row.hardware_json,
          status: row.status,
          tier: row.tier,
          reputationScore: row.reputation_score,
          uptimePct: parseFloat(row.uptime_pct) || 0,
          registeredAt: row.registered_at,
          lastHeartbeatAt: row.last_heartbeat_at,
          updatedAt: row.updated_at,
          consecutiveFailures: row.consecutive_failures || 0,
          totalRequestsServed: row.total_requests_served || 0,
          avgLatencyMs: row.avg_latency_ms || null,
          lastFailureAt: row.last_failure_at || null,
          lastFailureReason: row.last_failure_reason || null
        }
      });
    } catch (err) {
      console.error('[NodeRegistry] Get node error:', err.message);
      res.status(500).json({ ok: false, error: 'Failed to get node details' });
    }
  });

  router.get('/:nodeId/earnings', async (req, res) => {
    try {
      const { nodeId } = req.params;

      if (!db || !db.query) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }

      const nodeResult = await db.query(
        'SELECT wallet FROM registered_nodes WHERE node_id = $1',
        [nodeId]
      );

      if (nodeResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Node not found' });
      }

      const earnings = await getNodeEarnings(nodeId, db, 10);

      res.json({
        ok: true,
        earnings
      });
    } catch (err) {
      console.error('[NodeRegistry] Earnings error:', err.message);
      res.status(500).json({ ok: false, error: 'Failed to get earnings' });
    }
  });

  router.post('/heartbeat', async (req, res) => {
    try {
      const { nodeId, node_id, cpu_pct, ram_pct, uptime_seconds, rpc_calls_served, endpoint_url, timestamp, signature } = req.body || {};
      const actualNodeId = nodeId || node_id;

      if (!actualNodeId) {
        return res.status(400).json({ ok: false, error: 'nodeId or node_id is required' });
      }

      if (!db || !db.query) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }

      const nodeResult = await db.query(
        'SELECT node_id, status, wallet FROM registered_nodes WHERE node_id = $1',
        [actualNodeId]
      );

      if (nodeResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Node not found' });
      }

      // SEC-5: only the wallet the node registered with may heartbeat it (signature over
      // node id + timestamp + endpoint). Checked before any status or endpoint write.
      const auth = verifyNodeHeartbeat({
        nodeId: actualNodeId, wallet: nodeResult.rows[0].wallet, timestamp, signature, endpointUrl: endpoint_url,
      });
      if (!auth.ok) {
        return res.status(auth.http).json({ ok: false, error: auth.error });
      }
      if (endpoint_url) {
        const endpointError = validateNodeEndpoint(endpoint_url);
        if (endpointError) return res.status(400).json({ ok: false, error: endpointError });
      }
      if (!(await acceptMonotonicHeartbeat(nodeResult.rows[0].node_id, timestamp, redis))) {
        return res.status(409).json({ ok: false, error: 'heartbeat_replayed' });
      }

      const now = Math.floor(Date.now() / 1000);
      const currentStatus = nodeResult.rows[0].status;
      let newStatus = currentStatus;
      let comebackInfo = null;

      // Handle offline/suspended node comeback
      // Only 'offline' is revived by a heartbeat. 'suspended' may be a staff sanction (PATCH)
      // and cannot be told apart from the automatic >24h suspension, so it stays until staff
      // reactivate the node.
      if (currentStatus === 'offline') {
        comebackInfo = await handleNodeComeback(actualNodeId, db);
        newStatus = 'active';
      } else if (currentStatus === 'pending') {
        newStatus = 'active';
      }

      // Update node with heartbeat
      if (endpoint_url) {
        // endpoint_url was validated (and covered by the signature) above
        await db.query(
          `UPDATE registered_nodes
           SET last_heartbeat_at = $1, status = $2, updated_at = $1, endpoint_url = $4, consecutive_failures = 0
           WHERE node_id = $3`,
          [now, newStatus, actualNodeId, endpoint_url]
        );
      } else {
        await db.query(
          `UPDATE registered_nodes
           SET last_heartbeat_at = $1, status = $2, updated_at = $1, consecutive_failures = 0
           WHERE node_id = $3`,
          [now, newStatus, actualNodeId]
        );
      }

      if (redis) {
        try {
          await redis.set(
            `node:heartbeat:${actualNodeId}`,
            JSON.stringify({ cpu_pct, ram_pct, uptime_seconds, rpc_calls_served, timestamp: now }),
            'EX',
            300
          );
        } catch (e) { /* redis optional */ }
      }

      console.log(`[NodeRegistry] Heartbeat (generic): ${actualNodeId} status=${newStatus}${comebackInfo?.restored ? ' (restored)' : ''}`);

      res.json({
        ok: true,
        nodeId: actualNodeId,
        status: newStatus,
        lastHeartbeatAt: now,
        restored: comebackInfo?.restored || false,
        offlineMinutes: comebackInfo?.offlineMinutes || null
      });
    } catch (err) {
      console.error('[NodeRegistry] Heartbeat generic error:', err.message);
      res.status(500).json({ ok: false, error: 'Failed to process heartbeat' });
    }
  });

  router.post('/:nodeId/heartbeat', async (req, res) => {
    try {
      const { nodeId } = req.params;
      const { cpu_pct, ram_pct, uptime_seconds, rpc_calls_served, endpoint_url, timestamp, signature } = req.body || {};

      if (!db || !db.query) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }

      const nodeResult = await db.query(
        'SELECT node_id, status, wallet FROM registered_nodes WHERE node_id = $1',
        [nodeId]
      );

      if (nodeResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Node not found' });
      }

      // SEC-5: only the wallet the node registered with may heartbeat it (signature over
      // node id + timestamp + endpoint). Checked before any status or endpoint write.
      const auth = verifyNodeHeartbeat({
        nodeId: nodeId, wallet: nodeResult.rows[0].wallet, timestamp, signature, endpointUrl: endpoint_url,
      });
      if (!auth.ok) {
        return res.status(auth.http).json({ ok: false, error: auth.error });
      }
      if (endpoint_url) {
        const endpointError = validateNodeEndpoint(endpoint_url);
        if (endpointError) return res.status(400).json({ ok: false, error: endpointError });
      }
      if (!(await acceptMonotonicHeartbeat(nodeResult.rows[0].node_id, timestamp, redis))) {
        return res.status(409).json({ ok: false, error: 'heartbeat_replayed' });
      }

      const now = Math.floor(Date.now() / 1000);
      const currentStatus = nodeResult.rows[0].status;
      let newStatus = currentStatus;
      let comebackInfo = null;

      // Handle offline/suspended node comeback
      // Only 'offline' is revived by a heartbeat. 'suspended' may be a staff sanction (PATCH)
      // and cannot be told apart from the automatic >24h suspension, so it stays until staff
      // reactivate the node.
      if (currentStatus === 'offline') {
        comebackInfo = await handleNodeComeback(nodeId, db);
        newStatus = 'active';
      } else if (currentStatus === 'pending') {
        newStatus = 'active';
      }

      // Update node with heartbeat, reset circuit breaker, optionally update endpoint_url
      if (endpoint_url) {
        // endpoint_url was validated (and covered by the signature) above
        await db.query(
          `UPDATE registered_nodes
           SET last_heartbeat_at = $1, status = $2, updated_at = $1, endpoint_url = $4, consecutive_failures = 0
           WHERE node_id = $3`,
          [now, newStatus, nodeId, endpoint_url]
        );
        console.log(`[NodeRegistry] Heartbeat with endpoint update: ${nodeId} → ${endpoint_url}`);
      } else {
        // Reset consecutive_failures on heartbeat - node is alive, give it another chance
        await db.query(
          `UPDATE registered_nodes
           SET last_heartbeat_at = $1, status = $2, updated_at = $1, consecutive_failures = 0
           WHERE node_id = $3`,
          [now, newStatus, nodeId]
        );
      }

      if (redis) {
        try {
          await redis.set(
            `node:heartbeat:${nodeId}`,
            JSON.stringify({ cpu_pct, ram_pct, uptime_seconds, rpc_calls_served, timestamp: now }),
            'EX',
            300
          );
        } catch (e) { /* redis optional */ }
      }

      console.log(`[NodeRegistry] Heartbeat: ${nodeId} status=${newStatus}${comebackInfo?.restored ? ' (restored)' : ''}`);

      res.json({
        ok: true,
        nodeId,
        status: newStatus,
        lastHeartbeatAt: now,
        restored: comebackInfo?.restored || false,
        offlineMinutes: comebackInfo?.offlineMinutes || null
      });
    } catch (err) {
      console.error('[NodeRegistry] Heartbeat error:', err.message);
      res.status(500).json({ ok: false, error: 'Failed to process heartbeat' });
    }
  });

  // PATCH /api/nodes/:nodeId — Update node configuration (admin only)
  router.patch('/:nodeId', requireHeaderSecret('x-admin-key', ['MASTER_ADMIN_TOKEN', 'ADMIN_API_KEY']), async (req, res) => {
    try {
      const { nodeId } = req.params;

      if (!db || !db.query) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }

      const { endpoint_url, status, chain_ids } = req.body;
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (endpoint_url !== undefined) {
        // Validate endpoint URL - reject circular references
        const lowerUrl = endpoint_url.toLowerCase();
        if (lowerUrl.includes('satelink.network') || lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) {
          return res.status(400).json({ ok: false, error: 'Invalid endpoint: circular reference or localhost not allowed' });
        }
        updates.push(`endpoint_url = $${paramIndex++}`);
        values.push(endpoint_url);
      }

      if (status !== undefined) {
        if (!['active', 'inactive', 'suspended', 'pending'].includes(status)) {
          return res.status(400).json({ ok: false, error: 'Invalid status' });
        }
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (chain_ids !== undefined) {
        if (!Array.isArray(chain_ids)) {
          return res.status(400).json({ ok: false, error: 'chain_ids must be an array' });
        }
        updates.push(`chain_ids = $${paramIndex++}`);
        values.push(JSON.stringify(chain_ids));
      }

      if (updates.length === 0) {
        return res.status(400).json({ ok: false, error: 'No valid fields to update' });
      }

      const now = Math.floor(Date.now() / 1000);
      updates.push(`updated_at = $${paramIndex++}`);
      values.push(now);

      values.push(nodeId);

      const result = await db.query(
        `UPDATE registered_nodes SET ${updates.join(', ')} WHERE node_id = $${paramIndex} RETURNING node_id, endpoint_url, status, chain_ids`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Node not found' });
      }

      console.log(`[NodeRegistry] Node ${nodeId} updated:`, { endpoint_url, status, chain_ids });

      res.json({ ok: true, node: result.rows[0] });
    } catch (err) {
      console.error('[NodeRegistry] Update error:', err.message);
      res.status(500).json({ ok: false, error: 'Failed to update node' });
    }
  });

  router.get('/:nodeId/reputation', async (req, res) => {
    try {
      const { nodeId } = req.params;

      if (!db || !db.query) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }

      const nodeResult = await db.query(
        'SELECT node_id, reputation_score, tier FROM registered_nodes WHERE node_id = $1',
        [nodeId]
      );

      if (nodeResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Node not found' });
      }

      const { reputation_score, tier } = nodeResult.rows[0];
      const score = reputation_score || 0;
      const currentTier = tier || getNodeTier(score);
      const benefits = getTierBenefits(currentTier);
      const history = await getNodeReputationHistory(nodeId, db, 5);

      res.json({
        ok: true,
        reputation: {
          nodeId,
          score,
          tier: currentTier,
          tierBenefits: benefits,
          history: history.map(h => ({
            epochId: h.epoch_id,
            score: h.score,
            tier: h.tier,
            delta: h.delta,
            createdAt: h.created_at
          }))
        }
      });
    } catch (err) {
      console.error('[NodeRegistry] Reputation error:', err.message);
      res.status(500).json({ ok: false, error: 'Failed to get reputation' });
    }
  });

  router.post('/:nodeId/reputation/update', requireHeaderSecret('x-admin-key', ['ADMIN_API_KEY']), async (req, res) => {
    try {
      const { nodeId } = req.params;

      if (!db || !db.query) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }

      const { heartbeatsReceived, rpcCallsServed, missedHeartbeats, downtimeEvents, slaViolations } = req.body || {};

      const epochStats = {
        heartbeatsReceived: parseInt(heartbeatsReceived) || 0,
        rpcCallsServed: parseInt(rpcCallsServed) || 0,
        missedHeartbeats: parseInt(missedHeartbeats) || 0,
        downtimeEvents: parseInt(downtimeEvents) || 0,
        slaViolations: parseInt(slaViolations) || 0
      };

      const delta = calculateReputationDelta(epochStats);
      const result = await updateNodeReputation(nodeId, delta, db);

      res.json({
        ok: true,
        ...result,
        tierBenefits: getTierBenefits(result.newTier)
      });
    } catch (err) {
      console.error('[NodeRegistry] Reputation update error:', err.message);
      res.status(500).json({ ok: false, error: err.message || 'Failed to update reputation' });
    }
  });

  router.get('/:nodeId/health', async (req, res) => {
    try {
      const { nodeId } = req.params;

      if (!db || !db.query) {
        return res.status(503).json({ ok: false, error: 'Database unavailable' });
      }

      const nodeResult = await db.query(
        'SELECT node_id, status FROM registered_nodes WHERE node_id = $1',
        [nodeId]
      );

      if (nodeResult.rows.length === 0) {
        return res.status(404).json({ ok: false, error: 'Node not found' });
      }

      const healthData = await getNodeHealthSummary(nodeId, db, 10);

      res.json({
        ok: true,
        nodeId,
        nodeStatus: nodeResult.rows[0].status,
        health: healthData
      });
    } catch (err) {
      console.error('[NodeRegistry] Health error:', err.message);
      res.status(500).json({ ok: false, error: 'Failed to get health data' });
    }
  });

  return router;
}
