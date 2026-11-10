# Decision log — Release State A

Newest last. Each entry: decision, why, consequence. Founder decisions are marked (FOUNDER).

## D-A1 — 2026-11-04 — Work in a dedicated worktree on `build/*` branches
Another session shares the main checkout (branch `feat/beta-unified-workflow`, uncommitted files).
Release A work happens in `.claude/worktrees/release-a`. Branch stack: `build/p0-safety` → `build/integration-base` → `build/p2-foundation` → `build/s1-primary-journey` → … No merge to `main`; founder merges.

## D-A2 — 2026-11-04 — P0 verdict EXPOSED (credentials); continue local-only build
Credentials (JWT secret, two webhooks, an admin password hash) are in public history; production DB data is not.
Per mandate P0.5, all work touching those credentials, auth secrets, payment config or production stops.
The local build continues using only freshly generated local test credentials (random per run, never derived
from or compared with production values). Rotation is FOUNDER work (`SECURITY_INCIDENT_2026-11-04.md`).

## D-A3 — 2026-11-04 — Security detail stays out of the public repository
The repo is public. Committed security docs list categories, dates and remediation; exact commit/path/line
pointers live in `docs/build/evidence/private/` (gitignored), matching the ledger's existing rule.

## D-A4 — 2026-11-04 — CI gitleaks scans only new commits
A full-history scan would fail forever on findings that can only be cleared by founder rotation/rewrite. Scanning
`base..head` blocks new leaks without masking them behind old ones. Full-history results are recorded in §P0.

## D-A5 — 2026-11-04 — Two local tags differ from origin; not overwritten
`v0.8-backend-locked` and `v1-stable-pipeline` point to different commits locally vs origin. The fetch refused to
clobber them; remote tag objects were fetched into `refs/remotes/origin-tags/*` for scanning instead. No tag changed.

## ADR-1 — Modular monolith
One Express API (`apps/api`), one console (`apps/console`), shared packages. New capability = new module + registry
entry, not a new service. Rationale: one deploy, one DB, one auth system; matches R1.

## ADR-2 — Postgres is the durable source of truth
Workflow runs, steps, events, quotes, reservations, ledger entries and receipts live in Postgres. In-memory stores only
inside unit tests (R2).

## ADR-3 — One capability registry
Registry v3 (#582) is extended; the assistant, planner, Explore UI, OpenAPI, MCP tools and well-known files all read it.
A second catalog is a defect (R1/R9).

## ADR-4 — Simulated money model
Preview money is simulated: every money row carries `origin` and `environment`; revenue = `origin='external' AND
environment='live'` only (view + test). Credits only pay Satelink's own fee; suppliers are paid by the user directly.
Fees come from `config/pricing.preview.json`, labelled **PROPOSED — NOT APPROVED**.

## D-A6 — 2026-11-04 — Integrate published PR heads only
#609 is integrated at its GitHub head `83763dab`. The founder machine's local, unpushed `50fe4e24` (B3 release
candidate, another session) is NOT included — unreviewed and not published. Revisit if it is pushed to #609.

## D-A7 — 2026-11-04 — #583 migration renumbered 020 → 042 on the integration base
020 and 038 both replace `ledger_txns_kind_check`; sorted application drops one set either way (proven by test).
042 = union. #583 must not be merged alone; founder merges the integration base or re-applies the renumber on #583.

## ADR-5 — 2026-11-04 — Money bridge from apps/api to the Financial OS
Context: apps/api is plain Node (Railway Node 20, isolated `npm ci`), the Financial OS packages ship `.ts` source
only, and #583 has no Postgres reservation store. Options: (a) run apps/api under a TS loader — changes production
start; (b) compile the packages into apps/api — changes the production build; (c) JS SQL writer mirroring the TS
domain, the repo's established pattern (`shadow_ledger_write.js`). **Decision: (c)**, plus a **parity contract
test** in the vitest integration project that feeds identical inputs to the TS `reservation-postings` and the JS
writer and requires identical ledger postings, so drift fails CI. Simulated reservations post to the same
`ledger_txns`/`ledger_entries` tables with kinds hold/capture/release, tagged `origin`/`environment` (additive,
nullable columns; NULL = historical/unclassified, excluded from revenue). Production apply of any migration
stays founder-only. Because libs/CLAUDE.md declares the Financial OS architecture frozen, this is recorded as a
founder review item (OB-8) before any production use.

