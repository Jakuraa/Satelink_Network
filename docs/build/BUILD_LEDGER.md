# Build ledger — Satelink AI Assistance mandate

Read after `MASTER_BUILD_PROMPT.md`, every session. Newest session first. Security findings are
categories only (R14); details in `docs/build/evidence/private/` on the build machine.

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
| SEC-1 | Payout-signing route reachable with a weaker credential than staff auth | Fix PR #549 (founder-review). F1: rotation decision for the signer |
| SEC-2 | Unauthenticated outbound-fetch workload | Removed in PR #548 |
| SEC-3 | Relabelled-model inference surface (R4) | Removed in PR #548 |
| SEC-4 | Public revenue figures (S4) and sibling public money reads | #551 (revenue routes); other public money reads (diagnostics, treasury, settlement history, earnings, /os/events, /system) still open → W1 |
| SEC-5 | Unauthenticated internal parity / deposit-notify / node register-heartbeat endpoints | parity → #553; deposit-notify, node register/heartbeat still open → W1 |
| SEC-6 | Admin checks that open when an env var is unset; non-constant-time admin compare | env-compare routes → #553 (confirmed open live); `requireAdminAuth` constant-time → W3 |
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

### PRs this session
| PR | Branch | What | State |
|---|---|---|---|
| #548 | `fix/w1-remove-ai-gateway` | Remove relabelling AI gateway + bandwidth proxy; guard test (mutation-verified) | green; merge after #552 |
| #549 | `fix/w1-claims-auth` | Staff-only, dry-run-aware claim signing (mutation-verified) | green, `founder-review` |
| #550 | `chore/mandate-w0-foundation` | Mandate, ledger, matrix, D14, CLAUDE.md pointer, settings tightening, gitignore, baseline | green |
| #551 | `fix/w1-s4-public-revenue` | S4: no public revenue figures (mutation-verified) | green, `founder-review` |
| #552 | `ci/w0-real-gate` | Unmask CI; fix 63 TS errors; real lint; remove ignoreBuildErrors | CI running |
| #553 | `fix/w1-fail-open-admin` | Fail-closed admin secrets; unmount node-token; staff-gate parity (mutation-verified) | `founder-review` |

Merge policy applied: no self-merge until #552 makes CI a real gate (mandate §13 "real (unmasked) checks").

### Founder actions (F-list, cumulative)
| F | Action | Why |
|---|---|---|
| F1 | Decide on rotating the settlement signer key; check whether the claims contract holds funds (on-chain) | SEC-1 exposure window |
| F3 | Provision staging (Railway env + Vercel preview + demo tenant) | B-06, W8/W9 |
| F4 | KMS + isolated signer + static egress IP | B-08, M12 |
| F5 | Approve refund policy #525 + CA/lawyer review | W4 enablement |
| F6 | Licence choice (MIT vs BSL) | B-11 |
| F7 | Invoice Safe address | W4 |
| F8 | Confirm prices (Pro yearly $120 vs $190; INR FX; Max tier ladder; TI status) | DU §2 contradictions |
| F12 | `npm publish satelink-mcp` | Not on npm; docs tell users to `npx` it |
| F14 | Apply production migrations when asked | R11 |
| F15 | GitHub branch protection: `enforce_admins` + 1 required review | B-10 |
| F16 | Run `\d revenue_events_v2` via sat-db and paste the `amount_usdt` type | B-07 |
| F17 | Merge #549, #551, #553 (founder-review: auth / revenue reporting) | SEC-1, S4, SEC-6/7 |
| F18 | Confirm production `JWT_SECRET` ≠ the fallback literal in git history (deleted file `node_auth_route.mjs`); rotate if it ever matched | SEC-7 |
| F19 | Start Docker Desktop on the build machine (or provide a CI DB) so integration suites can run locally | BASELINE |

### Next actions (in order)
1. Merge #548 when CI is green (pre-approved: not money/auth), with R7 health checks before and after.
2. W1: S4 + sibling public money reads (SEC-4); unauthenticated parity/notify/register endpoints (SEC-5); node-token fallback secret (SEC-7).
3. W1: S6 truth.js filter fix (founder-review); jakuraa.com false claims removal; RPC upstream free-endpoint inventory.
4. W0: CI hardening per BASELINE.md (unmask, lint blocking, integration blocking, typecheck), `apps/web` ignoreBuildErrors + TS errors, API lockfile decision.
