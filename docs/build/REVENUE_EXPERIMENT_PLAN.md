# Revenue experiment plan

Session B1 · 2026-11-03. Verified external revenue to date: **$0.00** (REVENUE_MODEL.md; Steps T–V).
Success = an independent external customer pays real money, receives the service, and the payment reconciles
on-chain/ledger. Founder, test, free or simulated activity never counts. No outreach is sent without approval.

## Ranked opportunities

| | A. Polygon RPC (x402 / credits) | C. Strategy Lab evaluations | B. Crypto intelligence (token risk) | D. Procurement fees | E. MCP/API usage |
|---|---|---|---|---|---|
| Customer problem | Agents/bots need pay-per-call RPC without accounts | Traders want honest evidence before risking money | Agents need a risk signal before touching a token | Agents need to buy services safely | Agents want tools in their MCP client |
| Demand evidence | ~100k–500k req/day of anonymous traffic historically (unpaid); 3 named prospects drafted (Step T) | none measured | none measured; supplier is pushing it | none | none (package unpublished) |
| Technical readiness | **Live** (402 + deposits + charge path) | Working in preview (this session) | Supplier unreliable today (429s) | Working for first-party only | Blocked (F12) |
| Supplier dependency | upstream RPC (resale rights unresolved) | market data licence | single bot-run supplier | per capability | — |
| Commercial authorization | **blocked** until an upstream permits resale (F20/dRPC) | **blocked** for charging: Binance/Eulerpool licences non-commercial | supplier permits resale (email) | needs funded wallet + approval | founder publish |
| Unit cost → price | upstream CU cost → $0.0001/call ($0.10/1k) list | ~0 compute → proposal $0.25–$1/evaluation (unapproved) | $0.005 → proposal $0.01 | margin per call | per tool |
| Gross margin | high if upstream ≤ $0.00003/call | high once data licensed | ~50% at $0.01 | thin | — |
| Time to first pilot | **days** after an authorized upstream | weeks (licence) | weeks (evaluation) | months | days after publish |
| Regulatory risk | low | medium (must stay "not advice", no execution) | low-medium (not advice) | low | low |
| Acquisition need | direct outreach to named Polygon devs + x402 Bazaar | content + free beta | piggybacks on A/C | needs A–C first | MCP directories |
| **Rank** | **1** | 2 | 3 | 5 | 4 |

## Experiment 1 (selected): first paid Polygon RPC customer via x402

- **Why first:** it is the only product whose payment, metering and charge path are already live and tested; the
  remaining blockers are commercial, not engineering.
- **Pre-conditions (founder):** (1) one upstream with written resale permission — resend the dRPC reply to
  dRPC's contact, or approve keyed Ankr/Alchemy terms (F20); (2) merge #565 (refund on upstream failure) so a
  paid failure is never kept.
- **Offer:** existing public price, $0.10 USDC per 1,000 calls via x402 on Base, or USDT credits on Polygon. No new pricing.
- **Who:** the 3 verified Polygon developers from Step T + x402 Bazaar listing (already indexed).
- **Measure:** ≥ 1 settlement from a wallet not on the founder list, `is_test_data=false`, served calls ≥ 1, and the
  revenue event reconciles with the Base settlement tx. Report within 14 days of the upstream being authorized.
- **Stop rule:** zero paid conversions after 3 personal conversations + 14 days → interview why before building more.

## Experiment 2 (prepare in parallel, no charge): Strategy Lab free beta

- Deploy the workflows beta (flag on, Postgres-backed store) to a staging/preview environment once F3 exists; invite
  the same prospects. Measure: completed evaluations per user, return visits, and "would pay $X per evaluation"
  answers. Charging only after a commercial data licence (F25 or a licensed crypto data vendor) and price approval (F8).

## Outreach drafts (NOT sent)

The Step T/V drafts for the three Polygon developers remain valid; add one line per draft after the upstream is
authorized: "Pay per call with x402 on Base — no account, $0.10 per 1,000 calls; failed calls are refunded."

## Unit economics and pricing proposal — Strategy Lab and Agent Marketplace (Session B2, 2026-11-03)

**Proposal only. No price is live; every workflow charge stays $0 until the founder approves prices (catalog
`pricing.approved`) and the Financial OS reserve/capture path replaces `WithheldSettlement`.**
Legend: **M** = measured this session · **V** = vendor's public claim (confirm in writing) · **F** = formula, rate to confirm.

### Cost per operation

| Cost line | Strategy Lab evaluation | Marketplace call (wallet balance, Polygon, first-party) | Marketplace call (external supplier) |
|---|---|---|---|
| Model / AI | $0 today (rule-based compiler, **M**). If a model drafter is added: tokens × model price (**F**); ~1–2k tokens per compile | $0 | $0 |
| Compute | engine ~0.2–0.5 s CPU per evaluation on cached data (**M**: 231–465 ms in tests); first fetch ~2.5 s wall incl. data | negligible | negligible |
| Data | licensed source: CoinGecko paid tier ~$35/mo for 100k credits (**V**) ≈ $0.00035/credit; one evaluation ≈ 1–2 credits with a 1 h cache | — | — |
| Supplier | — | upstream RPC cost per call: unknown until dRPC/Ankr quote (F20, F26) | $0.002–$0.01 per call (**V**: Space Command, FreeTier) |
| Payment rail | x402 (USDC on Base): facilitator fee + gas — to confirm per facilitator (**F**); card/fiat via Dodo: merchant-of-record fee to confirm (**F**) | same | same + Satelink pays supplier per call |
| Refunds | none for usage: failed/unverified calls are never charged (**M**, tested) | same | same; supplier only settles after 2xx (**V**) |
| Infrastructure | shared Railway API + Postgres (existing fixed cost); per-run storage < 10 kB (run + receipt + journal) | same | same |

### Proposed prices (for founder decision)

| Product | Option A — usage | Option B — subscription | Gross margin estimate |
|---|---|---|---|
| Strategy Lab | first 3 evaluations/day free; then **$0.25 per evaluation** | **$19/mo** for 200 evaluations + saved strategies + paper-trading simulations at the existing $0.05 | cost ≈ data credit + CPU ≪ $0.01 → > 95% at $0.25 (before payment fees; after a licensed data plan) |
| Marketplace — first-party (wallet balance via Satelink RPC) | existing RPC list rate **$0.00003/call** (no change) | included in RPC credits | depends on upstream quote |
| Marketplace — external suppliers | **supplier cost + max(30%, $0.001)**, shown on the quote as supplier cost + Satelink fee | — | 23–33% per call; low absolute $ (e.g. $0.005 → $0.0065) |

Rationale and risks:
- Strategy Lab is the higher-margin product, but charging requires a commercial data licence (CoinGecko written
  confirmation) — until then it is a free preview and cannot be counted as revenue.
- Marketplace margins per call are tiny; it only matters at agent volume. Its near-term value is as the trust layer
  (quote → approval → verification → receipt) in front of RPC and Strategy Lab.
- Payment-rail fees can exceed the margin on sub-cent calls: sell external capabilities in prepaid credit bundles
  (like the existing $0.10 = 1,000 RPC calls) rather than one on-chain payment per call.
- No subscription or usage charge goes live without founder-approved prices, the legal/CA items (F5), and a
  reconciliation test that ties every charge to a receipt and a revenue event.
