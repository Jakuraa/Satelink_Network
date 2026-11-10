# Security and financial path audit — Release A

## §P0 Production data exposure (2026-11-04, read-only)

**Result: production database data NOT EXPOSED. Credentials EXPOSED in public history (liveness unknown)** —
see `SECURITY_INCIDENT_2026-11-04.md`.

| Item | Value |
|---|---|
| Refs examined | 1,111 (`docs/build/evidence/p0-refs-summary.txt`): local heads, 623 `origin/*` incl. **586 PR heads** (`refs/pull/*/head`, includes closed/force-pushed), 124 remote tags, local tags, `refs/stash`; reflog 2,679 entries; 0 notes |
| Objects examined | **11,764 blobs** (every object in the store: reachable, unreachable, dangling, packed, loose; `git cat-file --batch-all-objects`), 3,020 commits, 16,007 trees, 17 tags; `git fsck --unreachable --no-reflogs`: 182 blobs, 277 commits, 562 trees unreachable |
| Content rules (custom, `scripts/security/scan-git-objects.sh`) | `PGDMP` magic (offset 0 and embedded), gzip/zip/xz magic, `-- PostgreSQL database dump`, `COPY public.`, `CREATE TABLE public.`, ≥20 unique emails, INSERT/COPY with emails, postgres URL with password, PEM private key, JWT, `sk-or-v1-`, Stripe live-key prefixes, xprv, 64-hex near key words (→ public address derived locally to classify), AWS/GCP shapes, blob > 5 MB |
| Dump hits | **0** PGDMP, **0** pg_dump headers, **0** `COPY public.`, **0** blobs > 5 MB |
| gitleaks 8.30.0 (`--redact`, `--log-opts=--all`) | 163 findings / 2,460 commits; triaged (placeholders, EVM addresses, public test keys, URLs) → 4 real-looking public credentials (E1–E4) |
| trufflehog 3.99.8 (`--no-verification`, Raw/RawV2 dropped) | 132 findings (Postgres 62, Infura 43, RailwayApp 15, Box 10, Slack 2); all Postgres = local/placeholder/test-guard fixtures; Infura = upstream forge-std IDs; Railway = project/service IDs; Box = lockfile hashes; Slack = E2 |
| Publication channels | 0 GitHub releases; 0 Actions artifacts; no GitHub Pages; Vercel/Railway deploys are Git-connected (tracked files only); 0 forks |
| GitHub protections | secret scanning **disabled**, push protection **disabled** |
| Not checked | GitLab remote object store (no auth); credential liveness (would touch production — forbidden) |

Local file inventory and backup risk: `BACKUP_POSTURE.md`. Raw tool output (redacted): `evidence/private/` (local only).

### P0.6 guards added (branch `build/p0-safety`)
- `.gitignore`, all `.dockerignore` (incl. new `workers/reconciler/.dockerignore`), all `.vercelignore`, `.railwayignore`: dumps, backups, `.env*` (keep `.env.example`). Verified: gitignore engine for gitignore-syntax files; `@balena/dockerignore` (Docker semantics) for Docker files — 3 real dump paths + env files excluded, `.env.example`/`server.js` kept.
- `scripts/security/check-no-dumps.sh` (+ 8 tests): name + `PGDMP` magic + pg_dump header; run by the pre-commit gate (staged files) and CI (tracked tree).
- `.gitleaks.toml` (default rules + `pgdump-text-header` + `evm-private-key-assignment`, Hardhat #0 allowlisted; positive-control tested); pre-commit runs gitleaks on staged changes when installed; CI runs pinned `gitleaks:v8.30.0` over the PR's new commits only.
- `satelink-mcp` already has a `files` allowlist (no change).
