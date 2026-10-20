# Local Test Baseline (W0)

- **Recorded:** 2026-10-20 (local macOS, Node v24.13.0; CI uses Node 22)
- **Tree:** `chore/mandate-w0-foundation` @ `c937826e` (based on `origin/main` @ `8679dd61`), clean working tree, `node_modules` from the earlier `npm ci`
- **Safety:** no `.env` was sourced, and no `.env` file exists in this worktree. Every command ran with `REDIS_URL`, `DATABASE_PUBLIC_URL` and `POSTGRES_URL` unset. `DATABASE_URL` was either unset, the CI dummy `postgresql://ci:ci@127.0.0.1:54329/ci_test` (nothing listens on that port), or a local throwaway database on `localhost:5432`. Both throwaway databases (`satelink_baseline_tmp_1792462868` and `satelink_baseline_tmp_schema_1792463200`) were **dropped** at the end. No remote host was contacted for any database.
- **Raw logs:** `docs/build/evidence/baseline-logs/` (gitignored, each log ≤200 lines). The `05:xx` files come from the earlier attempt; the `07:5x` files come from this run.

## 1. Summary table

| # | Suite | Env | Pass | Fail | Skip | Duration | Log |
|---|---|---|---|---|---|---|---|
| 1a | apps/api mocha (639 tests) | CI mode: dummy unreachable DB | 470–472 | 2 (+2 flaky) | 165 | 10s | `api-mocha-ci-mode.log` |
| 1b | `scripts/ci-baseline-check.sh` (the CI guard) | CI mode | 472 | 2 (both allowlisted) | 165 | 11s | `ci-baseline-check-script.log`: **exit 0**, "17 known-failing now pass" |
| 1c | apps/api mocha | local throwaway DB, **empty** (no schema) | 491 | 34 | 100 (621 collected) | 11s | `api-mocha-localdb.log` |
| 1d | apps/api mocha | local throwaway DB + `test/schema/billing_test_schema.sql` | 534 | 3 (+2 flaky) | 100 | 13s | `api-mocha-localdb-billing-schema.log` |
| 1e | apps/api mocha | as 1d + `CONSOLE_ACCOUNTS_TEST_DB` set to the same local DB | **632** | **4** | 3 | 16s | `api-mocha-localdb-full-optin.log` |
| 2a | root vitest `--project libs` | no DB | 274 | 0 | 0 | 6s | `vitest-libs.log` |
| 2b | root vitest `--project tools` | no DB | 9 | 0 | 0 | 4s | `vitest-tools.log` |
| 2c | root vitest `--project workers` (workers/reconciler unit) | no DB | 16 | 0 | 0 | 2s | `vitest-workers.log` |
| 2d | root vitest `--project packages` | no DB | 9 | 0 | 0 | 3s | `vitest-packages.log` |
| 2e | `database/runner.ts migrate` | local throwaway DB | 001–013 applied | **014 fails** | 015–019 pending | ~2s | `database-migrate-localdb.log` |
| 2f | root vitest `--project integration` (all 20 files) | `TEST_DATABASE_URL` set to the local DB with the marker; **no Docker daemon** | 30 | 4 tests / 16 files | 113 | 9s | `vitest-integration.log` |
| 2f.1 | ↳ apps/api capacity (2 files) | same | 0 | 2 files | 21 | — | testcontainers: "Could not find a working container runtime strategy" |
| 2f.2 | ↳ services/financial (12 files) | same | 29 (4 in-memory contract files) | 8 files | 52 | — | same |
| 2f.3 | ↳ workers/reconciler (1 file) | same | 0 | 1 file | 12 | — | same |
| 2f.4 | ↳ database/__tests__ (4 files) | same | 1 | 3 tests / 4 files | 28 | — | same |
| 2f.5 | ↳ tools testcontainers smoke | same | 0 | 1 | 0 | — | same |
| 2g | apps/web `npm test` (vitest, CI=1) | no DB | 257 (21 files) | 0 | 0 | 4s | `web-vitest.log` |
| 2h | root `npm test` (turbo → web:test, the CI "Tests" job) | no DB | 257 | 0 | 0 | 102s (turbo builds dependencies first) | `root-npm-test-turbo.log` |
| 2i | apps/mcp-server `node --test` | no DB | 2 | 0 | 0 | 1s | `mcp-server-node-test.log` |
| — | packages/sdk `vitest run` (earlier attempt, re-confirmed) | — | 0 | exit 1 | — | 2s | `sdk-test.log`: "No test files found" |

