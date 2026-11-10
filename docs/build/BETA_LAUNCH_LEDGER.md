# Friends Beta launch ledger (single source of truth for the 2026-11-10 session)

Scope: `BETA_SCOPE.md`. Out-of-scope items: `BACKLOG.md`. Decisions: `DECISION_LOG.md` (entries D-B*).
Status values: VERIFIED (prod) · VERIFIED (preview/local) · VERIFIED (FIXTURE) · BLOCKED (FOUNDER) · NOT STARTED.
No secret value appears in this file. Variable NAMES only.

Working tree: `.claude/worktrees/beta-launch`, branch `beta/launch`, created from the #638 head `4e465d64`
(contains the Release A stack top `db832850` and #636 `b32b9dba`).

## Phase board

| Phase | Status | Evidence |
|---|---|---|
| B0 Ground truth sync | VERIFIED (prod), read-only | this file, §B0 |
| B1 Security train | NOT STARTED | |
| B2 Credential minimum bar | NOT STARTED | |
| B3 Backup + migrations | NOT STARTED | |
| B4 Release merge | NOT STARTED | |
| B5 Beta controls | NOT STARTED | |
| B6 UI/UX polish | NOT STARTED | |
| B7 Hard test | NOT STARTED | |
| B8 Go/no-go + launch kit | NOT STARTED | |

## B0 — ground truth (captured 2026-11-10 ~17:00–17:30 UTC)

### Git and PRs
- `main` = `dd279db4` (2026-10-31, #604). Branch protection on `main`: required checks Tests, Type Check + Lint,
  Build Verification, Secret Scan, API Test Baseline Guard; no required reviews; admins not enforced.
- All PRs below are OPEN and MERGEABLE. "draft" unless noted.

| PR | Head branch | Base | Head SHA | CI |
|---|---|---|---|---|
| 610 | build/p0-safety | main | 94abb2f8 | green |
| 611 | build/integration-base | main | a8d9285e | green |
| 612 | build/p2-foundation | build/integration-base | 3ba7318e | green |
| 616 | build/s1-primary-journey | build/p2-foundation | 618bf842 | green |
| 617 | build/s2-food-mcp | build/s1-primary-journey | 6e6bd766 | green |
| 618 | build/s3-trading | build/s2-food-mcp | 4d349f2e | green |
| 619 | build/s4-developer | build/s3-trading | cd245f90 | green |
| 620 | build/s5-mcp-server | build/s4-developer | cc20da9b | green |
| 621 | build/s6-machine | build/s5-mcp-server | f6ccc0c0 | green |
| 622 | build/p3-quality | build/s6-machine | 394ff9f9 | green |
| 623 | build/p4-assurance | build/p3-quality | f9eece3f | green |
| 627 | dependabot (web next) — ready | main | 0dfad1c0 | RED (5 failures) — backlog 1 |
| 628 | dependabot (api group) — ready | main | 07eadccd | RED (6 failures) — backlog 1 |
| 629 | build/p5-websites | build/p4-assurance | c891a0a7 | green |
| 630 | build/p6-acceptance | build/p5-websites | db832850 | green |
| 631 | security/next-sharp-15.5.29 | main | b49bcdcb | green (10) |
| 632 | security/root-lock-auth-proxy-dompurify | main | 5dedf912 | green (10) |
| 633 | security/mcp-sdk-1.32 | main | 05892ff9 | green (10) |
| 634 | security/api-lock-transitive | main | ac51a07a | 1 red: Financial OS Integration Suite (see C4); re-run started |
| 635 | security/x402-2.30-money-path-review | main | 313df452 | green — FORBIDDEN, not touched |
| 636 | fix/ac13-trading-intelligence-positioning | build/p6-acceptance | b32b9dba | green |
| 637 | security/release-a-integration-proof (test only) | build/p6-acceptance | af3b1dbf | green |
| 638 | docs/release-a-hold-2026-11-09 | fix/ac13-… | 4e465d64 | green |

Numbers 613–615 and 624–626 are not pull requests in this range.

### Vercel (team `jakuraa`)
| Project | Production deployment | SHA | State | `next` on that SHA |
|---|---|---|---|---|
| web (satelink.network) | dpl_HErGJ4oQ… | dd279db4 | READY | 15.5.28 |
| satelink-console (console.satelink.network) | dpl_Ea5RAwju… | dd279db4 | READY | 15.5.27 |
| jakuraa-corporate (jakuraa.com) | dpl_BD45uPr8… | 03888911 (#591) | READY (live) | 15.5.27 |

`jakuraa-corporate` builds for `736bdc33`, `8fc18f51`, `88ef1dca`, `dd279db4` are CANCELED. Cause:
`apps/corporate/vercel.json` → `"ignoreCommand": "npx turbo-ignore"`, which skips a build when the commit does not
affect the app. That is by design, not a failure. All three apps use the same ignore command. B1 must confirm
jakuraa.com actually rebuilds on the #631 merge.

Live checks: satelink.network 200 · console.satelink.network 307 (auth redirect) · jakuraa.com 200.

### Railway `Satelink-api` (project Satelink-api, environment production)
- `/health`: ok, db ok, commit `dd279db4` = `main` → auto-deploy from `main` is working.
- 111 variables. Non-secret flags read (name → value): SETTLEMENT_DRY_RUN → 1 · MIN_ANCHOR_REVENUE_USDT → 0.5 ·
  X402_ENABLED → true · NODE_ENV → production · CONSOLE_ACCOUNTS_V1 → true · AUTH_ENABLED → true ·
  BILLING_ENABLED → true · REVENUE_MODE → collected · SATELINK_MODE → live · SETTLEMENT_ROLLUP → 1 ·
  FEATURE_REAL_SETTLEMENT → true (pre-existing; not changed — the dry-run flag is the guard).
- `WORKFLOWS_BETA_ENABLED`, `BETA_INVITE_ONLY`, `BETA_KILL_SWITCH`, `MODEL_KILL_SWITCH`: not set.
- `DATABASE_URL` user: `postgres` (superuser), host internal.
- Variable NAMES (before B2): ADMIN_CRONS_ENABLED, ADMIN_SECRET_TOKEN, ALCHEMY_API_KEY, ALCHEMY_POLYGON_KEY,
  ANKR_API_KEY, AUTH_EMAIL_FROM, AUTH_ENABLED, BETA_REQUESTS_FOUNDER_EMAIL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
  BILLING_ENABLED, BINANCE_DEMO_API_KEY, BINANCE_DEMO_API_SECRET, BREVO_API_KEY, CAPACITY_ENFORCEMENT_PATH,
  CDP_API_KEY_ID, CDP_API_KEY_SECRET, CLAIMS_CONTRACT_ADDRESS, `cloudflare_Access Key ID`, cloudflare_access_token,
  CLOUDFLARE_ACCOUNT_ID, `cloudflare_S3 API endpoint`, `cloudflare_Secret Access Key`, CLOUDFLARE_ZONE_ID,
  CONSOLE_ACCOUNTS_V1, CONSOLE_S2S_SECRET, CREDIT_CANONICAL, DATABASE_URL, DB_TYPE, DEPOSIT_CHUNK_BLOCKS,
  DEPOSIT_INITIAL_LOOKBACK_BLOCKS, DEPOSIT_LISTENER_RPC_URL, DEPOSIT_POLL_INTERVAL_MS, DISCORD_ALERTS_ENABLED,
  DISCORD_REVENUE_WEBHOOK_URL, DISCORD_WEBHOOK_URL, DODO_CREDIT_PACK_PRODUCT_IDS, DODO_CREDIT_PACK_USD_VALUES,
  DODO_INTERNAL_SECRET, DODO_TESTMODE_API_KEY, DODO_WEBHOOK_SECRET_KEY, DRAW_SHADOW_WRITE, edit_zone_DNS_API_token,
  EULERPOOL_API_KEY, FEATURE_REAL_SETTLEMENT, FLASHBOTS_SIGNER_KEY, FOUNDER_WALLETS, FREE_TIER_DAILY_LIMIT,
  FREE_TIER_DISABLE_ESCALATION, GEMINI_API_KEY, GITHUB_TOKEN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
  google_OAuth_client_ID, google_OAuth_Client_secret, GROQ_API_KEY, INTEL_REFRESH_ENABLED, IP_SALT, JWT_SECRET,
  LEDGER_SHADOW_WRITE, LLAMARPC_POLYGON_DISABLED, MASTER_ADMIN_TOKEN, MIN_ANCHOR_REVENUE_USDT,
  NEXT_PUBLIC_WALLETCONNECT_ID, NODE_ENV, NODE_ID, NODE_OPTIONS, NODE_REGION, npm_config_build_from_source,
  OPENROUTER_API_KEY, POLYGON_CHAIN_ID, POLYGON_RPC_URL, POLYGON_SIGNER_ADDRESS, POLYGON_SIGNER_KEY,
  POLYGON_USDT_ADDRESS, PORT, PYTHON, RAILWAY_* (13 platform variables), railway_token, REDIS_URL, RESEND_API_KEY,
  `RESEND.COM_API_KEY`, REVENUE_MODE, REVENUE_VAULT_ADDRESS, SATELINK_MODE, SETTLEMENT_DRY_RUN,
  SETTLEMENT_EVM_SIGNER_PRIVATE_KEY, SETTLEMENT_ROLLUP, TREASURY_ADDRESS, USDT_CONTRACT_ADDRESS, VAULT_ADDRESS,
  vercel_token, VERCEL_TOKEN, X_ACCEL_BUFFERING, X402_ENABLED, X402_NETWORK, X402_PAY_TO.

### Production Postgres (read-only session, `default_transaction_read_only=on`)
- PostgreSQL 18.6. Login roles: `postgres` (superuser), `satelink_app`, `deposit_reconcile_ro`, `task_commerce_web`.
- `public` holds 99 tables. `ledger_txns` 345,658 rows; `ledger_entries` 691,316 rows.
- `schema_migrations` (Financial OS runner, `database/runner.ts`, explicit CLI only): 19 rows, last
  `019_ledger_kind_refund.sql` (2026-09-27). `_migrations`: 1 row (`009_epoch_aggregation.sql`).
- None of the 038–046 objects exist (`payment_intents`, `trading_decisions`, `workflow_runs`, `wf_journal`,
  `capability_registry`, `connector_connections`, `developer_api_keys`, … all absent).
- `ledger_txns_kind_check` allows only: draw, settlement, deposit, adjustment, reversal, refund.

### GitHub security
- Secret scanning: enabled. Push protection: enabled. Non-provider patterns and validity checks: disabled.
- Alerts: #1 Slack Incoming Webhook URL — resolved (revoked). No open alerts.
- Actions secret NAMES: ALERT_EMAIL_FROM, ALERT_EMAIL_TO, DEPOSIT_RECONCILE_DB_URL, DEPOSIT_RECONCILE_RPC_URL,
  DISCORD_WEBHOOK_URL, JWT_SECRET, POLYGONSCAN_API_KEY, REDIS_URL, RESEND_API_KEY, RPC_URL, SLACK_WEBHOOK_URL,
  TREASURY_ADDRESS, VERCEL_TOKEN.

### Tooling
gh CLI authenticated (repo, workflow scopes). Railway CLI logged in. Vercel MCP connected. GitHub MCP failed to
connect (401 / connection closed) — gh CLI used instead. Local: psql, pg_dump, docker present; `age` not installed.

## Contradictions resolved with live evidence

| # | Earlier statement | Live evidence | Consequence |
|---|---|---|---|
| C1 | Mandate B3: "apply 040/041 if not already applied, then 042–046" | Production `schema_migrations` ends at 019. Files 020–037 do not exist in `database/migrations/`; 038–046 (nine files) are all pending, and none of their objects exist | The runner applies pending files in order and cannot skip, so reaching 046 means applying 038 and 039 too (ledger kind check widened for payments; four payment tables; merged to `main` in #600). Plan: rehearse 038→046 on a restored copy, then apply all nine. See D-B2 |
| C2 | F3 lists `cloudflare_Example Usage` | No such variable. Present and unlisted: `cloudflare_S3 API endpoint`, `edit_zone_DNS_API_token`, `google_OAuth_client_ID` | Only variables that are both on the F3 list and present are deleted; the rest go to backlog 2 |
| C3 | `CREDENTIAL_ROTATION_CHECKLIST.md`: secret scanning "verified disabled" (2026-11-09) | Enabled, with push protection, on 2026-11-10; alert #1 resolved | Checklist to be corrected in B2.5 |
| C4 | `RELEASE_A_ACCEPTANCE.md`: #634 updated and green | Financial OS Integration Suite failed on run 42773969448: two unhandled Postgres `57P01` errors raised when the `pay_race_*` test databases were torn down; no assertion failed | Re-run started. If it recurs it is fixed in the test teardown, never by weakening an assertion |
| C5 | OB-10: OpenRouter live key missing | `OPENROUTER_API_KEY` exists as a variable name on Railway | Validity and credit limit unverified until B7 (F9) |
| C6 | "jakuraa-corporate builds were canceled" read as a fault | `turbo-ignore` skip, by design | Verify a real rebuild in B1 |
| C7 | `CLAUDE.md`: Vercel project `satelinkinternet-collabs-projects/web` | Team slug is `jakuraa` | Backlog 5 |
| C8 | `CLAUDE.md`: "Postgres 304 MB, 32 tables" | 99 tables in `public` | Older context row; not acted on |

## B1 — security train (F1) — in progress

Review before merge: resolved-version diff of every lockfile per PR. #632 and #633 leave `apps/api/package-lock.json`
untouched. #634 changes exactly body-parser 2.3.0→2.4.0, follow-redirects 1.16.1→1.16.3, ws 8.22.0→8.22.2 and removes
the `ws` 8.18.0 copy nested under `@ethersproject/providers`. No `@x402/*` or Coinbase package re-resolved (OB-12).

| Step | Status | Evidence |
|---|---|---|
| #631 merged | VERIFIED (prod) | merge `41017204b2`; CI 10/10 before merge |
| #631 deployed | VERIFIED (prod) | web `dpl_ciYHHupo…`, console `dpl_Dx4AWwCy…`, corporate `dpl_5vco7YNH…` all READY on `41017204`; corporate rebuilt (not skipped); API `/health` commit `41017204` |
| `/_next/image` rejects SVG | VERIFIED (prod) | local SVG source: satelink.network 400, jakuraa.com 400 (`INVALID_IMAGE_OPTIMIZE_REQUEST`). Console ships no image asset, so tested with a remote SVG source: 400 on all three domains |
| #632 merged | VERIFIED (prod) | branch updated via GitHub (head `c98cf5b2`), CI 13/13, merge `3c827c469a`; API `/health` commit `3c827c46` |
| #633 merged | VERIFIED (prod) | branch updated (head `9e3f4aee`), CI 13/13, merge `3552b5af09`; API `/health` commit `3552b5af` |
| #634 merged | pending CI | branch updated (head `f409d850`) |

## B2 — credential minimum bar — in progress

### B2.1 JWT_SECRET (F2) — VERIFIED (prod), with one stated limit
- Railway `JWT_SECRET` set from an inline generator (value never printed); GitHub Actions secret `JWT_SECRET` set the
  same way with an independent value (updated 2026-11-10T17:32:42Z). No workflow reads that Actions secret; CI uses a
  literal test value. Only `apps/api` reads `JWT_SECRET`; the Vercel apps do not.
- After the redeploy (uptime reset, commit `3552b5af`): `/health` ok; `/auth/me` without a token 401; with a malformed
  token 401; Better Auth `GET /api/identity/get-session` 200; anonymous RPC 402 (expected payment challenge).
- **Limit:** "an old token returns 401" is not demonstrated directly. No old-secret token exists locally, minting one
  inside the Railway environment was declined by the permission layer, and the legacy wallet login cannot issue a
  token in production at all: `POST /auth/verify` fails after signature verification with `relation "users" does not
  exist` (pre-existing; backlog 7). Rejection of old tokens follows from HS256 with a replaced secret.

### B2.2 Admin tokens (F3) — proof of no runtime use collected
`git grep` on `origin/main` and the release stack: no reader of GITHUB_TOKEN, VERCEL_TOKEN, vercel_token,
railway_token, cloudflare_access_token, `cloudflare_Access Key ID`, `cloudflare_Secret Access Key`,
google_OAuth_Client_secret or `RESEND.COM_API_KEY` in `apps`, `packages`, `libs`, `database`, `scripts`, `agent`.
Only hits: `scripts/secret-scan.sh` (a pattern) and `apps/api/src/admin/jobs/settlement_control.js:62`, which reads
uppercase `RAILWAY_TOKEN` — a variable that is not set. Deletion follows the #634 deploy.

### B2.3 DB role switch (F4) — re-sequenced after B4
The prepared runbook (`docs/build/runbooks/DB_ROLE_SWITCH.md` on `docs/node-blast-radius-and-db-role-switch`) states
the switch is unsafe until request-time DDL is removed. Checked on the release stack: `pricing_v2/schema.mjs` (13 DDL
statements, 0 guards), `console_accounts/schema.mjs` (17, 0), `analytics/rpc_traffic_recorder.mjs` (2, 0),
`billing/legacy_sub_entitlement.mjs` (2, 1). Under `satelink_app` those paths fail. The fix is code, so it ships with
the release and the switch is rehearsed on the local restore first.

## B3 — backup + migrations (F5) — in progress

### B3.1 Fresh backup — VERIFIED (local restore)
- `pg_dump -Fc` (client 18.4, server 18.6), full dump with ownership and grants, read from the public endpoint.
- File: `~/satelink-secure/satelink_prod_prebeta_20261110T171533Z.dump` — outside the repository, directory 700,
  file 600, 47,339,487 bytes, SHA-256 `daca4d3e6758164141ea06f77202ed8ef0ea7e095e45cbe706b4a2bd4feb7793`.
- First attempt hung when the network dropped (file stalled at 45,404,160 bytes, no server session). It was killed
  and the dump re-run with TCP keepalives; the recorded file is the complete second run (`pg_dump` exit 0).
- Not encrypted: `age` is not installed and no recipient is configured.
- Restore check: Docker `postgres:18` (18.6), `pg_restore --exit-on-error` exit 0. 98 base tables, 2,221,257 rows.
  93 tables match live production exactly; 5 live-append tables grew after the snapshot (`epoch_ledger` +4,
  `epochs` +4, `intelligence_snapshots` +8, `node_health_logs` +4, `rpc_traffic_daily` +18).
  `ledger_txns` 345,658 and `ledger_entries` 691,316 match exactly.
- **Not independent:** this file is on the same machine and disk as the 2026-11-03 backup. One disk failure loses
  both. An off-device encrypted copy remains a founder action (OB-5).

### B3.2 Rehearsal of 038→046 on the restored copy — VERIFIED (local)
Runner applied all nine in 0.9 s; `verify` reports every applied checksum matches its file (so 001–019 are unchanged
since production applied them). After: 28 migration rows; 23 new tables; `ledger_txns_kind_check` now also allows
payment, subscription, commission, rebate, provider_fee, hold, capture, release; `ledger_txns_reservation_tagged`
validated; append-only triggers present on `wf_journal`, `workflow_receipts`, `workflow_quotes`, `trading_decisions`,
`trading_strategy_evaluations`; `satelink_app` holds INSERT and SELECT only on `ledger_entries`; no pre-existing
table's row count changed. Production apply: not yet done.
