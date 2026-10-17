# Repository Baseline & Canonical Product Inventory

**Inspection:** 2026-10-15, 20:45–21:30 IST (15:15–16:00 UTC) · read-only · no deploys, no DB access, no transactions
**Inspector:** Claude Code (audit session) · **Evidence IDs** refer to `EVIDENCE_REGISTER.md`

---

## Part 0 — Phase Zero baseline

| Item | Value | Evidence |
|---|---|---|
| Working dir | `/Users/pradeepjakuraa/satelink` (monorepo) | R-01 |
| Remote | `github.com/Jakuraa/Satelink_Network` (transferred from `Satelink-Protocol` 2026-10-14) | R-01, EXECUTION_BOARD |
| Branch / commit | `main` @ `94161ef7` ("Round 2026-10-15 … (#537)") | R-01 |
| Uncommitted | 4 untracked files, **preserved untouched**: `INFRASTRUCTURE_COST_REDUCTION_{EXECUTION,REPORT}.md`, `scripts/prune-vercel-storage.cjs`, `scripts/vercel-pruning-results.json` | R-01 |
| Secret-looking files at repo root | `machine.key`, `client_secret_…apps.googleusercontent.com.json` — **both gitignored, not tracked** (`.gitignore:24`, `:190`). Values not read. | R-02 |
| Package mgr / build | npm workspaces + turbo (`turbo.json`); Next.js (web, console, corporate); Express (api); Foundry (contracts) | R-01 |
| Apps | `apps/api` (Express, Railway), `apps/web` (Next.js, Vercel → satelink.network), `apps/console` (console.satelink.network), `apps/corporate` (jakuraa.com), `apps/mcp-server`, `apps/cms` | R-01 |
| Packages | `config, content, provider, sdk, seo, ui, web-ui` | R-01 |
| Tests | `apps/api`: mocha `npm run test:baseline` (with `test/_guard/prod_db_guard.cjs`) | R-03 |
| CI | 11 workflows; `main` protected with 5 required checks (EXECUTION_BOARD; B-10 notes 3 checks run masked commands) | R-04 |
| Open PRs | #525 (refund policy, DRAFT DO-NOT-MERGE), #520 (PaymentAdapter + Financial OS ingest, draft), #492 (Trading AI integration, DO-NOT-MERGE until Gate 0) | R-05 |
| External systems inspected | Public HTTPS on api/rpc/satelink.network/jakuraa.com/console/docs/status (read-only GET + one unauthenticated JSON-RPC POST that returns 402); npm registry (read) | L-* |
| **Not inspected** (limitation) | Production Postgres (no DB access by standing rule), Railway env values, Dodo/Cashfree/Razorpay dashboards, CDP dashboard, bank statements. Every revenue figure below is therefore **from repo docs or public endpoints, not from ledgers**. | — |

### Test baseline (this session)
`DATABASE_URL`/`REDIS_URL` forced to dead localhost so no test can touch prod (the repo `.env` holds a prod URL — see SECURITY F-12).
```
451 passing · 165 pending · 2 failing
  1) x402 payment rail t2 — 402 carries x402 accepts  (expected undefined to be an array)
  2) x402 payment rail t9 — keyless 402 upgraded with accepts (same)
```
Live production 402 **does** carry `accepts` (L-05), so these two are most likely environment-dependent (config not loaded without `.env`). **Status: UNVERIFIED** — not classified as a regression; needs one run in CI to confirm.

---

## Part 1 — Canonical inventory

Classification: **A** verified operational (live evidence) · **B** implemented, not verified E2E · **C** partial · **D** documented/planned only · **E** broken/blocked/unavailable · **F** unknown.

### 1.1 Core product: Polygon RPC gateway (the only product with live paid-path evidence)

