# REPO_MAP — Satelink monorepo inventory

- Snapshot: `origin/main` @ `8679dd61` (worktree `.claude/worktrees/mandate-w0`), inventoried 2026-10-20.
- Method: read-only. `package.json`/deploy-config reads, `git grep` / `grep -r` for imports and references
  (node_modules, .next, dist and package-lock excluded). No app booted, no `.env` read (only `.env.example` names exist in git:
  `.env.example`, `apps/cms/.env.example`, `apps/web/.env.example`).
- "Deploys" means **repo evidence of a deploy config**. Live hosting state was NOT verified in this pass.

## 1. Workspaces (root `package.json`)

Root package `satelink-provider` (private, ESM, `npm@11.6.2`, turbo 2). `workspaces`:
`apps/*`, `!apps/cms`, `services/*`, `packages/*`, `agents/*`, `libs/*`, `workers/*`.

- `apps/cms` is **explicitly excluded** (Payload 3 needs React 19; root overrides pin React 18.3.1). It has its own lockfile.
- `libs/testing` has no `package.json`, so it is not a workspace (only `src/assert-test-db.ts`).
- Root scripts: `build` = turbo build of `web` + `@satelink/api` only; `test` = turbo test of `web` only;
  `test:libs|test:arch|test:integration` = root `vitest.config.ts` projects (`libs`, `tools`, `workers`, `packages`, `integration`);
  `arch` = dependency-cruiser over `libs tools workers`; `contracts:*` = Foundry.
- `tsconfig.base.json` path-maps `@satelink/kernel` and `@satelink/financial-domain` to source.

## 2. Deploy evidence (repo-side)

| Config | Target | Notes |
|---|---|---|
| `railway.json` (root) | RAILPACK, `node apps/api/server.js`, health `/` | Root-level; API service actually uses `rootDirectory=/apps/api` per comment in `apps/api/nixpacks.toml` |
| `apps/api/railway.json` + `apps/api/nixpacks.toml` | NIXPACKS, `node server.js`, health `/health`, Node 20 pin | **The live Satelink-api config** (per nixpacks.toml comment, 2026-09-15) |
| `nixpacks.toml` (root) | `npm ci` + `better-sqlite3` rebuild, `node server.js` | Per `apps/api/nixpacks.toml` comment, **never applied** to the API build |
| `workers/reconciler/railway.json` | NIXPACKS, `npm start --workspace=@satelink/reconciler`, health `/health` | Reconciler worker (M7); `SATELINK_OPS_RUNBOOK.md` documents it as a Railway service |
| `railway.paperclip.json` + `Dockerfile.paperclip` + `start-cloud.sh` | Paperclip agent orchestrator (installs `paperclipai`, `@anthropic-ai/claude-code`, clones repo) | Referenced only by agent/memory + docs; memory says offline since Aug |
| `apps/web/vercel.json` | Next.js on Vercel, `turbo-ignore`, rewrites `/api/identity/*` → API, host rewrite `status.satelink.network` → `/_status`, `app.satelink.network` redirect | satelink.network |
| `apps/console/vercel.json` | Next.js on Vercel, `turbo-ignore`, `/api/identity/*` rewrite | console.satelink.network |
| `apps/corporate/vercel.json` | Next.js on Vercel, `turbo-ignore` | jakuraa.com |
| `apps/mcp-server/Dockerfile` | `docker build -f apps/mcp-server/Dockerfile` (README) | No Railway/Vercel config; distributed via npm (`publish-mcp.yml`) |
| `apps/web/Dockerfile`, `apps/web/Dockerfile.web`, `Dockerfile.api`, `docker-compose*.yml`, `infra/docker/*` | Local/dev Docker stacks | Referenced by `Makefile` / compose files only; not a prod path |
| `apps/cms` | none | No vercel.json/railway.json; README claims `admin.satelink.network`, which CLAUDE.md says is the Express API |

### GitHub Actions (`.github/workflows/`)

