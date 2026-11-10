# workers/ — background workers (reconciler, payments-reconciler)
Purpose: out-of-band reconciliation jobs (separate Railway services).

## Rules
Reconciliation output feeds `REQUIRES_RECONCILIATION`; workers never move money. Release A step execution uses the existing outbox/worker in apps/api — do not add a second queue (R1). No deploys.

## Forbidden (always)
See root `CLAUDE.md` → Release State A + `docs/build/MASTER_BUILD_PROMPT.md` §1. No production DB/credentials/deploys, no real money, no `git add -A`, no merges, never touch `*.dump` backups. Hooks enforce this (`.claude/hooks/`).
