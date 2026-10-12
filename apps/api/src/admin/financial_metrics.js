// apps/api/src/admin/financial_metrics.js
// Admin command center — financial metric registry + money alerts
// (2026-10-12 directive, Step 5). Admin-auth only (mounted under /admin).
//
// Every metric carries its definition, the exact source query, currency,
// timestamp and reconciliation status. A metric that cannot be computed
// (missing table, query error) is value:null + status 'unavailable' — NEVER 0.
// Categories are kept apart and never summed into one "revenue" number.
import { FOUNDER_WALLETS } from '../payments/founder_wallets.js';
import { INTERNAL_PREDICATE } from '../services/financial/truth.js';
import { PRICE_PER_CALL_USDT } from '../billing/credit_service.mjs';

const EXTERNAL_PAYER = `NOT (lower(coalesce(payer, '')) = ANY ($1::text[]))`;

export const METRIC_DEFS = [
  {
    id: 'external_funds_collected', label: 'External funds collected', currency: 'USD-equivalent (per token below)',
    definition: 'Money received from non-founder payers on every rail (x402 USDC, card via Dodo, …), excluding test data. Gross, before provider fees.',
    sql: `SELECT token, source, COUNT(*)::int AS n, COALESCE(SUM(amount_usd),0)::float AS value
            FROM payment_sources WHERE is_test_data = false AND ${EXTERNAL_PAYER} GROUP BY 1, 2 ORDER BY 1, 2`,
    params: () => [FOUNDER_WALLETS], kind: 'breakdown',
  },
  {
    id: 'credit_liabilities', label: 'Credit liabilities', currency: 'USDT',
    definition: 'Prepaid credit not yet consumed on non-founder accounts — owed to customers as service (or refund), not revenue.',
    sql: `SELECT COALESCE(SUM(credits_usdt),0)::float AS value FROM api_credits
           WHERE COALESCE(credits_usdt,0) > 0 AND NOT (lower(coalesce(wallet_address,'')) = ANY ($1::text[]))`,
    params: () => [FOUNDER_WALLETS],
  },
  {
    id: 'consumed_usage', label: 'Consumed usage (metered)', currency: 'USDT',
    definition: 'Metered value of calls served to external customers (revenue_events_v2, excluding test data and founder/treasury usage).',
    sql: `SELECT COALESCE(SUM(e.amount_usdt),0)::float AS value FROM revenue_events_v2 e
            LEFT JOIN api_credits t ON t.api_key = e.client_id
           WHERE (e.is_test_data = false OR e.is_test_data IS NULL) AND NOT ${INTERNAL_PREDICATE}`,
    params: () => [FOUNDER_WALLETS],
  },
  {
    id: 'recognized_revenue', label: 'Recognized revenue (ledger)', currency: 'USDT (minor units / 1e6)',
    definition: 'Balance of the Financial OS platform revenue account. Shadow ledger — populated only while LEDGER_SHADOW_WRITE=1.',
    sql: `SELECT (COALESCE(SUM(amount) FILTER (WHERE direction='credit'),0) - COALESCE(SUM(amount) FILTER (WHERE direction='debit'),0))::float / 1e6 AS value
            FROM ledger_entries WHERE account_id = 'acct_platform_revenue'`,
    params: () => [], status: () => (process.env.LEDGER_SHADOW_WRITE === '1' ? 'unreconciled' : 'shadow_off'),
  },
  {
    id: 'subscriptions_active', label: 'Active subscriptions', currency: 'count',
    definition: 'Active, unexpired Trading AI period grants (payment_entitlement_grants).',
    sql: `SELECT COUNT(DISTINCT customer_account_id)::float AS value FROM payment_entitlement_grants
           WHERE status = 'active' AND grant_kind = 'period' AND period_end > now()`,
    params: () => [],
  },
  {
    id: 'refunds', label: 'Refunds and reversals', currency: 'per currency',
    definition: 'Refunded / disputed-lost payment events (Financial OS payments).',
    sql: `SELECT currency, COUNT(*)::int AS n, COALESCE(SUM(amount_minor),0)::float AS value
            FROM payment_events WHERE status IN ('refunded','disputed') GROUP BY 1`,
    params: () => [], kind: 'breakdown',
  },
  {
    id: 'internal_founder', label: 'Internal / founder funds', currency: 'USD-equivalent',
    definition: 'Payments from founder-controlled wallets (payments/founder_wallets.js). Never revenue.',
    sql: `SELECT COALESCE(SUM(amount_usd),0)::float AS value FROM payment_sources WHERE lower(coalesce(payer,'')) = ANY ($1::text[])`,
    params: () => [FOUNDER_WALLETS],
  },
  {
    id: 'test_simulated', label: 'Test / simulated payments', currency: 'USD-equivalent',
    definition: 'Payments flagged is_test_data (testnets, founder validation). Never revenue.',
    sql: `SELECT COALESCE(SUM(amount_usd),0)::float AS value FROM payment_sources WHERE is_test_data = true`,
    params: () => [],
  },
  {
    id: 'blocked_settlement', label: 'Blocked settlement', currency: 'USDT',
    definition: 'Settlement batches that could not be paid (status blocked_unfunded). Internal accounting, no money moved.',
    sql: `SELECT COALESCE(SUM(total_amount_usdt),0)::float AS value FROM settlement_batches WHERE status = 'blocked_unfunded'`,
    params: () => [],
  },
  {
    id: 'onchain_settlement', label: 'On-chain settlement', currency: 'USDT',
    definition: 'Settlement actually broadcast on-chain. While SETTLEMENT_DRY_RUN=1 nothing is broadcast; "confirmed" batches are simulated rollups.',
    sql: `SELECT COALESCE(SUM(total_amount_usdt),0)::float AS value FROM settlement_batches WHERE status = 'confirmed' AND tx_hash IS NOT NULL`,
    params: () => [],
    override: () => (process.env.SETTLEMENT_DRY_RUN !== '0' ? { value: 0, status: 'dry_run', note: 'SETTLEMENT_DRY_RUN is on — nothing has been broadcast' } : null),
  },
];

