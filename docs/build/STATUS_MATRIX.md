# Status matrix — Satelink AI Assistance

Baseline: `origin/main` @ `8679dd61` (#547) · Step 0 run 2026-10-20 · updated each session.
One status per row, from the mandate §4.7 vocabulary. Evidence is mandatory.
Security-sensitive findings are recorded as **categories only** (R14, public repo). The detailed
evidence lives in `docs/build/evidence/private/` (gitignored, local to the build machine).

Evidence keys: **P** = production probe 2026-10-20 (curl transcript in the ledger) ·
**R** = `evidence/REPO_MAP.md` · **RT/MP/DU** = private ROUTES / MONEY_PATHS / DUPLICATES sweeps ·
**RW** = Railway variable *names* (values never read, except the flags listed in the ledger).

## Release State A (2026-11-04) — one status per item, evidence required

| Item | Status | Evidence |
|---|---|---|
| Production DB data exposure | VERIFIED (not exposed) | §P0 `SECURITY_AND_FINANCIAL_PATH_AUDIT.md` |
| Credential exposure in public history | BLOCKED (FOUNDER) | `SECURITY_INCIDENT_2026-11-04.md`, OB-1..4 |
| Dump/env publication guards | VERIFIED | `check-no-dumps.test.sh` 9/9; PR #610 CI 13/13 green |
| Claude Code hooks | VERIFIED | `.claude/hooks/tests/run.sh` 50/50 |
| Integration base (#609+#582+#583) | VERIFIED | PR #611; api baseline guard no new failures (933/940, 4 known); integration 214/214; libs 300/300 |
| #583 migration conflict | VERIFIED (fixed on base) | `5bc1073a`; reservation-kind test 1/3 → 3/3 |
| Local runtime (Postgres) | VERIFIED | `scripts/preview/local-db.sh` (Homebrew :5432 and Docker :55432) |
| Workflow engine (mandate state set) | VERIFIED | task_state_machine 8/8; task_engine 12/12; restart drill PASS ×2 |
| Unified capability registry | VERIFIED | capability_registry_unified 9/9; R9 on Postgres (task_engine) |
| Model routing (OpenRouter) | VERIFIED (FIXTURE) | model_router 7/7 (fake fetch); no live key (OB-10) |
| Planner / quote / approval / simulated money / receipts | VERIFIED | planner 8/8, pricing 8/8, sim_ledger 13/13, task_engine 12/12, tasks_http 7/7 |
| Postgres reservation store | VERIFIED (preview, JS writer — ADR-5) | sim_ledger parity 13/13; mutation killed |
| S1 primary journey (browser) | VERIFIED | s1 E2E 15/15 @390/768/1440; axe clean; browser restart drill PASS; CI green ×2 consecutive on de142340 (runs 41898308212/300/215 attempts 1+2); PR #616 |
| S2 food procurement via MCP | VERIFIED | food_mcp.integration 8/8; s2-food E2E ×3 viewports; injection + PKCE negative tests; CI all green on 3e7ca49e; PR #617 |
| Zomato connector | BLOCKED (EXTERNAL) | terms for automated ordering unverified |
| Swiggy production integration | BLOCKED (FOUNDER) | no relationship/access; preparation pack SWIGGY_PRODUCTION_APPLICATION.md |
| S3 Trading AI (evaluate → risk → paper) | VERIFIED | trading_s3.integration 9/9; s3-trading E2E ×3 viewports; live-host refusal test; CI all green on c3cb8ef3; PR #618 |
| Alpaca paper adapter (live) | BLOCKED (FOUNDER) | needs ALPACA_PAPER_* keys; host pinned to paper-api |
| S4 Developer procurement (keys + REST/OpenAPI) | VERIFIED | developer_s4.integration 10/10; s4-developer E2E ×3; procure.sh; CI all green on PR #619 |
| S5 Agent commerce (MCP tools + A2A card/binding) | VERIFIED | agent_s5.integration 6/6; mcp-server node tests 13/13; s5-agent E2E ×3 (official SDK client over stdio); CI all green on PR #620 |
| MCP protocol 2026-07-28 | BLOCKED (EXTERNAL) | official SDK latest 1.32.2 negotiates ≤ 2025-11-25; server negotiates 2025-11-25 (OB-13) |
| A2A Agent Card JWS signature | NOT STARTED | needs a KeyProvider-held signing key; card ships unsigned (field omitted, not faked) |
| S6 Machine commerce (x402 V2 preview) | VERIFIED | machine_s6.integration 8/8 (incl. import-graph proof: no live x402/vault module reachable); s6-machine E2E ×3; mock facilitator saw only /verify; CI all green on PR #621 |
| P3 Product quality (preview console) | VERIFIED | approved 10-item nav; Home pending approvals + six-domain suggestions; Trading AI + Activity & Security real pages; Agent Marketplace honest Coming soon; p3-quality E2E ×3 (axe, overflow, hydration, headings); Lighthouse a11y 100 on 11 pages (artifacts/lighthouse/p3-a11y.json, local); CI all green on PR #622 |
| P4 Assurance suites | VERIFIED (local) | traceability: docs/build/ASSURANCE_P4.md; assurance_p4.integration 17/17 (authz matrix, rate limit, CSRF, SSRF redirect, oversize, headers, injection, concurrency, ledger invariants, determinism, per-slice durability); p4-adversarial E2E (XSS/CSRF); egress_guard unit; no-float-money arch rule; npm audit gate in CI; found+fixed 7 defects; CI on draft PR |
| Production dependency advisories | BLOCKED (FOUNDER) | 4 critical / 36 high in production deps (next RCE, better-auth account takeover, proxy-addr, dompurify) — OB-14 |
| x402 live rail for task capabilities | NOT STARTED | preview uses a LOCAL mock facilitator, testnet id, placeholder payTo; live = Release B founder decision |

### Release A tech debt
- Docker Desktop testcontainers port-mapping failures on this machine after long uptime; new suites support LEDGER_TEST_DB.
- Trading data is synthetic only; a licensed recorded dataset is a founder decision (F32).
- Console preview uses `/wallet`; mandate path `/usage` is the existing RPC analytics page (rename decision for P3).
- Turnstile (Cloudflare test keys) not wired on preview sign-up (OB-11).
- `apps/console/CLAUDE.md` names `packages/ui` for tokens; actual Signal tokens are `packages/web-ui/src/styles/tokens.css`.
- Timing-sensitive apps/api tests flake under high machine load (api_keys limiter, identity rate limits, SEC-5, x402 r7); testcontainers port-mapping flake under parallel load.
- Two OpenRouter adapters once #579 lands (workflows/model_router.js vs trading_agent/providers/openrouter.mjs) → consolidate.
- Task engine executes single-step plans (multi-step quoting supported; execution uses step 1) → extend before multi-step slices.
- TS integration tests import JS modules without .d.ts (editor-only warnings; CI does not typecheck database/__tests__).
- `/v1` task API mounted only by the preview server; production mount is a Release B decision.
- `workflows/supplier_catalog.js:190` and `workload_adapters.js:80,92` convert money to JS numbers (fix on touched paths).
- Workflow recovery runs lazily on first request, not at boot.
- `libs/CLAUDE.md` 316 lines (over the 150 target; founder-owned).
- `apps/api/migrations` runner UNKNOWN.
- Receipt `verification.method` is the generic `order_status_lookup` for every connector (S4).
- A2A binding implements SendMessage/GetTask/CancelTask only; streaming, ListTasks, push notifications, extended card → -32004.
- satelink-mcp task tools are stdio-only; the Streamable HTTP transport (`http.mjs`) does not expose them.
- `satelink_discover` is read-only and creates no run (quote/request_approval create/advance runs; status/receipt read them).
- Task-page quote countdown caused a hydration mismatch since S1 (fixed in S5; E2E now fails on hydration pageerrors).
- x402 preview: if a paid task then FAILS, the simulated x402 deposit stays as customer credit (a real rail needs a refund path).
- x402 preview keyless machines are scoped by their Idempotency-Key (it doubles as the bearer for that task's result).
- Receipt `payment.payer` is a mock address from the scripted client; no signature verification beyond the mock scheme.
- Lighthouse runs locally only (`scripts/preview/lighthouse-a11y.mjs`, pinned npx lighthouse@12.8.2); not wired into CI.
- The Shell renders only a fixed list of nav groups; live-console groups "Activity & Logs", "Developer Tools", "Protocols" are therefore hidden in production (pre-existing; not changed by Release A).
- Preview nav omits the live RPC product pages (they need production endpoints the preview API does not serve).
- Egress guard does not resolve DNS: a public hostname rebinding to a private IP must be checked at connect time before any beta/live connector.
- Dependency audit gate compares against a baseline of 40 known advisories (OB-14); the baseline must only shrink.

## M1 Identity, tenancy, access

| Capability | Status | Evidence | Code / docs / prod disagreement → resolution |
|---|---|---|---|
| API keys (`sk_…`, hashed) + EIP-191 wallet binding on `POST /api/keys` | COMPLETED AND VERIFIED IN PRODUCTION | #533; RT §keys | — |
| x402 session keys (hashed, signed recovery) | COMPLETED AND VERIFIED IN PRODUCTION | #522, #530; P `/.well-known/x402` 200 | — |
| Better Auth (console, `/api/identity`) | DEPLOYED BUT NOT VERIFIED | RW `AUTH_ENABLED=true`; RT flag-gated mount | End-to-end sign-in not re-verified this session |
| Tenants / organizations (`tenant_id`) | DOCUMENTED BUT NOT IMPLEMENTED | R: no tenant model on main | W3 |
| RBAC roles map | DOCUMENTED BUT NOT IMPLEMENTED | R: role checks are ad hoc middleware | W3 |
| Staff/admin auth | PARTIALLY IMPLEMENTED | P `/admin/*` → 401; #553 (`d051e4df`): digest compare incl. `requireAdminAuth`, header secrets fail closed (503 when unset), parity routes 401 (P 2026-10-20) | Still 3 mechanisms (W3: one staff-auth path) |
| Human identity systems | BROKEN OR CONTRADICTORY | DU §4: four identity systems, two on the same `/auth` prefix | W3 consolidation |

## M2 Capability Registry

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| `plan_catalog.v2.json` + `product_registry.test.js` | IMPLEMENTED AND VERIFIED IN A TEST ENVIRONMENT | #527; R | — |
| Single source of prices across surfaces | BROKEN OR CONTRADICTORY | DU §2: four tier price sets live (`/v1/plans`, `/v2/plans`, `/api/keys/tiers`, `rate_limiter.js`); Pro yearly $120 in catalog vs $190 in docs/seed; "save ~16.7%" label is really ~47%; INR rates ₹52.6–₹84 per $ | W2: registry v3, every surface derives; founder confirms prices (F8) |
| `.well-known/satelink.json` | COMPLETED AND VERIFIED IN PRODUCTION | P 200 | Describes "Satelink RPC Gateway / DePIN" → W2 rewrite to D14 |
| `/v1/capabilities`, `/v1/pricing` | COMPLETED AND VERIFIED IN PRODUCTION | P 200 | RPC-only content → W2 |
| `llms.txt` (satelink.network) | DEPLOYED BUT NOT VERIFIED | P 200, "AI-Agent & Machine-Commerce Infrastructure" | Contradicts D14; lists Trading Intelligence as priced → W2/W11 |

## M3 Satelink Intelligence Engine

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| Old OpenAI-compatible AI gateway | BROKEN OR CONTRADICTORY | P `GET /v1/models` 200 (llama3 list), `POST /v1/chat/completions` 401; code mapped gpt-4o/claude ids → Groq llama3 | Mandate said "unmounted Oct 15": **false**. Removed in PR #548 (pending merge) |
| AIProvider abstraction, model catalog, router, served_by, evals, model_traces | DOCUMENTED BUT NOT IMPLEMENTED (on main) | R: none on main; Stage 6/12 AIProvider exists only on `trading-agent/integration` | W6 |

## M4 Response / Decision API

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| `/v1/responses`, `/v1/tasks`, `/v1/decisions` | DOCUMENTED BUT NOT IMPLEMENTED | R; RT | W6 |
| `/v1/openapi.json` | DOCUMENTED BUT NOT IMPLEMENTED | P 404 (a hand-written RPC-only `/openapi.json` exists) | W6: generated OpenAPI 3.1 |

## M5 Connector Gateway

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| Connector contract, MCP client, A2A client, REST, Google, SQL, GitHub, webhooks | DOCUMENTED BUT NOT IMPLEMENTED | R | W7 |
| Broker adapters (Binance testnet, Upstox, Alpaca sandbox) | TESTED BUT NOT DEPLOYED | PR #492 (integration branch) | W8 |

## M6 Policy engine

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| Deterministic policy library | PARTIALLY IMPLEMENTED | R: fragments in `vnext/routing/policies.js`, capacity enforcement, flags, middleware | W3 |
| Trading risk engine (20 checks) + mandates | TESTED BUT NOT DEPLOYED | PR #492 | W8 (reuse, do not duplicate) |

## M7 Machine commerce / procurement

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| Polygon RPC gateway, $0.00003/call, anonymous → 402 | COMPLETED AND VERIFIED IN PRODUCTION | P `POST /rpc/polygon` → 402 x402Version 2 | — |
| x402 V2 on Base (USDC), $0.10 = 1,000 calls | COMPLETED AND VERIFIED IN PRODUCTION | P 402 body; RW `X402_ENABLED=true` | Effective rate stated inconsistently (DU §2c) → W2 |
| USDT vault deposits (RevenueVaultV2) + DepositListener | DEPLOYED BUT NOT VERIFIED | #408; MP: a pre-insert path can stop the listener auto-crediting, and one credit path is non-atomic | W4 fix + test |
| Procurement quotes/orders, Satelink-as-buyer | DOCUMENTED BUT NOT IMPLEMENTED | R | W7/M7 |
| Unauthenticated workload surfaces (bandwidth proxy etc.) | BROKEN OR CONTRADICTORY | RT; P `POST /api/bandwidth/proxy` → 400 (mounted) | Bandwidth proxy removed in PR #548; the rest are W1 items |

## M8 Financial OS / payments / pricing

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| Financial OS libs (`libs/kernel`, `services/financial`, reconciler) | IMPLEMENTED BUT NOT FULLY INTEGRATION-VERIFIED | R: not imported by live API code except one integration test | W4 |
| Shadow ledger (`LEDGER_SHADOW_WRITE`) | DEPLOYED BUT NOT VERIFIED | RW `LEDGER_SHADOW_WRITE=1` (mandate listed it as UNVERIFIED; flag is on) | Parity endpoints exist; verify drift via admin endpoint (W4) |
| Revenue truth (S6) | IMPLEMENTED AND VERIFIED IN A TEST ENVIRONMENT | #555 (`d214ec62`): consumed-usage predicate in `truth.js` + admin `consumed_usage`; real-SQL test on local PG | Epoch split (S6b) still uses the unfiltered sum → W1 next |
| `/api/economics/summary` public revenue (S4) | COMPLETED AND VERIFIED IN PRODUCTION | #551 (`b1d6f5f7`) + #559 (`839e3497`): P money fields null, `/api/revenue*`, `/api/epochs`, treasury/settlement/`/system` money reads 401 | SEC-4b `GET /api/nodes/:nodeId` wallet exposure open |
| `/api/financial/truth` admin-only, `/api/public/stats` sanitized | COMPLETED AND VERIFIED IN PRODUCTION | P 401 / 200 (6 fields, no money) | — |
| PaymentAdapter + single-tx ingest (#520) | TESTED BUT NOT DEPLOYED | PR #520 draft; 266/266 per PR | W4 rebase |
| Dodo V2 webhook | BROKEN OR CONTRADICTORY | RT: global JSON parser runs before the raw-body parser, so signature verification likely always fails (fails closed); RW flag absent | W4/W5 |
| Console Pricing V2 / Usage Units (#547) | BROKEN OR CONTRADICTORY | MP/DU: hardcoded client prices, ₹84 fixed FX + GST in client, shared Dodo test product ids collapse tiers, custom INR pack 404s, UU shown from invented fallback numbers | W5 |
| `revenue_events_v2.amount_usdt` type (B-07) | UNKNOWN AND REQUIRING INSPECTION | MP: REAL in `init.sql`, NUMERIC in `server.js` bootstrap | Founder runs `\d revenue_events_v2` (sat-db) → W4 plan |
| Verified external revenue | COMPLETED AND VERIFIED IN PRODUCTION (= $0.00) | Mandate §3; R3 | — |

## M9 Trading AI

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| Trading AI stages 09–35 | TESTED BUT NOT DEPLOYED | PR #492; `mountTradingRoutes` absent on main (RT) | W8 |
| Eulerpool research adapter (Bearer, quota guard, evidence licensing) | IMPLEMENTED AND VERIFIED IN A TEST ENVIRONMENT | Session T1; 19 contract tests; live from Railway → 502 (`evidence/EULERPOOL_CONTRACT.md`) | Auth unverified live; FREE plan = internal R&D only |
| Backtest / walk-forward StrategyEvaluation (append-only, migration 040) | IMPLEMENTED AND VERIFIED IN A TEST ENVIRONMENT | Session T1; PG integration 6/6; 4 real evaluations, all FAIL | Migration 040 not applied in production (F23) |
| Decision API go/no-go (conditions a–f, signed demo mandate) | IMPLEMENTED AND VERIFIED IN A TEST ENVIRONMENT | Session T1; 15 tests | Not mounted on any route |
| Binance Spot Demo broker + forward-test runner | BLOCKED (geo) | API runtime us-west2 → HTTP 451 (`evidence/TRADING_GEO_CHECK_2026-10-31.md`) | F22: worker outside the US |
| Gate 0 register (B-01…B-12) | PARTIALLY IMPLEMENTED | `docs/trading-agent/BLOCKERS.md` on integration | Founder reports Part D cleared (rotations done, Paperclip decommissioned) on 2026-10-20 → update B-01/B-02/B-03/B-04 with that evidence in W8 |

## M10 Surfaces

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| Console (console.satelink.network) | DEPLOYED BUT NOT VERIFIED | P 307 (auth redirect) | — |
| Admin host (admin.satelink.network) | COMPLETED AND VERIFIED IN PRODUCTION (404 as intended) | P 404 | — |
| developer.satelink.network | BROKEN OR CONTRADICTORY | P 307 to a Next error document | W10/M10 decision: one developer portal |
| `satelink-mcp` npm package | BLOCKED (founder publish, F12) | `npm view satelink-mcp` → E404; `mcp.json` tells users to `npx` it; manifest lists 1 tool, server registers 5 | W1 prep, founder publishes |
| A2A agent card | DOCUMENTED BUT NOT IMPLEMENTED | P `/.well-known/agent-card.json` 404 | W7 |
| `packages/sdk` | OBSOLETE OR SAFE TO REMOVE (as is) | R: no importers, no tests, no publish path | W6 regenerates from OpenAPI |
| `apps/cms` | OBSOLETE OR SAFE TO REMOVE | R: no consumer | W10 manifest |

## M11 Websites

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| satelink.network | DEPLOYED BUT NOT VERIFIED | P 200; copy is the #547 "infrastructure" framing | W11 to D14 |
| jakuraa.com | BROKEN OR CONTRADICTORY | DU §8: unmeasured or false claims (dry-run "sub-second settlement", "Verifiable oracle feeds", "Zero external SDK dependency", "Sub-50ms"), "Claude & Anthropic MCP compatible" badge, third-party YouTube embeds, a 2023 "x402" working paper (false attribution), "SOC2-compliant" on web pricing | W1/W11: remove now (claims), rebuild later |
| `security.txt` | DOCUMENTED BUT NOT IMPLEMENTED | P 404 | W11 |
| `app.satelink.network` | OBSOLETE OR SAFE TO REMOVE | P 000/error; CLAUDE.md "Production URLs" still lists it | CLAUDE.md fix in W0 |

## M12 Platform ops & security

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| Node claim signing route | COMPLETED AND VERIFIED IN PRODUCTION | #549 (`7581f207`): staff-only + dry-run refusal in route and signer; P anon/non-staff → 401 | On-chain signer unrotated → F21 OPEN-CRITICAL (`runbooks/SIGNER_ROTATION.md`) |
| Other unauthenticated money-adjacent reads/writes | PARTIALLY IMPLEMENTED | Fixed: public money reads (#551, #559), parity (#553), node-token (#553). Open: deposit-notify, node register/heartbeat, `GET /api/nodes/:nodeId` wallet | W1 |
| KMS / KeyProvider | DOCUMENTED BUT NOT IMPLEMENTED | R | W7 (F4) |
| Outbox + worker | PARTIALLY IMPLEMENTED | DU §5: interval jobs + node-cron live; ~12 orphaned queue files; `worker.js` / reconciler deploy status unknown | W6 decision record |
| Kill switches (`platform_flags`) | PARTIALLY IMPLEMENTED | R | W3 |
| Staging environment | BLOCKED (F3) | No staging env exists | Founder provisions |
| Committed `.claude/settings.json` autoApprove (B-04) | IMPLEMENTED BUT NOT FULLY INTEGRATION-VERIFIED | W0 PR removes it | — |
| CI as a real gate (B-10) | PARTIALLY IMPLEMENTED | BASELINE.md (pending) | W0 |
| `apps/api` lockfile | BROKEN OR CONTRADICTORY | Mandate §3; #541 override | W0 |

## M13 Repo hygiene

| Capability | Status | Evidence | Disagreement → resolution |
|---|---|---|---|
| Root report files (14 from #547) | OBSOLETE OR SAFE TO REMOVE (move to archive) | R §root | W10 |
| Two migration trees (`apps/api/migrations` 27, `database/migrations` 19) | BROKEN OR CONTRADICTORY | R | W4 decision record: runner.ts is canonical (R11) |
| Root `railway.json` / `nixpacks.toml` (unused; service uses `apps/api`) | OBSOLETE OR SAFE TO REMOVE | R | W10 |
| Vendored `apps/api/src/utils/lib/forge-std` | OBSOLETE OR SAFE TO REMOVE | R | W10 |
