# Current state audit — Release A (P1.1, 2026-11-04)

Base: `build/integration-base` = `main` `dd279db4` + #610 safety + #609 `83763dab` + #582 `c6e3556d` + #583 `4bd3a740`
+ fix `5bc1073a`. Two read-only audits (full text: `evidence/p1-audit-architecture.md`, `evidence/p1-audit-financial.md`);
every row marked ✔ was re-checked by the main session before use.

| Question | Answer (paths) | Checked |
|---|---|---|
| Auth / identity | Better Auth `apps/api/src/auth/better_auth.mjs`; session + CSRF `apps/api/src/console_accounts/router.mjs` (`betterAuthSession` L28, `csrfGuard` L38), gated by `CONSOLE_ACCOUNTS_V1`. API keys via `X-API-Key`. Workflow principal: `resolvePrincipal` in `apps/api/src/routes/workflows_route.js` (`user:<accountId>` or key ref). CSRF = `X-Satelink-Console: 1` on session mutations | audit |
| RoutingKernel | `apps/api/src/vnext/kernel/kernel.js` (`class RoutingKernel` L15, `execute` L62); adapters `vnext/kernel/interfaces.js`; durable wrapper `vnext/reliability/durable_kernel.js` | ✔ |
| Workflow engine (#609) | `apps/api/src/workflows/workflow_service.js`: states blocked / awaiting_approval / running / completed / failed / cancelled; CAS in `run_store.js`; `recover()` re-drives `running` lazily on first request; adapters `workload_adapters.js` | audit |
| Workflow storage | `PgRunStore` + `PgDurableStore(prefix wf_)`; tables in `database/migrations/041_customer_workflows.sql` (`workflow_*`, `wf_journal`, `wf_idempotency`, `wf_dlq`; receipts append-only; usage rows `money_moved=false`, `counted_as_revenue=false`, integer micro-USD) | audit |
| Mount / flags | `app_factory.mjs:453` `app.use("/v1", createWorkflowsRouter(pool))`; `WORKFLOWS_BETA_ENABLED`, `WORKFLOWS_RUNS_PER_MINUTE`; MCP tools `apps/mcp-server/src/workflows.mjs` behind `SATELINK_MCP_WORKFLOW_TOOLS=1` | ✔ (mount) |
| Registry v3 (#582) | `apps/api/src/pricing_v2/capability_registry.mjs` behind `CAPABILITY_REGISTRY_V3=1` (`validateCapabilities`, `publicCapabilities`, `registryRpcPrices`); consumers `pricing_v2/rails.mjs`, `catalog.mjs`, `routes/machine_onboarding.js`. Supplier catalog (#609) separate: `config/supplier_catalog.v1.json` via `workflows/supplier_catalog.js` → **two catalogs today (R1 risk; P2.2 unifies)** | audit |
| Reservation (#583) | Domain `libs/financial-domain/src/reservation/*`, postings `coordination/reservation-postings.ts` (hold: customer→holds; capture: holds→revenue + remainder→customer; release: holds→customer); service `services/financial/.../reservation-service.ts` (`reserve`, `capture`, `release`, `expireLapsed`). **In-memory repositories only — no Postgres table/repository, no expiry worker** | ✔ |
| Financial OS from apps/api | `@satelink/financial` and `@satelink/financial-domain` export raw `./src/index.ts`; apps/api runs plain `node server.js` (Railway Node 20, isolated `npm ci` in `apps/api`). **apps/api cannot import them at runtime**; existing pattern = JS SQL writers mirroring TS logic (`shadow_ledger_write.js`, `capacity_enforcement.js`) | ✔ |
| Outbox / worker | BullMQ `apps/api/src/queue/workloadQueue.js` (workload jobs, Redis); payments outbox in 039; #609 uses its own `wf_journal` / `wf_dlq` (DurableKernel) | audit |
| origin / environment on money rows | **None** in any migration (only `is_test_data`) | ✔ |
| Revenue computation | `apps/api/src/services/financial/truth.js` over `revenue_events_v2` etc. | audit |
| Floats on money | `workflows/supplier_catalog.js:190` `Number(chargeMicros)`; `workload_adapters.js:80,92` fee bps math in JS numbers; `plan_catalog.v2.json` float USD prices (live RPC prices — not touched) | ✔ (190) |
| Pricing status | supplier offers all `approved:false`; `REVENUE_MODEL.md` PROPOSED, no fee numbers (F8) | audit |
| Console | Next 15.5.27, `apps/console/src/app/(console)/*`, `components/Shell.tsx`, `components/ui.tsx`, Signal tokens `packages/web-ui/src/styles/tokens.css`; proxy `src/app/api/console/workflows/[...path]/route.ts` → `/v1/*`; Playwright `apps/console/playwright.config.ts`, `e2e/workflows-beta.spec.ts`; **no SimulationBadge** | ✔ (tokens) |
| Model routing | **No OpenRouter adapter on the base.** It exists in draft PR #579 (`feat/trading-openrouter-provider`, unmerged, unverified live) | ✔ |
| x402 | `apps/api/src/payments/x402/middleware.js` (`createX402Middleware`) — `apps/api/src/payments/` is a forbidden path (libs/CLAUDE.md); no mock facilitator on the base | audit |
| Migrations | `database/migrations` (runner `database/runner.ts`, now 001–019, 038–042); `apps/api/migrations` 001–048 (runner UNKNOWN; not used by Release A) | ✔ |
| Tests / CI | apps/api mocha (`scripts/ci-baseline-check.sh` + known-failure/skip baselines); vitest projects libs / tools / integration / console; CI `ci.yml` (check, trading, test, baseline, api-deploy-install, security, build) + `architecture.yml` (enforce, integration) | ✔ |

## Broken / failing today (measured on the integration base)
- apps/api: 4 failing + 3 pending tests — all already in `known-failures-baseline.txt` / `known-skips-baseline.txt` (pre-existing).
- Integration suite needs Docker (testcontainers): 15 files fail without it; **25/25 pass with Docker 29.6.2**.
- #583 + main migration conflict (fixed on the base, `5bc1073a`).
- Preview runtime (`scripts/preview/beta-preview.sh`) calls external hosts (Binance klines, public Polygon RPC) — Release A slices use recorded data instead.

## Build-relevant consequences
1. **Extend #609's workflow engine** (R1) to the mandate's state set — no second orchestrator.
2. **Unify the registry**: one module serving both registry v3 and the supplier catalog shape (R1/R9).
3. **Money bridge** (ADR-5): JS Postgres writer for reservations mirroring the TS postings, proven equal by a parity test.
4. **Model routing** must be built (or #579 integrated) with a fixture provider; no live key is available → VERIFIED (FIXTURE) at best.
5. Fix the float conversions on any path Release A touches.
