# First Revenue Experiments

**Date:** 2026-10-15
**Starting point (verified):** external revenue **$0.00**. All historical x402 settlements and the $19.98 Dodo credit are founder or test money (EXECUTION_BOARD 2026-10-13). There are ~80k unpaid `/rpc` requests/24h (`/api/public/stats`), and 100 % of billed calls return 402.

**Assumption that is NOT allowed:** that anonymous 402 traffic converts. Months of 402s have produced zero external payers. Traffic is a lead source, not revenue.

**Milestone definition (success):** one independently verified **external** payment, then successful service delivery, a correct ledger entry that reconciles to the payment, and a second payment from the same payer.

## Candidate first products

| | C1. RPC credits — direct-sold to identified users (recommended) | C2. x402 pay-per-request for agents (keep running, passive) | C3. BYO-key orchestration (demand test only) |
|---|---|---|---|
| Buyer | Named teams already calling `/rpc/polygon` (UNPAID_TRAFFIC_ANALYSIS: Polymarket-branded client, eRPC deployments, `RPCHub/1.0`, `polygon-one/0.1`, a Supabase Edge Function) | Autonomous agents discovering via x402 Bazaar | Teams running agents against multiple RPC/API providers |
| Problem | Their calls already fail with 402; they need a working Polygon endpoint | Agent needs data without an account | Spend control, failover and audit across providers |
| Willingness-to-pay evidence | **Indirect only**: they integrated Satelink deliberately (custom UAs) | None (0 external settlements) | None |
| Price | $10 prepaid minimum (USDT now; card once approved). Consider $20/M for C1 to be competitive with keyed PAYG | $0.10 / 1,000 | $49–99/mo (hypothesis) |
| Channel | Direct outreach via public contact channels (GitHub repo of `polygon-one`, eRPC community, Polymarket dev contact). **Founder-approved, opt-in, no scraped emails** (memory: cold-emailing inferred addresses was rejected) | Bazaar listing, `.well-known` | Landing page + waitlist |
| Supplier requirement | **Written resale confirmation from the upstream used for paid traffic** (dRPC/Infura/Ankr) or own node | same | none (customer's own keys) |
| Payment-provider requirement | None for USDT; MoR approval for card | CDP facilitator (India eligibility unverified) | none until built |
| Implementation work | Small: fix 402 copy (F-03), pricing contradictions (F-10), MCP publish, a welcome-credit flow (founder-funded, marked `is_test_data=false` only if it's the customer's money) | None | Landing page only |
| Legal dependency | CA view on crypto receipts (INDIA §1, §4). Until then, cap crypto receipts and keep invoices | same | none |
| Cost to deliver /1M | $4.25 infra + $0–20 supplier | same | — |
| Contribution margin /1M | $10.90–24.55 at $30/M (API_PROCUREMENT §3) | $70.75–90.75 at $100/M | n/a |
| Success metric | ≥1 external payer with second top-up within 30 days | ≥1 external settlement from a non-founder wallet | ≥10 qualified waitlist sign-ups with stated budget |
| Failure metric | 0 payers after 10 qualified conversations | 0 external settlements in 30 days | <3 qualified sign-ups |

**Lowest-risk first revenue product: C1.** It is the existing product, uses no new payment provider, has no trading exposure, and targets buyers who already integrated it. Its blockers are a supplier agreement and honest pricing, not new engineering.

## Experiments

### 24 hours (no code deploys needed except where noted)
| # | Action | Owner | Output |
|---|---|---|---|
| 24-1 | Founder checks Railway env for `ALCHEMY_*`, `DRPC_POLYGON_URL`, `PUBLICNODE_POLYGON_URL`, `POLYGON_RPC` (names only) to learn which upstream serves paid traffic | Founder | Fact for the supplier decision |
| 24-2 | Send written resale questions to dRPC (and one of Infura/Ankr) — **draft only here; founder sends** | Founder | Request logged |
| 24-3 | Publish `satelink-mcp@2.1.1` (`MCP_PUBLISH.md`) **or** approve removing the package reference from 402 bodies | Founder | F-03 closed |
| 24-4 | Founder runs the reconciliation SQL Q1–Q8 read-only; paste counts | Founder | Baseline: payers, credits, liabilities |

### 7 days
| # | Action | Owner | Metric |
|---|---|---|---|
| 7-1 | Ship P0 fixes (unmount AI gateway, gate `/api/economics/summary` + `/internal/*-parity`, delete `/v1/plans`, homepage → RPC) as reviewed PRs | Eng (this repo) + founder merge | Live curl evidence |
| 7-2 | Identify ≥10 named integrators from UA/GitHub and public channels; contact ≤10 through **their published contact channels** with a $10-credit offer | Founder | Qualified prospects (target ≥5 replies) |
| 7-3 | Run `X402_PAID_TEST_RUNBOOK.md` with a **non-founder** volunteer wallet (a friendly developer, disclosed as a test) | Founder | End-to-end trace: settle → `payment_sources` → credits → serve → ledger parity |
| 7-4 | Apply to Paddle (or Polar/Creem) **only after** the homepage, legal-page and boundary fixes are live; disclose Trading AI as a separate unlaunched beta | Founder | Application submitted with accurate site |

**7-day milestone:** ≥1 external payer (USDT or x402, non-founder wallet), served and reconciled, **or** 5 qualified conversations that state why they won't pay. Either outcome is decision-grade.

### 30 days
| # | Action | Metric |
|---|---|---|
| 30-1 | Repeat purchase from first payer | Repeat paying customers ≥1 |
| 30-2 | MoR decision (approved / declined with reason) | Provider status |
| 30-3 | BYO-key orchestration landing page + waitlist (C3) | ≥10 qualified sign-ups with budget |
| 30-4 | Weekly funnel review | All metrics below |

## Funnel metrics (tracked separately, never merged)

| Metric | Source | Current |
|---|---|---|
| Visitors | Vercel analytics | unknown |
| Qualified prospects | outreach log (founder) | 0 |
| Registered accounts | `api_credits` rows (non-test) | unknown — DB read needed |
| Activated (first successful call) | metering | unknown |
| Paid customers (external) | `payment_sources WHERE is_test_data=false` + on-chain payer attribution | **0** |
| Successful paid deliveries | metering after payment | 0 |
| Repeat paying customers | ≥2 payments per payer | 0 |
| Net collected revenue | provider payout reports + on-chain receipts to treasury, minus refunds | **$0.00** |
| Refunds / chargebacks | MoR + manual crypto | 0 |
| Contribution margin | API_PROCUREMENT §3 formula on actual volumes | n/a |

## Stop / go

- **GO (continue the RPC business):**
  - ≥1 external payer in 30 days **and** ≥1 repeat payment, **and**
  - written resale confirmation from at least one upstream (or own node), **and**
  - one MoR or acquirer approval for the RPC product, or a CA-approved crypto-receipt process.
- **NO-GO / pivot:**
  - zero external payers after 10 qualified conversations and 30 days, **or**
  - no supplier will confirm resale and an own node is uneconomic, **or**
  - every provider declines the RPC product after the fixes.

  Then pivot to C3 (software, BYO keys), or stop Satelink as a paid product.
