# Audit A — release-a worktree (build/integration-base)
Root: /Users/pradeepjakuraa/satelink/.claude/worktrees/release-a

## 1. Auth / identity
- Better Auth: config at apps/api/src/auth/better_auth.mjs (getBetterAuth). Session helpers: apps/api/src/console_accounts/router.mjs — `betterAuthSession(pool, req)` (L28), `csrfGuard` (L38), `createMeRouter` (L55), sessions in console_accounts/sessions.mjs. Gated by `CONSOLE_ACCOUNTS_V1=true` (app_factory.mjs L464 mounts /v1/me).
- API keys: `X-API-Key` → `resolveAccount(pool,{apiKey})`, active-only.
- Workflows principal (apps/api/src/routes/workflows_route.js ~L85-104, `resolvePrincipal`): API key → `{id: keyRef(api_key)}`; else if CONSOLE_ACCOUNTS_V1 and header `X-Satelink-Console: 1` → `{id: "user:<accountId>"}`. Wrappers `authed`/`open`/`sessionCsrf` in same file.
- CSRF: console session requests must carry `X-Satelink-Console: 1`; enforced by `csrfGuard` on mutating routes (skipped when X-API-Key present). Console proxies via Next route handlers apps/console/src/app/api/console/workflows/[...path]/route.ts (fetch `${API_BASE}/v1/${path}`, L33), also me/[...path], payments/[...path]. Console middleware: apps/console/src/middleware.ts; session lib apps/console/src/lib/session.ts.

