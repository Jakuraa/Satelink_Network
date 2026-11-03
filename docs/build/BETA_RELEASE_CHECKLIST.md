# Beta release checklist — customer workflows (Strategy Lab, Marketplace, Workflows, API & MCP)

Updated Session B2 · 2026-11-03 · PR #609 (draft). Every box needs evidence. Production steps are founder decisions.

**Release decision: NOT YET.** The local beta is persistent, reviewed and passes all supported journeys. A
controlled external beta needs the unchecked items in "Before an external beta".

## Code (branch `feat/beta-unified-workflow`)
- [x] Workflows run on the existing vNext RoutingKernel — no new engine, registry or ledger
- [x] Independent code review (fresh reviewer) — 4 HIGH, 4 MEDIUM, 6 LOW; all HIGH and MEDIUM fixed except M8 (account linking, documented); regression tests fail on the pre-fix commit (`a617b16f`)
- [x] Postgres persistence (migration 041 + down; `wf_*` kernel store, owner-scoped read model, append-only receipts/journal, usage never revenue) and restart recovery
- [x] API tests: 40 (memory) + 8 (Postgres, incl. both crash windows and a concurrent-approval race); mutation-checked
- [x] Full apps/api suite vs pristine main, same local DB: 916/867/50 vs 868/818/51 — no new failure
- [x] MCP workflow tools: 8 tools, opt-in, customer-scoped, spending cap, derived idempotency — 8/8 tests incl. real MCP client↔server
- [x] OpenAPI 3.1 contract (`GET /v1/workflows/openapi.json`) with route-drift test
- [x] Console: tsc + eslint clean; `next build` green (B1); browser E2E 8/8 + after-restart phase 1/1
- [x] CI green on the PR head — 13/13 checks at `42aac026` (incl. Build Verification, API baseline guard, Financial OS integration 23/23 files)
- [x] Migration 041 integration test in CI — `migrations.integration.test.ts` 15/15 in a real Postgres container (CI run 41570951084)

## Before an external beta
- [ ] Founder applies migrations 040 + 041 to production (F14/F23) — **review the down script; never run it in production**
- [ ] Staging environment (F3): flag on there first
- [ ] `WORKFLOWS_BETA_ENABLED=true` + `WORKFLOWS_POLYGON_RPC_URL` set to an **authorized** upstream (not a free public endpoint for customer traffic)
- [ ] Strategy Lab data: licensed source with written confirmation (CoinGecko paid tier is the first candidate) or the F22 EU worker for internal use only
- [ ] Account linking so one customer has one identity across API key and console session (review M8)
- [ ] Single API replica while the workflow journal keeps its hash-chain tail in memory (multi-instance writers would fork the chain)
- [ ] Rate limit is per process (in-memory); move to Redis if more than one replica
- [ ] Legal copy review: "simulated / not advice" banners, token-risk disclaimer

## Before charging anything
- [ ] Prices approved (see REVENUE_EXPERIMENT_PLAN — proposal only); catalog `pricing.approved=true`
- [ ] Replace `WithheldSettlement` with Financial OS reserve/capture/release (#583) + revenue event + reconciliation test
- [ ] Outbound x402 to suppliers: funded hot wallet with vNext `OutboundGuard` caps + founder spend authorization
- [ ] Execution safety for paid suppliers: a process crash *during* a supplier call can re-run it on recovery (RecoveryWorker) — require AT_MOST_ONCE handling before any paid external call
- [ ] Refund-on-upstream-failure for RPC (#565) merged

## Before publishing MCP
- [ ] Decide which tools are public (recommend: read-only + `request_capability_purchase`; `approve_purchase` only with auto-approve cap 0)
- [ ] Hosted HTTP transport behind auth + rate limits (it already uses the caller's X-API-Key)
- [ ] `npm publish satelink-mcp` (F12) — founder action