| Field | Value |
|---|---|
| Capability | Pay-per-call JSON-RPC for Polygon PoS (137) |
| Purpose / buyer | Developers, bots, AI agents needing Polygon reads/writes |
| Source | `apps/api/app_factory.mjs:401` (`/rpc` → `x402Middleware`, `freeTierGateUnlessX402Paid`, `createRpcGateway`); `src/workloads/rpc_gateway/`; billing `src/billing/credit_service.mjs` (`PRICE_PER_CALL_USDT`) |
| Endpoint | `POST https://rpc.satelink.network/rpc/polygon` |
| Auth | x402 payment (no account) **or** `X-API-Key` backed by `api_credits` |
| Billing | Prepaid credits, $0.00003/call (USDT deposit) · x402 bundle $0.10 USDC = 1,000 calls ($0.0001/call) |
| External deps | Upstream Polygon RPC providers (see `_research_protocols_and_suppliers.md`), CDP x402 facilitator (Base), Polygon chain (deposit vault) |
| DB / ledger | `api_credits`, `api_deposits`, `payment_sources`, `revenue_events_v2`, shadow ledger (`src/ledger/*`) |
| Tests | 451 passing suite incl. `catalog_consistency`, `rpc_billing_phase6`, `free_tier_gate`, `x402_challenge_shrink`; 2 env-dependent x402 failures |
| Production evidence | `/health` 200; unauthenticated call → spec-shaped x402 v2 402 with `accepts[exact, eip155:8453, 100000, payTo 0x966E…7Ad4]` (L-05). `/api/public/stats` `requests_24h: 80001` (L-06). |
| Paid-path evidence | x402 mainnet settlements exist historically; **all attributed to founder wallets; net external revenue $0.00** (EXECUTION_BOARD round 2026-10-13, P1a) |
| Class | **A** for serving + 402; **B** for "external customer pays and is served" (never observed with a non-founder payer) |
| Blockers | Zero external payers; `satelink-mcp` unpublished but advertised in every 402 (SEC F-03) |
| Claims made | "DePIN RPC gateway", "permissionless, no account, no commitment" (well-known, 402) |
| Recommended public description | "Pay-per-call Polygon JSON-RPC endpoint. Pay with USDC on Base via x402 (no account) or prepay USDT credits. $0.10 per 1,000 calls via x402; $0.03 per 1,000 calls with prepaid USDT credits." Drop "DePIN" until third-party nodes serve traffic. |

### 1.2 Full inventory table