## 2. RoutingKernel
- apps/api/src/vnext/kernel/kernel.js L15 `class RoutingKernel` (ctor {registry, settlement, fee, journal, idempotency, clock,...}; `execute(request, options)` L62; `reconstruct(txId)` L204).
- Interfaces apps/api/src/vnext/kernel/interfaces.js: `WorkloadAdapter`, `SettlementAdapter`, `FeeAdapter`, enums SettlementMode, ExecutionSafety, FeeCapture. Other kernel files: registry.js, journal.js, idempotency.js, saga.js, shadow_settlement.js, echo_adapter.js, fixed_fee.js.
- Durable wrapper: apps/api/src/vnext/reliability/durable_kernel.js `DurableKernel` (submit, recover, startRecoveryTimer lockKey 4021). PgDurableStore with prefix `wf_`.
- Adapters: vnext/adapters/rpc, vnext/adapters/x402; workflow adapters (#609) in apps/api/src/workflows/workload_adapters.js: `StrategyEvaluationAdapter` (workload `trading.strategy_evaluation`), `CapabilityProcurementAdapter` (`procurement:<capability>`), `WithheldSettlement`. HTTP: vnext/http/kernel_router.js.

## 3. #609 workflows (apps/api/src/workflows/)
- connectors.js — JSON-RPC balance connector, x402 HTTP connector, VERIFIERS/verifyResult.
- run_store.js — `MemoryRunStore` (L32), `PgRunStore` (L181), receiptHash, ReceiptIntegrityError; CAS `transition(id, from[], patch)`.
- strategy_compiler.js — rule-based strategy spec `satelink.strategy/v1`, compileStrategy, validateSpec.
- supplier_catalog.js — `SupplierCatalog`, loads apps/api/config/supplier_catalog.v1.json, registers executable offers in vNext SupplierRegistry.
- workflow_service.js — `WorkflowService`, TEMPLATES, WorkflowError, recover() L433 (called at create, L160).
- workload_adapters.js — see §2; SIMULATION_LABEL "SIMULATED / BACKTEST — NOT ACTUAL RETURNS".
- Run states (workflow_service.js header L8 + transitions L332-422): create → blocked | awaiting_approval | running; awaiting_approval → running (approve) | cancelled; running → completed | failed. Kernel tx states FAILED/REJECTED.
- Store: Postgres in prod (PgRunStore + PgDurableStore prefix `wf_` + PgEvaluationStore), Memory when no pool. Migration database/migrations/041_customer_workflows.sql (tables wf_journal, wf_idempotency, wf_suppliers, wf_dlq, workflow_definitions, workflow_strategies, workflow_runs, workflow_run_steps, workflow_usage_records, workflow_receipts); also needs 040.
- Routes: app_factory.mjs L36 import, L453 `app.use("/v1", createWorkflowsRouter(pool))`. Endpoints: GET /workflows/openapi.json, /workflows/mcp-tools, /workflows/templates, /marketplace/capabilities(/:id), POST /marketplace/quote, POST /strategy-lab/compile, POST/GET /workflows/runs, GET /workflows/runs/:id, GET /workflows/receipts/:id, POST/GET /strategy-lab/strategies(/:id), POST /workflows/runs/:id/approve, /cancel.
- Flags: `WORKFLOWS_BETA_ENABLED=true` (workflowsEnabled L48), `WORKFLOWS_RUNS_PER_MINUTE` (default 10), CONSOLE_ACCOUNTS_V1 for sessions.
- Recovery: lazy on first request (service boot) → WorkflowService.recover() re-drives 'running' runs; boot failure → 503 retry.
- Strategy Lab/PaperBroker: strategy_compiler + StrategyEvaluationAdapter (Binance candles, backtest scorecard). PaperBroker: UNKNOWN in workflows (paper trading lives in apps/api/src/trading/engine/ + /v1/trading). Marketplace: /marketplace/* over SupplierCatalog.
- MCP: apps/mcp-server/src/workflows.mjs (workflowToolDefs, WORKFLOW_TOOL_NAMES), workflow-tools.json; enabled by `SATELINK_MCP_WORKFLOW_TOOLS=1` (server-factory.mjs L96).

## 4. Capability Registry v3
apps/api/src/pricing_v2/capability_registry.mjs: CAPABILITY_STATUSES (L24: live,beta,paper,sandbox,planned,deprecated), CAPABILITY_AUDIENCES (L25), `registryEnabled` (L37, `CAPABILITY_REGISTRY_V3==='1'`), RPC_CREDITS_CAPABILITY / RPC_X402_BUNDLE_CAPABILITY, `validateCapabilities` (L71), microToUsd, `registryRpcPrices` (L157), `publicCapabilities` (L177). Entry fields: UNKNOWN in detail (see validateCapabilities L71). Consumers: pricing_v2/rails.mjs, pricing_v2/catalog.mjs, routes/machine_onboarding.js.

## 5. Console
- Next 15.5.27. Route group src/app/(console)/: agents, alerts, api-mcp, billing, data, developers, docs, keys, marketplace, paper-trading, requests, rpc, settings, spend, strategy-lab, trading-intelligence, usage, workflows, x402 (+ layout.tsx, page.tsx); also sign-in, welcome, api/console/*.
- Shell: apps/console/src/components/Shell.tsx. Shared UI: components/ui.tsx, components/v2/, components/workflows/ (parts, ProcurePanel, RerunButton, RunActions, StrategyLabWorkspace).
- Signal tokens: packages/web-ui/src/styles/tokens.css imported by apps/console/src/app/globals.css.
- API calls: lib/api.ts, lib/workflows.ts + proxy app/api/console/workflows/[...path]/route.ts.
- Playwright: apps/console/playwright.config.ts (testDir ./e2e, PW_BASE_URL); e2e: accounts-gate, alerts, onboarding, sign-in, simple-flows, workflows-beta specs.
- SimulationBadge: none by name; simulation text in OverviewWorkspace/DevelopersWorkspace/PaperTradingWorkspace.tsx and SIMULATION_LABEL server-side.

## 6. /v1 mounts (app_factory.mjs)
L423 /v1/credits, L424 /v1/vault, L428 machine V1 (/v1/pricing, /v1/machine/register), L432 /v1/x402/key, L436 machine intel (/v1/compare, /v1/capabilities), L443 /v1/intelligence, L448 /v1/trading, L453 workflows, L458 plans, L459 console summary, L464 /v1/me (flag), payments ~L466-475, L492 /v1/tools, then /v1 ai-gateway (~L486, /v1/responses); L534 /machine-access/v1.

## 7. Migrations
database/migrations highest 042 (041_customer_workflows, 042_ledger_kind_reservation) via database/runner.ts. apps/api/migrations highest 048_trading_idempotency.sql; runner for it UNKNOWN (no migrate script found in apps/api/package.json). #609's 041 is in database/migrations (database/runner.ts), public schema tables.

## 8. LLM providers
No OpenRouter adapter found on this branch (grep "openrouter" only hits trading files unrelated). PR #579 not merged here. No AIProvider abstraction / fixture provider found: UNKNOWN/absent.

## 9. x402
apps/api/src/payments/x402/middleware.js (`createX402Middleware`, app_factory L43), funnel.js, key_recovery_router.js; routes/well_known_x402.js; vnext/adapters/x402; workflows/connectors.js createX402HttpConnector. Mock facilitator: none found (no scripts/staging dir).

## 10. Tests/CI
- apps/api: mocha (`npx mocha --no-config --exit 'test/**/*.test.js'`).
- Root vitest.config projects: libs, tools, workers, packages, console (apps/console/**/*.{test,spec}.{ts,tsx}, excludes e2e), + others.
- Console: unit tests via vitest 'console' project; e2e Playwright.
- CI: ci.yml jobs check, trading, test, baseline, api-deploy-install, security, build; architecture.yml enforce, integration; plus deposit-reconciliation-manual, health-check, publish-mcp, release.
