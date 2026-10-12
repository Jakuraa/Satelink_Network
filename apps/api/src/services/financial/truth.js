/**
 * Financial Truth Endpoint
 *
 * Provides canonical financial metrics that distinguish:
 * - Metered value (usage measured)
 * - Allocated value (epochs calculated)
 * - Unpaid value (owed but not distributed)
 * - Treasury real (on-chain USDT)
 * - Withdrawable (MIN of unpaid and treasury)
 * - Claimed total (actual USDT distributed)
 */

import { Router } from 'express';
import { getUsdtBalance } from '../../autonomous/treasury_monitor.js';
import { FOUNDER_WALLETS } from '../../payments/founder_wallets.js';

// Internal = founder-controlled (canonical list, includes treasury 0x966e…):
// either the event's client_id IS a founder wallet (x402 rows carry the payer
// address) or it is an api key bound to a founder wallet. Everything else that
// is not is_test_data is external.
export const INTERNAL_PREDICATE =
  `COALESCE(lower(e.client_id) = ANY($1::text[]) OR lower(t.wallet_address) = ANY($1::text[]), false)`;
// COALESCE: an x402 payer with no api_credits row has t.wallet_address NULL;
// without it `false OR NULL` is NULL and the row drops out of BOTH buckets.

export function createFinancialTruthRouter(pool) {
  const router = Router();

  router.get('/truth', async (req, res) => {
    const startTime = Date.now();

    try {
      // 1. Metered value = SUM(revenue_events_v2.amount_usdt) excluding test data
      // Distinguish external customer usage from internal founder/treasury usage.
      const treasuryAddress = process.env.TREASURY_ADDRESS || '0x966E1Ae22996545015b1414B35234b10719d7Ad4';
      const meteredResult = await pool.query(`
        SELECT
          COALESCE(SUM(e.amount_usdt), 0) as total,
          COALESCE(SUM(e.amount_usdt) FILTER (WHERE NOT ${INTERNAL_PREDICATE}), 0) as external_total,
          COALESCE(SUM(e.amount_usdt) FILTER (WHERE ${INTERNAL_PREDICATE}), 0) as internal_total
        FROM revenue_events_v2 e
        LEFT JOIN api_credits t ON t.api_key = e.client_id
        WHERE e.is_test_data = false OR e.is_test_data IS NULL
      `, [FOUNDER_WALLETS]);
      const metered_value_usdt = parseFloat(meteredResult.rows[0]?.total || 0);
      const external_metered_usdt = parseFloat(meteredResult.rows[0]?.external_total || 0);
      const internal_metered_usdt = parseFloat(meteredResult.rows[0]?.internal_total || 0);

      // Deposits tracking (gross external funds deposited). null = unavailable
      // (table missing / query failed) — never reported as 0.
      let total_deposited_usdt = null;
      try {
        const depResult = await pool.query(`
          SELECT COALESCE(SUM(amount_usdt), 0) as total FROM credit_deposits
           WHERE status = 'confirmed' AND NOT (lower(wallet_address) = ANY($1::text[]))
        `, [FOUNDER_WALLETS]);
        total_deposited_usdt = parseFloat(depResult.rows[0]?.total || 0);
      } catch (e) { /* table may not exist → unavailable */ }

      // 2. Allocated value = SUM of epoch total_revenue from closed epochs
      const allocatedResult = await pool.query(`
        SELECT COALESCE(SUM(total_revenue), 0) as total
        FROM epoch_ledger
        WHERE status = 'CLOSED'
      `);
      const allocated_value_usdt = parseFloat(allocatedResult.rows[0]?.total || 0);

      // 3. Unpaid value = SUM(epoch_earnings WHERE status = 'UNPAID')
      const unpaidResult = await pool.query(`
        SELECT COALESCE(SUM(amount_usdt), 0) as total
        FROM epoch_earnings
        WHERE status = 'UNPAID'
      `);
      const unpaid_value_usdt = parseFloat(unpaidResult.rows[0]?.total || 0);

      // 4. Treasury real = live on-chain USDT balance
      const rpcUrl = process.env.RPC_URL || 'https://polygon.drpc.org';
      const usdtContract = process.env.USDT_CONTRACT || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';

      let treasury_real_usdt = 0;
      let treasury_source = 'onchain';
      let treasury_error = null;

      if (treasuryAddress) {
        try {
          const balance = await getUsdtBalance(rpcUrl, usdtContract, treasuryAddress);
          treasury_real_usdt = balance !== null ? balance : 0;
        } catch (e) {
          treasury_error = e.message;
          treasury_source = 'error';
        }
      } else {
        treasury_source = 'unconfigured';
      }

      // 5. Claimed total = SUM(epoch_earnings WHERE status = 'PAID') + SUM(node_claims)
      let claimed_total_usdt = 0;

      // Check epoch_earnings PAID
      const paidEarningsResult = await pool.query(`
        SELECT COALESCE(SUM(amount_usdt), 0) as total
        FROM epoch_earnings
        WHERE status = 'PAID'
      `);
      claimed_total_usdt += parseFloat(paidEarningsResult.rows[0]?.total || 0);

      // Check node_claims if exists
      try {
        const claimsResult = await pool.query(`
          SELECT COALESCE(SUM(amount_usdt), 0) as total
          FROM node_claims
        `);
        claimed_total_usdt += parseFloat(claimsResult.rows[0]?.total || 0);
      } catch (e) {
        // Table may not exist
      }

      // 6. Settlement batches stats (including blocked_unfunded)
      let settlement_batches_pending = 0;
      let settlement_batches_confirmed = 0;
      let settlement_batches_blocked_unfunded = 0;
      let settlement_batches_confirmed_usdt = 0;
      let settlement_batches_blocked_usdt = 0;
      try {
        const batchResult = await pool.query(`
          SELECT status, COUNT(*)::int as count, COALESCE(SUM(total_amount_usdt), 0)::float as sum_usdt
          FROM settlement_batches
          GROUP BY status
        `);
        for (const row of batchResult.rows) {
          if (row.status === 'pending') settlement_batches_pending = parseInt(row.count);
          if (row.status === 'confirmed') {
            settlement_batches_confirmed = parseInt(row.count);
            settlement_batches_confirmed_usdt = parseFloat(row.sum_usdt || 0);
          }
          if (row.status === 'blocked_unfunded') {
            settlement_batches_blocked_unfunded = parseInt(row.count);
            settlement_batches_blocked_usdt = parseFloat(row.sum_usdt || 0);
          }
        }
      } catch (e) {
        // Table may not exist
      }

      // 7. Calculate derived metrics
      const withdrawable_now_usdt = Math.min(unpaid_value_usdt, treasury_real_usdt);
      const cash_conversion_pct = metered_value_usdt > 0
        ? (claimed_total_usdt / metered_value_usdt) * 100
        : 0;

      // 8. Determine status
      let status = 'healthy';
      if (claimed_total_usdt === 0 && metered_value_usdt > 0) {
        status = 'metered_only';
      } else if (treasury_real_usdt < unpaid_value_usdt) {
        status = 'treasury_constrained';
      }

      // 9. Pipeline trace (for debugging)
      const pipelineTrace = await tracePipeline(pool, treasuryAddress);

      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        query_ms: Date.now() - startTime,

        // Core financial truth: strictly distinguish external customer revenue vs internal/deposits
        metered_value_usdt: parseFloat(metered_value_usdt.toFixed(6)),
        external_revenue_usdt: parseFloat(external_metered_usdt.toFixed(6)),
        internal_revenue_usdt: parseFloat(internal_metered_usdt.toFixed(6)),
        total_deposited_usdt: total_deposited_usdt == null ? null : parseFloat(total_deposited_usdt.toFixed(6)),
        allocated_value_usdt: parseFloat(allocated_value_usdt.toFixed(6)),
        unpaid_value_usdt: parseFloat(unpaid_value_usdt.toFixed(6)),
        treasury_real_usdt: parseFloat(treasury_real_usdt.toFixed(6)),
        withdrawable_now_usdt: parseFloat(withdrawable_now_usdt.toFixed(6)),
        claimed_total_usdt: parseFloat(claimed_total_usdt.toFixed(6)),
        cash_conversion_pct: parseFloat(cash_conversion_pct.toFixed(2)),
        status,

        // Source metadata
        sources: {
          metered: { table: 'revenue_events_v2', query: 'SUM(amount_usdt) WHERE NOT is_test_data' },
          external: { table: 'revenue_events_v2 (excluding treasury keys)', query: 'SUM(amount_usdt)' },
          internal: { table: 'revenue_events_v2 (treasury keys)', query: 'SUM(amount_usdt)' },
          allocated: { table: 'epoch_ledger', query: 'SUM(total_revenue) WHERE CLOSED' },
          unpaid: { table: 'epoch_earnings', query: 'SUM(amount_usdt) WHERE UNPAID' },
          treasury: {
            source: treasury_source,
            address: treasuryAddress || 'not_configured',
            contract: usdtContract,
            error: treasury_error
          },
          claimed: { tables: ['epoch_earnings (PAID)', 'node_claims'] }
        },

        // Settlement pipeline stats — note: confirmed batches are internal simulated rollups until on-chain proven
        settlement: {
          batches_pending: settlement_batches_pending,
          batches_confirmed: settlement_batches_confirmed,
          batches_blocked_unfunded: settlement_batches_blocked_unfunded,
          confirmed_batches_usdt: parseFloat(settlement_batches_confirmed_usdt.toFixed(6)),
          blocked_unfunded_usdt: parseFloat(settlement_batches_blocked_usdt.toFixed(6))
        },

        // Pipeline trace
        pipeline: pipelineTrace,

        // Warnings
        warnings: buildWarnings(metered_value_usdt, treasury_real_usdt, unpaid_value_usdt, claimed_total_usdt, settlement_batches_blocked_unfunded)
      });

    } catch (err) {
      console.error('[Financial-Truth] Query failed:', err.message);
      res.status(500).json({
        ok: false,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

async function tracePipeline(pool, treasuryAddress) {
  const trace = {
    revenue_events_v2: { count: 0, sum_usdt: 0, external_count: 0, external_usdt: 0, internal_count: 0, internal_usdt: 0 },
    epoch_ledger: { open: 0, closed: 0, total_revenue: 0 },
    epoch_earnings: { unpaid: 0, paid: 0, sum_unpaid: 0, sum_paid: 0 },
    settlement_batches: { pending: 0, confirmed: 0, blocked_unfunded: 0 },
    node_claims: { count: 0, sum_usdt: 0 },
    bottleneck: null,
    bottleneck_reason: null
  };

  try {
    // revenue_events_v2 with external vs internal split
    const eventsResult = await pool.query(`
      SELECT
        COUNT(*)::int as count,
        COALESCE(SUM(e.amount_usdt), 0)::float as sum,
        COUNT(*) FILTER (WHERE NOT ${INTERNAL_PREDICATE})::int AS ext_count,
        COALESCE(SUM(e.amount_usdt) FILTER (WHERE NOT ${INTERNAL_PREDICATE}), 0)::float AS ext_sum,
        COUNT(*) FILTER (WHERE ${INTERNAL_PREDICATE})::int AS int_count,
        COALESCE(SUM(e.amount_usdt) FILTER (WHERE ${INTERNAL_PREDICATE}), 0)::float AS int_sum
      FROM revenue_events_v2 e
      LEFT JOIN api_credits t ON t.api_key = e.client_id
      WHERE e.is_test_data = false OR e.is_test_data IS NULL
    `, [FOUNDER_WALLETS]);
    trace.revenue_events_v2.count = parseInt(eventsResult.rows[0]?.count || 0);
    trace.revenue_events_v2.sum_usdt = parseFloat(eventsResult.rows[0]?.sum || 0);
    trace.revenue_events_v2.external_count = parseInt(eventsResult.rows[0]?.ext_count || 0);
    trace.revenue_events_v2.external_usdt = parseFloat(eventsResult.rows[0]?.ext_sum || 0);
    trace.revenue_events_v2.internal_count = parseInt(eventsResult.rows[0]?.int_count || 0);
    trace.revenue_events_v2.internal_usdt = parseFloat(eventsResult.rows[0]?.int_sum || 0);

    // epoch_ledger
    const epochResult = await pool.query(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(total_revenue), 0) as sum
      FROM epoch_ledger GROUP BY status
    `);
    for (const row of epochResult.rows) {
      if (row.status === 'OPEN') trace.epoch_ledger.open = parseInt(row.count);
      if (row.status === 'CLOSED') {
        trace.epoch_ledger.closed = parseInt(row.count);
        trace.epoch_ledger.total_revenue = parseFloat(row.sum);
      }
    }

    // epoch_earnings
    const earningsResult = await pool.query(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount_usdt), 0) as sum
      FROM epoch_earnings GROUP BY status
    `);
    for (const row of earningsResult.rows) {
      if (row.status === 'UNPAID') {
        trace.epoch_earnings.unpaid = parseInt(row.count);
        trace.epoch_earnings.sum_unpaid = parseFloat(row.sum);
      }
      if (row.status === 'PAID') {
        trace.epoch_earnings.paid = parseInt(row.count);
        trace.epoch_earnings.sum_paid = parseFloat(row.sum);
      }
    }

    // settlement_batches
    try {
      const batchResult = await pool.query(`
        SELECT status, COUNT(*) as count FROM settlement_batches GROUP BY status
      `);
      for (const row of batchResult.rows) {
        if (row.status === 'pending') trace.settlement_batches.pending = parseInt(row.count);
        if (row.status === 'confirmed') trace.settlement_batches.confirmed = parseInt(row.count);
        if (row.status === 'blocked_unfunded') trace.settlement_batches.blocked_unfunded = parseInt(row.count);
      }
    } catch (e) { /* table may not exist */ }

    // node_claims
    try {
      const claimsResult = await pool.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(amount_usdt), 0) as sum FROM node_claims
      `);
      trace.node_claims.count = parseInt(claimsResult.rows[0]?.count || 0);
      trace.node_claims.sum_usdt = parseFloat(claimsResult.rows[0]?.sum || 0);
    } catch (e) { /* table may not exist */ }

    // Determine bottleneck
    if (trace.revenue_events_v2.count === 0) {
      trace.bottleneck = 'revenue_events_v2';
      trace.bottleneck_reason = 'No revenue events recorded';
    } else if (trace.epoch_ledger.closed === 0) {
      trace.bottleneck = 'epoch_ledger';
      trace.bottleneck_reason = 'No epochs have been closed (aggregation not running)';
    } else if (trace.epoch_earnings.unpaid === 0 && trace.epoch_earnings.paid === 0) {
      trace.bottleneck = 'epoch_earnings';
      trace.bottleneck_reason = 'Epoch closed but no earnings allocated to wallets';
    } else if (trace.epoch_earnings.paid === 0 && trace.epoch_earnings.unpaid > 0) {
      trace.bottleneck = 'settlement';
      trace.bottleneck_reason = 'Earnings allocated but none paid (settlement not executing)';
    } else if (trace.node_claims.count === 0 && trace.epoch_earnings.paid > 0) {
      trace.bottleneck = 'claims';
      trace.bottleneck_reason = 'Payments marked but no claims recorded';
    }

  } catch (e) {
    trace.error = e.message;
  }

  return trace;
}

function buildWarnings(metered, treasury, unpaid, claimed, blockedBatches = 0) {
  const warnings = [];

  if (blockedBatches > 0) {
    warnings.push({
      code: 'BLOCKED_SETTLEMENT_BATCHES',
      message: `${blockedBatches} settlement batches blocked by unfunded settlement signer`,
      severity: 'warning'
    });
  }

  if (treasury < unpaid) {
    warnings.push({
      code: 'TREASURY_CONSTRAINED',
      message: 'Treasury constrained — withdrawals limited by available USDT',
      severity: 'warning'
    });
  }

  if (claimed === 0 && metered > 0) {
    warnings.push({
      code: 'METERED_NOT_COLLECTED',
      message: 'Usage measured but not converted into collected revenue',
      severity: 'warning'
    });
  }

  if (unpaid > 0 && treasury === 0) {
    warnings.push({
      code: 'TREASURY_EMPTY',
      message: 'Unpaid earnings exist but treasury has zero USDT',
      severity: 'critical'
    });
  }

  return warnings;
}
