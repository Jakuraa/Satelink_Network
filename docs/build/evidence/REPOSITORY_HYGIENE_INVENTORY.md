# Repository hygiene inventory — 2026-10-20

Pass A of the repository hygiene directive. Base `origin/main` @ `1102d2b1` (recovery tag
`archive/pre-cleanup-2026-10-20`). Evidence = `git grep` reference counts across the monorepo (excluding
the path itself and `package-lock.json`), `git log` origin, deploy/CI configs, and Railway service names.
Classes: KEEP_AUTHORITATIVE · KEEP_ACTIVE_DEPENDENCY · KEEP_HISTORICAL · KEEP_LOCAL_UNTRACKED ·
ARCHIVE_CANDIDATE · DELETE_VERIFIED_SAFE · NEEDS_FOUNDER_APPROVAL.

## 1. Root loose files

| Path | Added | Refs | Class | Reason / evidence |
|---|---|---|---|---|
| `README.md`, `CONTRIBUTING.md`, `LICENSE`, `LICENSE.BSL`, `CLAUDE.md` (→ `.claude/CLAUDE.md`) | Feb–May | 6–62 | KEEP_AUTHORITATIVE | mandate §10 root set; licences R20. Licence conflict MIT vs BSL is F6 (not touched) |
| `package.json`, `package-lock.json`, `turbo.json`, `tsconfig*.json`, `vitest.config.ts`, `.npmrc`, `.nvmrc`, `.mocharc.cjs`, `.dependency-cruiser.cjs` | — | 6–37 | KEEP_ACTIVE_DEPENDENCY | workspace/CI config |
| `foundry.toml`, `foundry.lock`, `remappings.txt` | Mar | 1–6 | KEEP_ACTIVE_DEPENDENCY | Foundry (`contracts/`, never modified) |
| `Dockerfile.api`, `docker-compose*.yml`, `Makefile` | Feb–Mar | 1–4 | KEEP_ACTIVE_DEPENDENCY | local dev tooling, referenced by docs/scripts |
| `railway.json`, `nixpacks.toml` (root) | May–Jun | 6–10 | NEEDS_FOUNDER_APPROVAL | Satelink-api uses `rootDirectory=/apps/api`; root files are documented as never applied, but deleting needs confirmation of every service's root dir (2026-10-07 manifest) |
| `mint.json`, `docs.json` | May | 3 | NEEDS_FOUNDER_APPROVAL | Mintlify config; a Mintlify check ran on PRs — verify the Mintlify project first |
| `AUDIT_REPORT_2026_06.md` | Jun | 5 | KEEP_HISTORICAL | listed as canonical in `CLAUDE.md` |
| `SATELINK_OPS_RUNBOOK.md` | Aug | 3 | KEEP_AUTHORITATIVE | runbook in use (`scripts/ops/OPS_LOG.md`) |
| `SECURITY_HOTFIX.md` | 2026-10-07 | 3 | KEEP_HISTORICAL | Gate 0 security record; candidate for `docs/security/` once that folder exists (mandate layout) |
| 14 #547 reports (`FULL_SURFACE_*`, `GITHUB_AND_*`, `IMPLEMENTATION_AND_*`, `INFRASTRUCTURE_COST_*` ×2, `PREVIEW_DEPLOYMENT_*`, `PRODUCT_CAPABILITY_*`, `REFERENCE_SITE_*`, `REMAINING_FOUNDER_*`, `SEO_GEO_*` ×2, `WEBSITE_*` ×2) | 2026-10-20 | 1–3 (each other + build docs by name) | ARCHIVE_CANDIDATE → **moved** | not evidence (R2); one contains a wrong CIN (audit B2.7) |
| `Dockerfile.paperclip`, `railway.paperclip.json`, `start-cloud.sh` | May | 4–8 (agent notes, historical audits only) | DELETE_VERIFIED_SAFE → **deleted** | Railway services: Postgres-iQeW, Satelink-api, satelink-reconciler, Redis — no Paperclip; no config refs; F2 |
| `.env.example` | — | — | KEEP_ACTIVE_DEPENDENCY | onboarding template (no secrets) |
| `.gitmodules`, `.github/`, `.husky/`, `.vscode/`, `.dockerignore`, `.railwayignore`, `.vercelignore`, `.gitignore` | — | — | KEEP_ACTIVE_DEPENDENCY | tooling/CI |

## 2. Directories