async function evalMetric(pool, m, asOf) {
  const base = { id: m.id, label: m.label, definition: m.definition, currency: m.currency, source_query: m.sql.replace(/\s+/g, ' ').trim(), as_of: asOf };
  const o = m.override?.();
  if (o) return { ...base, value: o.value, reconciliation_status: o.status, note: o.note };
  try {
    const r = await pool.query(m.sql, m.params());
    const value = m.kind === 'breakdown' ? r.rows : (r.rows[0]?.value ?? null);
    return { ...base, value, reconciliation_status: m.status?.() ?? 'unreconciled' };
  } catch (err) {
    return { ...base, value: null, reconciliation_status: 'unavailable', reason: err.code === '42P01' ? 'source table not present in this database' : 'query failed' };
  }
}

export async function getFinancialMetrics(pool) {
  const asOf = new Date().toISOString();
  return { as_of: asOf, metrics: await Promise.all(METRIC_DEFS.map((m) => evalMetric(pool, m, asOf))) };
}

// ── Alerts ──────────────────────────────────────────────────────────────────
// Each: { id, firing: true|false|null, count, sample, definition, reason? }.
// null = cannot be evaluated (never reported as "not firing").
export const ALERT_DEFS = [
  {
    id: 'payment_without_credit',
    definition: 'An external x402/vault payment with no matching api_deposits credit row (money taken, nothing credited).',
    sql: `SELECT p.source, p.tx_hash, p.amount_usd FROM payment_sources p
            LEFT JOIN api_deposits d ON d.tx_hash = p.tx_hash
           WHERE p.is_test_data = false AND p.source IN ('x402') AND d.tx_hash IS NULL
             AND NOT (lower(coalesce(p.payer,'')) = ANY ($1::text[])) LIMIT 20`,
    params: () => [FOUNDER_WALLETS],
  },
  {
    id: 'duplicate_credit',
    definition: 'One payment credited more than once (same tx_hash in api_deposits or payment_sources).',
    sql: `SELECT tx_hash, COUNT(*)::int AS n FROM (
            SELECT tx_hash FROM api_deposits UNION ALL SELECT tx_hash FROM payment_sources) x
           GROUP BY tx_hash HAVING COUNT(*) > 2 LIMIT 20`,
    // payment_sources + api_deposits each hold one row per paid tx → >2 means a duplicate
    params: () => [],
  },
  {
    id: 'x402_402_loop',
    definition: 'A payer holding an issued x402 key received a 402 while its account still had credit for a call.',
    sql: `SELECT account_api_key, code, credits_usdt_at_denial, created_at FROM x402_key_denials
           WHERE created_at > now() - interval '24 hours' AND credits_usdt_at_denial >= $1 ORDER BY created_at DESC LIMIT 20`,
    params: () => [PRICE_PER_CALL_USDT],
  },
  {
    id: 'reconciliation_diff',
    definition: 'An account whose total_deposited differs from the sum of its api_deposits credits.',
    sql: `SELECT c.api_key, c.total_deposited::float AS recorded, COALESCE(SUM(COALESCE(d.credited_usdt, d.amount_usdt)),0)::float AS from_deposits
            FROM api_credits c LEFT JOIN api_deposits d ON d.api_key = c.api_key
           WHERE COALESCE(c.total_deposited,0) > 0
           GROUP BY c.api_key, c.total_deposited
          HAVING abs(COALESCE(c.total_deposited,0) - COALESCE(SUM(COALESCE(d.credited_usdt, d.amount_usdt)),0)) > 0.000001 LIMIT 20`,
    params: () => [], redact: (row) => ({ ...row, api_key: `${String(row.api_key).slice(0, 8)}…` }),
  },
  {
    id: 'worker_down',
    definition: 'The deposit listener cursor has not advanced in 30 minutes.',
    sql: `SELECT chain_id, updated_at FROM deposit_scan_cursor WHERE updated_at < now() - interval '30 minutes'`,
    params: () => [],
  },
];

async function evalAlert(pool, a) {
  try {
    const r = await pool.query(a.sql, a.params());
    const rows = a.redact ? r.rows.map(a.redact) : r.rows;
    return { id: a.id, definition: a.definition, firing: rows.length > 0, count: rows.length, sample: rows.slice(0, 5) };
  } catch (err) {
    return { id: a.id, definition: a.definition, firing: null, count: null, sample: [], reason: err.code === '42P01' ? 'source table not present in this database' : 'query failed' };
  }
}

export async function getFinancialAlerts(pool) {
  return { as_of: new Date().toISOString(), alerts: await Promise.all(ALERT_DEFS.map((a) => evalAlert(pool, a))) };
}
