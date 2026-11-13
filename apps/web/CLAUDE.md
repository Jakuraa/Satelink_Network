# apps/web — public website satelink.network (Next.js, Vercel)
Purpose: marketing + docs. Claims must be true today (`npm run lint:claims`). Release A: "Preview — simulated, no charges".

## Commands
`npm run dev` (3000) · `npm run build` · `npm run lint` · `npm run lint:claims` · `npm run test:run` (vitest).

## Rules
Never link `app.satelink.network` (dead). No third-party logos, no fabricated metrics (the historical 1,878 TX is never a live metric). Changes ship as PRs only — no `vercel` CLI.

## Forbidden (always)
See root `CLAUDE.md` → Release State A + `docs/build/MASTER_BUILD_PROMPT.md` §1. No production DB/credentials/deploys, no real money, no `git add -A`, no merges, never touch `*.dump` backups. Hooks enforce this (`.claude/hooks/`).
