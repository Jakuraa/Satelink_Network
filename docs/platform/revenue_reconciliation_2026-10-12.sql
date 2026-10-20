-- Read-only. Run with PGOPTIONS='-c default_transaction_read_only=on'. See REVENUE_RECONCILIATION_2026-10-12.md
-- Founder exclusion list (all four canonical founder wallets, lowercase)
\set founders '{0x5cbda3a1c0f1b28fecea1d919785321e88f9fa97,0x966e1ae22996545015b1414b35234b10719d7ad4,0x175727a8486a7eb3ac4bcf2a1a89fd2d58ca0dfd,0x55691946766f4666c786ea8ee2bea176ecc3a841}'

-- Q1  R1 external funds collected, all rails
SELECT COALESCE(SUM(amount_usd), 0) AS collected_usd, COUNT(*) AS n
  FROM payment_sources
 WHERE is_test_data = false
   AND NOT (lower(coalesce(payer, '')) = ANY (:'founders'::text[]));

-- Q2  R2 card/provider split — which provider actually took the money
SELECT source, token, network, COUNT(*) AS n, SUM(amount_usd) AS usd
  FROM payment_sources
 WHERE is_test_data = false
   AND NOT (lower(coalesce(payer, '')) = ANY (:'founders'::text[]))
 GROUP BY 1, 2, 3 ORDER BY usd DESC;

-- Q3  R3 x402
SELECT COUNT(*) AS settlements, COUNT(DISTINCT lower(payer)) AS payers, SUM(amount_usd) AS usd
  FROM payment_sources
 WHERE source = 'x402' AND is_test_data = false
   AND NOT (lower(payer) = ANY (:'founders'::text[]));

-- Q4  R4 credit liabilities (prepaid balance not yet consumed), external accounts only
SELECT COUNT(*) AS accounts, SUM(credits_usdt) AS liability_usdt
  FROM api_credits
 WHERE COALESCE(credits_usdt, 0) > 0
   AND NOT (lower(coalesce(wallet_address, '')) = ANY (:'founders'::text[]));

-- Q5  R5 metered usage (consumed), external only — same predicate as truth.js INTERNAL_PREDICATE.
--     FIXED 2026-10-15: this used to SUM every revenue_events_v2 row with no op_type filter,
--     which pulled in Dodo deposits (internal_dodo.js 'subscription_payment', webhooks.mjs
--     'pack_purchase' — money COMING IN, already counted in Q1/collected) and refund reversals
--     ('refund_reversal' — belongs in a 'refunded' bucket, not 'consumed'). Both inflated
--     "consumed" with rows that were never a metered debit, breaking the Q1/Q4/Q5 invariant
--     below. Usage debits only: every row EXCEPT those three op_types.
SELECT COUNT(*) AS events, SUM(e.amount_usdt) AS metered_usdt
  FROM revenue_events_v2 e
  LEFT JOIN api_credits t ON t.api_key = e.client_id
 WHERE (e.is_test_data = false OR e.is_test_data IS NULL)
   -- 2026-10-20 (S6): aligned with truth.js CONSUMED_USAGE_PREDICATE — also excludes
   -- never-charged rows (is_billable = false) and x402 bundle purchases ('x402:<tx>').
   AND COALESCE(e.op_type, '') NOT IN ('subscription_payment', 'pack_purchase', 'refund_reversal')
   AND COALESCE(e.is_billable, true)
   AND COALESCE(e.request_id, '') NOT LIKE 'x402:%'
   AND NOT COALESCE(lower(e.client_id) = ANY (:'founders'::text[])
                 OR lower(t.wallet_address) = ANY (:'founders'::text[]), false);

-- Q6  R6 settlement batches by status (simulated while SETTLEMENT_DRY_RUN=1)
SELECT status, COUNT(*) AS batches, SUM(total_amount_usdt) AS usdt
  FROM settlement_batches GROUP BY 1 ORDER BY 1;

-- Cross-check C1: every external payment produced exactly one credit (no payment-without-credit)
SELECT p.source, p.tx_hash, p.amount_usd
  FROM payment_sources p
  LEFT JOIN api_deposits d ON d.tx_hash = p.tx_hash
 WHERE p.is_test_data = false AND d.tx_hash IS NULL
   AND NOT (lower(coalesce(p.payer, '')) = ANY (:'founders'::text[]));

-- Q7  (added 2026-10-13) x402 payer attribution — full payer address + tx hash per settlement,
--     ALL rows (founder and test included), so each payer can be matched to Base chain data.
SELECT p.created_at, p.network, lower(p.payer) AS payer, p.tx_hash, p.amount_usd, p.is_test_data,
       left(p.credited_api_key, 8) AS key_prefix
  FROM payment_sources p
 WHERE p.source = 'x402'
 ORDER BY p.created_at;

-- Q8  (added 2026-10-13) card provider of record — which provider wrote each non-crypto row.
--     The code writes card rows only as source = 'dodo'; any other source value is a finding.
SELECT p.source, p.created_at, p.amount_usd, p.token, p.network, p.is_test_data,
       left(coalesce(p.tx_hash, ''), 14) AS ref_prefix, left(p.credited_api_key, 8) AS key_prefix
  FROM payment_sources p
 WHERE p.source NOT IN ('x402', 'polygon_usdt_vault')
 ORDER BY p.created_at;
