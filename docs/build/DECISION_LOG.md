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
