import { Router } from 'express';
import { ethers } from 'ethers';
import { verifyJWT } from '../gateway/routes/auth_v2.js';
import { requireAdminAuth } from '../admin/admin_router.js';
import { secretEquals } from '../security/header_secret.js';
import { generateClaimSignature } from '../services/claims/claim_processor.js';
import { CONSUMED_USAGE_PREDICATE } from '../services/financial/truth.js';
import { broadcaster } from '../realtime/broadcaster-instance.js';
import { discord } from '../services/discord_notify.mjs';

export function createClaimsRouter(pool) {
  const router = Router();

  // Admin endpoint: backfill orphaned revenue events with node_id
  router.post('/admin/backfill-revenue', verifyJWT, async (req, res) => {
    try {
      const { nodeId, adminSecret } = req.body;

      // T-02: no hard-coded fallback. ADMIN_BACKFILL_SECRET must be set in
      // env, or every request is refused as misconfigured (never silently
      // accepted via a literal — see 02_INVENTORY.md §4 B6).
      if (!process.env.ADMIN_BACKFILL_SECRET) {
        return res.status(503).json({ success: false, error: 'ADMIN_BACKFILL_SECRET not configured' });
      }
      if (!secretEquals(adminSecret, process.env.ADMIN_BACKFILL_SECRET)) {
        return res.status(403).json({ success: false, error: 'Invalid admin secret' });
      }

      if (!nodeId) {
        return res.status(400).json({ success: false, error: 'nodeId required' });
      }

      // Verify node exists (check both tables for compatibility)
      let nodeResult = await pool.query(
        'SELECT node_id, wallet FROM registered_nodes WHERE node_id = $1',
        [nodeId]
      );
      if (nodeResult.rows.length === 0) {
        nodeResult = await pool.query(
          'SELECT node_id, wallet FROM nodes WHERE node_id = $1',
          [nodeId]
        );
      }

      if (nodeResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Node not found' });
      }

      const targetNodeId = nodeResult.rows[0].node_id;

      // Count orphaned revenue events
      const orphanCount = await pool.query(
        'SELECT COUNT(*) as count, COALESCE(SUM(amount_usdt), 0) as total FROM revenue_events_v2 WHERE node_id IS NULL'
      );

      // Backfill orphaned revenue events with the node_id string
      const backfillResult = await pool.query(
        'UPDATE revenue_events_v2 SET node_id = $1 WHERE node_id IS NULL RETURNING id',
        [targetNodeId]
      );

      console.log(`[BACKFILL] Backfilled ${backfillResult.rowCount} orphaned revenue events to node ${nodeId}`);

      res.json({
        success: true,
        backfilled: backfillResult.rowCount,
        orphanedTotal: parseFloat(orphanCount.rows[0]?.total || 0),
        targetNodeId: targetNodeId
      });

    } catch (err) {
      console.error('[Backfill] Failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin endpoint: directly allocate earnings to a node based on revenue
  router.post('/admin/allocate-earnings', verifyJWT, async (req, res) => {
    try {
      const { nodeId, adminSecret } = req.body;

      // T-02: no hard-coded fallback (see backfill-revenue above).
      if (!process.env.ADMIN_BACKFILL_SECRET) {
        return res.status(503).json({ success: false, error: 'ADMIN_BACKFILL_SECRET not configured' });
      }
      if (!secretEquals(adminSecret, process.env.ADMIN_BACKFILL_SECRET)) {
        return res.status(403).json({ success: false, error: 'Invalid admin secret' });
      }
      // One allocator per revenue row: the epoch scheduler/finalizer writes node earnings for
      // every closed epoch. This manual tool allocates from all-time node revenue, so running
      // both double-pays the same revenue. Off unless explicitly enabled for a backfill.
      if (process.env.MANUAL_EARNINGS_ALLOCATION_ENABLED !== 'true') {
        return res.status(503).json({ success: false, error: 'manual_allocation_disabled' });
      }

      if (!nodeId) {
        return res.status(400).json({ success: false, error: 'nodeId required' });
      }

      const client = await pool.connect();
      let broken;
      try {
        // The node's payout wallet from the registry, never from the request body: earnings
        // rows may be keyed by node id OR wallet (legacy writers), and claims match both.
        // Looked up before BEGIN (a missing legacy table must not abort the transaction).
        // Wallets from BOTH node tables (they can differ); only a missing table/column is
        // tolerated — any other error aborts, since a silently missing wallet would let rows
        // keyed by it go uncounted (double allocation).
        const wallets = [];
        for (const table of ['registered_nodes', 'nodes']) {
          let w;
          try {
            w = await client.query(`SELECT wallet FROM ${table} WHERE node_id = $1`, [nodeId]);
          } catch (e) {
            if (e.code === '42P01' || e.code === '42703') continue; // undefined table / column
            throw e;
          }
          for (const r of w.rows) if (r.wallet) wallets.push(String(r.wallet).toLowerCase());
        }

        await client.query('BEGIN');
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`alloc:${String(nodeId).toLowerCase()}`]);
        const ids = [...new Set([nodeId, ...wallets].filter(Boolean).map((x) => String(x).toLowerCase()))];

        // All amounts in SQL numeric, truncated to 6 dp (never round a payout up).
        //  share    = 50% of the node's real consumed usage (no test data, deposits, refunds,
        //             unbilled rows or x402 bundle purchases — same rule as /api/financial/truth)
        //  existing = everything already allocated to this node under either id, any status,
        //             except claim-expiry reallocations (epoch 0: other nodes' expired money)
        const r = await client.query(
          `SELECT trunc(s.total, 8)::text AS total_revenue,
                  trunc(s.total * 0.5, 6)::text AS node_share,
                  trunc(x.existing, 6)::text AS existing,
                  trunc(s.total * 0.5 - x.existing, 6)::text AS to_allocate
             FROM (SELECT COALESCE(SUM(e.amount_usdt), 0) AS total FROM revenue_events_v2 e
                    WHERE e.node_id = $1
                      -- Backfill only: revenue of CLOSED epochs the finalizer never ran on. The
                      -- open epoch (or unassigned revenue) is paid by the finalizer at close; a
                      -- finalized epoch was already split (equally across its nodes) — topping a
                      -- node up to 50% of its own revenue there paid the pool out twice.
                      AND e.epoch_id IN (SELECT id FROM epochs WHERE status = 'CLOSED')
                      AND NOT EXISTS (SELECT 1 FROM epoch_earnings f
                                       WHERE f.epoch_id = e.epoch_id AND f.role = 'node_operator')
                      AND (e.is_test_data = false OR e.is_test_data IS NULL)
                      AND (${CONSUMED_USAGE_PREDICATE})) s,
                  (SELECT COALESCE(SUM(amount_usdt), 0) AS existing FROM epoch_earnings
                    WHERE lower(wallet_or_node_id) = ANY($2::text[]) AND epoch_id <> 0) x`,
          [nodeId, ids]
        );
        const row = r.rows[0];
        const toAllocate = Number(row.to_allocate);

        if (toAllocate >= 0.000001) {
          // Own key (epoch -1, role manual_allocation) — never collides with a real epoch's
          // node_operator row; repeat allocations add to it (production PK is
          // (epoch_id, role, wallet_or_node_id)).
          await client.query(
            `INSERT INTO epoch_earnings (epoch_id, role, wallet_or_node_id, amount_usdt, status, created_at)
             VALUES (-1, 'manual_allocation', $1, $2::numeric, 'UNPAID', $3)
             ON CONFLICT (epoch_id, role, wallet_or_node_id)
             DO UPDATE SET amount_usdt = epoch_earnings.amount_usdt + EXCLUDED.amount_usdt`,
            [nodeId, row.to_allocate, Math.floor(Date.now() / 1000)]
          );
          console.log(`[ALLOCATE] Allocated $${row.to_allocate} to ${nodeId}`);
        }
        await client.query('COMMIT');

        res.json({
          success: true,
          totalRevenue: Number(row.total_revenue),
          nodeShare: Number(row.node_share),
          existingEarnings: Number(row.existing),
          allocated: toAllocate >= 0.000001 ? toAllocate : 0,
        });
      } catch (err) {
        await client.query('ROLLBACK').catch((rbErr) => { broken = rbErr; });
        throw err;
      } finally {
        client.release(broken);
      }
    } catch (err) {
      console.error('[Allocate] Failed:', err.message);
      res.status(500).json({ success: false, error: 'allocation_failed' });
    }
  });

  // Admin endpoint: trigger epoch close and distribute rewards (legacy)
  router.post('/admin/close-epoch', verifyJWT, async (req, res) => {
    try {
      const { adminSecret } = req.body;

      // T-02: no hard-coded fallback (see backfill-revenue above).
      if (!process.env.ADMIN_BACKFILL_SECRET) {
        return res.status(503).json({ success: false, error: 'ADMIN_BACKFILL_SECRET not configured' });
      }
      if (!secretEquals(adminSecret, process.env.ADMIN_BACKFILL_SECRET)) {
        return res.status(403).json({ success: false, error: 'Invalid admin secret' });
      }
      // Manual epoch tool: it writes epoch_ledger ids into revenue_events_v2.epoch_id (a
      // column that holds epochs ids) and pays wallet-keyed shares outside the scheduler —
      // a second allocator. Off unless explicitly enabled, like allocate-earnings.
      if (process.env.MANUAL_EARNINGS_ALLOCATION_ENABLED !== 'true') {
        return res.status(503).json({ success: false, error: 'manual_allocation_disabled' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Ensure epoch_ledger table exists
        await client.query(`
          CREATE TABLE IF NOT EXISTS epoch_ledger (
            id SERIAL PRIMARY KEY,
            epoch_id TEXT UNIQUE,
            status TEXT NOT NULL DEFAULT 'OPEN',
            started_at BIGINT NOT NULL,
            closed_at BIGINT,
            total_revenue NUMERIC(18,8) DEFAULT 0,
            node_pool NUMERIC(18,8) DEFAULT 0,
            platform_fee NUMERIC(18,8) DEFAULT 0,
            distribution_pool NUMERIC(18,8) DEFAULT 0,
            merkle_root TEXT,
            tx_hash TEXT,
            created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
          )
        `);

        // Ensure epoch_earnings table exists
        await client.query(`
          CREATE TABLE IF NOT EXISTS epoch_earnings (
            epoch_id INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'node_operator',
            wallet_or_node_id TEXT NOT NULL,
            amount_usdt NUMERIC(18,8) NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'UNPAID',
            created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
            PRIMARY KEY (epoch_id, wallet_or_node_id)
          )
        `);

        // Get current epoch
        const epochResult = await client.query(
          `SELECT id, epoch_id FROM epoch_ledger WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1`
        );

        let epochDbId, epochTextId;
        if (epochResult.rows.length === 0) {
          // Create first epoch
          const newEpoch = await client.query(
            `INSERT INTO epoch_ledger (epoch_id, status, started_at)
             VALUES ('epoch-1', 'OPEN', $1) RETURNING id, epoch_id`,
            [Date.now()]
          );
          epochDbId = newEpoch.rows[0].id;
          epochTextId = newEpoch.rows[0].epoch_id;
        } else {
          epochDbId = epochResult.rows[0].id;
          epochTextId = epochResult.rows[0].epoch_id || `epoch-${epochResult.rows[0].id}`;
        }

        // Calculate total unallocated revenue
        const revenueResult = await client.query(
          `SELECT COALESCE(SUM(amount_usdt), 0) as total FROM revenue_events_v2 WHERE epoch_id IS NULL`
        );
        const totalRevenue = parseFloat(revenueResult.rows[0].total || 0);

        if (totalRevenue === 0) {
          await client.query('ROLLBACK');
          return res.json({ success: true, message: 'No unallocated revenue to distribute', totalRevenue: 0 });
        }

        // Apply 50/30/20 split
        const nodePool = totalRevenue * 0.50;
        const platformFee = totalRevenue * 0.30;
        const distributionPool = totalRevenue * 0.20;

        // Get active nodes and their request counts (check registered_nodes first)
        let nodesResult = await client.query(
          `SELECT wallet, node_id,
                  (SELECT COUNT(*) FROM revenue_events_v2 WHERE node_id = registered_nodes.node_id AND epoch_id IS NULL) as request_count
           FROM registered_nodes WHERE status = 'active'`
        );
        if (nodesResult.rows.length === 0) {
          nodesResult = await client.query(
            `SELECT wallet, node_id,
                    (SELECT COUNT(*) FROM revenue_events_v2 WHERE node_id = nodes.node_id AND epoch_id IS NULL) as request_count
             FROM nodes WHERE status = 'active'`
          );
        }

        const activeNodes = nodesResult.rows;
        const totalRequests = activeNodes.reduce((sum, n) => sum + parseInt(n.request_count || 0), 0);

        // Distribute to nodes
        let distributed = 0;
        for (const node of activeNodes) {
          const requestCount = parseInt(node.request_count || 0);
          const nodeShare = totalRequests > 0 ? (requestCount / totalRequests) * nodePool : nodePool / Math.max(activeNodes.length, 1);

          if (nodeShare > 0 && node.wallet) {
            await client.query(
              `INSERT INTO epoch_earnings (epoch_id, wallet_or_node_id, amount_usdt, status, role, created_at)
               VALUES ($1, $2, $3, 'UNPAID', 'node_operator', $4)`,
              [epochDbId, node.wallet, nodeShare, Math.floor(Date.now() / 1000)]
            );
            distributed += nodeShare;
            console.log(`[EPOCH_CLOSE] Allocated $${nodeShare.toFixed(6)} to ${node.node_id}`);
          }
        }

        // Assign epoch_id to revenue events (use numeric db id)
        await client.query(
          `UPDATE revenue_events_v2 SET epoch_id = $1 WHERE epoch_id IS NULL`,
          [epochDbId]
        );

        // Close epoch
        await client.query(
          `UPDATE epoch_ledger SET status = 'CLOSED', closed_at = $1,
           total_revenue = $2, node_pool = $3, platform_fee = $4, distribution_pool = $5
           WHERE id = $6`,
          [Date.now(), totalRevenue, nodePool, platformFee, distributionPool, epochDbId]
        );

        // Create new open epoch
        const nextEpochNum = parseInt((epochTextId || '').replace('epoch-', '')) + 1 || epochDbId + 1;
        await client.query(
          `INSERT INTO epoch_ledger (epoch_id, status, started_at)
           VALUES ($1, 'OPEN', $2)`,
          [`epoch-${nextEpochNum}`, Date.now()]
        );

        await client.query('COMMIT');

        res.json({
          success: true,
          epochClosed: epochTextId,
          totalRevenue,
          nodePool,
          platformFee,
          distributionPool,
          nodesRewarded: activeNodes.filter(n => parseInt(n.request_count || 0) > 0).length,
          distributed
        });

      } finally {
        client.release();
      }

    } catch (err) {
      console.error('[EpochClose] Failed:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Claim signing produces a production-signer EIP-712 payout authorization, so it is
  // staff-only and fails closed while settlement is in dry-run (W1, 2026-10-20). A
  // self-registered JWT is not proof of node ownership, so staff auth is the gate (no JWT).
  function refuseWhileDryRun(req, res, next) {
    if (process.env.SETTLEMENT_DRY_RUN !== '0') {
      return res.status(503).json({ success: false, error: 'settlement_dry_run' });
    }
    next();
  }

  router.post('/:nodeId/claim', requireAdminAuth, refuseWhileDryRun, async (req, res) => {
    try {
      const { nodeId } = req.params;
      const { walletAddress } = req.body;

      if (typeof walletAddress !== 'string' || !ethers.isAddress(walletAddress)) {
        return res.status(400).json({
          success: false,
          error: 'a valid walletAddress is required in request body'
        });
      }

      const result = await generateClaimSignature(nodeId, ethers.getAddress(walletAddress), pool);

      broadcaster.publish('claim:generated', {
        node_id: nodeId,
        amount_usdt: result.amount_usdt || 0,
        wallet: walletAddress,
        timestamp: new Date().toISOString()
      });

      discord.claim(nodeId, result.amount_usdt || 0, null).catch(() => {});

      res.json({
        success: true,
        signature: result
      });

    } catch (err) {
      console.error('[Claims] Signature generation failed:', err.message);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  return router;
}
