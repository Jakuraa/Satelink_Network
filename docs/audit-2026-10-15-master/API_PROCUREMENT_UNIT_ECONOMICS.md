# API Procurement & Unit Economics

**Inspection:** 2026-10-15 · Supplier terms read from official pages (accessed 2026-10-15). Full citations, verbatim clauses and arithmetic: `_research_protocols_and_suppliers.md` (§B3, §B4, §C1–C6).
**Rule applied:** gross markup ≠ profit. Contribution margin = revenue − supplier − payment fee − infra − failure/refund − support − partner share.

## 1. Headline

1. **Satelink's live product today *is* API resale.** It is not a hypothetical procurement business; it resells upstream Polygon RPC by the call. By default `apps/api/src/workloads/rpc_gateway/providers.js` routes paid `/rpc/polygon` traffic to **keyless public endpoints**:
   - `polygon-bor-rpc.publicnode.com` (L90–96, `enabled:true`)
   - `polygon.drpc.org` (L108–113; also the emergency fallback, `router.js:152`)
   - Alchemy only when an env key is set (L78–88).
   - Production env overrides are **UNVERIFIED**. The founder must check them, because Railway variable names could not be read this session.
2. **No supplier Satelink touches confirms resale or proxying is permitted.**
   - **PublicNode:** written approval required to distribute "any part of the Service".
   - **dRPC:** account required (§1.3), licence non-sublicensable (§1.1).
   - **Alchemy §2.2, Infura §7.3, Ankr §5.2(a):** written approval required.
   - **QuickNode §7(v), Chainstack:** prohibited.
   - **No signed supplier or reseller agreement exists in the repo or docs.**
3. **"API procurement with a margin" for non-RPC APIs is the worst fit under every ToS reviewed.**
   - **OpenAI:** no resale of access or keys (§3.1, §3.3(g)).
   - **Firecrawl:** prohibited.
   - **Anthropic:** resale needs approval (§D.4).
   - **CoinGecko:** re-syndication needs written approval (§4.1.6).

   These suppliers allow *value-added products built on* their APIs, but not pass-through resale.
4. **Price is not competitive.** $30/M (USDT credits) is 1.5–12× pay-as-you-go competitors, and $100/M (x402 bundle) is 5–40×. The only differentiator is "no account, pay per call with a wallet", and demand for that is unproven: **external revenue is $0.00** (EXECUTION_BOARD 2026-10-13).
5. `docs/PRICING_INTELLIGENCE.md` is stale. Alchemy no longer has a $49 Growth plan, and the QuickNode Polygon credit multiplier was 10× too low. Don't cite it.

## 2. Supplier matrix (summary — citations in research §B3)

| Supplier | In use | Resale class | Published cost /1M simple calls | Notes |
|---|---|---|---|---|
| PublicNode (Allnodes) | **Yes, keyless, default** | REQUIRES WRITTEN APPROVAL | $0 | Also bars "robots"; scope (site vs RPC) is ambiguous; no SLA |
| dRPC public | **Yes, keyless, default + fallback** | NOT DOCUMENTED (non-sublicensable; account required) | $0 public / ~$6 PAYG | Best candidate for a written reseller confirmation |
| Alchemy | Optional (env) | REQUIRES WRITTEN APPROVAL | ~$10.50–13.65 | WS gateway defaults to the shared `demo` key (`ws_gateway.js:21–24`), which is not a licensed production use |
| Ankr / polygon-rpc.com | Deposit listener (keyed per comment); 4 internal paths default to `polygon-rpc.com`, which is now key-only | REQUIRES WRITTEN APPROVAL | ~$20 | Reliability bug: `withdraw_service.js:25` and `settlement_control.js:39` default to an endpoint that no longer accepts keyless calls |
| Infura | No | REQUIRES WRITTEN APPROVAL | ~$8.89 | §3.3 explicitly lets customers share credentials with their "authorized AI Agents", which suits a BYO-key model |
| QuickNode | No | CONFIRMED PROHIBITED (default ToS) | ~$12.25 | Partner Network is the route |
| Chainstack | No | CONFIRMED PROHIBITED (default ToS) | ~$2.45 in plan | Affiliate: 20 % of spend for 12 months |

## 3. Contribution margin per 1M calls

**Assumptions:**
- **Infra:** $4.25/M, i.e. the API's share of ~$371/mo of Railway at an assumed 15M calls/mo. It is ±50 % because the infra report is internally inconsistent.
- **Allowances:** failure/refund 2 % and support 2 % of revenue.
- **Partner share:** 0, because node-operator payouts are dry-run.
- **CDP fee:** 1,000 free settlements/mo, then $0.001 each, which is ~$1 per 1M calls on $0.10 bundles.

