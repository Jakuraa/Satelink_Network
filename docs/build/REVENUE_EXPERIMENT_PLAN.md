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
