# database/ — Financial OS migrations (ledger, reservations)
Purpose: forward-only migrations for the Financial OS schemas, applied by `database/runner.ts` (checksummed, never on app boot, connection string passed explicitly).

## Commands
`npx tsx database/runner.ts migrate|status|verify <LOCAL connection string>` · tests in `database/__tests__/`.

## Rules
Additive only; new number above the highest on `origin/main`; never apply to production (founder action). Read `libs/CLAUDE.md` (frozen architecture, money invariants) before touching ledger code.

## Forbidden (always)
See root `CLAUDE.md` → Release State A + `docs/build/MASTER_BUILD_PROMPT.md` §1. No production DB/credentials/deploys, no real money, no `git add -A`, no merges, never touch `*.dump` backups. Hooks enforce this (`.claude/hooks/`).
