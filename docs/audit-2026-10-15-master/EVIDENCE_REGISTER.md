# Evidence Register

**Audit date:** 2026-10-15. Times are IST unless marked UTC.

Types:
- **REPO**: repository evidence
- **LIVE**: live production endpoint
- **WEB**: website
- **POLICY**: official provider policy
- **LEGAL**: official legal/regulatory source
- **3P**: third-party commentary
- **INF**: inference
- **UNV**: unverified claim

Detailed per-item citations live in each report: provider URLs are in PAYMENT_PROVIDER_POLICY_MATRIX; legal sources in INDIA_REGULATORY_QUESTIONS; supplier clauses and arithmetic in `_research_protocols_and_suppliers.md`; page-level website evidence in WEBSITE_AUDIT_*.

| ID | Type | Evidence | Inspected | Confidence | Used in |
|---|---|---|---|---|---|
| R-01 | REPO | `main` @ `94161ef7`; 4 untracked files preserved; monorepo layout | 2026-10-15 21:05 | High | Inventory §0 |
| R-02 | REPO | `machine.key`, `client_secret_*.json` gitignored (`.gitignore:24`, `:190`), not tracked; values not read | 21:07 | High | Inventory §0 |
| R-03 | REPO | `npm run test:baseline` with dead DB/Redis URLs: 451 pass / 165 pending / 2 fail (`x402_rail` t2, t9) | 21:12 | High (result); cause UNV | Inventory §0 |
| R-04 | REPO | `docs/platform/EXECUTION_BOARD.md` (last updated 2026-10-15 12:10): external revenue $0.00; Razorpay suspended; Cashfree/Dodo pending; S3/S4/S6 | read 21:08 | Medium (repo doc, prior session; figures from founder/on-chain analysis) | Verdict, Inventory |
| R-05 | REPO | Open PRs #525, #520, #492 (`gh pr list`) | 21:10 | High | Inventory |
| R-06 | REPO | `apps/api/app_factory.mjs:395–560` route mounts | 21:09 | High | Inventory |
| R-07 | REPO | `src/workloads/ai_gateway/index.js` L20–40 (models + `MODEL_MAPPING`), L66–90 (`is_billable=false`), L120–135 (stub), L249–297 | 21:20 | High | SEC F-01 |
| R-08 | REPO | `src/gateway/routes/api_keys.js` (rpc_api_keys issuer) not mounted in `app_factory.mjs` | 21:22 | High | SEC F-01 |
| R-09 | REPO | `apps/web/src/app/api/dodo-webhook/route.ts:1–30, 115–170`: HMAC verification by official adapter; idempotent reversals; surface 1 = "500 Verified Local Business Leads" | 21:23 | High | SEC F-11, PAYMENT |
| R-10 | REPO | `src/payments/x402/settlement.js` (single txn, `tx_hash` UNIQUE, test-network guard); `middleware.js` L166–187, L277–310 (settle → record → serve) | 21:25 | High | PAYMENT, SEC F-06 |
| R-11 | REPO | `src/services/deposit_listener.js` L9–24, 66, 327–339 (confirmations, idempotency) | 21:25 | High | PAYMENT |
| R-12 | REPO | `origin/trading-agent/integration`: 497 files / +41,098 lines; `docs/trading-agent/BLOCKERS.md` Gate 0 NOT PASSED | 21:27 | High | BOUNDARY, SEC F-07 |
| R-13 | REPO | `.claude/settings.json:16` `"autoApprove": true` (tracked) | 21:30 | High | SEC F-07 |
| R-14 | REPO | `src/workloads/rpc_gateway/providers.js` L70–113: PublicNode (keyless, enabled), dRPC public default, Alchemy env-only, Ankr/llamarpc disabled | 21:19 | High (code); prod env overrides **UNV** | API_PROCUREMENT |
| R-15 | REPO | No `MPP` references in `apps/`/`packages/` (grep, word-boundary, excluding vendored `.sol`) | 21:20 | High | PAYMENT |
| L-01 | LIVE | `GET api.satelink.network/health` 200 db ok | 15:37 UTC | High | Inventory |
| L-02 | LIVE | 36-endpoint GET sweep (statuses in Inventory §1.2) | 15:37 UTC | High | Inventory |
| L-05 | LIVE | `POST /rpc/polygon` eth_blockNumber → 402, x402 v2 body + `payment-required` header; references `satelink-mcp` | 15:39 UTC | High | SEC F-03, PAYMENT |
| L-06 | LIVE | `/api/public/stats`: nodes_online 1, uptime 100, requests_24h 80001 | 15:37 UTC | High (as reported by the endpoint) | Inventory |
| L-07 | LIVE | `/v1/models` lists `gpt-4o`, `gpt-3.5-turbo` (`owned_by: openai`); `/v1/ai/status` `groq:true`, `margin "100%"` | 15:37 / 15:45 UTC | High | SEC F-01 |
| L-08 | LIVE | `/api/economics/summary` public, `totalRevenueUsdt 20.52582` | 15:37 UTC | High | SEC F-02 |
| L-09 | LIVE | `npm view satelink-mcp` → E404; `@satelink/sdk` 0.2.0 published | ~15:55 UTC | High | SEC F-03 |
| L-10 | LIVE | `/v1/pricing` has a `free` tier `daily_limit 500` plus the note "No free RPC" | 15:39 UTC | High | F-10 |
| L-11 | LIVE | `/v1/plans` Free 300 / Pro $19 / Max $79 / overage $0.008; `/v2/plans` `mode:test`, `checkoutAvailable:false`, boundary "Dodo-funded value … Trading Intelligence only" | 15:39 UTC | High | F-10, PAYMENT §5 |
| L-12 | LIVE | API headers: HSTS, CSP, referrer-policy no-referrer, ACAO `*` | ~15:58 UTC | High | SEC F-12 |
| L-13 | LIVE | `/internal/ledger-parity` (4 events / 3 txns / 75 %), `/internal/draw-parity` (0 %), `/internal/capacity-parity`, all 200 unauthenticated | 15:39 UTC | High | SEC F-04 |
| L-14 | LIVE | `/api/nodes`: 4 nodes, 1 active (ap-south-1), all `uptimePct 0` | 15:39 UTC | High | Inventory #17 |
| L-15 | LIVE | `/v1/intelligence` catalogue live at $0.01/metric | 15:39 UTC | High | BOUNDARY |
| L-16 | LIVE | `/vnext/*` 503 "vnext kernel disabled"; `/v1/payments/*` 404 | 15:37 UTC | High | Inventory |
| W-01 | WEB | satelink.network `<title>` / H1 = "An AI trading operating system for people, AI agents and machines" | ~16:05 UTC | High (re-checked) | SL-01 |
| W-02 | WEB | jakuraa.com `<title>` "Jakuraa - a technology and trading company, established 2019" | ~16:05 UTC | High | JK-01 |
| W-03 | WEB | jakuraa.com/legal/refunds 404; /legal/terms, /legal/privacy 200; satelink /tasks and /api/tasks/start 404 | ~15:50 UTC | High | SEC F-11, F-14 |
| W-04 | WEB | Full website issue lists SL-01…28, JK-01…22 | 21:06–21:20 | High (agent, spot-checked SL-01, SL-02, JK-01) | WEBSITE_AUDIT_* |
| P-01 | POLICY | Dodo Merchant Acceptance: prohibits "Crypto-related offerings", "cloud compute credits … persistent infrastructure", "unlicensed financial tools, investment strategies … stored value", "reselling AI APIs … without clear rights"; reviews "scraping" (docs.dodopayments.com/miscellaneous/merchant-acceptance) | 2026-10-15 (re-fetched by lead auditor) | High | PROVIDER MATRIX |
| P-02 | POLICY | Paddle AUP (updated 13 Apr 2026): prohibits trading signals and strategies; stored value incl. store credit; resale without reseller certificate; crypto exchanges/trading platforms | 2026-10-15 (re-fetched) | High | PROVIDER MATRIX |
| P-03 | POLICY | Razorpay crypto covenant; PayU, Lemon Squeezy, Polar, Creem, Cashfree, Stripe India invite-only; Stripe stablecoin/MPP/SPT country lists (India absent) | 2026-10-15 (agent) | Medium–High | PROVIDER MATRIX, PAYMENT |
| P-04 | POLICY | Supplier ToS: Alchemy §2.2, Infura §7.3/§3.3, Ankr §5.2(a), QuickNode §7(v), Chainstack, PublicNode, dRPC §1.1/§1.3, OpenAI §3.1/§3.3(g), Anthropic §D.4, CoinGecko §4.1.6, Firecrawl §5.d | 2026-10-15 (agent) | Medium–High | API_PROCUREMENT |
| P-05 | POLICY | x402 docs (v2, schemes, facilitator, no native refunds); CDP facilitator (networks, fees, OFAC/KYT) | 2026-10-15 (agent) | High | PAYMENT |
| P-06 | UNV | CDP Terms: India seller eligibility (page 403 to automation) | — | **Unverified** | PAYMENT, Q4 |
| G-01 | LEGAL | IGST Act s.2(6) export-of-services conditions; FEMA payment-channel rules; SEBI algo circular (4 Feb 2025) and related orders; RBI export regulations (per agent) | 2026-10-15 (agent) | Medium. Primary text read for some; **2026-dated items need counsel confirmation** | INDIA |
| G-02 | 3P | PMLA VDA notification details, PA/PPI direction details, Consumer Protection 2026 amendment, new Income-tax Act section numbers (official pages blocked or not opened) | 2026-10-15 (agent) | Medium–Low | INDIA |
| I-01 | INF | "Underwriters will classify Satelink as a trading/crypto merchant from the current homepage" | — | Medium (based on P-01/P-02 language + W-01) | Verdict |
| I-02 | INF | "x402_rail t2/t9 failures are environmental" | — | Medium | Inventory §0 |
| U-01 | UNV | Which upstream serves paid production traffic (env overrides) | — | Unverified, founder to check | P0-4 |
| U-02 | UNV | Count of legacy `rpc_api_keys` able to use the AI gateway | — | Unverified (no DB) | SEC F-01 |
| U-03 | UNV | Whether the "Local Business Leads" product was ever sold | — | Unverified (no DB / Dodo dashboard) | F-11 |
| U-04 | UNV | All revenue figures beyond R-04 (needs founder-run reconciliation SQL) | — | Unverified | FIRST_REVENUE |
