# Repository cleanup report — 2026-10-20

The canonical report for the repository hygiene directive. Inventory and per-item evidence:
`docs/build/evidence/REPOSITORY_HYGIENE_INVENTORY.md`. Manifest rows: `docs/CLEANUP_MANIFEST.md` (addendum 2026-10-20).
Recovery: tag `archive/pre-cleanup-2026-10-20` @ `1102d2b1` (pushed before any change).

## Deleted (DELETE_VERIFIED_SAFE)

| Path | Reason | Evidence |
|---|---|---|
| `Dockerfile.paperclip`, `railway.paperclip.json`, `start-cloud.sh` | Paperclip agent service decommissioned (F2) | Railway services today: Postgres-iQeW, Satelink-api, satelink-reconciler, Redis (names only). No CI/Docker/Railway/Vercel config or code references them. The 2026-10-07 manifest already marked them DELETE, but they were never removed on `main` |

## Archived (moved, history kept via `git mv`)

| From | To | Reason |
|---|---|---|
| 14 #547 root reports (`FULL_SURFACE_*` ×2, `GITHUB_AND_DEVELOPER_ECOSYSTEM_POSITIONING.md`, `IMPLEMENTATION_AND_VERIFICATION_REPORT.md`, `INFRASTRUCTURE_COST_REDUCTION_*` ×2, `PREVIEW_DEPLOYMENT_AND_VERIFICATION_REPORT.md`, `PRODUCT_CAPABILITY_AND_CLAIM_REGISTER.md`, `REFERENCE_SITE_RESEARCH.md`, `REMAINING_FOUNDER_DECISIONS.md`, `SEO_GEO_*` ×2, `WEBSITE_*` ×2) | `docs/archive/2026-10/` (+ `README.md` index marking them non-evidence) | Root clutter; agent-written, not evidence (R2); mandate §10 target layout. Links updated in `docs/build/evidence/REPO_MAP.md` |

## `.gitignore` changes

None. Zero generated or OS artifacts are tracked; existing rules already cover them.

## Code / configuration removed

Only the three Paperclip deploy files above. No source code, test, package, migration or money-path file was touched.

## Retained on purpose (looks old, kept)

- `AUDIT_REPORT_2026_06.md`: canonical per `CLAUDE.md`.
- `SECURITY_HOTFIX.md`: Gate 0 security record.
- `SATELINK_OPS_RUNBOOK.md`: runbook in use.
- `legacy/`: archive convention from the 2026-10-07 cleanup.
- `docs/execution/`: September execution state, still cited.
- `broadcast/`: on-chain deployment record of the claims contract, which is F21 evidence.
- `script/` and `lib/`: Foundry.
- `agent/memory`: never deleted.

## Needs founder approval (not changed)

Root `railway.json`/`nixpacks.toml`, `mint.json`/`docs.json`, `agents/` vs `agent/`, `.antigravity-rules`,
`src/MockUSDT.sol`, `docs/vNext` and `docs/ui-recovery` (archive in a docs-tree reorganisation), stale
worktrees/stashes on the build machine. Details in the inventory §6.

## Checks actually run

- `git grep` reference sweep for every root file and candidate directory (counts in the inventory).
- Railway service list (names only).
- Secret-pattern sweep of the tracked tree: 0 hits.
- Tracked generated artifacts: 0.
- `git diff --cached --check`: clean.
- Dangling links to moved files: none. Four name-only mentions remain, in the founder audit text, the mandate and one historical note.
- Canonical and deploy files present: 14/14, including `apps/api/railway.json`, `apps/api/nixpacks.toml`, `apps/api/server.js` and `Dockerfile.api`.
- CI on the PR: see the PR checks. It runs the full DB-backed API suite (#564), web build, lint and secret scan.

## Remaining uncertainty / cleanup debt

- The docs tree does not yet follow the mandate §10 layout (`architecture/`, `runbooks/`, `security/`, …).
- No link checker runs in CI yet.
- `knip`/`depcheck` dependency evidence has not been run, so no packages were removed.
- Root `package-lock.json` has not been regenerated (mandate §10 item; separate PR).

## PRs

- This cleanup PR: see the PR link in the session report. Earlier cleanup: #516 (2026-10-12).