## D-A8 — 2026-11-04 — Preview currency: USD quotes, USDC/6 simulated ledger, no FX
The kernel `Money` knows only USDC/USDT (adding a currency = new Financial OS primitive, frozen). Quotes are
USD integer micro-units; the simulated ledger records them as USDC/6 (1 minor unit = 1 micro-USD), labelled
simulated. INR users see "priced in USD (INR display not available in preview)". No exchange rate is invented.

## ADR-6 — 2026-11-04 — One outbox/worker for tasks
#609's DurableKernel (`wf_journal` + `wf_idempotency` + `wf_dlq`) is the outbox for task steps. Recovery runs
at boot and one in-process sweep expires quotes, approvals and reservations. No BullMQ path and no second queue.

## ADR-7 — 2026-11-05 — MCP client driver without changing apps/api's lockfile
Adding any dependency to `apps/api` makes npm re-resolve the x402 payment stack (the committed lock already holds an
invalid edge: `@coinbase/cdp-sdk` wants `@x402/evm ^2.25.0`, lock has 2.18.0) — an unreviewed change to a live money-path
dependency in the production deploy lockfile. Decision: the S2 MCP client driver loads `@modelcontextprotocol/sdk@1.29.0`
lazily from the workspace install (already present via `apps/mcp-server`) and is constructed only by the local preview
server; production never imports it. Declare the dependency once OB-12 is resolved. (Attempted and reverted, nothing committed.)

## ADR-8 — 2026-11-05 — Developer API keys for the task API (S4)
The existing `/api/keys` keys belong to the live RPC credit money path (`api_credits`) — off-limits in Release A.
Task-API developer keys live in `developer_api_keys` (migration 045), bound to the SAME Better Auth principal
(`user:<id>`), so there is one identity with a second credential type — not a second identity system (R1).
Only SHA-256 hashes + a display prefix are stored; scopes are explicit; revocation is immediate; per-key rate limits
are in-process (fixed window), usage counters are durable (per key per day).

## ADR-9 — 2026-11-05 — Agent commerce surfaces (S5)
- **MCP tools generated from the registry**: `satelink_discover|quote|request_approval|task_status|receipt` in
  `apps/mcp-server/src/task-tools.mjs`, built at `tools/list` from `GET /v1/capabilities` (capability enum, categories,
  catalogue text). Opt-in `SATELINK_MCP_TASK_TOOLS=1`; loopback API only. No approve tool exists.
- **Agent spend pre-authorization = $0** (migration 046, per key). A task with `actor_type = agent` can be approved by a
  key only up to that amount → by default only a person in the console approves (`HUMAN_APPROVAL_REQUIRED`, 403). Agent
  keys from the Developer Hub should omit `tasks:approve` as a second layer.
- **"Every call creates/advances a run"**: quote creates the run; request_approval advances it (journal event
  `APPROVAL_REQUESTED`, no state change); status/receipt read it. Discovery is a registry read and creates no run.
- **MCP revision**: the official TypeScript SDK (latest 1.32.2) negotiates at most 2025-11-25, so the server negotiates
  2025-11-25 — the fallback revision the mandate names. 2026-07-28 is not hand-rolled (OB-13).
- **A2A v1.0**: Agent Card per `lf.a2a.v1` (ProtoJSON camelCase, enums by name), one JSONRPC 1.0 interface; methods
  SendMessage/GetTask/CancelTask on the same task engine; `A2A-Version: 1.0` required (empty = 0.3 → -32009). Satelink
  AWAITING_APPROVAL ↦ TASK_STATE_AUTH_REQUIRED with the console link. `messageId` is the idempotency key. The card is
  unsigned in the preview (no KeyProvider key); `signatures` is omitted, never faked.
- satelink-mcp bumped to 2.2.0 (pack only; publishing is founder action F12).

## ADR-10 — 2026-11-05 — x402 V2 preview for machine commerce (S6)
- `GET /v1/x402/preview/:capability_id?q=…` (preview server only) answers 402 with `PAYMENT-REQUIRED` built with the
  official `@x402/core` 2.18.0 codecs (already an apps/api dependency — no lockfile change): scheme `exact`, network
  `eip155:84532` (Base Sepolia testnet), Base Sepolia USDC, zero-address placeholder `payTo`, `extra.simulated = true`.
- **Amount = the quote's Satelink credit charge only** (the PROPOSED fee). Supplier amounts are never collected by
  Satelink (forbidden: holding customer money to pay third parties).
