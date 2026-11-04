# Build ledger — Satelink AI Assistance mandate

Read after `MASTER_BUILD_PROMPT.md`, every session. Newest session first. Security findings are
categories only (R14); details in `docs/build/evidence/private/` on the build machine.

---

## ▶ RESUME CAPSULE — Release State A (updated after each phase)
1. Mandate: Release State A master prompt v2026-11-04b + founder conditions 1–6 (2026-11-04).
2. Worktree: `.claude/worktrees/release-a`; stack `build/p0-safety` (#610) → `build/integration-base` (#611) → `build/p2-foundation` → `build/s1-primary-journey`.
3. Last phase done: **S1** (console journey) — local gate met; CI E2E runs pending (two consecutive greens required). P0–P2 done.
4. Last SHA: see `git log -1 build/p0-safety`.
5. Next sub-step: confirm 2 consecutive green CI runs on #616 (Release A E2E + CI) → then **S2** food procurement via MCP (branch `build/s2-food-mcp` from `build/s1-primary-journey`).
6. Open risks: E1 JWT secret + webhooks public (OB-1/2); plaintext signer/treasury keys in local stash (OB-3); single-copy backup (OB-5).
7. Rule: no work touching auth secrets, payment config or production (D-A2); local test credentials only.
8. Backups: never touch `backups/protected/*.dump`, `docs/release/*.dump` (BACKUP_POSTURE.md).
9. Blockers: `OPEN_BLOCKERS.md` (7 open, all FOUNDER).
10. Decisions: `DECISION_LOG.md` (D-A1…D-A5, ADR-1…4).

## Release A — Slice S1 — 2026-11-04
- Console (SATELINK_PREVIEW=1 only): /signup → /onboarding → /assistant → /tasks/[id] (SSE) → /receipts/[id] (JSON/CSV) →
  /wallet (Wallet & Usage) → /explore; SimulationBadge; origin-guarded proxy; Shell "Preview" group; styled 404.
- Auth: the existing Better Auth (magic link) on the local DB with preview-only switches (dev mail sink, host-only cookies,
  per-IP limit off for E2E) — each refused in production (unit test 3/3).
- E2E `tests/e2e/s1-primary-journey.spec.ts` **15/15** at 390/768/1440: journey, supplier failure (no charge), expired quote
  (UI + server), tenant isolation (HTTP 404), axe zero serious/critical on every page. Screenshots `artifacts/screenshots/s1/`.
- Browser restart drill `scripts/preview/restart-drill-browser.sh`: **PASS** (1 order, 1 capture, unknown-outcome recovery).
- Bugs found and fixed: pre-hydration native form submit; cross-tenant 404 served as HTTP 200 (loading boundary; no data
  leaked); axe definition-list; auth rate limit vs E2E; "Satelink Trading AI" branding on preview sign-in.
- Deviations: /wallet (not /usage — existing RPC page); Turnstile not wired (OB-11); stack runs `next dev` locally, `next start` in CI.
- Draft PR #616 (stacked on #612); CI workflow `release-a-e2e.yml`.

## Release A — Phase P2 — 2026-11-04
- Extends #609 (one kernel/journal/run table): 18-state machine (`task_state_machine.js`), migration 043, unified registry
  (`capability_registry.js` + `capabilities.preview.json`), model router (`model_router.js`, **VERIFIED (FIXTURE)**), planner,
  pricing (PROPOSED — NOT APPROVED), sim ledger (ADR-5, parity vs TS), task service/store/step adapter, `/v1` task API
  (preview server only; `app_factory.mjs` untouched), Demo Digital Store (MOCK) as a separate local process.
- Tests: P2 unit 40/40 (mocha); integration 246/246 incl. sim_ledger parity 13/13, task_engine 12/12, tasks_http 7/7
  (one testcontainers port flake, passes on rerun); #609 workflows suites green; API baseline guard 980/973/4 known/3 known
  skips (two earlier guard runs at load avg ~40 showed different timing flakes — each passes in isolation; clean at low load).
- Restart drill `scripts/preview/restart-drill.sh`: kill -9 during EXECUTING → UNKNOWN_EXECUTION_OUTCOME → VERIFYING →
  SUCCEEDED; 1 supplier order, 1 capture, receipt hold+capture, reconcile [] — **PASS ×2**.
- Bugs found by tests and fixed: reconciliation could declare success without verification (state table); BigInt in quote
  lines; task stuck in PLANNING on quote error; supplier error code lost through kernel; unlabelled usage receipt summaries.

## Release A — Phase P1 — 2026-11-04
- Inspected #609 (`83763dab`), #582 (`c6e3556d`), #583 (`4bd3a740`): independent; file overlap only `migrations.integration.test.ts`. Local unpushed `50fe4e24` excluded (D-A6).
- Merged on `build/integration-base` (PR #611). **Semantic conflict**: #583 020 vs main 038 both replace the ledger kind CHECK → renumbered 042 with union (D-A7, `5bc1073a`); proven 1/3 → 3/3.
- Tests (local PG16 + Docker 29.6.2): api baseline guard 940/933/4 known/3 known-pending; integration 214/214; libs 300/300; arch 9/9; depcruise 0; console tsc clean; mcp 8/8.
- Docs: `CURRENT_STATE_AUDIT.md`, STATUS_MATRIX Release A section, ADR-5 (money bridge), OB-8..10. Runtime: `docker-compose.preview.yml`, `scripts/preview/local-db.sh`.

## Release A — Phase PT — 2026-11-04
- Plugins: feature-dev + claude-md-management installed (project); others pre-existing; Superpowers pre-existing from official marketplace; context7 via claude.ai connector. `.mcp.json` not created (Postgres reference server deprecated).
- `.claude/settings.json` deny/allow + 7 hooks, tests `bash .claude/hooks/tests/run.sh` 50/50. CLAUDE.md: root trimmed to 152 + 7 new. 2 skills, 7 agents. Inventory: `TOOLCHAIN_INVENTORY.md`.

## Release A — Phase P0 — 2026-11-04 (Opus 5.5, background job)
- Scanned every object (11,764 blobs) across 1,111 refs incl. 586 PR heads: **no dump content anywhere**; 0 releases / artifacts / Pages.
- Credentials in public history (categories): JWT secret, Slack + Discord webhooks, admin password hash → `SECURITY_INCIDENT_2026-11-04.md`.
- Local-only: stash with plaintext production signer/treasury keys (GitHub 404).
- Guards: ignore files (git/docker/vercel/railway), `check-no-dumps.sh` (9/9 tests), `.gitleaks.toml` (positive-control tested), pre-commit + CI gitleaks on new commits.
- Docs: `SECURITY_AND_FINANCIAL_PATH_AUDIT.md` §P0, `BACKUP_POSTURE.md`, `DECISION_LOG.md`, `OPEN_BLOCKERS.md`.

## Session B2 — 2026-11-03 Beta: persistence, independent review, MCP, suppliers (Opus 5.5, background job)

Scope: founder briefs "B2 — Stabilize, Persist, Review and Complete" + "PR #609 release readiness". Branch
`feat/beta-unified-workflow`, PR #609 (draft). No merge, deploy, env change, paid call, publish or message sent.

### Privacy incident (commit `5f08020a`, public repo)
Third-party business email addresses (a dRPC staff member, another company that wrote to dRPC) and the fact that a
reply was misaddressed were committed; redacted in `aa6435df`, still in branch history. **No credentials, tokens or
secrets → no rotation needed.** Severity low/low-medium. Cleanup plan (needs approval): squash-merge #609 so main
never contains it, delete the branch; full purge = rebase + force-push + GitHub Support for cached PR refs.

### Delivered
| Commit | What |
|---|---|
| `d0b2bdca` | Migration 041 (`wf_*` kernel store + owner-scoped read model; usage never revenue; append-only receipts/journal) + `PgDurableStore` prefix |
| `a617b16f` | `run_store.js` (Memory/Pg), Postgres wiring, boot `recover()`, receipts/strategies endpoints; **all HIGH/MED review fixes** (except M8) with regression tests that fail on the pre-fix commit |
| `13269b5e` | MCP workflow tools (8, opt-in, caller-scoped, approval cap), OpenAPI 3.1 + drift test, saved strategies + `/api-mcp` console page |
| `6dcb4b17` | Browser E2E (journeys A–D, mobile, auth) + after-restart phase |
| (this) | Supplier catalog evidence, docs |

### Tests
- API workflows: 40/40 memory + 8/8 Postgres (mutation-checked: SQL CAS, recovery). MCP: 8/8.
- Full apps/api suite, same local DB: branch 916/867/50 vs pristine main 868/818/51 — zero failures unique to the branch.
- Console: tsc + eslint clean. Browser E2E phase 1: 8/8; API restarted on the same DB → phase 2: 1/1.
- Not run locally: migration integration tests (testcontainers; no Docker, F19) — CI.

### Findings
- Railway: only `satelink-reconciler` is in `europe-west4`; API/Postgres/Redis remain `us-west2`.
- Space Command Kits previews fail because their workers' free Base RPC (`mainnet.base.org`) returns 429 to Cloudflare egress (200 from Satelink's network). Not a Satelink defect.
- FreeTier: public catalogue 83 paths / 74 MCP tools; two free calls 200, balance matched on-chain. Same operator signal. 0.5% share not accepted.
- dRPC: corrected enquiry saved as a Gmail **draft** to dRPC (unsent).

### Founder actions added
- F30 Apply migrations 040 + 041 in production when the beta goes to staging/production (review first).
- F31 Send (or edit) the dRPC draft; reply to Space Command (test keys, 120 s vs 300 s timeout, Base RPC dependency).
- F32 Choose the Strategy Lab data licence (CoinGecko paid tier first) and approve/adjust the pricing proposal.
- F33 Decide MCP publication scope (BETA_RELEASE_CHECKLIST).
- F34 Approve the privacy cleanup plan above (or accept squash-merge-only).

---

## Session B1 — 2026-11-03 Customer beta: one workflow foundation for trading + procurement (Opus 5.5, background job)

Scope: founder mandate "MASTER PRODUCT RECOVERY, UNIFICATION & BETA LAUNCH". Branch `feat/beta-unified-workflow`
(worktree `.claude/worktrees/beta-unified`), base `origin/main` `dd279db4` = production `/health.commit` (verified).
Customer-journey matrix: `BETA_READINESS_MATRIX.md`. Suppliers: `SUPPLIER_INTEGRATION_STATUS.md`.

### Verified state (read-only)
- Railway: Satelink-api, Postgres, Redis, reconciler all deployed in **`us-west2`** (manifests 2026-11-02 23:18 UTC). The brief's "moved to Europe" is not reflected; Binance 451 from the API still applies.
- Prod: `/health` ok @ `dd279db4`; anon `/rpc/polygon` → JSON-RPC `-32005` with x402 + deposit instructions.
- Supplier mail (read-only): Space Command Kits and FreeTier share sender domain `mail.grokbot.com`; the founder's dRPC answer did not reach dRPC (misaddressed; detail in `evidence/private/`).
- Space Command Kits zero-cost probes: manifests 200; unpaid → 402 v2 (Base+Polygon USDC, $0.005, timeout 300 s ≠ claimed 120 s); Polygon → 503 paused; free previews 503/502 (their Base RPC 429). No paid call.

### Delivered
| Commit | What |
|---|---|
| `d13fab1a` | `apps/api/src/workflows/*`: supplier catalog → vNext SupplierRegistry; NL strategy compiler (`satelink.strategy/v1`); kernel workloads `trading.strategy_evaluation` (real walk-forward engine) and `procurement:<capability>`; quote → approval → execute → verify → receipt; `WithheldSettlement` (charge 0, no money moved, not revenue); `/v1` router inert unless `WORKFLOWS_BETA_ENABLED=true` |
| `7bdbb129` | Console `/strategy-lab`, `/marketplace`, `/marketplace/[id]`, `/workflows`, `/workflows/[id]` (flag-gated nav); console-session principal with existing `csrfGuard`; local preview (`scripts/preview/beta-preview.sh`) |
| (docs) | BETA_READINESS_MATRIX, SUPPLIER_INTEGRATION_STATUS, REVENUE_EXPERIMENT_PLAN, BETA_RELEASE_CHECKLIST, ACCEPTANCE_TESTS §Customer journeys |

### Tests
- `workflows_beta.test.js` 31/31; mutation checks: removing the result verifier → 2 fail; removing the journal-payload clone → 2 fail (chain breaks on restart).
- Full apps/api suite, local PG, branch vs pristine `origin/main` worktree with identical env: main 868/819 pass/50 fail; branch 898/848/51. Only diff = `identity rate limits … same Vercel IP` (known flake; 17/17 ×3 on rerun). The ~50 local failures exist on main too (local DB env), CI uses its own Postgres.
- Console: `tsc --noEmit` 0 errors, `eslint` clean, `next build` exit 0.
- Browser walkthrough (Playwright, desktop + 390 px): Journey A real BTC data, 20/50 SMA → **FAIL** (1/4 windows; +4.02% vs buy-and-hold +49.39%); Journey B real Polygon balance of `0x966E…` (0.2287 POL), receipt charge $0 withheld; token-risk on Base blocked (evaluation). `evidence/beta-preview/`.

### Not done / next (in order)
1. Independent code review of `d13fab1a`/`7bdbb129`; open PR (draft) → founder review.
2. Durable store for workflows (`PgDurableStore` + reviewed migration of `vnext/reliability/schema.sql`) and staging (F3) before any flag-on deploy.
3. Expose the same workflow service as MCP tools; OpenAPI for `/v1/workflows|marketplace|strategy-lab`.

### Founder actions added
- F26 Resend the 2026-11-02 dRPC answer to dRPC's contact (it went only to a third party copied on the thread).
- F27 Reply to Space Command Kits accepting the free test keys (token-risk, bal-check) for a capped 40-call evaluation.
- F28 Decide Strategy Lab data path: licensed vendor vs F22 worker outside the US; until then Strategy Lab is non-commercial preview.
- F29 Approve (or change) list prices before any workflow meter charges (catalog `pricing.approved`).

---

## Session T1 — 2026-10-31 Trading AI: Eulerpool + evaluation harness + go/no-go (Opus 5.5, background job)

Scope: founder prompt "TRADING AI: EULERPOOL DATA + DECISION API GO/NO-GO + BINANCE DEMO EXECUTION".
Branch `feat/trading-eulerpool-demo-broker` (worktree `.claude/worktrees/trading-eulerpool-demo`).
Start: main `88ef1dca` (#600) = deployed `/health.commit` `88ef1dca…`.

### Phase 0
- Railway `Satelink-api` variable NAMES present: `BINANCE_DEMO_API_KEY`, `BINANCE_DEMO_API_SECRET`,
  `EULERPOOL_API_KEY`, `OPENROUTER_API_KEY` (values never read).
- **Geo stop**: from the API container (region `us-west2`) `demo-api.binance.com` ping/time/ticker → **HTTP 451**
  (restricted location). Phases 4 (demo broker) and 5 (forward-test runner) NOT started.
  `evidence/TRADING_GEO_CHECK_2026-10-31.md` (proposal: separate `trading-worker` service in `europe-west4`).
- Reused, not rewritten: services/trading (instrument, providers, SMA, decision-api, 10-gate engine,
  broker-adapter/UnknownOrderReconciler, orchestrator, metering) and the apps/api engine bundle.
  `services/sie` is only in open PR #581; OpenRouter adapter only in draft #579 (other session) — not touched.

### Delivered (code)
| Phase | What | Tests |
|---|---|---|
| 1 | Eulerpool adapter: Bearer-only auth, lossless JSON → bigint, typed errors, bounded retries, 90% quota stop + alert, backtest cache, licensing from `evidence/licences/eulerpool.json` (FREE: internal R&D only; customer use fails closed) | 19 contract + 7 decimal/JSON; opt-in live test |
| 2 | Bar-replay engine (t+1 open fills, fee/spread/slippage, bigint exchange filters), walk-forward ×4 OOS, baselines, metrics, leakage gate, StrategyEvaluation + append-only store; migration 040 (+down, PG test) | 13 unit + 6 PG integration |
| 3 | Go/no-go engine (conditions a–f), Ed25519 founder-signed demo mandate with hard ceiling, model outage → BASELINE_ONLY, append-only decisions | 15 |
| CI | New `trading` job: typecheck, vitest, engine-bundle drift check (trading tests never ran in CI before) | — |

services/trading vitest: 91 → 147 passed, 1 skipped (opt-in live). Independent review (fresh subagent): 0 blockers; 7 should-fix all fixed with regression tests (instrument check on (a), fail-closed expiry, atomic quota reservation, truthful cache timestamps, forming-bar drop, mandate field types, future timestamps). Database integration: 75/75 (local PG 16).
Mutation checks (each test fails on the mutant): t+1 fill, leakage verdict, kill switch, mandate, agreement, quota guard.

### Live checks
- Eulerpool (once, from Railway): all endpoints **HTTP 502** at Eulerpool's edge; build machine invalid-token → 401.
  Auth path unverified. `evidence/EULERPOOL_CONTRACT.md`.
- Binance demo place/query/cancel: not run (geo stop).

### StrategyEvaluation (1d klines 2021-01-01 → 2026-10-30, 4×182-day OOS, fee 10 bps; local test DB, not production)
| Strategy | Symbol | Id | Beat best baseline | Verdict |
|---|---|---|---|---|
| sma-crossover@1.0.0 | BTCUSDT | `eval_1e1d3b6bb51e44e33d2c8e32a99832ed` | 1/4 | FAIL |
| donchian-breakout@1.0.0 | BTCUSDT | `eval_b65c96c6779eaef918727f8c70e8287f` | 0/4 | FAIL |
| sma-crossover@1.0.0 | ETHUSDT | `eval_73e50ca5cec1bddbeda2e5781387c02f` | 2/4 | FAIL |
| donchian-breakout@1.0.0 | ETHUSDT | `eval_9f622e8226fd63a1b6e6b3c8a6f88c03` | 1/4 | FAIL |
Full records: `evidence/trading/STRATEGY_EVALUATIONS_2026-10-31.json`. No PASS → no demo-enable command issued.

### Founder actions added
- F22 Create `trading-worker` Railway service outside the US (recommend `europe-west4`), demo/Eulerpool/OpenRouter vars only; re-probe.
- F23 Apply migration 040 to production (`npx tsx database/runner.ts migrate <url>`) when the worker needs it (F14).
- F24 Generate the founder Ed25519 mandate key; publish the public key id for `trustedMandateKeys`.
- F25 Eulerpool: Free plan is non-commercial — Builder ($990/yr) before any customer-facing use.

## Session 2 — 2026-10-20 P0 close-out (Opus 5.5, background job)

Scope: founder session prompt "P0 CLOSE-OUT (security + money PRs)". Founder answers A1–A3 were
left as unfilled brackets → treated as NOT SURE and verified from evidence.

### Founder answers vs evidence (Step 1) — `evidence/SIGNER_AND_FOUNDER_ANSWERS_2026-10-20.md`
| Q | Evidence | Result |
|---|---|---|
| A1 settlement signer in F1 rotation | `ClaimsContract` `0x6987…1CC9` `platformSigner` = `0x966E…7Ad4` at every sampled block since deploy (86,985,310, 2026-05-16); holds 4.281768 USDT; admin = EOA `0x3b32…667A` | **On-chain signer not rotated** → F21 OPEN-CRITICAL |
| A2 `DATABASE_URL` uses `satelink_app` | username part = `postgres` | **NO** (F1 follow-up open) |
| A3 `ADMIN_API_KEY` set | name absent from 104 Satelink-api variables | **NO** (routes using it fail closed 503 after #553) |
Legacy push-model contract `0xE475…3fb0` holds 4.930838 USDT (no withdraw path).

### Merges (Step 2) — each: update on main · fresh-subagent review · regression test fails on old / passes on new · CI green with counts · blast radius · R7 before/after · prod probe
| PR | Squash SHA | Review fixes applied | Old→new test | CI api tests (tests/pass/fail/pending) | Prod probe after deploy |
|---|---|---|---|---|---|
| #549 claims signing | `7581f207` | signer-level dry-run refusal; wallet validation; token-unset/recovery/refusal tests | 4/4 fail → 7/7 pass | 648/478/2/168 (main 641/471/2/168) | anon, non-staff Bearer, wrong x-admin-token → 401 |
| #553 fail-closed admin | `d051e4df` | parity gate `app.use` (all methods + sub-paths); order-independent dodo test | 5 fail → 21 pass | 669/499/2/168 | parity GET/POST 401 (was 200); node-token 404; reputation 503; PATCH node 403 |
| #559 SEC-4 money reads | `839e3497` | + `/system/settlement-anchor`, `/system/epoch-scheduler`; HEAD test | 11/11 fail → 14 pass | 683/513/2/168 | 10 money routes 401 (were 200); `/system/free-tier`, `/api/nodes` 200 |
| #561 secret-scan placeholder | `fc20d858` | — (Step 3) | 6 node:test | required green | R7 OK after 19:39 deploy |
| #555 S6 truth | `d214ec62` | predicate also feeds admin `consumed_usage`; parens; real-SQL test (local PG, mutation-checked) | old lacks predicate → 2+1 pass | 686/515/2/169 (+1 = new real-SQL test, skips without PG in CI) | tests only (no prod DB); `/api/financial/truth` + `/admin/financial/metrics` stay 401 |
| #551 S4 public revenue | `b1d6f5f7` | `/api/diagnostics` fixed error string | 5/8 fail → 8 pass | 691/521/2/168 | `/api/economics/summary` money fields null (was 20.52582); `/api/diagnostics` `totalRevenueUsdt` null (was 20.18); `/api/revenue`, `/revenue/events`, `/epochs` 401 (were 200) |

All R7 checks green before and after every merge. No revert needed.
Failures in every run = the two allowlisted x402 t2/t9. The 165–169 pending tests are DB-backed
suites that skip without Postgres (console_accounts 25, console_onboarding 18, console_alerts 17,
pricing_v2_lifecycle 13, s1_wallet_binding_security 12, legacy_dodo_subscription_bucket 10,
x402_rail 10, x402_session_key 10, pricing_v2_metering 8, x402_recover_hardening 7, +10 smaller) → Step 5.2.

Vercel: all three projects report "Deployment rate limited — retry in 24 hours" since ~16:10 IST.
Web-side changes in #559/#551 reach production only after the limit resets; until then the internal
monitoring page shows `$undefined` for vault balance (cosmetic, internal page).

### Review follow-ups not fixed (tracked)
- Claims: same UNPAID balance can be signed repeatedly (no reservation); `allocate-earnings` sums without `is_test_data=false`; float amounts. **Must fix before `SETTLEMENT_DRY_RUN=0`.**
- `node_operator` JWTs minted by the removed node-token route stay valid up to 7 days → founder decides `JWT_SECRET` rotation (F18).
- SEC-4b: `GET /api/nodes/:nodeId` exposes payout wallet + endpoint IP (no frontend callers); gate needs care because `:nodeId` patterns also match sibling GETs.
- S6: denylist predicate is fragile (x402 bundles share `op_type='rpc_call'`); `SUM(real)` drift if `amount_usdt` is REAL (F16).
- `/api/diagnostics` handler test is source-scan only.

### Step 3 / Step 5 / hygiene (same session)
| Item | PR | State | Evidence |
|---|---|---|---|
| Secret-scanner masked-placeholder allowlist + tests (no more `--no-verify`) | #561 | merged `fc20d858` | 6 node:test; E2E: placeholder passes, real-format key + PEM blocked |
| Docs: F21 evidence, A1–A3, merge ledger, signer-rotation runbook | #562 | merged `38d04d58` | docs only |
| 5.1 TI prices withheld from machine-readable surfaces until F8 | #563 | merged `ca1b0e14` | API `/v1/pricing`, `/.well-known/x402`, `/.well-known/satelink.json`: 0 TI-price hits after deploy. Web half (llms.txt, pricing.json, JSON-LD) ships when the Vercel rate limit resets |
| 5.2 DB-backed API tests in CI (Postgres service) + unexpected-skip gate | #564 | merged `1102d2b1` | CI: 694 tests, 687 pass, 4 listed failures, 3 listed skips (was 168 silent skips). Gate caught 3 real skips on first run (fixed) |
| 5.3 Refund on upstream failure for paid RPC (legacy gate pre-deduct; post-charge isolation) | #565 | **open, founder-review (money path)** | 10 tests (5/6 original fail on main); fresh-subagent review: no blockers, fixes applied |
| Repository hygiene: 14 #547 root reports → `docs/archive/2026-10/`; Paperclip deploy files deleted | #566 | open | `REPOSITORY_CLEANUP_REPORT.md`, tag `archive/pre-cleanup-2026-10-20` |

### Process incident (this session)
A zsh word-splitting bug in a helper loop ran `git merge origin/main` in the shared main checkout
(conflict in `packages/sdk/README.md`) and created one stray symlink. Detected immediately:
the other session's unstaged `apps/mcp-server/package.json` change was backed up, verified untouched
by the merge, `git merge --abort` restored the exact prior state, symlink removed. Helpers now run
under bash with an explicit `cd`/`pwd` guard.

---

## Session 1 — 2026-10-20 (Opus 5.5, background job)

### Environment (Step 0.1)
- Node v24.13.0, npm 11.6.2. `gh` account `satelinkinternet-collab` (scopes repo, workflow, read:org, gist).
  Remote `origin` = github.com/Jakuraa/Satelink_Network; a `gitlab` remote also exists.
- Railway CLI linked to project `Satelink-api`, env `production`, service `Satelink-api` (104 variables; names only read).
- Main checkout `/Users/pradeepjakuraa/satelink` is on `feat/evidence-led-repositioning` with an uncommitted
  `apps/mcp-server/package.json` change **not created by this session**. Left untouched. Work happens in worktrees.
- ~45 worktrees under `.claude/worktrees/` and job tmp dirs; 11 stashes (none created by this session). Not modified.
- Founder statement (2026-10-20, in the mandate message): **"Part D are cleared (rotated, Paperclip decommissioned)"**.
  Recorded as founder evidence; it feeds B-01/B-02/B-03/B-04 updates in W8 and the Paperclip file removal in W10.

### Production probes (Step 0.6, 2026-10-20 ~05:26 IST)
```
GET  api/health                      200  {"ok":true,"db":"ok"}
GET  api/api/status                  200  operational, total_requests_24h 96013
POST api/rpc/polygon (anon)          402  x402Version 2
GET  api/admin/executive/summary     401
GET  api/.well-known/satelink.json   200  "Satelink RPC Gateway" (DePIN framing)
GET  api/.well-known/agent-card.json 404
GET  api/.well-known/x402            200
GET  api/v1/capabilities             200
GET  api/v1/pricing                  200  price_per_call_usdt 0.00003
GET  api/v1/models                   200  llama3 model list        ← old AI gateway MOUNTED
POST api/v1/chat/completions         401  "API key required"       ← old AI gateway MOUNTED
GET  api/api/economics/summary       200  totalRevenueUsdt 20.52582 ← S4 live
GET  api/api/financial/truth         401
GET  api/api/public/stats            200  6 fields, no money
GET  api/v1/openapi.json             404
POST api/api/bandwidth/proxy {}      400  (mounted, unauthenticated)
satelink.network                     200 · /llms.txt 200 · /robots.txt 200 · /.well-known/security.txt 404
jakuraa.com 200 · console 307 · admin.satelink.network 404 · developer.satelink.network 307→error · app.satelink.network error
npm view satelink-mcp                E404 (not published)
```
Railway flags (values read only for these non-secret flags): `SETTLEMENT_DRY_RUN=1`, `LEDGER_SHADOW_WRITE=1`,
`X402_ENABLED=true`, `CONSOLE_ACCOUNTS_V1=true`, `AUTH_ENABLED=true`; absent: `SATELINK_SUBSCRIPTIONS_ENABLED`,
`VNEXT_KERNEL_ENABLED`, `PAYMENTS_V1`, `TRADING_AGENT`, `ADMIN_BACKFILL_SECRET`.
RPC upstream variable names: `ALCHEMY_API_KEY`, `ALCHEMY_POLYGON_KEY`, `ANKR_API_KEY`, `DEPOSIT_LISTENER_RPC_URL`,
`POLYGON_RPC_URL`, `LLAMARPC_POLYGON_DISABLED` (free-endpoint inventory needs the code defaults → W1).
Not done yet: Cloudflare WAF read, Vercel production SHA vs main.

### Contradictions with the mandate's §3 context
1. "Old AI gateway recorded as unmounted on Oct 15": **false**, it was live (see probes). Fixed by PR #548.
2. "`LEDGER_SHADOW_WRITE` production state UNVERIFIED": the flag is `1` in Railway. Drift is still unverified.
3. "Flaky `x402_shadow_atomicity` test": exists only on `platform/wave1-payments` (#520), not on main → fix during the W4 rebase.
4. `docs/build/` was gitignored by the generic `build/` rule. Negated in the W0 PR.

### Step 0 evidence files
- `docs/build/evidence/REPO_MAP.md` (committed).
- `docs/build/evidence/private/{ROUTES,MONEY_PATHS,DUPLICATES}.md` (gitignored, contain unfixed security detail).
- `docs/build/evidence/BASELINE.md`: see the W0 PR for its status.
- `docs/build/STATUS_MATRIX.md` (committed).

### Security findings (categories only)
| ID | Category | State |
|---|---|---|
| SEC-1 | Payout-signing route reachable with a weaker credential than staff auth | Fix PR #549 (founder-review). F21: signer rotation decision |
| SEC-2 | Unauthenticated outbound-fetch workload | Removed in PR #548 |
| SEC-3 | Relabelled-model inference surface (R4) | Removed in PR #548 |
| SEC-4 | Public revenue figures (S4) and sibling public money reads | #551 (revenue routes + diagnostics); treasury, settlement history, node earnings, `/os/events`, `/system/*` reads still open → W1 next |
| SEC-5 | Unauthenticated internal parity / deposit-notify / node register-heartbeat endpoints | parity → #553; deposit-notify, node register/heartbeat still open → W1 |
| SEC-6 | Admin checks that open when an env var is unset; non-constant-time admin compare | #553 (both, incl. `requireAdminAuth`) |
| SEC-7 | Unproven node-token minting with hard-coded fallback secret | #553 (unmounted). F18 |
| SEC-8 | Settings allow-list escapable by prefix-matched Bash rules (background review) | fixed in #550 |

### Baselines (Step 0.8) — `evidence/BASELINE.md`
- apps/api mocha, CI mode: 639 tests, ~471 pass, 2 fail (allowlisted x402 t2/t9), **165 skip silently** (no DB).
  `ci-baseline-check.sh` is green partly because DB tests skip; 19/21 allowlist entries are stale.
- apps/api with a full local DB: 632 pass / 4 fail / 3 skip. Real drift: console-onboarding test expects Pro yearly 190,
  catalog gives 120 → founder price decision (F8), not allowlisted.
- Flaky: identity rate-limit burst tests (~1 in 5 on macOS). Latent: migration-035 BIGSERIAL id string-vs-number.
- Root vitest: libs 274/274, tools 9/9, workers 16/16, packages 9/9. apps/web vitest 257/257. mcp-server 2/2.
- `database/runner.ts migrate` stops at 014 on an empty DB (`revenue_events_v2` is created by API boot, not a migration).
- Integration suites (testcontainers) need Docker; not run locally (16/20 files could not start a container).
- CI never runs: DB-backed api tests, Playwright e2e, packages/content + packages/seo typechecks (both red), mcp-server tests on PRs.

### CI as a real gate (W0, PR #552)
Unmasking found: 63 hidden `apps/web` TS errors (several live UI bugs, incl. a pricing-page ReferenceError and every
formatted admin table column rendering raw values), lint never actually running for any app (web `echo Skipped`;
console/corporate stuck at the ESLint setup prompt), and install-layout issues (`next` is per-app, not root).
All fixed in #552; `ignoreBuildErrors` removed; console/corporate typecheck + lint added.

### PRs this session (state at checkpoint 2026-10-20 ~14:35 IST)
| PR | What | State | Production evidence |
|---|---|---|---|
| #548 | Remove relabelling AI gateway + bandwidth proxy; guard test | **merged** c12e1960 | `/v1/models`, `/v1/chat/completions`, `/v1/ai/status`, `/api/bandwidth/proxy` → 404; `/v1/pricing`, `/v1/capabilities`, `/v1/tools/langchain`, `/v1/plans` → 200; R7 OK |
| #550 | W0 foundation: mandate, ledger, matrix, D14, CLAUDE.md pointer, settings, baseline | **merged** 8453eaf0 | docs only |
| #552 | CI as a real gate; 63 TS errors fixed; real lint; `ignoreBuildErrors` removed | **merged** 5577460a | all 5 deploys success; R7 OK |
| #554 | Remove false/unmeasured site claims; claims-lint `UNMEASURED_CLAIM` rule | **merged** 4b13844f | jakuraa.com: 0 hits for each removed claim; "Payments live" 1; /research lists x402-kit; satelink.network media section gone |
| #556 | Real lint for apps/web (`no-explicit-any` warn in web only: 184 `any`s = debt) | **merged** 2b066328 | build green |
| #557 | `apps/api/package-lock.json` + CI "API deploy install" job (D15) | **merged** 58d5996b | first lockfile deploy: see next session check |
| #549 | Claim signing staff-only + dry-run-aware; review fixes (no JWT, success-path test) | open, `founder-review` | — |
| #551 | S4 public revenue routes + `/api/diagnostics` revenue leak (review BLOCKER fixed) | open, `founder-review` | — |
| #553 | Fail-closed admin secrets; digest compare incl. `requireAdminAuth`; node-token unmounted; parity staff-only (real routing tests) | open, `founder-review` | — |
| #555 | S6 consumed-usage predicate (+x402 bundle purchases, NULL-safe op_type); Q5 aligned | open, `founder-review` | — |

Code review (§12) ran over #549/#551/#553/#555; every BLOCKER/SHOULD-FIX was applied and summarised as a PR comment.
Merge policy: self-merge only non-`founder-review` PRs, CI green under the real gate, R7 before and after each merge.

### Founder actions (F-list, cumulative; F1–F14 canonical from `AUDIT_2026-10-20.md` Part D)
| F | Action | State |
|---|---|---|
| F1 | Rotations (Discord webhook, Railway `ADMIN_SECRET_TOKEN`, Vercel admin token, Paperclip `ANTHROPIC_API_KEY`, Alchemy key); API `DATABASE_URL` → `satelink_app` role | Reported cleared by founder 2026-10-20. **Session 2 evidence: `DATABASE_URL` user is still `postgres` (not `satelink_app`) → open.** On-chain claims signer not rotated → F21. |
| F2 | Decommission Paperclip service + Paperclip-DB (dump first) | **Reported cleared by founder 2026-10-20** → unblocks Paperclip file removal (W10) and B-04 |
| F3 | Staging environment (Railway env + Postgres + Vercel preview) | open (B-06) |
| F4 | Managed KMS + isolated signer + static egress IP | open (B-08) |
| F5 | Legal/CA opinion: VDA execution (FIU-IND/PMLA), GST, FEMA, refund policy L1–L10 | open (#525) |
| F6 | Licence: MIT vs BSL | open (B-11) |
| F7 | Invoice Safe address | open |
| F8 | Confirm prices (D13 vs Pricing V2 vs per-call). Specific conflicts: Pro yearly $120 (catalog) vs $190 (docs/test); INR rates ₹52.6–₹84; Max $79 below Max 5× allowance; TI Starter Pack | open |
| F9 | Fiat provider approval with an accurate business description | open |
| F10 | Google OAuth verification (+ Gmail security assessment) | open |
| F11 | Model provider production keys + spend limits | open |
| F12 | `npm publish satelink-mcp` | open (still E404) |
| F13 | Binance eligibility / programme terms; testnet keys in `trading-testnet` env | open |
| F14 | Apply reviewed production migrations | as needed |
| F15 | GitHub branch protection: `enforce_admins` + 1 required review | open (B-10) |
| F16 | `\d revenue_events_v2` via sat-db → paste `amount_usdt` type | open (B-07) |
| F17 | Review + merge founder-review PRs #549 (first), #551, #553, #555, #559. After #553, `POST /rpc/keys` and node reputation update return 503 until `ADMIN_API_KEY` is set (intended) | **Merged under founder session authorization (session 2)**: #549 `7581f207`, #553 `d051e4df`, #559 `839e3497` #555 `d214ec62`, #551 `b1d6f5f7`. `ADMIN_API_KEY` confirmed absent → those two routes 503 (verified) |
| F18 | Confirm production `JWT_SECRET` ≠ the fallback literal in git history (deleted `node_auth_route.mjs`) | open. `JWT_SECRET` is set (name only). Node-token route now 404 (#553); tokens it minted stay valid ≤7 days → rotate `JWT_SECRET` if any were issued (logs older than ~15 min are not retained) |
| F19 | Docker Desktop on the build machine (or a CI DB) for integration suites | open |
| F20 | RPC upstreams: Alchemy + Ankr resale terms; approve keyed Ankr as paid fallback, then drop free public endpoints from billed traffic (`evidence/RPC_UPSTREAMS.md`) | open |
| F21 | Settlement signer: rotate if not in F1's set (it was reachable via SEC-1 until #549 merges); check on-chain whether the claims contract holds funds | **OPEN-CRITICAL.** `0x6987…1CC9` still accepts `platformSigner` `0x966E…7Ad4` (= treasury/x402 payTo), unchanged since deploy; holds 4.281768 USDT; admin is EOA `0x3b32…`. Runbook prepared: `runbooks/SIGNER_ROTATION.md` (not executed). #549 now refuses signing (staff + dry-run) |

### Next actions (in order)
1. Verify the first lockfile-based API deploy (#557): Railway status success + R7 + `/health` uptime reset.
2. W1: remaining public money reads (SEC-4) and unauthenticated deposit-notify / node register-heartbeat (SEC-5) — check the self-heartbeat caller before gating heartbeat. founder-review.
3. W1: S6b epoch_scheduler split filter (settlement path; founder-review); RPC upstream inventory DONE (`evidence/RPC_UPSTREAMS.md`, F20) → refund-on-upstream-error fix; Cloudflare WAF read + proposal; `satelink-mcp` publish prep (F12).
4. W0: Dependabot #546 after real-gate CI; DB-backed API test job in CI (165 silently skipped tests); packages/content + packages/seo typecheck; prune stale allowlist entries.
5. W2: Capability Registry v3 (after F8 price decisions are requested in one founder brief).
