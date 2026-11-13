# Toolchain inventory — Release A (PT, 2026-11-04)

## Runtime
| Tool | Version |
|---|---|
| Claude Code | 2.1.311 |
| Node | v24.13.0 (CI uses 22) |
| npm | 11.6.2 (no pnpm) |
| Docker | CLI present; **daemon not running** (no server version) — affects P1.4 (see BUILD_LEDGER) |
| gh | logged in (`satelinkinternet-collab`), scopes: gist, read:org, repo, workflow |
| gitleaks | 8.30.0 (pre-installed) |
| trufflehog | 3.99.8 — **installed this session** via `brew install trufflehog` |
| typescript / typescript-language-server | 7.0.2 / 6.0.3 — **installed this session** via `npm i -g typescript typescript-language-server` |

## Plugins (official marketplace `anthropics/claude-plugins-official` only)
| Plugin | Status | Scope / version |
|---|---|---|
| feature-dev | INSTALLED this session | project |
| code-review | enabled (pre-existing) | user · ad30d62cd52a |
| security-guidance | enabled (pre-existing) | user · 2.0.8 |
| playwright | enabled (pre-existing) | user · ad30d62cd52a |
| context7 | NOT INSTALLED as plugin — Context7 already connected via the claude.ai connector (no double registration) | — |
| frontend-design | enabled (pre-existing) | user |
| typescript-lsp | enabled (pre-existing); language server installed this session | user · 1.0.0 |
| github | enabled (pre-existing); its MCP server fails auth (HTTP 401) this session — `gh` CLI used instead | user |
| claude-md-management | INSTALLED this session | project · 1.0.0 |
| code-simplifier | available as an agent inside pr-review-toolkit (no separate install) | — |
| pr-review-toolkit | enabled (pre-existing) | user · ad30d62cd52a |
| vercel | enabled (pre-existing); read-only use, `vercel` CLI denied | user · 0.43.0 |
| **Superpowers** | **INSTALLED (pre-existing)** — listed in the official marketplace manifest (`superpowers@claude-plugins-official` 6.4.1); not installed by this session | user |

Nothing installed from any other marketplace.

## MCP (`.mcp.json`)
Not created. The official Postgres reference server (`@modelcontextprotocol/server-postgres`, latest 0.6.2) is
**deprecated on npm**; registering it is a supply-chain risk. Local DB access uses `psql "$DATABASE_URL_LOCAL"`.
GitHub and Vercel come from plugins (no duplicates).

## Settings + hooks (`.claude/settings.json`, `.claude/hooks/`)
Deny/allow lists per prompt PT.4. Hooks: guard-bash, guard-files (PreToolUse); lint-typecheck, money-path-warn,
secret-scan (PostToolUse); resume-capsule (SessionStart compact|resume); continue-if-unfinished (Stop, reads
`docs/build/PHASES.txt`, cap 20/session). Tests: `bash .claude/hooks/tests/run.sh` → **50 passed, 0 failed**.
Note: the session that wrote them was started from the main checkout, so these project hooks apply to sessions
started in this branch/worktree, not retroactively to that session.

## CLAUDE.md files
Root `.claude/CLAUDE.md` (152 lines: Release A block + skill routing table; stale prod-DB advice removed);
new: `apps/api`, `apps/console`, `apps/web`, `apps/corporate`, `apps/mcp-server`, `database`, `workers` (8–14 lines).
`libs/CLAUDE.md` (316 lines, pre-existing Financial OS rules) left unchanged — over the 150 target, founder-owned.

## Project skills (`.claude/skills/`)
Created: `satelink-product-context`, `satelink-security-gates`.
Created when their phase starts: satelink-workflow-engine, satelink-capability-registry, satelink-model-routing,
satelink-financial-simulation (P2); satelink-console-ui, satelink-e2e-evidence (S1); satelink-connectors-protocols
(S2); satelink-trading-ai (S3). Remaining skills from the founder's 34-skill list: **DEFERRED — create when the
workstream starts**.

## Subagents (`.claude/agents/`)
repo-auditor (RO), security-auditor (RO), financial-reviewer (RO), backend-builder, frontend-builder,
test-engineer, release-reviewer (RO). RO = Read, Grep, Glob, read-only Bash (instructed; Bash cannot be
technically restricted to read-only by the tool list).
