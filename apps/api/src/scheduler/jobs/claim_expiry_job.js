import { logger } from '../../monitoring/logger.js';

/**
 * Claim Expiry Job
 * Runs every 6 hours to:
 * 1. Expire unclaimed earnings after 48 days → sweep to treasury
 * 2. Expire unsubmitted claim signatures after 48 hours
 */

const EARNINGS_EXPIRY_DAYS = 48;
const SIGNATURE_EXPIRY_HOURS = 48;
const JOB_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Sweep expired unclaimed earnings to treasury.
 * @param {import('pg').Pool} pool - PostgreSQL pool
 */
async function sweepExpiredEarnings(pool) {
    const client = await pool.connect();
    const now = Math.floor(Date.now() / 1000);
    const expiryThreshold = now - (EARNINGS_EXPIRY_DAYS * 24 * 60 * 60); // 48 days ago

    try {
        // No runtime DDL (docs/build/runbooks/DB_ROLE_SWITCH.md): read what the schema has.
        const schema = await client.query(`
            SELECT to_regclass('treasury_sweeps') IS NOT NULL AS has_sweeps,
                   EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema = current_schema() AND table_name = 'epoch_earnings'
                              AND column_name = 'expired_at') AS has_expired_at
        `);
        const { has_sweeps: hasSweeps, has_expired_at: hasExpiredAt } = schema.rows[0];
        if (!hasSweeps) {
            // Fail closed: never mark earnings EXPIRED without recording where the money went.
            logger.warn('CLAIM_EXPIRY: treasury_sweeps table missing — skipping earnings expiry (apply the migration)');
            return { nodesAffected: 0, totalSwept: 0, totalReallocated: 0, skipped: 'treasury_sweeps_missing' };
        }

        await client.query('BEGIN');

        // Mark expired UNPAID earnings (reserved CLAIMING rows are never touched) and get the
        // per-node amounts back; all money in SQL numeric.
        const expired = await client.query(`
            WITH x AS (
                UPDATE epoch_earnings
                   SET status = 'EXPIRED'${hasExpiredAt ? ', expired_at = $2' : ''}
                 WHERE status = 'UNPAID' AND created_at < $1 AND amount_usdt > 0
                RETURNING wallet_or_node_id, amount_usdt
            )
            SELECT wallet_or_node_id AS node_id, SUM(amount_usdt)::text AS expired_amount
              FROM x GROUP BY wallet_or_node_id
        `, hasExpiredAt ? [expiryThreshold, now] : [expiryThreshold]);

        // 50% to treasury per node (recorded), 50% pooled for reallocation.
        let totalSwept = '0';
        let totalReallocated = '0';
        if (expired.rows.length > 0) {
            const sweep = await client.query(`
                WITH e AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(node_id text, expired_amount numeric)),
                     ins AS (
                        INSERT INTO treasury_sweeps (node_id, amount_usdt, reason, swept_at)
                        SELECT node_id, trunc(expired_amount * 0.5, 8), '48_day_expiry_50pct', $2 FROM e
                        RETURNING amount_usdt
                     )
                SELECT (SELECT COALESCE(SUM(amount_usdt), 0) FROM ins)::text AS swept,
                       (SELECT COALESCE(SUM(expired_amount), 0) FROM e)::text AS expired
            `, [JSON.stringify(expired.rows), now]);
            totalSwept = sweep.rows[0].swept;
            // Reallocation = everything expired minus what went to the treasury (no rounding loss).
            const rem = await client.query(`SELECT ($1::numeric - $2::numeric)::text AS r`, [sweep.rows[0].expired, totalSwept]);
            totalReallocated = rem.rows[0].r;
        }

        // Reallocate the pooled 50% to currently active nodes. Own role (expiry_reallocation,
        // epoch 0): role is NOT NULL and part of the PK (epoch_id, role, wallet_or_node_id), so
        // repeat runs add to the node's row instead of failing.
        if (Number(totalReallocated) > 0) {
            const realloc = await client.query(`
                WITH active AS (
                    SELECT node_id FROM nodes WHERE LOWER(status) IN ('active', 'online', 'healthy')
                ), share AS (
                    SELECT trunc($1::numeric / NULLIF((SELECT COUNT(*) FROM active), 0), 8) AS per_node
                )
                INSERT INTO epoch_earnings (epoch_id, role, wallet_or_node_id, amount_usdt, status, created_at)
                SELECT 0, 'expiry_reallocation', active.node_id, share.per_node, 'UNPAID', $2
                  FROM active, share WHERE share.per_node > 0
                ON CONFLICT (epoch_id, role, wallet_or_node_id)
                DO UPDATE SET amount_usdt = epoch_earnings.amount_usdt + EXCLUDED.amount_usdt
                RETURNING wallet_or_node_id
            `, [totalReallocated, now]);
            if (realloc.rowCount === 0) {
                // No active node to receive it: record the pooled half with the treasury rather
                // than letting it vanish (expired = swept + reallocated, always).
                await client.query(
                    `INSERT INTO treasury_sweeps (node_id, amount_usdt, reason, swept_at) VALUES (NULL, $1::numeric, 'expiry_no_active_nodes', $2)`,
                    [totalReallocated, now]);
            }
            logger.info({
                totalReallocated,
                nodesReallocated: realloc.rowCount,
            }, 'CLAIM_EXPIRY: reallocated expired earnings to active nodes');
        }

        await client.query('COMMIT');

        for (const row of expired.rows) {
            logger.info({ nodeId: row.node_id, amount: row.expired_amount, reason: '48_day_expiry' },
                'CLAIM_EXPIRY: expired earnings split 50/50');
        }

        return {
            nodesAffected: expired.rows.length,
            totalSwept: Number(totalSwept),
            totalReallocated: Number(totalReallocated)
        };

    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Expire unsubmitted claim signatures after 48 hours.
 * @param {import('pg').Pool} pool - PostgreSQL pool
 */
async function expireStaleSignatures(pool) {
    const now = Math.floor(Date.now() / 1000);

    const result = await pool.query(`
        UPDATE claims
        SET status = 'expired'
        WHERE status = 'pending'
        AND expiry < $1
        RETURNING claim_id, node_id, amount_usdt
    `, [now]);

    if (result.rows.length > 0) {
        logger.info({
            count: result.rows.length,
            claims: result.rows.map(r => r.claim_id)
        }, 'CLAIM_EXPIRY: expired stale claim signatures');
    }

    return { expiredSignatures: result.rows.length };
}

/**
 * Run the full expiry job.
 * @param {import('pg').Pool} pool - PostgreSQL pool
 */
async function runExpiryJob(pool) {
    try {
        logger.info('CLAIM_EXPIRY: running scheduled expiry job');

        // 1. Sweep 48-day expired earnings
        const earningsResult = await sweepExpiredEarnings(pool);

        // 2. Expire 48-hour stale signatures
        const signaturesResult = await expireStaleSignatures(pool);

        logger.info({
            nodesSwept: earningsResult.nodesAffected,
            totalSwept: earningsResult.totalSwept,
            totalReallocated: earningsResult.totalReallocated || 0,
            signaturesExpired: signaturesResult.expiredSignatures
        }, 'CLAIM_EXPIRY: job completed (50% treasury, 50% reallocated)');

        return {
            ok: true,
            ...earningsResult,
            ...signaturesResult
        };

    } catch (err) {
        logger.error({ error: err.message }, 'CLAIM_EXPIRY: job failed');
        throw err;
    }
}

/**
 * Start the claim expiry scheduler.
 * Runs every 6 hours.
 * @param {import('pg').Pool} pool - PostgreSQL pool
 */
export function startClaimExpiryJob(pool) {
    const run = async () => {
        try {
            await runExpiryJob(pool);
        } catch (err) {
            logger.error({ error: err.message }, 'CLAIM_EXPIRY: scheduled run failed');
        }
    };

    // Run immediately on startup, then every 6 hours
    run();
    const intervalId = setInterval(run, JOB_INTERVAL_MS);

    logger.info({
        intervalHours: JOB_INTERVAL_MS / (60 * 60 * 1000),
        earningsExpiryDays: EARNINGS_EXPIRY_DAYS,
        signatureExpiryHours: SIGNATURE_EXPIRY_HOURS
    }, 'CLAIM_EXPIRY: started — sweeping unclaimed rewards every 6h');

    return {
        runNow: run,
        stop: () => clearInterval(intervalId)
    };
}

// ensureExpiryTables (runtime CREATE/ALTER) was removed: it was never called, and runtime DDL
// fails for a non-owner role. The schema comes from migrations (core/db/sql/033_claims_pull_model.sql).

export { runExpiryJob, sweepExpiredEarnings };

export default {
    startClaimExpiryJob,
    runExpiryJob
};
