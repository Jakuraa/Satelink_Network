# apps/api — Express API (Railway service Satelink-api)
Purpose: all HTTP routes; `server.js` → `app_factory.mjs` mounts everything (do not refactor without migrating routes).
Release A: workflow engine, capability registry, model router, planner and simulated money live under `src/` and mount under `/v1`.

## Commands
- Tests: `npm run test:baseline` (mocha `--no-config --exit`; prod-DB guard required). Pre-existing failures are recorded in `docs/build/STATUS_MATRIX.md` — a NEW failure is a regression.
- Local DB only: `DATABASE_URL_TEST` / `DATABASE_URL_LOCAL` (never `DATABASE_URL` pointing anywhere but localhost).
- Migrations: `apps/api/migrations/NNN_*.sql` — additive only, number above the highest on `origin/main`, with a `down/` script.

## Money-path warnings
`src/routes/credits.js`, `src/workloads/rpc_gateway/`, `src/economics/`, x402 middleware, payments adapters, anything ledger/receipt/reservation: integer minor units or NUMERIC (R4), `origin` + `environment` on every money row (R5), idempotency keys (R6), `simulated: true` labels in preview (R10). `SETTLEMENT_DRY_RUN=1` stays.

## Forbidden (always)
See root `CLAUDE.md` → Release State A + `docs/build/MASTER_BUILD_PROMPT.md` §1. No production DB/credentials/deploys, no real money, no `git add -A`, no merges, never touch `*.dump` backups. Hooks enforce this (`.claude/hooks/`).
