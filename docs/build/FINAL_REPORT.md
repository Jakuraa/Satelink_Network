# Release State A — final report (2026-11-09)

## 1. Verdict
**NOT ACCEPTED / HOLD** (founder decision, 2026-11-09). The earlier "ACCEPTED under the mandate's rule" is withdrawn; see `RELEASE_A_ACCEPTANCE.md`. The rest of this report records the build as of its writing, and `SECURITY_TRIAGE_2026-11-09.md` corrects its dependency claims.

that could change your reading of AC13: see the caveats in [`RELEASE_A_ACCEPTANCE.md`](RELEASE_A_ACCEPTANCE.md).

| AC | Status | AC | Status |
|---|---|---|---|
| AC1 Signup + onboarding | VERIFIED | AC8 Receipts + usage | VERIFIED |
| AC2 Automatic model selection | VERIFIED (FIXTURE) | AC9 Responsive UI | VERIFIED (Lighthouse local) |
| AC3 Unified registry | VERIFIED | AC10 Playwright journeys | VERIFIED |
| AC4 Quote + approval | VERIFIED | AC11 Security, isolation, money | VERIFIED |
| AC5 Six demos, one engine | VERIFIED | AC12 Simulated ≠ revenue | VERIFIED |
| AC6 Survives restarts | VERIFIED | AC13 Sites describe the preview | VERIFIED (with caveat) |
| AC7 Idempotency + recovery | VERIFIED | | |

## 2. P0 exposure and backup posture
- **Production database data: not exposed. Credentials: EXPOSED in public git history** (a JWT secret, Slack and Discord webhooks, an
  admin password hash). A local-only git stash holds plaintext signer and treasury keys. None were used; rotation is yours (actions 4–6).
- **Backups:** untouched. Both production dumps match their expected hash but count as **one copy** (same disk). Repo, Docker and
  deploy ignore rules now exclude dumps, effective once #610 merges. See `BACKUP_POSTURE.md`, action 7.

## 3. Progress board
| Phase | Status | Phase | Status |
|---|---|---|---|
| P0 Safety | DONE | S4 Developer | DONE |
| PT Toolchain | DONE | S5 Agents | DONE |
| P1 Integration | DONE | S6 Machines | DONE |
| P2 Foundation | DONE | P3 Quality | DONE |
| S1 Shopping | DONE | P4 Assurance | DONE |
| S2 Food | DONE | P5 Websites | DONE, claims gap open |
| S3 Trading | DONE | P6 Acceptance | DONE (this PR) |