| Workflow | Trigger | What it runs |
|---|---|---|
| `ci.yml` | PR → main/develop; push develop | typecheck+lint, claims lint (`apps/web`, `apps/corporate`), `npm test` (= web vitest), `scripts/ci-baseline-check.sh` (API mocha baseline guard), secret scan, web build |
| `architecture.yml` | PR → main/develop; push develop | `npm run arch`, `typecheck:libs`, `typecheck:workers`, `test:libs`, `test:arch`, `test:integration` (Postgres, `database/migrations`) |
| `publish-mcp.yml` | tag `satelink-mcp-v*`, manual | `apps/mcp-server`: `npm test` then `npm publish --access public` |
| `release.yml` | tag `v*.*.*` | release |
| `health-check.yml` | cron `*/5 * * * *`, manual | external health probes + Resend email alert |
| `deposit-reconciliation-manual.yml` | manual only | `apps/api` deposit reconciliation script |

Note: no `develop` branch exists (CONTRIBUTING.md); push-to-main does not run CI, only PRs do.

## 3. Workspace / app inventory

Test counts exclude node_modules. "Importers" = other repo locations referencing the package name or a relative path into it.

| Path | Package | Purpose (1 line) | Entry points | Importers | Deploys | Tests |
|---|---|---|---|---|---|---|
| `apps/api` | `@satelink/api` | Express backend: RPC gateway, x402, credits, admin, pricing V2, console accounts, vnext kernel | `server.js` → `app_factory.mjs` (569 lines, all route mounts); `worker.js`, `gateway.js` | none by name (root scripts `start/gateway/worker`) | Yes: Railway Satelink-api (`apps/api/railway.json`) | mocha: 100 files in `test/` (`--require test/_guard/prod_db_guard.cjs`); +2 vitest `*.integration.test.ts` in `src/capacity` (root `integration` project) |
| `apps/web` | `web` | satelink.network public site + `(admin)`, `ops`, `machine-console`, `satelink/os`, `status`, `docs`, checkout routes | Next.js `src/app/*` | none | Yes: Vercel (`vercel.json`) | vitest 21; Playwright e2e 11 |
| `apps/console` | `@satelink/console` | console.satelink.network customer console (keys, usage, alerts, onboarding) | Next.js `src/app`, `src/middleware.ts` | none | Yes: Vercel (`vercel.json`) | Playwright e2e 5 (`e2e/*.spec.ts`) |
| `apps/corporate` | `@satelink/corporate` | jakuraa.com corporate/editorial site | Next.js `app/` | none | Yes: Vercel (`vercel.json`) | 0 (only `lint:claims`) |
| `apps/mcp-server` | `satelink-mcp` v2.1.2 | MCP server (stdio + Streamable HTTP `POST /mcp`, `/execute`, `/.well-known/mcp.json`) | `index.js` (bin `satelink-mcp`), `http.mjs` (bin `satelink-mcp-http`) | name string only in `apps/api/src` 402 bodies (`utils/payment_required.js`, x402/credit/free-tier middleware) — not an import | npm publish via `publish-mcp.yml`; Dockerfile exists | node:test, 2 (`bin`, `version`) |
| `apps/cms` | `@satelink/cms` | Payload 3 CMS (Next 15, React 19), Postgres + Vercel Blob | Next.js `src/`, `payload migrate/seed` | **no consumer**: zero `CMS_URL`/cms references in `apps/web` or `apps/corporate` code | No config | vitest 1 (`test/cms-lifecycle.int.test.ts`) |
| `packages/config` | `@satelink/config` | shared ESLint preset + tsconfig | `index.js`, `eslint-preset.js` | `packages/ui`, `agents/node-agent` (package.json) | n/a (library) | 0 |
| `packages/content` | `@satelink/content` | zod content schemas, CMS REST client w/ fallback fixtures, product/pricing contract | `src/` (TS source) | `apps/web` (14 src files + next.config), `packages/seo` | n/a | vitest 1 (`schemas.test.ts`) |
| `packages/sdk` | `@satelink/sdk` v0.2.0 | client SDK: RPC gateway, x402, agent tools | `dist/index.js` (built) | **none** (self only); no publish workflow | n/a | `vitest` script, 0 test files |
| `packages/seo` | `@satelink/seo` | Next metadata/JSON-LD builders, llms.txt generators, SEO validators | `src/` | `apps/web` (70 src files) | n/a | vitest 1 (`validators.test.ts`) |
| `packages/ui` | `@satelink/ui` | OS/admin dashboard design system (tokens = state-color source) | `src/index.ts` | `apps/web` (37 src files) | n/a | 0 |
| `packages/web-ui` | `@satelink/web-ui` | "Satelink Signal" public-site design system | `src/` | `apps/web` (29), `apps/console` (1); description claims `apps/corporate` too, but **no corporate import found** | n/a | 0 |
| `libs/kernel` | `@satelink/kernel` | pure shared value objects, zero I/O, root of dep graph | `src/index.ts` | `libs/financial-domain` (58), `services/financial` (42), `workers/reconciler` (2) | n/a | vitest 3 |
| `libs/financial-domain` | `@satelink/financial-domain` | pure ledger aggregates (principal, account, authorization, draw, funding-source, ledger) | `src/index.ts` | `services/financial` (38) | n/a | vitest 13 |
| `libs/testing` | (none) | test DB guard helper | `src/assert-test-db.ts` | vitest config / tests | n/a | 0 |
| `services/financial` | `@satelink/financial` | Financial OS application (commands/queries/ports) + Postgres infra adapters (EIP-3009 verifier) | `src/index.ts` | `apps/api/src/capacity/m9_schedule_enforcement.integration.test.ts` (relative path, test-only), `ops/m8-create-authorization.ts`, `ops/m9-register-schedule.ts` | n/a | vitest 12 (all `*.integration.test.ts`) |
| `workers/reconciler` | `@satelink/reconciler` | M7 worker: settlement-poller + ledger⟷chain reconciler + outbox-publisher + refill-monitor + guardrails | `src/index.ts` via `tsx` | none | Yes: Railway (`railway.json`, Dockerfile) | vitest 4 |
| `agents/node-agent` | `@satelink/node-agent` | CLI for node operators (`satelink-node` register/status) against rpc.satelink.network | `src/index.ts` → `dist/` | none | none | 0 |

