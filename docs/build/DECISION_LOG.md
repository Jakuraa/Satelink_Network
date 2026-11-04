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
