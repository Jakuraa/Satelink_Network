# Security incident 2026-11-04 — credentials in public Git history

Status: **OPEN — founder action required.** Found by Release A Phase P0 (read-only investigation).
Categories only (this repository is public). Exact commits, paths and line numbers are in
`docs/build/evidence/private/SECURITY_INCIDENT_2026-11-04_DETAIL.md` on the build machine (gitignored).

## Verdict
| Question | Answer | Evidence |
|---|---|---|
| Was production database data (dump / rows) ever committed or pushed? | **No** | 0 of 11,764 Git blobs (reachable + unreachable + dangling, all refs incl. 586 PR heads and remote tags) carry `PGDMP` magic, a `-- PostgreSQL database dump` header or `COPY public.` blocks; no blob > 5 MB; 0 releases, 0 Actions artifacts, no Pages site |
| Were live-looking credentials pushed to a public ref? | **Yes — liveness UNKNOWN** | see table below; liveness cannot be checked without touching production credentials (forbidden) |
| Is anything sensitive held only locally? | **Yes** | see "Local only" |

## Exposed in public history (all removed from `main` HEAD, still reachable in history)
| ID | Class | Public since | Blast radius if still valid |
|---|---|---|---|
| E1 | JWT signing secret, written inside a `railway variables set` command (i.e. production-labelled) | 2026-02-22 | Forge any HS256 session/access token the API accepts (users, node operators, possibly admin roles) |
| E2 | Slack incoming-webhook URL | 2026-04-19 | Post arbitrary messages into the workspace channel (phishing/spoofing) |
| E3 | Discord webhook URL with token (already known 2026-09-30, still unrotated per records) | 2026-04-19 | Post/spoof messages in the Discord channel |
| E4 | Admin password hash embedded in a client-side page | 2026 (main history) | Offline cracking of that password; dangerous if reused anywhere |
| E5 | One HS256 access JWT (expired 2026-03-07; not signed by E1) | 2026-02-28 | None while expired; gives attackers a sample for offline secret guessing |
| E6/E7 | Personal / third-party email addresses (PII) | 2026-10-11 / 2026-11-03 | Privacy; no credential |

## Local only (verified NOT on GitHub — blob API 404, positive control 200)
| ID | Class | Where |
|---|---|---|
| L1 | **Plaintext env file whose private keys derive to the production signer `0x988f…cf91` and the treasury `0x966E…7Ad4`** (plus four other keys) | a `git stash -u` entry from 2026-09-22 in the local `.git` (shared by every worktree on this machine) |
| L2–L4 | An RSA private key PEM, a fixture-shaped payment-provider live-key string, one gzip blob | unreachable local objects |

The GitLab remote's object store was not checked (no authenticated access); founder to confirm L1 was never pushed there.

## Repository protections found
GitHub secret scanning: **disabled**. Push protection: **disabled**. Forks: 0.

## Founder remediation (in order)
1. **Rotate E1 now**: set a new `JWT_SECRET` in Railway; this invalidates all existing sessions/tokens (expected). Confirm no other service shares the value.
2. **Delete E2 and E3** webhooks in Slack/Discord and create new ones stored only in a secret manager.
3. **E4**: if that admin password is used anywhere, change it there.
4. **L1 (highest consequence)**: the production signer and treasury private keys exist in plaintext on this machine. Move funds/roles to fresh keys if there is any doubt about this machine; then drop that stash entry yourself (`git stash list` → identify by date 2026-09-22 → `git stash drop stash@{n}`) and run `git gc --prune=now`. Agents will not do this (destructive).
5. Enable GitHub **secret scanning + push protection** (Settings → Code security).
6. Optional, after rotation: history rewrite (git filter-repo) + force-push + GitHub Support request to purge cached PR refs/views. Rotation is what actually closes the risk; a rewrite only reduces noise.
7. Assess notification for the PII in E6/E7 (two third parties' addresses).

## What this session did and did not do
- Did: read-only scans (custom object scan, gitleaks 8.30.0 redacted, trufflehog 3.99.8 `--no-verification`, Raw fields dropped); added future-exposure guards (P0.6).
- Did not: verify any credential against a provider, read `.env`, rotate, delete, rewrite history, or touch production.
- Build continues **only** on freshly generated local test credentials; no work touches auth secrets, payment config or production (DECISION_LOG D-A2).