Static checks from the earlier attempt (logs only, not re-run): `npm run arch` 0 violations; `typecheck:libs` and `typecheck:workers` exit 0; `test:arch` exit 0; claims-lint for web and corporate exit 0. **`apps/web tsc --noEmit` exits 2 with 63 TS errors** (`web-tsc.log`). **`packages/content` and `packages/seo` typecheck both exit 2** (for example a duplicate key at `packages/content/src/navigation.ts:307`).

## 2. Failing tests: likely reason and candidate allowlist

### apps/api mocha

| Test (mocha fullTitle, abbreviated) | Env | Likely reason | Recommendation |
|---|---|---|---|
| `x402 payment rail t2` (402 carries x402 accepts) | all | `body.accepts` is undefined because building the x402 `accepts` needs the CDP facilitator `/supported` call (creds) | Keep allowlisted (already listed) |
| `x402 payment rail t9` (keyless 402 upgraded) | all | Same as t2 | Keep allowlisted (already listed) |
| `x402 … ledger integrity + bundle credits t13` | DB envs (1d, 1e) | Same as t2 (fails at the `accepts` assertion) | Already listed |
| `console onboarding — … review requires the recurring-charge authorisation…` | 1e only | Fixture or test drift: it expects `pro_yearly` amount **190**, the code records **120**. This is likely Pricing V2 drift from #547 / `b85914eb` "plan allowance alignment". **Real regression candidate**, not an allowlist item | Fix the test or the code. Do not allowlist |
| `identity rate limits … 301st call → 429`, `… list-sessions and list-accounts share…`, `… 601st read → 429`, `… bucket memory is capped` | random (1 in 5 runs of the file in isolation) | `expected 403 to equal 200` / `socket hang up` partway through a burst of 300–600 supertest requests. No `403` exists in `src/auth/{client_ip,session_read_limit}.mjs`, so it is likely macOS ephemeral-port/listener churn (supertest opens a new server per request). Not reproduced in CI | **Flaky.** Do not allowlist by title. Make the test reuse one `app.listen()` server instead |
| 34 failures in 1c (`relation "api_credits" / "payment_sources" / "api_deposits" / "revenue_events_v2" does not exist`, then `current transaction is aborted`) | 1c only | Empty DB: the app schema comes from boot-time bootstrap, not from any migration runner. Fixed by applying `apps/api/test/schema/billing_test_schema.sql` (1d) | Environment issue. Document the provisioning step; no allowlist |
| `035 — payment_sources.source CHECK allows dodo … the Dodo insert SUCCEEDS` | 1c only | `expected '2' to be a number`: the test creates `id BIGSERIAL`, and node-pg returns int8 as a string. Latent test bug, masked in 1d/1e because the schema file's table wins | Fix the assertion (`Number(id)`) |

**The allowlist is mostly stale for CI.** `apps/api/test/known-failures-baseline.txt` has 21 entries. In CI mode only **2** of them still fail (x402 t2 and t9). The guard reports that the other 17 "now pass", but they actually **skip**: every DB-dependent suite calls `this.skip()` when it cannot connect. With the full local DB (1e), the old "pre-existing 9" all pass: DepositListener, EpochScheduler, instant-key t1–t3, and the Withdrawal API (which skips unconditionally).
- **Candidate allowlist after pruning:** x402 t2, t9 and t13 (all need CDP creds). Everything else can come out.

