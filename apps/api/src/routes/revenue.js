import express from "express";
import { requireAdminAuth } from "../admin/admin_router.js";

export default function revenueRoutes(pool) {
  const router = express.Router();

  router.get("/revenue", requireAdminAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT COALESCE(SUM(amount_usdt), 0) AS total
        FROM revenue_events_v2
      `);

      res.json({ ok: true, total: result.rows[0].total });
    } catch (err) {
      console.error("Revenue error:", err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  router.get("/revenue/events", requireAdminAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, amount_usdt, created_at
        FROM revenue_events_v2
        ORDER BY created_at DESC
        LIMIT 50
      `);

      res.json({ ok: true, events: result.rows });
    } catch (err) {
      console.error("Events error:", err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  router.get("/epochs", requireAdminAuth, async (req, res) => {
    try {
      // Query actual epochs table (status is 'OPEN' or 'CLOSED')
      const result = await pool.query(`
        SELECT
          e.id AS epoch_id,
          e.status,
          e.starts_at,
          e.ends_at,
          e.total_revenue_usdt AS total,
          e.node_pool_usdt,
          e.platform_share_usdt,
          e.distributor_share_usdt,
          COALESCE(r.request_count, 0) AS requests
        FROM epochs e
        LEFT JOIN (
          SELECT epoch_id, COUNT(*) AS request_count
          FROM revenue_events_v2
          WHERE epoch_id IS NOT NULL
          GROUP BY epoch_id
        ) r ON r.epoch_id = e.id
        ORDER BY e.id DESC
        LIMIT 20
      `);

      res.json({ ok: true, epochs: result.rows });
    } catch (err) {
      console.error("Epoch error:", err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  // S4 (W1, 2026-10-20): public, so it carries NO money figures. Revenue totals live
  // behind staff auth (/admin/revenue/summary, /api/financial/truth). Money fields stay
  // in the shape as null — unknown to this caller, never 0.
  router.get("/economics/summary", async (req, res) => {
    try {
      const lastEpochResult = await pool.query(`
        SELECT id, closed_at
        FROM epochs
        WHERE status IN ('CLOSED', 'FINALIZED') AND (is_phantom = false OR is_phantom IS NULL)
        ORDER BY id DESC
        LIMIT 1
      `);
      const lastEpoch = lastEpochResult.rows[0] || { id: 0, closed_at: null };

      res.json({
        ok: true,
        revenueVisibility: "staff_only",
        totalRevenueUsdt: null,
        totalNodePoolUsdt: null,
        totalPlatformShareUsdt: null,
        totalDistributorShareUsdt: null,
        splitRatio: {
          nodeOperators: 50,
          platform: 30,
          distributors: 20
        },
        lastEpochId: lastEpoch.id || 0,
        lastEpochRevenueUsdt: null,
        lastEpochClosedAt: lastEpoch.closed_at || null
      });
    } catch (err) {
      console.error("Economics summary error:", err);
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  return router;
}