| Path | Files | Last change | Outside refs | Class | Reason |
|---|---|---|---|---|---|
| `agent/` (incl. `agent/memory`) | 103 | 2026-10-15 | 31 | KEEP_AUTHORITATIVE | never delete `agent/memory` (CLAUDE.md, mandate) |
| `agents/` | 3 | 2026-06 | 18 | NEEDS_FOUNDER_APPROVAL | overlaps `agent/`; referenced; consolidation is a content decision |
| `.agents/`, `.cursor/` | 1 each | Apr–May | 24 / 3 | KEEP_ACTIVE_DEPENDENCY | tool instruction files (Codex/Cursor) with references |
| `.antigravity-rules` | 1 | 2026-06 | 0 | NEEDS_FOUNDER_APPROVAL | instructions for Antigravity (D8 scope); deleting changes another agent's behaviour |
| `legacy/` | 16 | 2026-10-12 | 6 | KEEP_HISTORICAL | archive convention from the 2026-10-07 cleanup |
| `src/` (only `MockUSDT.sol`) | 1 | 2026-10-07 | — | NEEDS_FOUNDER_APPROVAL | `.sol` rule; duplicate of `contracts/MockUSDT.sol` |
| `script/`, `lib/`, `broadcast/` | 5 / 2 / 2 | Mar–May | 7 / 25 / 3 | KEEP_ACTIVE_DEPENDENCY / KEEP_HISTORICAL | Foundry scripts + libs; `broadcast/DeployClaimsOnly.s.sol/137/*` is the on-chain deployment record of the claims contract (F21 evidence) |
| `scripts/` | 87 | 2026-10-20 | 83 | KEEP_ACTIVE_DEPENDENCY | CI and ops scripts |
| `test/` (root) | 5 | 2026-10-07 | 88 (name collisions) | KEEP_ACTIVE_DEPENDENCY | `test/foundry/*.t.sol` (forge) |
| `infra/`, `ops/`, `docker/` | 5 / 4 / 2 | Mar–Oct | 2–11 | KEEP_ACTIVE_DEPENDENCY | referenced infra/ops material |
| `docs/vNext` | 55 | 2026-07-22 | 1 | ARCHIVE_CANDIDATE | stale design set; mandate §10 lists it — needs a content review before moving (one live reference) |
| `docs/ui-recovery` | 7 | 2026-06-22 | 0 | ARCHIVE_CANDIDATE | June UI-recovery plans; one mentions the claims contract (useful history). Move with a docs-tree reorganisation |
| `docs/execution` | 75 | 2026-10-07 | 1 | KEEP_HISTORICAL | Sept execution state, founder gates, pricing truth; superseded by `docs/build` but cited (`docs/platform/revenue_reconciliation.md`) |
| `docs/CLEANUP_MANIFEST.md` vs `docs/execution/CLEANUP_MANIFEST.md` | — | — | KEEP_HISTORICAL | two different manifests (2026-10-07 deletions vs a Sept non-destructive log); the root manifest is canonical and now carries the 2026-10-20 addendum |

## 3. Generated artifacts, caches, ignored files

- Tracked generated/OS artifacts (`node_modules/`, `.next/`, `dist/`, `coverage/`, `.turbo/`, `*.log`, `.DS_Store`, `*.tsbuildinfo`, `*.bak`): **0 tracked**. `.gitignore` already covers them; no change made.
- Untracked local items in the shared main checkout (other session's work, `.env` files, local DBs): **not inspected for deletion, not touched** (KEEP_LOCAL_UNTRACKED).

## 4. Secrets / sensitive artifacts

`git grep` over the tracked tree for live and test API keys (the Stripe-style key prefixes followed by 24+ characters), PEM private-key headers,
AWS access keys, Groq/Slack/GitHub tokens, Discord webhook URLs, and 64-hex literals assigned to key-like names: **0 hits**.
History is not rewritten; the known historical exposures (Discord webhook token, a JWT fallback literal) are tracked as F1/F18.

## 5. Branches, worktrees, stashes (inspected, nothing deleted)

- ~30 local worktrees under `.claude/worktrees/` and job tmp dirs, 11 stashes (incl. "PRESERVED-2026-07-16" RevenueVaultV2 variant). Owned by other sessions or the founder → NEEDS_FOUNDER_APPROVAL; never deleted by this pass.
- Open PRs: #565 (founder-review, money path), drafts #525/#520/#492 (do-not-merge by title).

## 6. Founder approval list

1. Root `railway.json` / `nixpacks.toml` — confirm no Railway service uses the repo root.
2. `mint.json` / `docs.json` — is the Mintlify project still live?
3. `agents/` vs `agent/` and `.antigravity-rules` — consolidate or keep.
4. `src/MockUSDT.sol` duplicate (`.sol` rule).
5. `docs/vNext`, `docs/ui-recovery` → `docs/archive/` in a docs-tree reorganisation.
6. Stale worktrees/stashes on the build machine.
