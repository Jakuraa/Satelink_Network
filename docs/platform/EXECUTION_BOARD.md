# Satelink Execution Board — 2026-10-12 escalation round

Single source of state for this round. Evidence columns hold only verifiable references
(commit, PR, test output, curl result). Last updated: 2026-10-13 ~01:30 IST.

Status values: NOT STARTED / IN PROGRESS / BLOCKED / READY FOR REVIEW / MERGED / DEPLOYED / PRODUCTION VERIFIED

| workstream | deliverable | status | branch/PR/commit | dependencies | test evidence | production evidence | blocker | next action | founder action Y/N |
|---|---|---|---|---|---|---|---|---|---|
| 1.1 Reconciliation | `RELEASE_RECONCILIATION.md` matrix | MERGED (with this PR) | docs/platform-reconciliation-2026-10-12 | — | — | live probes (404s, capabilities) recorded in doc | — | — | N |
| 1.2 Reconciliation | #521 ↔ #520 overlap + test-merge | DONE | doc §2 | — | scratch merge: 2 textual conflicts (console package.json, lockfile), money files auto-merge | — | — | — | N |
| 1.3 Security | #521 key verdict | DONE — **deterministic, critical** | doc §3; fix #522 | — | k1 guessed key rejected; mutation red | guessed `x402_<addr>` → 402 in prod | — | — | N |
| 1.4 Financial truth | `REVENUE_RECONCILIATION_2026-10-12.md` | BLOCKED (queries written, all UNVERIFIED) | this PR | prod read | SQL syntax-checked locally | — | prod DB read denied by session permission policy | founder runs `revenue_reconciliation_2026-10-12.sql` read-only | **Y** |
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
| 3.2 Controlled paid test | one founder-funded x402 payment (is_test_data) | BLOCKED | — | 2.1 deployed | k2–k4 cover the same assertions locally | — | needs a founder-funded test wallet; Claude never handles keys | founder runs `apps/mcp-server/client-example.mjs` with a funded **founder** wallet, then reports tx hash | **Y** |
| 3.3 Existing payers | remaining credits of the 2 paying machines | BLOCKED (recover flow live) | — | 2.1 | — | `/v1/x402/key/recover` live | prod DB read denied | founder runs Q4 per payer (no contact, no credentials) | **Y** |
| 3.4 Funnel | per-payer funnel | PRODUCTION VERIFIED (endpoint) | **#524** `/admin/funnel/x402-payers` | — | real-SQL test | endpoint 401 without token | values need an admin read | founder reads with X-Admin-Token | N |
| 4.1 Refund policy | `/legal/refunds` draft | READY FOR REVIEW (draft, DO NOT MERGE) | **#525** | — | tsc clean; ux-copy pass | jakuraa.com/legal/refunds still 404 (correct) | founder "approved" + legal/CA review | founder comments "approved" | **Y** |
| 4.2 Invoice address | startup validator + listener separation | READY FOR REVIEW (on #520) | `bbcd2298` | — | separation test (claim to invoice address writes nothing) | — | no address provided | founder provides a dedicated Safe address (address only) | **Y** |
| 4.3 Deposit fix | `/api/keys/deposit` atomic | DEPLOYED | **#523** → `113cd7c6` | 1.5 | d1/d2 red→green | new container + health green | — | — | N |
| 4.4 Wave 1.10 | Part 11 items 1–8 | READY FOR REVIEW (on #520) — **8/8 PASS** | `7ae91537` | 2.4 | `part11_acceptance.integration.test.ts` 8/8 | — | P11-7 in prod depends on `LEDGER_SHADOW_WRITE` (UNVERIFIED) | — | N |
| 4.5 Checkout E2E | preview pay → on-chain confirm → receipt → entitlement → ledger | BLOCKED | — | 4.1, 4.2 | API e2e in integration suite | — | refund page + invoice address | after 4.1 + 4.2 | **Y** |
| 5 Admin command center | metric registry + alerts; 401 sweep | PRODUCTION VERIFIED (endpoints) | **#526** | — | 4/4 real-SQL | `/admin/*` 28/28 GET → 401; new endpoints 401 | — | UI page wiring after ADMIN_UI gate | N |
| 5a Public financial endpoint | `/api/financial/truth` is public (200, no token) | BLOCKED — decision | — | — | — | 200 on api + satelink.network | gating blanks public `/node`, `/machine-console`, mission-control panels | founder: admin-only or public summary? | **Y** |
| 6 Product registry | registry + surface test + MCP list | PRODUCTION VERIFIED | **#527** | — | product_registry 4/4; mcp reuse 2/2 | `.well-known` products live | — | — | N |
| 6a MCP 402 loop | MCP re-paid $0.10 per call (Rail 1.5 removed) | MERGED (repo) | **#527** | — | 6 calls → key reused; mutation red | — | npm / MCP-registry package not republished | founder republishes the package | **Y** |
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
| an `api_credits` row is bound to the burn address `0x…dEaD` (seen when a recover-challenge probe returned a nonce) | low | investigate; one harmless 10-min nonce row was written by the probe |
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
