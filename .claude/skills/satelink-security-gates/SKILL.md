---
name: satelink-security-gates
description: Use before committing, pushing, touching backups, env/config, auth, connectors or anything production-adjacent in Satelink — lists the gates, what they block, and how to verify them.
---
# Satelink security gates

| Gate | Where | Blocks | Test |
|---|---|---|---|
| Claude PreToolUse Bash | `.claude/hooks/guard-bash.sh` | prod hosts, Railway hosts, api.alpaca.markets, non-local `DATABASE_URL`, any command touching `*.dump/*.pgdump/*.backup`, `git add -A/.`, adding env/dump/key files, force push, push to main, `--no-verify`, `gh pr merge`, publish, railway/vercel CLI | `bash .claude/hooks/tests/run.sh` |
| Claude PreToolUse Edit/Write | `.claude/hooks/guard-files.sh` | `.env*` (not `.env.example`), dumps/keys, migrations already on origin/main or numbered ≤ its max, railway/vercel/nixpacks config | same |
| Claude PostToolUse | `secret-scan.sh`, `money-path-warn.sh`, `lint-typecheck.sh` | gitleaks hit on edited file; money-path reminder; eslint errors | same |
| Git pre-commit | `scripts/pre-commit-gate.sh` | secret patterns, `.env`, token files, dumps (name + `PGDMP` + pg_dump header), gitleaks staged, bloat | `bash scripts/security/check-no-dumps.test.sh`, `node --test scripts/security/secret_scan.test.mjs` |
| Git pre-push | `scripts/secret-scan.sh` | Cloudflare/Vercel/Dodo/Resend token shapes in outgoing diff | — |
| CI `security` job | `.github/workflows/ci.yml` | same + gitleaks on the PR's new commits | CI |

Never bypass a gate (`--no-verify` is forbidden). A false positive is fixed by changing the input (e.g. split a
literal, summarise instead of committing raw data) or by a reviewed pattern fix with a test.

Backups: `backups/protected/*.dump`, `docs/release/*.dump` — never move/copy/read/modify (BACKUP_POSTURE.md).
Open incident: `docs/build/SECURITY_INCIDENT_2026-11-04.md` (rotation is founder work; never use production secrets).