- The verified payment for the exact quote IS the approval (`TaskService.approveWithPayment`, internal only). It is
  booked as a simulated deposit (`acct_preview_x402_sim` → customer credit, origin `simulated`), then the normal
  reserve → execute → verify → capture runs. x402-paid tasks get no promotional credit. Revenue truth stays $0.
- Verification uses a LOCAL mock facilitator (`tools/mock-x402-facilitator`, `/verify` only — `/settle` does not exist)
  with a documented mock signature scheme; the router refuses a non-loopback facilitator. `PAYMENT-RESPONSE` reports
  `transaction: ""`, `extra.settled: false`.
- A test walks the preview server's import graph and fails if any live x402 middleware, vault/deposit listener, RPC
  credit path or `app_factory.mjs` is reachable, or if reachable code names a vault address / a real facilitator.

## ADR-11 — 2026-11-05 — P4 hardening decisions
- **One egress guard** (`workflows/connectors/egress_guard.js`) for every connector and the x402 facilitator: preview =
  loopback http(s) only; beta/live = https and no private/loopback/link-local/metadata targets (IPv4-mapped IPv6 in
  both forms); every request `redirect: 'error'`. Replaces four per-driver loopback checks (R1).
- **Registry-driven intent routing**: the conversation/plan router recognises the action words the capability registry
  declares (`intents`), so a new capability is reachable from the chat without code changes (R9).
- **Deterministic trading evaluation per quote**: the evaluation clock is anchored to the quote (`offer.as_of`); a
  re-execution is a replay and recovery can verify by recomputation. The bundle-synced trading engine is unchanged.
- **Recovery records the deliverable**: on crash recovery, a connector's verify returns the supplier's own record
  (verified only); the engine stores it when no result was recorded — it never overrides one.
- **x402: one payment per task**: the simulated deposit is booked only inside the winning approval transition and is
  keyed per task.
- **Dependency audit gate**: CI fails on NEW high/critical production advisories; the existing 40 (4 critical) are
  founder actions (OB-14) because fixing them changes production lockfiles and requires deploys.

## D-B1 — 2026-11-10 — Friends Beta session: permissions widened only as far as the ticked authorizations (FOUNDER)
The founder mandate of 2026-11-10 ticks F1–F7, F9, F10. `.claude/settings.json` therefore allows
`gh pr merge <n> --merge` and specific Railway commands (`status`, `logs`, `variables --service Satelink-api`
`--kv` / `--set` / `delete`, `run --service Postgres-iQeW`). Still denied: force-push, push to `main`, publish,
`vercel*`, `.env` and dump reads, `railway up/down/delete`, any Railway command naming `SETTLEMENT_DRY_RUN`,
`FEATURE_REAL_SETTLEMENT` or a signer variable, merging #635, and squash/rebase/admin merges.
Consequence: the 2026-11-09 HOLD is superseded for the listed items only. F8 and F11 stay unticked.

## D-B2 — 2026-11-10 — Production is at Financial OS migration 019, not 039/041
The mandate assumed 040/041 might be pending and authorised 042–046 (F5). Live `schema_migrations` ends at 019 and
none of the 038–046 objects exist. The runner is ordered and cannot skip, and 042 rewrites the same ledger kind check
that 038 widens. Decision: treat 038 and 039 as prerequisites inside F5's intent, rehearse 038→046 on a restored copy
of the fresh backup first, and apply all nine only if the rehearsal verifies. The founder can veto before B3.

## D-B3 — 2026-11-10 — Beta session works in `.claude/worktrees/beta-launch` on `beta/launch`
Created from the #638 head so the stack, #636 and the session documents are one line of history. `release/beta-1`
is cut from `main` after the security train and merges this line. The main checkout is left untouched.

## D-B4 — 2026-11-10 — Production wiring of the assistant is B5 step 0
Release A runs only as a local preview (separate server, `SATELINK_PREVIEW=1` console build, loopback mock
suppliers). The Friends Beta needs it on production, so B5 starts with: (a) mount the task routes in `app_factory.mjs`
behind the beta flag with Better Auth principals, default off; (b) host the simulated suppliers in-process, labelled
simulated, reachable only on loopback, with the egress guard allowing loopback solely for connectors the registry
marks simulated; (c) run the task worker in the API process; (d) point the console task proxy at the production API.
No real supplier, payment rail or facilitator is added; the live x402 rail and `/rpc` money path are not touched.
Why: without it the F10 flags enable nothing a friend can use. Consequence: B5 is larger than the mandate's list.
