# Revenue reconciliation — 2026-10-12

Step 1.4 of the 2026-10-12 directive. Scope: reproduce each reported figure with one read-only
SQL query against production, `is_test_data = false`, excluding founder wallets
`0x5cbda3a1c0f1b28fecea1d919785321e88f9fa97` and `0x966e1ae22996545015b1414b35234b10719d7ad4`
(the canonical list in `apps/api/src/payments/founder_wallets.js` also has
`0x175727…0dfd` and `0x556919…a841`; the queries exclude **all four**).

## Status: ALL FIGURES UNVERIFIED

Claude Code's request to read the production database was **denied by the session's
permission policy** (production read). No figure below was reproduced. The queries are
ready; the founder (or an approved session) runs them read-only and pastes the results in
the "result" column. Until then, no figure here may be quoted as revenue.

Run read-only:

```bash
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_PUBLIC_URL" -f docs/platform/revenue_reconciliation_2026-10-12.sql
```

| # | reported figure | source (claim) | query | result | status |
|---|---|---|---|---|---|
| R1 | $20.18 collected (total external) | report | Q1 | — | UNVERIFIED |
| R2 | $19.98 card deposits, labelled "Stripe" | report | Q2 | — | UNVERIFIED — **and the label is wrong by code**: there is no Stripe integration in `apps/api` (zero matches). Card payments are written as `payment_sources.source = 'dodo'` (`src/routes/internal_dodo.js:688`, `src/pricing_v2/webhooks.mjs:134`). If $19.98 exists it was taken by **Dodo**. Q2 groups by `source` to prove it. |
| R3 | $0.20 from x402 | report | Q3 | — | UNVERIFIED (expect 2 × $0.10 bundles, the two paying machines) |
| R4 | credit liabilities (unconsumed prepaid) | report | Q4 | — | UNVERIFIED |
| R5 | metered usage | report | Q5 | — | UNVERIFIED |
| R6 | $294.29 simulated settlement batches | report | Q6 | — | UNVERIFIED — `SETTLEMENT_DRY_RUN=1`: these are **internal simulated rollups, not money moved**. Never revenue. |

## Queries (`revenue_reconciliation_2026-10-12.sql`)

```sql
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
--     FIXED 2026-10-15: excludes Dodo deposit rows ('subscription_payment', 'pack_purchase' —
--     money coming in, already in Q1/collected) and 'refund_reversal' (belongs in "refunded",
--     not "consumed"); the unfiltered SUM used to count all three as usage.
SELECT COUNT(*) AS events, SUM(e.amount_usdt) AS metered_usdt
  FROM revenue_events_v2 e
  LEFT JOIN api_credits t ON t.api_key = e.client_id
 WHERE (e.is_test_data = false OR e.is_test_data IS NULL)
   AND e.op_type NOT IN ('subscription_payment', 'pack_purchase', 'refund_reversal')
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
```

## Reconciliation identities (to check once results exist)

- **Invariant: collected = liability + consumed + refunded** (within rounding).
  Q1 (collected) should equal Q4 (liability, unconsumed prepaid) + Q5 (consumed, fixed
  2026-10-15 to exclude deposit/refund op_types) + a refunded-amount query (not yet in
  this file — `SUM(amount_usdt) FROM revenue_events_v2 WHERE op_type = 'refund_reversal'`,
  external only, same predicate as Q5). Before the Q5 fix this invariant could not hold:
  Q5 double-counted deposits that Q1 already counted, and never subtracted refunds.
- Q1 = Σ Q2 (by construction).
- Q3 ≤ Q1; Q3 settlements should equal the number of x402 `api_deposits` rows (C1 empty).
- External funds collected (Q1) ≥ consumed (Q5 portion billed from prepaid) + liability (Q4),
  modulo bundle margin (an x402 $0.10 bundle credits $0.03 of spend capacity — `credited_usdt`
  vs `amount_usdt`, settlement.js T-17b).
- Q6 is never added to Q1–Q5.
- **Open finding (not fixed by this round, flagged for founder review):** `/api/financial/truth`
  (`src/services/financial/truth.js`, live, `#529`/`#532` PRODUCTION VERIFIED) computes
  `metered_value_usdt` the same unfiltered way Q5 had — `SUM(revenue_events_v2.amount_usdt)`
  with no `op_type` exclusion — so it likely has the same deposit/refund double-count in
  production today. Out of scope for this round (money-path code, needs its own review/PR);
  this doc only fixes the read-only reconciliation query.
