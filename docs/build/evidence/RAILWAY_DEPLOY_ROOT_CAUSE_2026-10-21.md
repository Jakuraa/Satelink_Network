# Railway "merged but not live": root cause (2026-10-21)

Session A, Step 1. Collected 2026-10-21 19:54–20:31 UTC. Read-only: Railway CLI/GraphQL reads, GitHub API
and the public status page. Nothing was changed on Railway.

## Symptom
- `/health` uptime was 95,409 s at 17:39 UTC and 103,518 s at 19:54 UTC, so the process started at about
  **2026-10-20 15:08 UTC**.
- #569 (`ed18f23d`), #567 (`33bdf7f4`) and #570 (`6e34d3ba`) were merged on main but not live.
- Vercel deployed the same commits normally.

## Evidence

| # | Source | Finding |
|---|---|---|
| 1 | `railway deployment list --service Satelink-api` | The newest deployment is `b90ff9e5…`, **SUCCESS** at 2026-10-20 15:08:00 UTC for `0ce443ff` (#566). There is **no deployment record of any status** after it, and GraphQL `deployments(includeDeleted:true)` agrees. |
| 2 | `railway status --json` | `satelink-reconciler`, the other git-connected service, also stops at `0ce443ff`, 15:08 UTC. Both services stopped together. |
| 3 | GraphQL `deploymentTriggers` | Satelink-api trigger: repo `Jakuraa/Satelink_Network`, branch `main`, provider `github`, `checkSuites: false`. `serviceInstance.watchPatterns = []`, `rootDirectory = /apps/api`. Nothing here would suppress a push trigger. |
| 4 | GitHub `repos/…/deployments` | `railway-app[bot]` created a GitHub deployment (`Satelink-api / production`) for every main commit up to `0ce443ff` (15:08:03 UTC) and **none** after it. `vercel[bot]` created deployments for `33bdf7f4` and later commits. |
| 5 | GitHub `orgs/Jakuraa/installations` | `railway-app` is installed on **all** repos, not suspended, and subscribed to `push` and `check_suite`. The connection survived the 2026-10-14 org transfer; deploys worked on 2026-10-15 and 2026-10-20. |
| 6 | Commit checks | No `push`-event workflows run on main, so CI cannot gate the deploy. `railway-app`'s check suite is `queued` on every commit, including `0ce443ff`, which did deploy. |
| 7 | **status.railway.com** | **Incident "Dashboard and API unavailable, builds paused"**, Major Outage. It was first posted **2026-10-21 07:24 UTC**. At 11:33 UTC: "new builds remain paused in all regions". At 19:30 UTC: builds return in stages, Enterprise first, then Pro, **Hobby**, Free/Trial. At 20:25 UTC OAuth sessions were invalidated, which logged out this machine's Railway CLI. At 20:30 UTC: still "working towards enabling builds for Enterprise". |
| 8 | GraphQL `project.workspace` | Plan **HOBBY**, so builds return in the third stage. |
| 9 | Commit times | #569 merged at 10:46 UTC, #567 at 14:39 UTC and #570 at 14:48 UTC on 2026-10-21. **All three came after the 07:24 UTC pause.** The last pre-incident merge, #566 at 15:07 UTC on 2026-10-20, deployed in under a minute. |

## Classification
**Something else: a Railway platform outage that paused builds and dropped the push-triggered deployments.**
- **Not** a failed build: no build ran.
- **Not** lockfile drift: the last build ran `npm ci` successfully (see below).
- **Not** a lost GitHub connection: the app is installed and the trigger is intact.
- **Not** watch paths: there are none.

## Fix
- **No code or config change** is needed, and none is possible from our side.
- Once Railway re-enables **Hobby** builds, main must be **deployed explicitly** ("Deploy latest commit" on Satelink-api, or `serviceInstanceDeployV2` for the main HEAD). Pushes made during the pause are not replayed.
- The next merge to main would also trigger a build.
- Every probe can now prove what is live: `/health` returns `commit` (PR #580, `52448b91`).

## Lockfile question (Step 1.5)
**`apps/api/package-lock.json` exists and production uses it.**
- #557 (`58d5996b`, 2026-10-20) committed it.
- The build log of the live deployment `b90ff9e5…` shows the Nixpacks plan `install │ npm ci` and `RUN … npm ci` at stage 6/8, with root `/apps/api`.
- The #579 body ("apps/api installs without a lockfile", line 23) predates #557 and is stale.

## Side finding
Vercel reports "Deployment rate limited — retry in 24 hours" on PR previews: Hobby build quota. The same condition was logged on 2026-10-20 (Session 2), so it recurs.