## 4. Branches, draft PRs and merge order
Nothing is merged, deployed or published. Merge in this order; each later PR contains the earlier ones.
1. [#610](https://github.com/Jakuraa/Satelink_Network/pull/610) `build/p0-safety`: **merge first, independently useful**
2. [#611](https://github.com/Jakuraa/Satelink_Network/pull/611) `build/integration-base` (contains #609, #582, #583 and fixes #583's migration collision; retarget or close those three afterwards, do not merge #583 alone)
3. [#612](https://github.com/Jakuraa/Satelink_Network/pull/612) `build/p2-foundation`
4. [#616](https://github.com/Jakuraa/Satelink_Network/pull/616) S1 → [#617](https://github.com/Jakuraa/Satelink_Network/pull/617) S2 → [#618](https://github.com/Jakuraa/Satelink_Network/pull/618) S3 → [#619](https://github.com/Jakuraa/Satelink_Network/pull/619) S4 → [#620](https://github.com/Jakuraa/Satelink_Network/pull/620) S5 → [#621](https://github.com/Jakuraa/Satelink_Network/pull/621) S6
5. [#622](https://github.com/Jakuraa/Satelink_Network/pull/622) P3 → [#623](https://github.com/Jakuraa/Satelink_Network/pull/623) P4
6. [#629](https://github.com/Jakuraa/Satelink_Network/pull/629) P5: **publishes website copy on merge; read its founder-review notes first**
7. The P6 draft PR (docs and tests)

**Merging is not the same as switching on:** `/v1` tasks, A2A and x402 preview are mounted only by the local preview server, console
pages need `SATELINK_PREVIEW=1`, and migrations 042–046 are not applied by a merge. Website copy (#629) and the shared token,
footer and nav changes do go live on merge.

## 5. Tests
Latest CI on the full stack (#629 at `c891a0a7`). The P6 PR adds 5 architecture tests and the MCP tests to CI.

| Suite | Passed | Failed | Skipped (reason) | CI run |
|---|---|---|---|---|
| Release A Playwright (S1–S6, P3, P4, P5 × 3 viewports) | 45 | 0 | 3 (browser restart drill runs only via its own script) | [42621806424](https://github.com/Jakuraa/Satelink_Network/actions/runs/42621806424) |
| Restart drill (SIGKILL during EXECUTING) | PASS | 0 | 0 | same |
| Dependency audit gate | PASS: 0 new | 0 | 40 known high/critical (OB-14) | same |
| Integration, real Postgres | 304 | 0 | 0 | [42621806402](https://github.com/Jakuraa/Satelink_Network/actions/runs/42621806402) |
| Domain | 300 | 0 | 0 | same |
| Architecture guards | 11 | 0 | 0 | same |
| apps/api baseline guard | no new failures | pre-existing known set | 3 known | [42621806392](https://github.com/Jakuraa/Satelink_Network/actions/runs/42621806392) |
| Trading engine, type check, lint, secret scan, Vercel builds | pass | 0 | Build Verification job skipped (workflow condition) | same |
| apps/web unit | 273 | 0 | 0 | *Tests* job, same run |
| Local only: console unit 37/37, Lighthouse accessibility 100 on 11 pages, satelink-mcp 13/13 | | 0 | | not in CI (the MCP tests join CI in P6) |

Per-slice runs: [S1](https://github.com/Jakuraa/Satelink_Network/actions/runs/41989123709) · [S2](https://github.com/Jakuraa/Satelink_Network/actions/runs/41991327541) · [S3](https://github.com/Jakuraa/Satelink_Network/actions/runs/41996868348) · [S4](https://github.com/Jakuraa/Satelink_Network/actions/runs/41999602588) · [S5](https://github.com/Jakuraa/Satelink_Network/actions/runs/42031491687) · [S6](https://github.com/Jakuraa/Satelink_Network/actions/runs/42033628955) · [P3](https://github.com/Jakuraa/Satelink_Network/actions/runs/42037942104) · [P4](https://github.com/Jakuraa/Satelink_Network/actions/runs/42613150857) · [P5](https://github.com/Jakuraa/Satelink_Network/actions/runs/42621806424)

## 6. The six demos
| Demo | Status | E2E | Screenshots |
|---|---|---|---|
| Shopping | VERIFIED, mock store | `tests/e2e/s1-primary-journey.spec.ts` | `artifacts/screenshots/s1/` |
| Food over MCP + OAuth | VERIFIED, mock, not connected to Swiggy | `tests/e2e/s2-food.spec.ts` | `artifacts/screenshots/s2/` |
| Trading AI | VERIFIED, synthetic data, paper only | `tests/e2e/s3-trading.spec.ts` | `artifacts/screenshots/s3/` |
| Developer procurement | VERIFIED, mock API | `tests/e2e/s4-developer.spec.ts`, `tests/dev/procure.sh` | `artifacts/screenshots/s4/` |
| Agent commerce (MCP, A2A) | VERIFIED; MCP 2025-11-25, unsigned card | `tests/e2e/s5-agent.spec.ts`, `tests/agents/mcp-client.e2e.ts` | `artifacts/screenshots/s5/` |
| Machine commerce (x402) | VERIFIED, mock facilitator, nothing settled | `tests/e2e/s6-machine.spec.ts` | `artifacts/screenshots/s6/` |

## 7. Run the preview locally
Needs Node, a local Postgres and `psql`. Run on a checkout of `build/p5-websites` or later.
```bash
npm ci
bash scripts/preview/start-s1.sh      # fresh local DB, all mocks, API :4500, console :3400
open http://localhost:3400/signup     # the sign-in link appears on the page (dev mail sink)
```
Checked from clean on 2026-11-09: all services healthy and a machine purchase completed through this stack.

## 8. Toolchain
Installed this build: trufflehog, typescript + language server, plugins `feature-dev` and `claude-md-management`. **Superpowers:** kept;
it was already installed from the official marketplace, not installed by this build. `lighthouse@12.8.2` runs through `npx`, pinned, and
is not a repo dependency. `@x402/core` and the MCP SDK were already in the repo; no dependency was added to `apps/api`. Skipped: the
GitHub MCP server fails auth, so `gh` was used; a Context7 plugin is unnecessary because the connector exists. Detail: `TOOLCHAIN_INVENTORY.md`.

## 9. Top 10 tech debt
1. Stale Trading Intelligence copy across public, docs and legal surfaces (founder decision).
2. Execution runs only step 1 of a plan; extend before multi-step tasks.
3. A paid x402 task that fails keeps its simulated deposit as credit; a real rail needs a refund path.
4. Egress guard does not resolve DNS, so rebinding must be handled before any real external connector.
5. Trading data is synthetic; evaluation results say nothing about real markets.
6. A2A implements 3 methods with an unsigned card; MCP tools are stdio only and on the 2025-11-25 revision.
7. Lighthouse and the console unit tests are not in CI; axe on marketing sites covers key pages only.
8. Per-slice durability other than S1 uses a simulated crash; the browser drill is not in CI.
9. Receipt `verification.method` reads `order_status_lookup` for every connector.
10. A worktree's `node_modules` symlink resolves `@satelink/*` from the main checkout, which silently tested stale packages locally; CI is the reliable check.

## 10. Release B founder actions
The full table, with where and defaults, is in [`RELEASE_B_FOUNDER_ACTIONS.md`](RELEASE_B_FOUNDER_ACTIONS.md).
**Do 1–7 now, whatever you decide on Release B: they are live exposures today.**
1. Upgrade `next` in console and corporate (RCE advisory). 2. Upgrade `better-auth` (account takeover advisory). 3. Upgrade `proxy-addr`, `dompurify`; triage 36 highs. 4. Rotate the JWT secret. 5. Replace the Slack and Discord webhooks. 6. Move signer and treasury keys, then drop the stash. 7. Make an encrypted off-site backup.
8. Secret scanning and push protection. 9. GitLab and PII checks. 10. Merge the stack in order. 11. Review ADR-5; apply migrations yourself. 12. Decide Trading Intelligence's future. 13. Check the JSON-LD change against merchant reviews. 14. Decide the "On-Chain Settlement" link. 15. Approve fees. 16. Live model key. 17. Real suppliers. 18. Food platform access. 19. Payment rail + KYB. 20. Live x402 decision. 21. Tax and legal review. 22. Alpaca paper keys. 23. Licensed market data. 24. Turnstile keys. 25. KMS key for A2A signing. 26. Publish `satelink-mcp`. 27. Resolve the `apps/api` lockfile edge (needed before #2 is clean). 28. DNS-rebinding check before real connectors.