| Upstream | Supplier | **$30/M USDT credits** CM | **$100/M x402 bundle** CM | Compliance |
|---|---|---|---|---|
| Public keyless (today) | $0 | $24.55 | $90.75 | **Not usable for resale without written approval** |
| Chainstack in-plan | $2.45 | $22.10 | $88.30 | Prohibited without partner deal |
| dRPC PAYG | $6.00 | $18.55 | $84.75 | Needs written confirmation |
| Infura | $8.89 | $15.66 | $81.86 | Needs written approval |
| Alchemy PAYG | $10.50–13.65 | $10.90–14.05 | ~$78–81 | Needs written approval |
| QuickNode Build | $12.25 | $12.30 | ~$80 | Prohibited without partner deal |
| Ankr PAYG | $20.00 | $4.55 | $70.75 | Needs written approval |

**Card rail:**
- A $30 top-up through Dodo costs ~$2.05; through Paddle, $2.00.
- A $0.10 bundle cannot be sold by card, because Dodo's fixed fee ($0.40) alone exceeds the price.
- Card products must therefore be sold as top-ups of at least $10, or as subscriptions.

**Break-even on fixed infra:** ~16M paid calls/mo at $30/M, or ~4M at $100/M. Today's paid volume is 0.

**Reading:**
- Per-unit margins look healthy. Volume is zero, though, and the legally clean upstream (keyed, with written approval) removes most of the price advantage at $30/M.
- At this stage, **the economics are dominated by demand and legitimacy, not unit cost.**

## 4. Business-model comparison (recommendation in bold)

| # | Model | Evidence of demand | Ops / compliance burden | Verdict |
|---|---|---|---|---|
| 1 | Subscription to Satelink software | None yet | Low (if software, not resale) | Candidate once there is a software product |
| 2 | Usage-based API billing (current) | ~80k unpaid req/24h, 0 paid | **Needs a supplier agreement** or own nodes | **Keep, but only on a contracted or self-run upstream** |
| 3 | Procurement fee (buy APIs for agents) | None | Worst ToS fit; marketplace/PA risk in India (see INDIA §5) | **Defer / reject** |
| 4 | Reseller markup | None | Needs signed reseller agreement | Only via (2) with a contract |
| 5 | Referral / affiliate | None | Lowest; fully compliant | Small; **good supplementary revenue with zero legal risk** |
| 6 | Marketplace fee | No 3rd-party supply (1 self node) | High (payouts = RBI/FIU questions) | Defer |
| 7 | Enterprise orchestration (BYO supplier keys) | None measured | **Low**: the customer holds the supplier contract; Satelink sells software | **Strongest legitimate shape for the "machine commerce" thesis** |
| 8 | Machine-to-machine metered (x402) | Founder-only settlements | Crypto-receipt GST/FEMA questions (INDIA §1, §4) | Keep as optional rail; not the primary revenue rail until CA opinion |

## 5. Recommended smallest model

**A. Contracted pay-per-call Polygon RPC (keep the product, fix the supply).**
1. Obtain **written resale confirmation** from one supplier: dRPC first (no explicit prohibition, cheapest keyed PAYG), then Infura or Ankr. Alternatively, run one owned Polygon node.
2. Move paid traffic to that keyed, contracted upstream only. Keep keyless public endpoints out of the paid path.
3. Sell prepaid credit packs by card through a merchant-of-record, at a minimum of $10. Keep x402 as an optional machine rail.

**B. In parallel: BYO-key orchestration software** (routing, failover, metering, spend limits and audit logs over the customer's *own* provider keys), sold as a subscription.
- This is software, not resale, and is the cleanest story for a payment underwriter.
- **Build it only after** a demand test shows interest (see FIRST_REVENUE_EXPERIMENTS).

**Reject for now:**
- Generic "API procurement/marketplace" for AI, scraping or data APIs: resale terms prohibit it, and it creates Indian payment-aggregator exposure.
- AI-gateway resale of Groq/OpenAI-shaped access: SECURITY F-01.

## 6. Answers

- **Q5. Is API procurement with a margin legitimate and viable for the identified suppliers?**
  - *Not as currently operated.* Today it rests on keyless public endpoints whose terms don't permit resale.
  - It **can** be legitimate with a signed reseller/partner agreement, or own nodes.
  - Viability is unproven: $0 external revenue, and the price is 1.5–40× the market.
- **Q6. Which agreements permit resale and automated purchases?**
  - *None confirmed.* Written approval paths exist with Alchemy, Infura, Ankr and PublicNode.
  - dRPC is not documented.
  - QuickNode and Chainstack prohibit it by default (partner programmes exist).
  - Infura §3.3 is the only one that explicitly contemplates AI agents holding credentials.