### Integration / migrations

| Item | Reason | Recommendation |
|---|---|---|
| All 16 testcontainers-backed files (apps/api capacity ×2, services/financial ×8, reconciler ×1, database ×4, tools smoke ×1) | Docker Desktop is installed but its daemon is not running on this machine. Every file starts its own `PostgreSqlContainer`, and none of them use `TEST_DATABASE_URL`. The `TEST_DATABASE_URL` + `__test_db_marker` guard passed | Environment issue. Re-run with Docker up for a real local number |
| `database/runner.ts migrate` fails at `014_revenue_is_billable.sql` (`relation "revenue_events_v2" does not exist`) | Known infra gap (documented in architecture.yml): migrations 014+ depend on a table that only apps/api boot creates | The CI integration job is `continue-on-error` for this reason. Fix it at the source (a migration or harness bootstrap), not by allowlisting |
| packages/sdk `vitest` exit 1 | No test files | Add `--passWithNoTests` or a test |

## 3. What CI runs and what it does not

**Runs** (on PRs to `main`):

| Workflow / job | What it runs | Blocking? |
|---|---|---|
| `ci.yml` → `baseline` | `scripts/ci-baseline-check.sh`: prod-guard self-check, then apps/api mocha with the dummy unreachable DB, diffed against the allowlist | Yes. But ~165 DB tests silently skip, so it does **not** exercise billing, x402, C1, P0-wallet-auth or the console suites |
| `ci.yml` → `test` | root `npm test` = `turbo test --filter=web` → apps/web vitest | **Effectively no.** The command is piped `\| tail -20` under the default `bash -e` (no `pipefail`), so a test failure exits 0 |
| `ci.yml` → `check` | `apps/web tsc --noEmit \| head -20` (also masked; the 63 errors pass today), lint (`continue-on-error`), claims-lint for web and corporate (blocking) | Claims-lint only |
| `ci.yml` → `build` | `next build` for apps/web | Yes |
| `architecture.yml` → `enforce` | depcruise, typecheck:libs, typecheck:workers, `vitest --project libs`, `vitest --project tools` | Yes |
| `architecture.yml` → `integration` | `vitest --project integration` with Docker and testcontainers | **No** (`continue-on-error: true`) |
| `publish-mcp.yml` | apps/mcp-server `npm test` | Only on `satelink-mcp-v*` tags or manual dispatch, never on PRs |

**Not run on PRs at all:**
- `vitest --project workers` (workers/reconciler unit, 16 tests). Only its typecheck runs.
- `vitest --project packages` (content, seo and web-ui, 9 tests).
- `packages/content` and `packages/seo` typecheck (both currently red).
- apps/mcp-server node:test.
- packages/sdk (it has no tests).
- The ~165 DB-dependent apps/api mocha tests. These would need a real Postgres service plus `billing_test_schema.sql` plus `CONSOLE_ACCOUNTS_TEST_DB`, which together give 632/639 passing locally.
- apps/web Playwright e2e (11 files).
- `database/runner.ts migrate` (only the non-blocking integration job touches it, indirectly).

`health-check.yml` (cron), `release.yml` (tags) and `deposit-reconciliation-manual.yml` (manual) run no test suites.

## 4. Reproduce

```bash
# from apps/api; never source .env
env -u REDIS_URL -u DATABASE_PUBLIC_URL -u POSTGRES_URL NODE_ENV=test JWT_SECRET=<64 chars> \
  DATABASE_URL=postgresql://localhost:5432/<throwaway> CONSOLE_ACCOUNTS_TEST_DB=postgresql://localhost:5432/<throwaway> \
  npx mocha --no-config --exit --require test/_guard/prod_db_guard.cjs 'test/**/*.test.js'
# provision first: createdb -h localhost <throwaway> && psql -h localhost -d <throwaway> -f test/schema/billing_test_schema.sql
```
