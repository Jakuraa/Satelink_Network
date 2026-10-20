# Status matrix — Satelink AI Assistance

Baseline: `origin/main` @ `8679dd61` (#547) · Step 0 run 2026-10-20 · updated each session.
One status per row, from the mandate §4.7 vocabulary. Evidence is mandatory.
Security-sensitive findings are recorded as **categories only** (R14, public repo). The detailed
evidence lives in `docs/build/evidence/private/` (gitignored, local to the build machine).

Evidence keys: **P** = production probe 2026-10-20 (curl transcript in the ledger) ·
**R** = `evidence/REPO_MAP.md` · **RT/MP/DU** = private ROUTES / MONEY_PATHS / DUPLICATES sweeps ·
**RW** = Railway variable *names* (values never read, except the flags listed in the ledger).

## M1 Identity, tenancy, access

| Capability | Status | Evidence | Code / docs / prod disagreement → resolution |
|---|---|---|---|
| API keys (`sk_…`, hashed) + EIP-191 wallet binding on `POST /api/keys` | COMPLETED AND VERIFIED IN PRODUCTION | #533; RT §keys | — |
| x402 session keys (hashed, signed recovery) | COMPLETED AND VERIFIED IN PRODUCTION | #522, #530; P `/.well-known/x402` 200 | — |
| Better Auth (console, `/api/identity`) | DEPLOYED BUT NOT VERIFIED | RW `AUTH_ENABLED=true`; RT flag-gated mount | End-to-end sign-in not re-verified this session |
| Tenants / organizations (`tenant_id`) | DOCUMENTED BUT NOT IMPLEMENTED | R: no tenant model on main | W3 |
| RBAC roles map | DOCUMENTED BUT NOT IMPLEMENTED | R: role checks are ad hoc middleware | W3 |
| Staff/admin auth | PARTIALLY IMPLEMENTED | P `/admin/*` → 401; RT: 3 separate admin-secret mechanisms, non-constant-time compare, some header-vs-env checks that open when the env var is unset | W1/W3: one staff-auth path, constant-time compare, fail closed |
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
| Revenue truth (S6) | BROKEN OR CONTRADICTORY | MP: `truth.js` sums `revenue_events_v2` without op_type/`is_billable` filters; the epoch split uses the same sum; phantom workload rows and double-count paths flow in | W1 fix (founder-review) |
| `/api/economics/summary` public revenue (S4) | BROKEN OR CONTRADICTORY | P 200 `totalRevenueUsdt: 20.52582` (founder test data shown as revenue); RT: sibling public revenue reads | W1 fix |
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
| Node claim signing route | BROKEN OR CONTRADICTORY | RT + RW (signer + claims contract configured) | Fixed in PR #549 (founder-review). Rotation decision → F1 |
| Other unauthenticated money-adjacent reads/writes | BROKEN OR CONTRADICTORY | RT: several public money reads, unauthenticated parity and deposit-notify endpoints, open node register/heartbeat | W1 sequence of fix PRs |
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
