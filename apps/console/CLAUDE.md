# apps/console — customer console (Next.js, port 3400, console.satelink.network)
Purpose: signed-in customer product: assistant, tasks, receipts, usage, explore, developer hub.
Design system: "Signal" tokens (`packages/web-ui/src/styles/tokens.css`). Every page needs loading, empty and error states and must be keyboard-navigable.

## Commands
`npm run dev` · `npm run build` · `npm run lint` · `npx tsc --noEmit` · Playwright specs under `e2e/` / `tests/e2e/`.

## Rules
- No fake numbers: absent data → EmptyState. Simulated objects render `<SimulationBadge/>`; receipts print "SIMULATED — NO MONEY MOVED".
- Console talks to the API through its CSRF-guarded proxy; never call production hosts from local preview.

## Forbidden (always)
See root `CLAUDE.md` → Release State A + `docs/build/MASTER_BUILD_PROMPT.md` §1. No production DB/credentials/deploys, no real money, no `git add -A`, no merges, never touch `*.dump` backups. Hooks enforce this (`.claude/hooks/`).
