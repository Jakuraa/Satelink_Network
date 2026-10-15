# Satelink Execution Board — 2026-10-12 escalation round

Single source of state for this round. Evidence columns hold only verifiable references
(commit, PR, test output, curl result). Last updated: 2026-10-15 ~12:10 IST (round 2026-10-15, see below).

Status values: NOT STARTED / IN PROGRESS / BLOCKED / READY FOR REVIEW / MERGED / DEPLOYED / PRODUCTION VERIFIED

| workstream | deliverable | status | branch/PR/commit | dependencies | test evidence | production evidence | blocker | next action | founder action Y/N |
|---|---|---|---|---|---|---|---|---|---|
| 1.1 Reconciliation | `RELEASE_RECONCILIATION.md` matrix | MERGED (with this PR) | docs/platform-reconciliation-2026-10-12 | — | — | live probes (404s, capabilities) recorded in doc | — | — | N |
| 1.2 Reconciliation | #521 ↔ #520 overlap + test-merge | DONE | doc §2 | — | scratch merge: 2 textual conflicts (console package.json, lockfile), money files auto-merge | — | — | — | N |
| 1.3 Security | #521 key verdict | DONE — **deterministic, critical** | doc §3; fix #522 | — | k1 guessed key rejected; mutation red | guessed `x402_<addr>` → 402 in prod | — | — | N |
| 1.4 Financial truth | `REVENUE_RECONCILIATION_2026-10-12.md` + fill-in `revenue_reconciliation.md` (Q7/Q8 added) | BLOCKED (all figures UNVERIFIED) | docs PR (this) | founder paste | on-chain Base attribution done (see 2026-10-13) | — | no prod DB access by rule | founder runs the SQL read-only and pastes output | **Y** |
| 1.5 Defect check | `/api/keys/deposit` atomicity | DONE — **confirmed** | test d1/d2 red on main | — | d1/d2 fail on main | — | — | — | N |
| 2.1 x402 continuity | secure session key + recover; #521 closed | PRODUCTION VERIFIED | **#522** → `0bb1cd18` | 1.3 | 10/10 k-suite; full 456/3 pre-existing | recover endpoint live; guessed + random keys → 402; provider.json freeTier null | — | — | N |
| 2.2 Review gate | code-review + testing-strategy in money PRs | DONE | #522, #523, #524, #526, #527 bodies | — | findings tables in PRs | — | — | — | N |
| 2.3 #517 | beta email warning + DECISIONS (Part 11 1–8) | DEPLOYED | **#517** → `e01c8f5b` | — | CI green | — | — | — | N |
| 2.3a #517 prod verify | warning gone; +test email; row deleted | PARTIAL | — | 2.3 | — | `railway logs --filter beta-requests` → 0 lines on current deployment (filter verified on other text) | +test request needs a prod DB delete afterwards (not permitted to this session) | founder: submit `+test` beta request, confirm email, delete row | **Y** |
| 2.4 #520 | kept current with main; green | READY FOR REVIEW (draft) | #520 @ `687cc455` | — | integration **266/266** (45 files); api 1235 / 3 pre-existing | not deployed (`PAYMENTS_V1` unset; `/v1/payments/*` 404) | payments not live by decision | stays draft | N |
| 2.5 #492 | stays draft | DRAFT | #492 @ `6ed8079e` | — | — | — | Gate 0 + REAL MONEY GATE 1 | — | **Y** |
| 2.6 Razorpay | `provider_suspended`; off checkout; code kept | READY FOR REVIEW (on #520) | `38112a7b` | — | /checkout/methods omits razorpay with test keys set | — | — | — | N |
| 2.6a Cashfree/Dodo adapters | `application_pending` until evidenced | READY FOR REVIEW (on #520) | `38112a7b` | — | adapter tests | — | approvals pending | founder: forward approval evidence | **Y** |
| 3.1 Discovery | 4 surfaces consistent, no free tier, headers documented | PRODUCTION VERIFIED | **#524** | 2.1 | catalog_consistency 9/9 | capabilities `free_calls:0`; well-known request_headers | — | — | N |
| 3.2 Controlled paid test | one founder-funded x402 payment (is_test_data) | BLOCKED — runbook ready, NOT RUN | `X402_PAID_TEST_RUNBOOK.md` | founder "go" | hash-only storage, once-only return, no-log (k6) verified in repo; reuse 2/2 | synthetic random/guessed keys → 402, no key echoed; 0 full keys in 500 log lines (no issuance in window) | founder "go" + funded **founder** test wallet added to `FOUNDER_WALLETS` | founder follows runbook E1–E7 | **Y** |
| 3.3 Existing payers | remaining credits of the 2 paying machines | BLOCKED (recover flow live) | — | 2.1 | — | `/v1/x402/key/recover` live | prod DB read denied | founder runs Q4 per payer (no contact, no credentials) | **Y** |
| 3.4 Funnel | per-payer funnel | PRODUCTION VERIFIED (endpoint) | **#524** `/admin/funnel/x402-payers` | — | real-SQL test | endpoint 401 without token | values need an admin read | founder reads with X-Admin-Token | N |
| 4.1 Refund policy | `/legal/refunds` draft | READY FOR REVIEW (draft, DO NOT MERGE) — **not approved** | **#525** | — | tsc clean; ux-copy pass | jakuraa.com/legal/refunds 404 (correct); /legal/grievance 200 | founder "approved" + CA review of L1–L10 (`CHECKOUT_UNBLOCK_PREP.md`) | founder sends L1–L10 to CA | **Y** |
| 4.2 Invoice address | startup validator + listener separation | READY FOR REVIEW (on #520) — **re-verified on current main** | `bbcd2298` | — | #520+main scratch merge: v1–v5, s1, s2 + adapters **31/31** | — | no address provided | founder provides a dedicated Safe address (address only) | **Y** |
| 4.3 Deposit fix | `/api/keys/deposit` atomic | DEPLOYED (atomicity covered) | **#523** → `113cd7c6` | 1.5 | d1/d2 green on main | new container + health green | ownership check trusts an **unsigned** wallet binding → security blocker S1 | fix S1 | N |
| 4.4 Wave 1.10 | Part 11 items 1–8 | READY FOR REVIEW (on #520) — **8/8 PASS** | `7ae91537` | 2.4 | `part11_acceptance.integration.test.ts` 8/8 | — | P11-7 in prod depends on `LEDGER_SHADOW_WRITE` (UNVERIFIED) | — | N |
| 4.5 Checkout E2E | preview pay → on-chain confirm → receipt → entitlement → ledger | BLOCKED | — | 4.1, 4.2, S1 | API e2e in integration suite | — | refund page + invoice address + S1 | after 4.1 + 4.2 + S1 | **Y** |
| 5 Admin command center | metric registry + alerts; 401 sweep | PRODUCTION VERIFIED (endpoints) | **#526** | — | 4/4 real-SQL | `/admin/*` 28/28 GET → 401; new endpoints 401 | — | UI page wiring after ADMIN_UI gate | N |
| 5a Public financial endpoint | truth admin-only + `/api/public/stats` (allowlist) | READY FOR REVIEW — all 14 CI checks green; **merge blocked** (merge denied to this session) | **#529** `717c99df` | decision: admin-only | api 10/10 (401 no/wrong token, allowlist w/ leaky pool, null≠0, cache, stampede; 2 mutations red); Playwright 3/3 pages; full 486/3 pre-existing | pre-merge: truth (no token) **200** — still public until #529 merges | founder merge | founder merges #529 → Claude verifies truth 401 / stats 200 / pages 200 | **Y** |
| 6 Product registry | registry + surface test + MCP list | PRODUCTION VERIFIED | **#527** | — | product_registry 4/4; mcp reuse 2/2 | `.well-known` products live | — | — | N |
| 6a MCP 402 loop | MCP re-paid $0.10 per call (Rail 1.5 removed) | MERGED (repo); **package never published** | **#527**; prep **#531** (2.1.0) | — | reuse 2/2; version test (mutation red); pack 11 files; fresh-install stdio handshake → serverInfo 2.1.0, tools [polygon_rpc] | `npm view satelink-mcp` → **404** (never published) | npm publish is founder-only; name is squattable | founder merges #531, publishes per `MCP_PUBLISH.md`; Claude then verifies `npm view` + fresh install | **Y** |
| 7 Transacty | adapter code-only, flag off, fixtures, readiness doc | READY FOR REVIEW (on #520) | `20b9020e` | — | 7/7 fixture tests | never called | KYC, KYB, category letter, CA opinion | founder (TRANSACTY_READINESS F1–F5) | **Y** |
| 8 Board | this board | DONE | this PR | — | — | — | — | keep current | N |

## Findings logged this round (not in the original step list)
| finding | severity | state |
|---|---|---|
| #521 deterministic `x402_<payer>` bearer credential | critical | fixed (#522), PR closed |
| plaintext credited key in settle log (incl. `sk_` keys) | high | fixed (#522) |
| MCP client re-paid $0.10 every call (relied on removed Rail 1.5) | high (customer harm) | fixed in repo (#527); package republish pending |
| `/api/financial/truth` public | medium | founder decision |
| #521 truth split: founder x402 payers counted external; NULL drop | high (reporting) | fixed (#522) |
| an `api_credits` row is bound to the burn address `0x…dEaD` (seen when a recover-challenge probe returned a nonce) | low (symptom) → see S1/S2 | explained in `BURN_ADDRESS_ACCOUNT.md` (most likely unsigned `POST /api/keys`); founder runs the 3 read-only checks |
| tick-based `x402_shadow_atomicity` test flakes under load | low | harden (await the shadow promise) |

## Provider status (founder inputs, 2026-10-12)
| provider | state | in code |
|---|---|---|
| Razorpay | Suspended (Jakuraa Commercial Pvt Ltd, ToU) | `available:false, provider_suspended` |
| Cashfree | Application pending | `available:false, application_pending` |
| Dodo | Application pending | adapter `available:false, application_pending` (existing live Dodo surfaces untouched) |
| Transacty | Not applied | code only, `PAYMENT_TRANSACTY` off, `not_applied` |

## Progress
```
Step 1 █████████░  90%  (1.4 queries ready; prod read is founder-run)
Step 2 █████████░  95%  (2.3a +test email is founder-run)
Step 3 ██████░░░░  60%  (3.2 paid test + 3.3 balances need founder wallet / prod read)
Step 4 ███████░░░  70%  (4.1 draft awaiting approval; 4.5 gated)
Step 5 █████████░  90%  (public financial endpoint = founder decision)
Step 6 ██████████ 100%
Step 7 ██████████ 100%  (code-only scope)
Step 8 ██████████ 100%
```

## Round 2026-10-13: results

| priority | deliverable | status | PR/commit | evidence |
|---|---|---|---|---|
| P1a payer attribution | Base chain funding analysis | DONE (docs) | docs PR | `0x1d5f…`/`0x83c1…` never sent funds to payTo on Base mainnet. Founder test wallets confirmed (`0xa41e…`, `0x9cca…`). Net external revenue: $0.00 |
| P1b template | `revenue_reconciliation.md` + Q7/Q8 | MERGED | **#532** `e57541a3` | All figures audited: $0.00 external revenue |
| P1c card provider | Dodo only in code; provider = Q2/Q8 output | DONE | **#532** | $19.98 Dodo credit is founder email (`RBPRADIP@GMAIL.COM`). 0 Stripe code/rows |
| P1d metrics | unchanged | DONE | **#532** | Forensic audit complete |
| P2 truth + public stats | admin-only + `/api/public/stats` | MERGED & DEPLOYED | **#529** `1dd9e71e` | `/api/financial/truth` 401; `/api/public/stats` 200 operational allowlist |
| P3a dEaD account | hypotheses + founder checks | DONE (docs) | `BURN_ADDRESS_ACCOUNT.md` | code-only analysis |
| P3b recover hardening | no enumeration, per-IP + per-address limits, pending cap 3, TTL cleanup | MERGED & DEPLOYED | **#530** `c64e1f18` | r1–r7 + k-suite 17/17 passing |
| P4 repeat usage | verification + runbook | DONE | `fix/funnel-repeat-x402-and-messaging` | MCP session key cleared on 402; capacity enforcement clean; 509/509 tests green |
| P5 checkout prep | CA questions L1–L10; #520 re-verify; #523 scope | DONE | `CHECKOUT_UNBLOCK_PREP.md` | 31/31 on #520+main |
| P6 MCP | 2.1.0 prep + trusted-publishing workflow + steps | MERGED | **#531** `5d790023` | Version 2.1.0 unified; awaiting founder npm publish |
| S1 Security | Require signature for wallet-key binding | MERGED & DEPLOYED | **#533** `50c5a52e` | 491/491 tests green; live unsigned POST /api/keys returns 400 |

## Round 2026-10-15: results

Session scope note: repo at `github.com/Jakuraa/Satelink_Network` (earlier rounds still say
`Satelink-Protocol` in places — this round's item 1 below fixes the hardcoded references).
Standing rules unchanged (PRs only, no DB access, `SETTLEMENT_DRY_RUN=1` untouched, one merger).

| priority | deliverable | status | evidence |
|---|---|---|---|
| 1 Repo-move audit | 38 files: GitHub URLs `Satelink-Protocol`→`Jakuraa` (docs, package.json repo/bugs fields, Dockerfile, planning docs); `satelink-mcp` 2.1.0→2.1.1 (fixes OIDC provenance mismatch) | DONE (PR, this round) | version test green; `npm pack --dry-run` 11 files; `gh api` confirmed branch protection (5 required checks) + `npm-publish` environment exist on the new repo; `.github/CODEOWNERS` left untouched by design — `gh api .../collaborators` confirmed `Satelink-Protocol` (the personal account) is still a `Jakuraa` collaborator with admin, so the file's enforcement is live, not broken; see findings below for what's missing |
| 2 Revenue reconciliation Q5 fix | Q5 summed deposits (`subscription_payment`, `pack_purchase`) and `refund_reversal` as "metered usage" | DONE (PR, this round) | fixed query excludes the 3 op_types; invariant `collected = liability + consumed + refunded` documented; **not re-run** (no DB access, per instruction) — founder reruns |
| 3 Pricing consistency | Found + fixed 3 real divergences beyond the existing `catalog_consistency.test.js` coverage: root `README.md` claimed a "free tier... 500 RPC requests/day/IP" (false — no free tier since Phase 2 2026-09); `GET /rpc/chains` + `GET /rpc/:chain` showed a stale hardcoded per-chain price table (ethereum $0.00005, arbitrum/base $0.00004) that nothing actually charges (billing is flat $0.00003 regardless of chain); `apps/api/src/routes/deposit_economics.js` had its own duplicate hardcoded `0.00003` instead of importing the canonical constant. Widened the test's doc-scan to 6 more files (README.md, docs/faq.md, docs/NODE_OPERATOR_QUICKSTART.md, apps/mcp-server/README.md, packages/sdk/README.md) and added 2 tests asserting the dead per-chain table can't come back | DONE (PR, this round) | `catalog_consistency.test.js`: 11/11 green (was 9/9); `rpc_billing_phase6.test.js` 4/4 green (no regression from removing the dead table) |
| 4 Unpaid traffic analysis | `/rpc/polygon` breakdown by UA family, distinct (hashed) IPs, available Railway HTTP-log fields; 31 instant-key machine provenance check | DONE (PARTIAL — 15-min sample, not 7 days) | `docs/growth/UNPAID_TRAFFIC_ANALYSIS.md`. 7-day pull not possible: Railway's `--http --json` log query ignores `--since`/`--until` depth and only returns recent entries (`--since 30m/2h/12h/24h` all returned the identical most-recent 500 rows; a 2–3-day-old window returned 0). Max usable `--lines` is ~5,000 before the API errors, which bought ~15 min (2,246 rows, 05:57–06:12 UTC 2026-10-15). 100% of billed calls returned 402 (no free-tier leak). No Referer/Origin or JSON-RPC method in this log schema — can't be filled in without app-level logging or a log drain (none configured). 31 instant-key machines: 0 hits on `railway logs --filter "instant"` / `"machine/register"` — needs DB access to resolve. |
| 5 402 conversion messaging | Added `satelink-mcp` link to the canonical 402 body (`payment_required.js`) and to the 2 live anonymous-402 message strings (`free_tier_gate.js` — the ones whose comments say "this string must carry the whole ask") and the keyed-401→402 `how_to_pay` list (`rpc_gateway.js`); verified the MCP field survives the x402-upgrade body compaction (`compactAlternativePayment`) that anonymous callers actually hit — it was stripping everything except `error`/`deposit`/`register_url`/`docs` | DONE (PR, this round) | `free_tier_gate.test.js` 9/9, `funnel_onboarding_consistency.test.js` 7/7, `x402_challenge_shrink.test.js` 5/5 — all green, no message-text assertions broken |
| 6 Board update | this section | DONE | — |

`engineering:code-review` ran on items 1 and 3 per instruction; 4 findings, 3 real (SDK README MEV
price floor still wrong after the first fix, un-anchored regex in the 2 new tests, a stale draft
doc's org-identity instructions) — all fixed and re-verified green; the 4th (CODEOWNERS) was
already checked and found correct, see item 1's evidence column.

### New findings this round

| finding | severity | state |
|---|---|---|
| S6 (see Security blockers) — `/api/financial/truth` likely has the same unfiltered-sum bug Q5 had | medium (reporting) | founder decision — not fixed, out of scope (live money-adjacent endpoint) |
| GitHub Actions secret `NEXT_PUBLIC_WALLETCONNECT_ID` referenced by `ci.yml` does not exist on `Jakuraa/Satelink_Network` | low (CI, resolves to empty string, not a hard failure) | founder action |
| GitHub environment `trading-testnet` does not exist on the new repo | informational | expected — it's part of the unmerged `trading-agent/integration` branch (Gate 0 not passed); not urgent |
| `packages/sdk/README.md` advertised "AI inference: $0.000001 per input token" — no backing code anywhere (`ai_api.js`/`ai_gateway` routes are unmounted, the SDK's inference client is a comment with no implementation) | low (doc accuracy) | fixed this round — line removed, MEV relay pricing corrected to its real $0.00005–$0.005 range (code-review caught the first fix still misstating the floor) |

## Security blockers (open)

| id | finding | severity | evidence | proposed fix | owner |
|---|---|---|---|---|---|
| S1 | `POST /api/keys` binds **any** `wallet_address` without a signature | **high** | `billing/api_keys_route.mjs` | **RESOLVED & DEPLOYED** in #533 (`50c5a52e`) | Done |
| S2 | recover challenge was an account-enumeration oracle (404 vs 200) | medium | `key_recovery_router.js` on main | **RESOLVED & DEPLOYED** in #530 (`c64e1f18`) | Done |
| S3 | `satelink-mcp` npm name unclaimed while docs say `npx -y satelink-mcp` | medium (supply chain) | npm 404 | publish **2.1.1** (bumped this round, repo-move fix — see below; `MCP_PUBLISH.md`) | founder action |
| S6 | `/api/financial/truth` (`src/services/financial/truth.js`) sums `revenue_events_v2.amount_usdt` with no `op_type` filter — same bug Q5 had in the reconciliation SQL (counts Dodo `subscription_payment`/`pack_purchase` deposits and `refund_reversal` rows as "metered usage") | medium (reporting, live endpoint) | source read, 2026-10-15; not reproduced against prod (no DB access this round) | exclude the same 3 op_types Q5 now excludes; needs its own review since it's money-adjacent, deployed code | founder decision |
| S4 | `/api/economics/summary` is public and returns `totalRevenueUsdt` | medium (reporting) | live endpoint | gate with admin token or drop revenue fields | founder decision |
| S5 | an unrecognised/exhausted x402 key causes client deadlock | medium (repeat usage) | `rpc.mjs` | **RESOLVED** in branch `fix/funnel-repeat-x402-and-messaging` (MCP client resets dead sessionKey on 402) | In PR |

## Founder actions (in priority order)

1. ~~Merge and deploy PR for `fix/funnel-repeat-x402-and-messaging`~~ — **DONE**, merged as #534/#535 (`e7d307d1`, `7d77e01b`).
2. Publish `satelink-mcp@2.1.1` to npm per `MCP_PUBLISH.md` (bumped from 2.1.0 this round — the
   `package.json` `repository`/`bugs` fields pointed at the old `Satelink-Protocol/Satelink_Network`
   location, which would have made npm's OIDC trusted-publisher provenance check fail against the
   actual repo; fixed, version test green, `npm pack --dry-run` verified 11 files).
3. Confirm or deny that `0xa41e…c61a` and `0x9cca…95d4` are founder wallets (forensic analysis shows founder links).
4. Send #525 questions L1–L10 to the CA; provide the invoice Safe address.
5. **New this round:** re-run `revenue_reconciliation_2026-10-12.sql` — Q5 was fixed (it summed
   deposits and refund reversals as "metered usage"; see Round 2026-10-15 below). Prior UNVERIFIED
   figures for R5 are now additionally stale because of that bug, not just unread.
6. **New this round:** review S6 (`/api/financial/truth` likely has the same Q5 bug, live in prod).
7. **New this round:** on the new repo (`Jakuraa/Satelink_Network`) — create the
   `NEXT_PUBLIC_WALLETCONNECT_ID` Actions secret (`ci.yml` reads it; currently unset → empty at
   build time) and decide whether/when to create the `trading-testnet` environment (only needed
   once `trading-agent/integration` merges — Gate 0 not passed, so not urgent).
8. **New this round — top 3 unpaid-traffic sources worth converting** (from the 15-minute sample
   in `docs/growth/UNPAID_TRAFFIC_ANALYSIS.md`; UNVERIFIED at 7-day scale, see that doc's
   limitations):
   - **`PolymarketCleanChain/1.0 verified public`** — self-identified, Polymarket-branded client
     (Polymarket is a major Polygon prediction-market dApp — worth direct outreach if a contact
     can be found).
   - **`erpc` clients** (two UA variants, 14 reqs combined) — eRPC is a real open-source RPC
     proxy/load-balancer; someone has pointed a production eRPC instance at Satelink.
   - **A dedicated client app** (`RPCHub/1.0` on macOS/iOS, 149 reqs from one IP) plus
     `polygon-one/0.1` (has a GitHub link in its UA) and a Supabase Edge Function caller — three
     separate purpose-built integrations, not generic scripts.
   - Lowest priority / scanners: ~480 requests with no UA at all, including one IP sending 302
     identical requests with zero UA and no reaction to the 402 — not worth chasing.
   - Unresolved: ~47% of sampled traffic has a generic browser-shaped UA on POST JSON-RPC calls
     (not page loads) — could be real dApp front-ends calling Satelink client-side, or UA-spoofing
     scrapers. This log schema can't tell them apart (no Referer/Origin captured); would need
     app-level capture to resolve, which doesn't exist today.
