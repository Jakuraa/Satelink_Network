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
| F1 | Rotations (Discord webhook, Railway `ADMIN_SECRET_TOKEN`, Vercel admin token, Paperclip `ANTHROPIC_API_KEY`, Alchemy key); API `DATABASE_URL` → `satelink_app` role | **Reported cleared by founder 2026-10-20.** Confirm: did the set include the settlement signer (see F21), and has `DATABASE_URL` moved to `satelink_app`? |
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
| F17 | Review + merge founder-review PRs #549 (first), #551, #553, #555, #559. After #553, `POST /rpc/keys` and node reputation update return 503 until `ADMIN_API_KEY` is set (intended) | open |
| F18 | Confirm production `JWT_SECRET` ≠ the fallback literal in git history (deleted `node_auth_route.mjs`) | open |
| F19 | Docker Desktop on the build machine (or a CI DB) for integration suites | open |
| F20 | RPC upstreams: Alchemy + Ankr resale terms; approve keyed Ankr as paid fallback, then drop free public endpoints from billed traffic (`evidence/RPC_UPSTREAMS.md`) | open |
| F21 | Settlement signer: rotate if not in F1's set (it was reachable via SEC-1 until #549 merges); check on-chain whether the claims contract holds funds | open |

### Next actions (in order)
1. Verify the first lockfile-based API deploy (#557): Railway status success + R7 + `/health` uptime reset.
2. W1: remaining public money reads (SEC-4) and unauthenticated deposit-notify / node register-heartbeat (SEC-5) — check the self-heartbeat caller before gating heartbeat. founder-review.
3. W1: S6b epoch_scheduler split filter (settlement path; founder-review); RPC upstream inventory DONE (`evidence/RPC_UPSTREAMS.md`, F20) → refund-on-upstream-error fix; Cloudflare WAF read + proposal; `satelink-mcp` publish prep (F12).
4. W0: Dependabot #546 after real-gate CI; DB-backed API test job in CI (165 silently skipped tests); packages/content + packages/seo typecheck; prune stale allowlist entries.
5. W2: Capability Registry v3 (after F8 price decisions are requested in one founder brief).
