# Release reconciliation — 2026-10-12

Step 1.1 of the 2026-10-12 escalation directive. Read-only. "Deployed?" is proven by
**live behaviour** on `https://api.satelink.network` (curl, 2026-10-12 ~18:15 and ~23:10 IST),
never by merge status.

## Matrix

| PR/branch | objective | files | tests/CI | base | conflicts with | deployed? (live proof) | next action |
|---|---|---|---|---|---|---|---|
| **#521** `fix/x402-session-continuity-and-financial-truth` @ `31c19979` (other agent) | x402 reuse key, `PAYMENT` alias, capabilities/`freeTier:null`, truth.js revenue split | 14 (api x402 mw, credit_service, deposit_validation, free_tier_gate, truth.js, earnings, machine_intel/onboarding, 3 web pages, 2 tests) | CI green except Vercel web preview | `main` | #520 (textual: `apps/console/package.json`, `package-lock.json`; semantic: `credit_service.mjs`, `app_factory.mjs` auto-merge) | **No.** `/v1/capabilities` still lists `anonymous_free_tier` | **Do not merge — critical credential flaw** (see §3). Close as superseded by #522 once #522 merges |
| **#522** `fix/x402-secure-session-key` (this round) | #521's useful parts + random hashed session key + signed recover | 20 | local: 456 pass / 3 pre-existing x402 network fails (main: 439/4); CI: see PR | `main` | none with main; same textual overlap with #520 as #521 | **Yes** — merged `0bb1cd18`; recover endpoint live (400 on `{}`); guessed key → 402 | PRODUCTION VERIFIED |
| **#523** `fix/api-keys-deposit-atomic` (this round) | `POST /api/keys/deposit` atomic credit | 2 | d1/d2 fail on main, pass on branch; 442 pass / 3 pre-existing | `main` | none | **Yes** — merged `113cd7c6`, new container, health green | DEPLOYED |
| **#524** `fix/discovery-consistency` | no free calls on any surface; x402 headers + recover documented; per-payer funnel | 6 | 9/9 + funnel SQL test | `main` | none | **Yes** — capabilities `free_calls:0`, well-known `request_headers` | PRODUCTION VERIFIED |
| **#525** `draft/legal-refunds-policy` (draft) | refunds & cancellations policy | 3 | tsc clean | `main` | none | No — `/legal/refunds` 404 (correct until approved) | **Founder "approved" + legal/CA review** |
| **#526** `feat/admin-financial-metrics` | metric registry + 5 alerts; 402-loop instrumentation | 6 | 4/4 real SQL | `main` | none | **Yes** — new container; endpoints 401 without token | PRODUCTION VERIFIED (auth) |
| **#527** `feat/product-registry` | product registry + surface test; MCP session-key reuse | 12 | registry 4/4, MCP 2/2 | `main` | none | **Yes** — `.well-known` products live | PRODUCTION VERIFIED; MCP package republish = founder |
| **#520** `platform/wave1-payments` (draft) | PaymentAdapter contract, single-txn ingest, 5 adapters, webhooks, refund gate, on-chain invoices, checkout UI | 46 (+3769/−11) | Secret scan ✓; Vercel web/corporate ✗ | `trading-agent/integration` | #521/#522 (see above) | No (`/v1/payments/methods`, `/webhooks/razorpay` → 404; `PAYMENTS_V1` unset) | Stays draft; now includes main through #527 (`687cc455`): integration 266/266, api 1235 / 3 pre-existing; + Razorpay suspended, invoice validator, Part 11 8/8, Transacty |
| **#517** `feat/platform-decisions-beta-email` | Beta founder-email startup warning + admin flag; DECISIONS doc (now incl. Part 11 1–8, `5e67e200`) | 5 (+docs) | CI fully green at `c1681040` | `main` | none | **Yes** — merged `e01c8f5b`; `[beta-requests]` warning absent from current deployment logs | DEPLOYED (+test email = founder) |
| **#492** `trading-agent/integration` @ `ee13185c` (draft) | Trading AI integration branch (497 files) | 497 | CI green, CLEAN | `main` | — (117 commits ahead of main) | No (`/v1/trading/health` → 404) | Stays draft: Gate 0 + REAL MONEY GATE 1 unmet |
| `ee13185c` | Merge origin/main → integration (main wins web conflicts) | merge | integration suite unblocked | integration | — | No | none |
| `deedf051` (#520) | x402 shadow ledger writes fire only AFTER settlement commits | `settlement.js` | x402 shadow-atomicity integration test | wave1-payments | **#522** touches `settlement.js` (key issuance inside txn) — rebase needed, logic compatible | No | Carry through #520 rebase |
| `cfab183b` (#520) | DepositListener credit atomic (`creditAccount` BEGIN/COMMIT) | `credit_service.mjs` + test | integration test | wave1-payments | #522 edits `resolveAccount` in same file — auto-merges | No | Carry; review note: `isPool` heuristic relies on pg-internal `totalCount` |
| `4e25b9d9` (#520) | Trading AI checkout screens (Wave 1.8 UI) | console | harness e2e | wave1-payments | — | No | Blocked on refund page + invoice address |
| `94058760` (#520) | Refund-policy completion gate + safe on-chain invoices (Wave 1.8 API) | payments | 409 when refund policy unpublished | wave1-payments | — | No | Blocked on refund page + invoice address |

## §2 — #521 ↔ #520 overlap (test-merge of #521 into a scratch copy of `platform/wave1-payments`)

`git merge --no-commit origin/fix/x402-session-continuity-and-financial-truth` on a detached
worktree of `origin/platform/wave1-payments` (aborted afterwards):

| file | result |
|---|---|
| `apps/console/package.json` | **CONFLICT** (content) |
| `package-lock.json` | **CONFLICT** (content) |
| `apps/api/app_factory.mjs` | auto-merged (#521 `/api/mode` freeTier; #520 `mountPayments`) — no semantic clash |
| `apps/api/src/billing/credit_service.mjs` | auto-merged (#521 `isApiKey`; #520 `creditAccount` txn) — no semantic clash |
| `apps/web/package.json` | auto-merged |

No money-logic conflict. The x402 ledger write (`deedf051`) and #522's key issuance both live
in `recordX402Settlement`; they compose (issuance is inside the settlement transaction, the
shadow writes fire after COMMIT).

## §3 — Security verdict on #521 (Step 1.3)

**Deterministic. Critical.**
- Key minted at `apps/api/src/payments/x402/settlement.js:67`: `` `x402_${payer.toLowerCase()}` ``.
- Zero server-generated entropy; derivable from the payer address printed on the Base
  settlement transaction; stored plaintext as `api_credits.api_key` (primary key).
- #521 changes `isApiKey()` (`credit_service.mjs:42`) and `KEY_PREFIXES`
  (`deposit_validation.mjs`) to accept `x402_`, turning that public value into a bearer
  credential → anyone could spend any x402 payer's prepaid calls.
- #521 also logged the credited key in plaintext (`middleware.js` settle log) — for a payer
  whose oldest account is an `sk_` account that is a real `sk_` secret.
- **On main today** the `x402_<payer>` value exists but is NOT accepted as a credential
  (`isApiKey` = `sk_` only; bare `x-wallet-address` rejected, `rpc_gateway.js:215-228`), so
  main is safe — it only has the continuity gap (paid bundle calls cannot be reused).

Fix: PR #522 (random 32-byte key, sha256-only storage, returned once, never logged,
`POST /v1/x402/key/recover` with EIP-191 signature). Test `k1` proves a guessed
`x402_<address>` is rejected; mutation (re-adding `startsWith('x402_')`) turns it red.

## §4 — `/api/keys/deposit` defect (Step 1.5)

**Confirmed.** `api_keys_route.mjs:377-390` (main): `INSERT INTO api_deposits` and
`UPDATE api_credits` are separate autocommit queries. Crash between them → deposit row
persisted, account not credited, every retry refused by the `tx_hash` pre-check
(`:230`) → stranded USDT. Failing test `test/api_keys_deposit_atomicity.test.js` d1/d2 on
main; fixed in PR #523.
