# Satelink Execution Board — 2026-10-12 escalation round

Single source of state for this round. Evidence columns hold only verifiable references
(commit, PR, test output, curl result). Last updated: 2026-10-14 ~00:45 IST (round 2026-10-13, see below).

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
| P1a payer attribution | Base chain funding analysis | DONE (docs) | docs PR (this) | `0x1d5f…`/`0x83c1…` never sent funds to payTo on Base mainnet (all tokens, block 46M→52.56M), Base Sepolia or Polygon vaults → **UNDETERMINED** (need Q7). Observed payers: `0x1757…` founder (listed); `0xa41e…` + `0x9cca…` **probable founder** (`0xa41e…` funded founder wallet `0x1757…` 1.0 USDC 984 blocks before its first payment, and is `0x9cca…`'s only funder); `0x7dd8…` **external** (pays 664 x402 merchants) |
| P1b template | `revenue_reconciliation.md` + Q7/Q8 | DONE | docs PR | all figures UNVERIFIED until pasted |
| P1c card provider | Dodo only in code; provider = Q2/Q8 output | DONE | docs PR | no Stripe code; `FOUNDER_GATES.md` records $19.98 Dodo credit as founder email |
| P1d metrics | unchanged | DONE | — | no pasted evidence yet |
| P2 truth + public stats | admin-only + `/api/public/stats` | READY, merge pending | #529 | see row 5a |
| P3a dEaD account | hypotheses + founder checks | DONE (docs) | `BURN_ADDRESS_ACCOUNT.md` | code-only analysis |
| P3b recover hardening | no enumeration, per-IP + per-address limits, pending cap 3, TTL cleanup | READY FOR REVIEW | **#530** `7ccbeac8` | r1–r7 + k-suite 17/17; 4 mutations red; full suite = main's 3 pre-existing |
| P4 repeat usage | verification + runbook | DONE (verify) / NOT RUN (paid test) | `X402_PAID_TEST_RUNBOOK.md` | see row 3.2 |
| P5 checkout prep | CA questions L1–L10; #520 re-verify; #523 scope | DONE | `CHECKOUT_UNBLOCK_PREP.md` | 31/31 on #520+main |
| P6 MCP | 2.1.0 prep + trusted-publishing workflow + steps | READY FOR REVIEW; publish = founder | **#531** `df7b6b30`, `MCP_PUBLISH.md` | see row 6a |

## Security blockers (open)

| id | finding | severity | evidence | proposed fix | owner |
|---|---|---|---|---|---|
| S1 | `POST /api/keys` binds **any** `wallet_address` without a signature. x402 settlement and the USDT DepositListener credit "the oldest row bound to the wallet", and `/api/keys/deposit` ownership trusts the same binding, so a squatter can capture a victim's x402 bundle credit, Polygon deposits, or an unclaimed treasury transfer | **high** | `billing/api_keys_route.mjs:69-98`, `settlement.js:70-76`, `deposit_listener.js` (`resolveAccount({wallet})`), `checkDepositOwnership` | `/api/keys` drops `wallet_address` or requires the `/v1/machine/register` signature; flag existing unsigned bindings (no deletes) | founder decision (public API change) |
| S2 | recover challenge was an account-enumeration oracle (404 vs 200) | medium | `key_recovery_router.js` on main | **#530** | merge #530 |
| S3 | `satelink-mcp` npm name unclaimed while docs say `npx -y satelink-mcp` | medium (supply chain) | npm 404 | publish 2.1.0 (#531, `MCP_PUBLISH.md`) | founder |
| S4 | `/api/economics/summary` is public and returns `totalRevenueUsdt` (20.52585 live), an unverified revenue figure | medium (reporting) | curl 2026-10-13 | gate it like truth, or drop revenue fields | founder decision |
| S5 | an unrecognised x402 key gets a non-payable 402 (no `accepts`), and the MCP client keeps the dead key | medium (repeat usage) | prod probe 2026-10-13; `rpc.mjs` | settle with runbook E7, then fix server + client | after paid test |

## Founder actions (in priority order)

1. **Decide S1** (wallet binding requires a signature). It blocks checkout E2E and is a live money-capture path.
2. Merge **#529** (truth admin-only). This session's merge was denied by the permission policy. Claude then verifies prod.
3. Merge **#530** (recover hardening).
4. Run `revenue_reconciliation_2026-10-12.sql` read-only (incl. Q7/Q8) and the 3 `BURN_ADDRESS_ACCOUNT.md` queries; paste the output.
5. Confirm or deny that `0xa41e…c61a` and `0x9cca…95d4` are founder wallets.
6. Merge **#531**, then publish `satelink-mcp@2.1.0` (`MCP_PUBLISH.md`).
7. Say "go" + fund a founder test wallet → paid test (`X402_PAID_TEST_RUNBOOK.md`).
8. Send #525 questions L1–L10 to the CA; provide the invoice Safe address.
