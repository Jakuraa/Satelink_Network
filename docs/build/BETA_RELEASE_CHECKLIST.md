# Beta release checklist — customer workflows (Strategy Lab, Marketplace, Workflows)

Every box needs evidence (link, SHA, test output). Production steps are founder decisions.

## Code (branch `feat/beta-unified-workflow`)
- [x] Workflows run on the existing vNext RoutingKernel (no new engine/registry/ledger) — `d13fab1a`
- [x] 31 API tests pass; mutation-checked (result verifier, journal clone) — `apps/api/test/workflows_beta.test.js`
- [x] Full apps/api suite vs pristine main, same local DB: +30 tests, no new failure (one known flake, 17/17 on rerun)
- [x] Console pages typecheck + lint; browser walkthrough desktop + 390 px — `evidence/beta-preview/`
- [ ] Console `next build` green in CI
- [ ] Independent code review (fresh reviewer) with fixes applied
- [ ] Workflows API documented in OpenAPI + console `/docs`

## Before any deploy with the flag on
- [ ] Durable store: boot `WorkflowService` with `PgDurableStore` (`vnext/reliability/schema.sql` reviewed + applied as a migration, F14) — the preview uses memory
- [ ] Railway region decision for Strategy Lab data: API is `us-west2` (Binance 451) → separate worker outside the US (F22) or a licensed data source
- [ ] `WORKFLOWS_POLYGON_RPC_URL` set to an authorized upstream (not a free public endpoint for customer traffic)
- [ ] Staging environment (F3) — flag on there first, never first in production
- [ ] Rate limit on `/v1/workflows/runs` and `/v1/strategy-lab/compile` (backtests cost ~2–3 s CPU)

## Before charging anything
- [ ] Prices approved per meter (F8); catalog `pricing.approved=true` + `customer_price_usd`
- [ ] Data licence permits commercial use for Strategy Lab (F25 or other vendor, written confirmation)
- [ ] Replace `WithheldSettlement` with Financial OS reserve/capture/release (#583) + revenue event; reconciliation test
- [ ] Outbound x402 to external suppliers: funded hot wallet with per-tx/hour/day caps (vNext `OutboundGuard`) + founder spend authorization
- [ ] Refund-on-upstream-failure for RPC (#565) merged

## Product
- [ ] Workflows exposed as MCP tools (same service) and `satelink-mcp` published (F12)
- [ ] Onboarding: "choose a use case" step routes to Strategy Lab / Marketplace / RPC
- [ ] Legal copy reviewed: "simulated / not advice" banners, token-risk disclaimer
