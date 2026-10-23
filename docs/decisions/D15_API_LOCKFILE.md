# D15 — apps/api deploy lockfile (2026-10-20)

Status: DECIDED (mandate W0 lets the build session choose with evidence).

## Problem
Railway builds `Satelink-api` with `rootDirectory=/apps/api`, so the repo-root
`package-lock.json` is invisible to the build and Nixpacks runs a fresh `npm install`.
Every deploy re-resolves all dependency ranges. On 2026-10-15 one upstream publish
(a vitest peer) broke every API deploy (hotfix #541).

## Options
1. Switch the service to the repo root and `npm ci -w apps/api`. Needs a Railway service
   setting change (founder-only, §13) and changes the build context.
2. **Commit `apps/api/package-lock.json`** generated in isolation (outside the workspace),
   so Nixpacks auto-detects it and runs `npm ci`. No dashboard change.

## Decision
Option 2. The lock was generated on 2026-10-20 from `apps/api/package.json` alone, so it
records today's fresh resolution, which is what production installs on each deploy. It does
not record the older versions in the root lockfile; for 12 direct deps it is newer (e.g.
express 5.2.1 → 5.3.0, which production already runs).

## Evidence
- Isolated `npm ci` from the lock: 615 packages, OK. `app_factory.mjs` imports cleanly.
- API mocha suite from the isolated install (98 self-contained files): 455 passing,
  165 pending, 3 failing: x402 t2/t9 (allowlisted baseline) and a docs-regeneration test
  that reads `../../docs`, which the isolated copy does not contain. Same as the root baseline.
- CI job `API deploy install` reproduces the isolated `npm ci` and the import smoke on every PR.

## Consequences
- Bumping an API dependency now means regenerating `apps/api/package-lock.json` the same way
  (`cp apps/api/package.json /tmp/x && cd /tmp/x && npm install --package-lock-only --ignore-scripts`,
  then copy the lock back). CI fails if the lock is out of sync.
- The root lock and the API lock can diverge. CI tests run on the root install; the deploy
  install job guards the API lock. Converging them is W10 (or option 1, if the founder moves
  the Railway root directory).