Note: `apps/api/src/services/financial/truth.js` is an **API-internal** module (financial truth router), unrelated to the `services/financial` workspace despite the name.

### apps/api internal layout (src/, file counts)

`utils` 166 (76 one-off `utils/scripts`, 68 a **vendored forge-std copy** at `utils/lib/forge-std`), `gateway` 100, `core` 99, `workloads` 48,
`vnext` 47, `monitoring` 30, `economics` 27, `security` 22, `settlement` 20, `routes` 16, `queue` 16, `machine-access` 16,
`scheduler` 14, `nodes` 13, `pricing_v2` 12, `services` 11, `console_accounts` 11, `admin` 11, `auth` 10, others ≤9.
Migrations: `apps/api/migrations` (27 files) **and** root `database/migrations` (19 files, Financial OS; run by `database/runner.ts`) — two migration trees.

## 4. Module mapping (M1–M13)

| Module | Primary locations (evidence) | Status note |
|---|---|---|
| M1 Identity / tenancy / access | `apps/api/src/auth/*` (Better Auth `better_auth.mjs`, JWT, wallet auth, roles), `src/console_accounts/*` (sessions, keys, wallets, limits), `src/machine-access/*` (machine identity, token hashing, replay protection, permission validator), `src/billing/api_keys_route.mjs`, `wallet_challenge.mjs`; `apps/console/src/middleware.ts` | No explicit tenant model; "tenant" appears only in SLA/partner code |
| M2 Capability Registry | `apps/api/config/plan_catalog.v2.json` (loaded by `src/pricing_v2/catalog.mjs`), `src/pricing_v2/products.mjs` (product registry, enforced by `test/product_registry.test.js`, `test/catalog_consistency.test.js`), `src/plans/*`, `src/vnext/registry/supplier_registry.js`, `src/workloads/registry.js`; `packages/content` (product/pricing contract) | Catalog is the single JSON source |
| M3 Intelligence Engine (AI providers / model routing) | `apps/api/src/workloads/ai_gateway/` (OpenAI-compatible `/v1/chat/completions`, Groq backend, langchain adapter, plugin manifest), `src/queue/adapters/ai_adapter.js`, `src/workloads/ai/`; `src/intelligence/*` = **derived trading-market metrics** (funding heatmap, OI, liquidations), mounted `/v1/intelligence` | No multi-provider model router found; no Anthropic SDK use in backend |
| M4 Response / Decision API | `apps/api/src/vnext/routing/decision_engine.js`, `src/vnext/http/kernel_router.js` (`/vnext`), `src/execution/executionRouter.js`, `src/routes/intelligence_route.js` | vnext kernel mounted at `/vnext` |
| M5 Connector Gateway | `src/workloads/rpc_gateway/` (+ `rpc/`, `connectors/`, `sources/`, `bridge_gateway`, `defi_gateway`, `oracle`, `mev_relay`), `src/providers/adapters/*` (polygon, base-like chains, solana), `src/vnext/adapters/{rpc,x402}`, `src/intelligence/connectors.js`, `src/integrations/*` (moonpay, nodeops, fuse, partner engine) | RPC gateway is the live money path |
| M6 Policy engine | `src/vnext/routing/policies.js`, `src/capacity/capacity_enforcement.js` + `src/lib/flags.js` (platform_flags legacy/dual/new), `src/middleware/` (free-tier/credit gates), `src/security/featureGate.js`, `abuse_firewall.js`, `prod_guard.js` | Policy is distributed, no single engine |
| M7 Agent procurement & machine commerce | `src/payments/x402/*` (middleware, settlement, funnel, key recovery), `src/billing/*` (credits, deduct, deposit validation, x402 session keys), `src/routes/credits.js`, `src/routes/well_known_x402.js`, `src/services/deposit_listener.js`, `src/vnext/market/*` (bazaar source, discovery/benchmark agents); `workers/reconciler` (self-described "M7 worker") | Note naming clash: Financial-OS milestone "M7" ≠ this M7 |
| M8 Financial OS / payments / pricing | `libs/kernel`, `libs/financial-domain`, `services/financial`, `workers/reconciler`, `database/migrations`, `apps/api/src/pricing_v2/*` (Dodo checkout/webhooks, metering, rails, reconcile), `src/ledger/*` (shadow ledger), `src/economics/*`, `src/settlement/*`, `src/vnext/fees/*`, `apps/api/src/services/financial/truth.js`; `libs/CLAUDE.md` (frozen architecture) | Two ledgers coexist: API shadow ledger + Financial-OS ledger |
| M9 Trading AI | `apps/api/src/intelligence/*` (derived market metrics; binance-style public data in `connectors.js`), `docs/trading-agent/`; `src/capacity/m9_schedule_enforcement.integration.test.ts` is Financial-OS "M9" (schedules), not trading | No trading/OMS/broker code on main (memory: stacked draft PRs #464–#489 unmerged) |
| M10 Surfaces | `apps/console`, `apps/mcp-server`, `packages/sdk`, admin: `apps/api/src/admin/*` (`/admin`), `apps/web/src/app/(admin)`, `admin/`, `ops/`, `machine-console`, `satelink/os`; `apps/api/src/gateway/public/agent-control-centre.html` | **No A2A implementation** (zero code hits for a2a/agent-card) |
| M11 Websites | `apps/web` (satelink.network), `apps/corporate` (jakuraa.com), `apps/cms` (unconsumed), `packages/web-ui`, `packages/seo`, `packages/content`, root `docs.json`/`mint.json` (Mintlify) | |
| M12 Platform ops / security | `apps/api/src/monitoring/*`, `src/security/*`, `src/queue/*` (job queue, backpressure), outbox: `workers/reconciler/src/outbox-publisher`, kill switches: `src/lib/flags.js`, `src/vnext/reliability/outbound_guard.js`, `ANON_FREE_TIER_ENABLED` etc; `infra/monitoring` (prometheus/grafana/alertmanager, local compose only); `.github/workflows/health-check.yml`; `tools/architecture-tests`, `.dependency-cruiser.cjs`; `.husky/` hooks; `scripts/secret-scan.sh` | **No KMS integration in code** (zero `kms` hits outside images/vendored forge-std) |
| M13 Repo / docs hygiene | 18 root `.md` reports, `docs/` (72 entries), `docs/CLEANUP_MANIFEST.md` (2026-10-07 cleanup, tag `archive/pre-cleanup-2026-10-07`), `legacy/`, `scripts/` (64 entries) vs `script/`, `agent/` vs `agents/`, vendored `apps/api/src/utils/lib/forge-std` | See §5–§6 |

## 5. Other top-level directories

| Dir | Content | Referenced by | Assessment |
|---|---|---|---|
| `contracts/` | 13 Solidity sources (RevenueVaultV2, EpochAnchor, SplitEngine, NodeRegistryV2, ClaimsWithdrawals, GovernanceTimelock…) | `foundry.toml` `src = "contracts"` | Live (Foundry source); do-not-touch per CLAUDE.md |
| `test/foundry/` | 5 Foundry `.t.sol` | Foundry default test dir | Live (contracts) |
| `script/` | 5 Foundry `.s.sol` deploy scripts | root `package.json` `contracts:deploy:*`, `contracts/README.md` | Live, Foundry convention; **not a duplicate of `scripts/`** |
| `scripts/` | 64 entries: Node/bash ops, smoke, deploy, CI baseline guard, secret scan, audits | `ci.yml` (`ci-baseline-check.sh`), `Makefile`, root scripts | Live, mixed quality (many one-off `test_*.js`, `fix.sh`) |
| `src/` (root) | single `MockUSDT.sol` (differs from `contracts/MockUSDT.sol`) | `script/DeployMockUSDT.s.sol`, `docs/CLEANUP_MANIFEST.md` | Effectively dead; Foundry `src` is `contracts/`, so this file is not compiled by default |
| `broadcast/` | Foundry broadcast log for `DeployClaimsOnly.s.sol` on chain 137 | `.gitignore` only | Historical deploy artifact |
| `lib/` | git submodules `forge-std`, `openzeppelin-contracts` (not checked out in worktree) | `.gitmodules`, `foundry.toml`, `remappings.txt` | Live (Foundry deps) |
| `legacy/` | 16 files: archived docs + SQL; own README says "nothing imported, deployed, or run by CI" | 3 root repositioning reports, `docs/CLEANUP_MANIFEST.md`, `apps/cms/package-lock.json` (string) | Dead/archive by design |
| `agent/` | 103 tracked files: `memory/` (agent state, task queues, audits), `execution/` | 28 files: `.claude/CLAUDE.md`, `.claude/commands/*`, `.agents/skills/satelink/SKILL.md`, `Dockerfile.paperclip` (`COPY agent/`) | Keep (CLAUDE.md: NEVER delete `agent/memory/`) |
| `agents/` | `node-agent` only, 3 tracked files (package.json, tsconfig, `src/index.ts`) | workspace glob `agents/*`; `.gitignore` labels it "Legacy agents directory" | Low-use; no importer, no deploy, no tests |
| `database/` | Financial-OS migrations (19), `runner.ts`, 5 integration tests | `architecture.yml`, `libs/CLAUDE.md`, `SATELINK_OPS_RUNBOOK.md`, api capacity tests, `shadow_ledger_write.js` | Live |
| `docker/` | `init/init.sql`, postgres init | `docker-compose.yml`, `apps/api/src/core/schema.js`, `rpc_billing.js` (comments/paths) | Local dev only |
| `infra/` | `docker/` compose files, `monitoring/` (prometheus, grafana, alertmanager) | `Makefile` (infra/docker), `docker-compose.yml` (infra/monitoring) | Local dev only |
| `ops/` | 4 shell scripts (`stop-satelink`, `deploy-check`, `reset-dev-db`, `smoke-test`) | only `docs/CLEANUP_MANIFEST.md` | Likely dead (overlaps `scripts/ops/`) |
| `tools/` | `architecture-tests/` (3 vitest), `ops/revoke-authorization.ts` | root `test:arch`, `arch`; incident docs | Live |
| `docs/` | 72 entries (canonical docs + audits + `build/evidence/`) | CLAUDE.md canonical list | Live, sprawling |
| `.agents/` | `skills/satelink/SKILL.md` | `docs/ui/UI_SKILLS.md` | Agent tooling config, not code |
| `.cursor/` | `settings.json` (datadog/slack plugin toggles) | none | Editor config, unreferenced |
| `.antigravity-rules` | 8 lines of UI rules (TS, Tailwind v4, no fabricated data), points to `apps/web/ANTIGRAVITY_BRIEFING.md` | **0 references** | Agent-tool config; unreferenced |
| `.claude/` | real `CLAUDE.md` (root `CLAUDE.md` is a symlink), commands, subagents, skills, settings | Claude Code | Live agent config; CLAUDE.md last changed 2026-07-16 (stale vs memory) |
| `.husky/` | `pre-commit`, `pre-push` | `husky` devDep | Live |
| `.vscode/` | settings/tasks/extensions | none | Editor config |
| Paperclip files | `Dockerfile.paperclip`, `railway.paperclip.json`, `start-cloud.sh` | each other + `agent/memory/{RUFLO_SETUP,SETUP_COMPLETE}.md`, `docs/CLEANUP_MANIFEST.md`, `docs/audit-2026-06-13/*` | Deploy config for an offline cloud-agent service; no app code depends on it |

## 6. Root-level files

### Report / doc `.md` files at root (20)

| File | Last commit | Classification |
|---|---|---|
| `CLAUDE.md` (→ `.claude/CLAUDE.md`) | 2026-07-16 | Authoritative agent context, **partly stale** (e.g. lists `app.satelink.network` as frontend URL while also calling it dead; money path says vault `0x80AF…` while header says V2) |
| `README.md` | 2026-10-20 (#547) | Authoritative public README (repositioned copy) |
| `CONTRIBUTING.md` | 2026-10-12 | Authoritative (branch strategy) |
| `SATELINK_OPS_RUNBOOK.md` | 2026-10-15 | Authoritative ops runbook (reconciler worker) |
| `AUDIT_REPORT_2026_06.md` | 2026-06-26 | Historical report (listed as canonical in CLAUDE.md) |
| `SECURITY_HOTFIX.md` | 2026-10-07 | Historical report (Gate 0 B-02/B-03 hotfix) |
| `docs/archive/2026-10/FULL_SURFACE_CONTENT_CHANGE_MATRIX.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (repositioning batch) |
| `docs/archive/2026-10/FULL_SURFACE_REPOSITIONING_AUDIT.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (repositioning batch) |
| `docs/archive/2026-10/GITHUB_AND_DEVELOPER_ECOSYSTEM_POSITIONING.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (repositioning batch) |
| `docs/archive/2026-10/IMPLEMENTATION_AND_VERIFICATION_REPORT.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (repositioning batch) |
| `docs/archive/2026-10/INFRASTRUCTURE_COST_REDUCTION_EXECUTION.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (authored by "Antigravity CLI + Gemini") |
| `docs/archive/2026-10/INFRASTRUCTURE_COST_REDUCTION_REPORT.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (same author) |
| `docs/archive/2026-10/PREVIEW_DEPLOYMENT_AND_VERIFICATION_REPORT.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (repositioning batch) |
| `docs/archive/2026-10/PRODUCT_CAPABILITY_AND_CLAIM_REGISTER.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Report with authoritative intent (claim register) — unverified |
| `docs/archive/2026-10/REFERENCE_SITE_RESEARCH.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (claude.com/anthropic.com IA research) |
| `docs/archive/2026-10/REMAINING_FOUNDER_DECISIONS.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Open-decision list (time-bound) |
| `docs/archive/2026-10/SEO_GEO_AND_MACHINE_DISCOVERY_AUDIT.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (repositioning batch) |
| `docs/archive/2026-10/SEO_GEO_IMPLEMENTATION_REPORT.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (repositioning batch) |
| `docs/archive/2026-10/WEBSITE_CONTENT_CHANGE_MATRIX.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (repositioning batch) |
| `docs/archive/2026-10/WEBSITE_REPOSITIONING_AUDIT.md` (moved from root 2026-10-20) | 2026-10-20 (#547) | Historical report (repositioning batch) |

14 are dated 2026-10-20 (PR #547 `8679dd61`): README plus 13 repositioning/cost reports.

### Config / other root files

| File | Classification |
|---|---|
| `package.json`, `package-lock.json`, `turbo.json`, `tsconfig.json`, `tsconfig.base.json`, `vitest.config.ts`, `.mocharc.cjs`, `.npmrc`, `.nvmrc`, `.dependency-cruiser.cjs` | Config (live). `.mocharc.cjs` has the known `file` bug; API tests run with `--no-config` |
| `railway.json`, `nixpacks.toml` | Config, root-level Railway; per `apps/api/nixpacks.toml` the root nixpacks is not applied to the API service |
| `railway.paperclip.json`, `Dockerfile.paperclip`, `start-cloud.sh` | Config for Paperclip agent service (offline) |
| `Dockerfile.api`, `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.postgres.yml`, `.dockerignore`, `Makefile` | Local dev config; `docker-compose.postgres.yml` has 0 references |
| `foundry.toml`, `foundry.lock`, `remappings.txt`, `.gitmodules` | Contracts toolchain config (`foundry.toml` rpc endpoints target Fuse, not Polygon) |
| `docs.json`, `mint.json` | Mintlify docs config (two generations; only referenced by docs) |
| `.env.example`, `.gitignore`, `.railwayignore`, `.vercelignore` | Config |
| `LICENSE`, `LICENSE.BSL` | Legal |

## 7. Observations (factual)

1. Two Railway configs for the API (root `railway.json` RAILPACK vs `apps/api/railway.json` NIXPACKS) and two `nixpacks.toml`; the in-repo comment states only the `apps/api` pair applies.
2. API has no committed lockfile in `apps/api` (per nixpacks comment); root `package-lock.json` exists for the workspace.
3. `packages/sdk` and `agents/node-agent` have no importers, no tests, and no publish/deploy path.
4. `apps/cms` is built but nothing in `apps/web`/`apps/corporate` consumes it; `packages/content` contains a CMS client with fallback fixtures.
5. `@satelink/web-ui` claims to be shared with `apps/corporate`; no corporate import found.
6. `services/financial` is reached from `apps/api` only through a test file; production API code does not import the Financial-OS packages.
7. CI only runs on PRs (and `develop`, which does not exist); root `npm test` covers `web` only — API mocha runs via the baseline-guard job; Financial-OS via `architecture.yml`.
8. Vendored `apps/api/src/utils/lib/forge-std` (68 files) duplicates the `lib/forge-std` submodule inside the API source tree.
9. No KMS, no A2A, and no multi-provider AI model router exist in code on main.
10. Milestone naming collides: Financial-OS "M7/M8/M9" (reconciler, authorization, schedules) vs target modules M7/M8/M9 here.
