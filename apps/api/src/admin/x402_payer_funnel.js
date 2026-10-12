// apps/api/src/admin/x402_payer_funnel.js
// Per-PAYER x402 funnel (2026-10-12 directive, Step 3.4). Counts payers, never
// raw traffic. External only: is_test_data=false and no founder wallet.
//
//   discovery_hits → 402_issued → paid → first_call → repeat_calls(≥2) → repeat_purchase
//
// The first two stages are anonymous by design (no payer identity exists before
// a signed payment), so they are reported as null + reason — never a traffic
// number dressed up as a payer count.
import { FOUNDER_WALLETS } from '../payments/founder_wallets.js';

export const PAYER_FUNNEL_SQL = `
  WITH payers AS (
    SELECT lower(payer) AS payer, COUNT(*)::int AS settlements,
           MIN(credited_api_key) AS account
      FROM payment_sources
     WHERE source = 'x402' AND is_test_data = false
       AND payer ~* '^0x[0-9a-f]{40}$'
       AND NOT (lower(payer) = ANY($1::text[]))
     GROUP BY 1
  ), usage AS (
    SELECT p.payer, p.settlements, COALESCE(SUM(u.request_count), 0)::int AS calls
      FROM payers p LEFT JOIN api_usage_daily u ON u.api_key = p.account
     GROUP BY 1, 2
  )
  SELECT COUNT(*)::int                                   AS paid,
         COUNT(*) FILTER (WHERE calls >= 1)::int         AS first_call,
         COUNT(*) FILTER (WHERE calls >= 2)::int         AS repeat_calls,
         COUNT(*) FILTER (WHERE settlements >= 2)::int   AS repeat_purchase
    FROM usage`;

export async function getX402PayerFunnel(pool) {
  const r = await pool.query(PAYER_FUNNEL_SQL, [FOUNDER_WALLETS]);
  const row = r.rows[0] || {};
  const anon = { value: null, reason: 'unavailable: anonymous stage — no payer identity before a signed payment' };
  return {
    unit: 'distinct external payer wallets',
    stages: {
      discovery_hits: anon,
      x402_issued: anon,
      paid: { value: row.paid ?? 0 },
      first_call: { value: row.first_call ?? 0, definition: '≥1 metered call on the credited account (includes the paid call itself)' },
      repeat_calls: { value: row.repeat_calls ?? 0, definition: '≥2 metered calls — i.e. the bundle was reused after payment' },
      repeat_purchase: { value: row.repeat_purchase ?? 0, definition: '≥2 x402 settlements from the same payer' },
    },
    source: 'payment_sources (source=x402) ⨝ api_usage_daily on credited_api_key',
    excludes: 'is_test_data, founder wallets (payments/founder_wallets.js)',
    as_of: new Date().toISOString(),
  };
}