| # | Capability | Source / endpoint | Live probe (2026-10-15 UTC) | Billing | Class | Key blocker / note |
|---|---|---|---|---|---|---|
| 1 | RPC gateway (Polygon) | `/rpc/:chain` | 402 w/ x402 accepts | credits / x402 | **A** (serve) / **B** (external paid) | 0 external payers |
| 2 | Multi-chain RPC | `/rpc/chains` | 402 (even the chain list is payment-gated) | — | **C** | Only Polygon documented as served; `/rpc/chains` behind paywall is odd for discovery |
| 3 | MEV private relay | `app_factory.mjs:404` `/rpc/mev` | 402 | "10x pricing" | **F** | No evidence it relays to any builder; do not market |
| 4 | x402 payment rail | `src/payments/x402/{middleware,settlement,config}.js` | 402 v2 + `payment-required` header live | USDC Base | **A** (protocol) | Settlement atomic, `tx_hash` UNIQUE (R-10) |
| 5 | x402 session key + recover | `/v1/x402/key/recover`, `billing/x402_session_keys.js` | route present (GET 404 = POST-only) | — | **A** (per #522/#530 evidence) | — |
| 6 | USDT credit deposits | `RevenueVaultV2 0x577D…BaCEF`; `src/services/deposit_listener.js` | `/v1/pricing` advertises flow | USDT Polygon | **B** | Listener: 25 confirmations, idempotent on `tx_hash` (R-11) |
| 7 | Deposit claim / notify | `/api/keys/deposit`, `/api/deposit/notify` | — | — | **B** | Atomicity fixed #523; S1 signature fix #533 |
| 8 | Machine registration (instant key) | `/v1/machine/register` (`createMachineV1Router`) | advertised in 402 | free | **A** (advertised) | Creates unfunded account |
| 9 | API keys (wallet-bound) | `/api/keys` (`createSimpleApiKeysRouter`) | — | — | **B** | Unsigned binding fixed #533 |
| 10 | Pricing discovery | `/v1/pricing`, `/v1/capabilities`, `/.well-known/{x402,satelink.json,ai-plugin.json}`, `/openapi.json` | 200 | — | **A** | **Contradictions**: `/v1/pricing` lists a `free` tier `daily_limit:500` (with a note saying no free RPC); `/v1/plans` advertises **Free 300 calls, Pro $19/mo, Max $79/mo, overage $0.008/call** — a price 266× the RPC price and not wired to RPC billing (WEB/PRICING F-01) |
| 11 | Plans v2 / subscriptions (Dodo) | `/v2/plans`; `pricing_v2/*`; Dodo webhooks `/webhooks/dodo/v2` (only if `SATELINK_SUBSCRIPTIONS_ENABLED`) | `mode:"test"`, `checkoutAvailable:false`, all paid plans `purchasable:false` | Card (Dodo MoR) | **E** (not purchasable) | Boundary text: *"Dodo-funded value … is spendable on Trading Intelligence only"* — the only card product is the crypto-derivatives data product |
| 12 | Trading Intelligence API | `/v1/intelligence` (`createIntelligenceRouter`, `app_factory.mjs:429`) | 200 catalogue: funding-rate-heatmap, open-interest-shifts, liquidation-clusters, market-microstructure @ $0.01 | credits | **B/F** (serving returns 503 `warming_up` unless `INTEL_REFRESH_ENABLED`) | Delisted from web/console (#511/#515/#518) **but still live in API catalogue and payable** — inconsistent; derived from exchange public data → market-data licence question (INDIA §6) |
| 13 | AI inference gateway | `/v1/models`, `/v1/chat/completions`, `/v1/ai/status` (`src/workloads/ai_gateway/index.js`) | `/v1/models` 200 lists `gpt-4o`, `gpt-3.5-turbo` (`owned_by: openai`); status `groq:true`, `pricing.perRequestUsdt 0.001, margin "100%"` | **none** — `is_billable=false`, no credit deduction | **E** (misrepresenting) | **P0**: maps `gpt-4o`/`claude-3-5-sonnet` → Groq Llama silently (`MODEL_MAPPING` L32–40); falls back to a **stub reply returned as a successful completion** (L125–135); free Groq usage for any active legacy `sk_` key. See SEC F-01 |
| 14 | LangChain tool adapter / bandwidth proxy | `/v1/tools`, `/api/bandwidth` | 404 on GET root | — | **F** | Not a product |
| 15 | Oracle price feed | `/api/oracle/prices` | 200 public (ETH/BTC/MATIC) | free | **B** | Upstream likely CoinGecko — redistribution terms unverified |
| 16 | Webhook delivery | `/api/webhooks` | 401 "API key required" | — | **F** | No customer evidence |
| 17 | Node registry / DePIN | `/api/nodes` | 200: 4 nodes, **1 active** (ap-south-1), 3 suspended/pending, all `uptimePct 0` | — | **C** | "DePIN" claim rests on 1 self-operated node |
| 18 | Node operator revenue share / settlement | `src/economics/epoch_scheduler.js`, settlement anchor; `/api/nodes/claims` | `SETTLEMENT_DRY_RUN=1` | 50/30/20 split | **D/E** (dry-run) | Must not be marketed as earnings (B-05); RBI/VDA questions if ever paid in USDT |
| 19 | Public economics summary | `/api/economics/summary` | **200 public**: `totalRevenueUsdt 20.53` | — | **E** (misleading) | Figure is founder test money; external revenue is $0.00 (SEC F-02, S4) |
| 20 | Ledger shadow / parity | `src/ledger/*`; `/internal/{ledger,draw,capacity}-parity` | **200 public, no auth**: sums, counts, an x402 tx hash | — | **C** | Shadow ledger 75 % parity (4 vs 3 rows); **internal financial endpoints unauthenticated** (SEC F-04) |
| 21 | Canonical Financial OS / PaymentAdapter | PR #520 (draft) | `/v1/payments/*` 404 | — | **B** (not deployed) | 266/266 integration tests on branch; `PAYMENTS_V1` unset |
| 22 | Card payment adapters | #520: Dodo, Cashfree (`application_pending`), Razorpay (`provider_suspended`), Transacty (`not_applied`) | — | — | **E** | **Razorpay suspended Jakuraa Commercial Pvt Ltd under its Terms of Use** (EXECUTION_BOARD provider table) |
| 23 | Refunds / reversals | Dodo webhook reversal handler (`apps/web/src/app/api/dodo-webhook/route.ts:115–170`, idempotent on refund/dispute id) | — | — | **B** | No public refund policy (jakuraa.com/legal/refunds 404; PR #525 draft). No refund path for x402/USDT at all (on-chain, by design) |
| 24 | Revenue attribution / reconciliation | `docs/platform/revenue_reconciliation_2026-10-12.sql` (Q5 fixed), `/admin/funnel/x402-payers` | admin-only | — | **C** | Not re-run since Q5 fix; `/api/financial/truth` has same bug (S6) |
| 25 | Admin dashboard | `/admin/*` (28 GET → 401), `apps/web` (admin) | 401 | — | **B** | Prior memory: 11/13 admin UI pages were hardcoded fake data (PR #267) — not re-verified this session |
| 26 | Customer console | console.satelink.network; `/v1/console/summary`; `/v1/me/*` (flag) | 200 | — | **B** | `CONSOLE_ACCOUNTS_V1` state unverified |
| 27 | Developer onboarding / docs | satelink.network/docs, docs.satelink.network | 200 | — | **B** | See WEBSITE_AUDIT_SATELINK |
| 28 | SDK | `packages/sdk` → npm `@satelink/sdk@0.2.0` | published | — | **B** | Its README previously advertised non-existent AI pricing (fixed #537) |
| 29 | MCP server | `apps/mcp-server` (`satelink-mcp` 2.1.1) | **npm 404 — never published** | — | **E** | Name squattable while live 402 bodies point to it (SEC F-03) |
| 30 | Status page | status.satelink.network | 200 | — | **F** | Source of uptime numbers not verified |
| 31 | Task-commerce "500 Verified Local Business Leads" (Google Maps extraction) | `apps/web/src/app/tasks/page.tsx`, `/api/tasks/start`, Dodo webhook surface 1 | **404 / 404** (dormant) | Dodo one-off | **E** (dormant, code present) | Lead-data brokerage + Google Maps scraping sold on the **same Dodo account** as Satelink. Must be removed and disclosed historically if ever sold (BOUNDARY §3) |
| 32 | vNext kernel / `/vnext/resell` | `app_factory.mjs:559` | 503 "vnext kernel disabled" | x402 | **D** | The only code path named "resell"; disabled |
| 33 | Workload discovery / provider registry / API procurement | `src/workloads/registry.js`, `workload_acquisition_engine.js`, `src/providers/adapters` | not exposed | — | **D** | **No live API-procurement product exists.** No supplier resale contracts in repo |
| 34 | Data & scraping services | (only #31) | — | — | **E** | See #31 |
| 35 | Automation / webhook APIs | `src/workloads/automation_jobs`, `webhook_delivery` | not exposed publicly | — | **F** | — |
| 36 | Monitoring | prom-client + `/admin/observability/metrics`; Railway HTTP logs retain ~15 min | admin | — | **C** | No log drain; 7-day traffic analysis impossible |
| 37 | Trading AI — research, strategy DSL, backtest, paper, risk, mandates, OMS, portfolio, audit, broker adapters (Binance testnet, Alpaca, Upstox copilot), Razorpay billing (test) | `origin/trading-agent/integration` — 497 files / +41k lines; PR #492 | **not on `main`, not mounted**; `satelink.network/trading-agent/product` page 200 (marketing/waitlist) ; `/beta` waitlist API | none live | **B** (isolated) / **E** (production) | Gate 0 **NOT PASSED** (B-01 leaked credential rotation, B-04 auto-approve, B-06 no staging, B-08 no KMS, B-09 no scope/legal decision). `LIVE_TRADING`, `AUTONOMOUS_MODE`, `UPSTOX_AUTOMATED` hard-locked |
| 38 | Autonomous agent permissions | trading `authorization/`, `mandates` (branch); `machine-access/v1` (main, token-gated 401) | 401 | — | **C** | — |

### 1.3 End-to-end dependency graph (as-built, `main`)

```
                  ┌───────────── discovery ─────────────┐
 agent/dev ──► /.well-known/{x402,satelink.json}, /openapi.json, /v1/pricing, x402 Bazaar (CDP)
     │
     ▼
 POST /rpc/polygon ──► x402Middleware ──(no payment)──► 402 {accepts: USDC/Base, alternativePayment: USDT/Polygon}
     │                     │
     │                (X-PAYMENT)──► CDP facilitator verify/settle (Base) ──► settlement.js (1 DB txn:
     │                                 payment_sources[tx_hash UNIQUE] + revenue_events_v2 + api_credits + session key)
     │
     ├─(X-API-Key)──► freeTierGate ──► authorizeAndMeter (api_credits −$0.00003) ──► rpc_gateway ──► upstream RPC (3rd-party)
     │
 USDT.approve + RevenueVaultV2.deposit (Polygon) ──► DepositListener (25 conf, tx_hash idempotent) ──► api_credits
     │
 revenue_events_v2 ──► epoch_scheduler (10 min) ──► settlement anchor  [SETTLEMENT_DRY_RUN=1: no broadcast]
                      └─► shadow ledger (ledger_txns) ──► /internal/*-parity  [public, unauthenticated]

 Card rail (Dodo MoR, TEST mode, not purchasable):
 satelink.network /api/dodo-checkout ──► Dodo ──► /api/dodo-webhook (Standard Webhooks HMAC) ──►
        apps/api /internal/dodo/credit (shared secret) ──► api_credits (Trading-Intelligence-only boundary)
        └─ surface 1 (dormant): task_orders  ("500 Verified Local Business Leads")
```

### 1.4 Commercial lifecycle trace (Phase Two)

| Stage | Implementation | Idempotency / safety | Production evidence | Owner of next action |
|---|---|---|---|---|
| Discovery | well-known, openapi, Bazaar | — | live 200 | — |
| Product selection | `/v1/pricing` vs `/v1/plans` vs `/v2/plans` | — | **3 contradictory price lists live** | Eng |
| Authentication | x402 (wallet sig) / API key | key hashed (#522) | live | — |
| Price quote | 402 `accepts.amount=100000` (0.10 USDC) | — | live | — |
| Payment authorization | EIP-3009 via x402 client | facilitator verify | historical founder settlements | — |
| Payment confirmation | facilitator settle → `settlement.js` | `tx_hash` UNIQUE; test-network guard | founder-only | Founder: run X402_PAID_TEST_RUNBOOK with a non-founder wallet |
| Service delivery | rpc_gateway | — | live | — |
| Metering | `authorizeAndMeter` | — | — | — |
| Billing | credits decrement | — | — | — |
| Ledger entry | `revenue_events_v2` + shadow ledger | shadow parity 75 % | `/internal/ledger-parity` | Eng: explain the 1-row drift |
| Settlement / payout | epoch → anchor | DRY RUN | none | Do not change |
| Refund / reversal | Dodo: idempotent handler. x402/USDT: **none** | — | — | Policy (#525) + legal |
| Reconciliation | SQL Q1–Q8 | Q5 fixed, not re-run | none | Founder (DB read) |
| Repeat purchase | session-key reuse; MCP reset fix (#534) | — | — | — |

**Conceptual cases**

| # | Case | Behaviour in code | Gap |
|---|---|---|---|
| 1 | Human buys subscription | Dodo checkout allowlist-only in TEST mode | Not possible today |
| 2 | Renewal fails | Dodo V2 webhooks + `startPricingReconcile` (flag-gated) | Not live |
| 3 | Credits exhausted | 402 with re-pay instructions | OK |
| 4 | Machine calls paid API | x402 / key | OK (founder-proven) |
| 5 | Payment-required response | spec-shaped v2 402 + header | OK; references unpublished npm name |
| 6 | Paid but delivery fails | x402: settle happens **before** serving; no automatic credit-back on upstream failure found (memory: "RPC no-refund" defect, master contract 2026-09-27) | **Gap (verified in code)** — `src/payments/x402/middleware.js` order is verify → **settle on-chain** → record → serve; if the DB record fails after settlement, L186–187 return `500 settlement_record_failed` with no credit and no service (funds already moved). Needs a reconciliation sweep from facilitator receipts → `payment_sources`. Upstream error after crediting is softened by the bundle model (1 settlement = 1,000 calls) |
| 7 | Webhook delivered twice | Dodo: idempotent on tx/refund/dispute id; x402: `tx_hash` UNIQUE → 409 | OK |
| 8 | Refund / chargeback | Dodo reversal handler; crypto: none | Policy missing |
| 9 | Provider unavailable | upstream failover (see research doc) | UNVERIFIED |
| 10 | Supplier cost > resale price | No per-call cost accounting vs upstream | **Gap** — no margin guard |
| 11 | Wrong network payment | x402 `accepts` pins `eip155:8453` + USDC address; test-network guard; USDT deposit only via vault event | Funds sent directly (not via vault) to an address on the wrong chain are unrecoverable — needs disclosure |
| 12 | Unauthorized spending | S1 fixed (signed binding); per-agent limits behind `CONSOLE_ACCOUNTS_V1` | Spending limits not live by default |

### Disagreements between layers (balance / entitlement)

1. `/api/economics/summary` ($20.53 "revenue") ≠ EXECUTION_BOARD verified external revenue ($0.00) ≠ `/internal/ledger-parity` `sum_revenue_usdt 20.18`.
2. `/v1/plans` (Free 300 / Pro $19 / Max $79) ≠ `/v2/plans` (Launch/Pro $19, TI-only, not purchasable) ≠ `/v1/pricing` (free tier 500/day "but every call charged") ≠ the canonical $0.00003/call.
3. Shadow ledger 3 txns vs 4 revenue events (parity 75 %); draw-parity 0 % (2 payment sources, 0 draws).
4. Trading Intelligence: delisted on web/console, still sold in the API catalogue.
