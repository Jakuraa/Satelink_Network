# Backlog — noticed during the Friends Beta session, not built

Items here are outside `BETA_SCOPE.md`. Nothing in this file is worked on in the beta session.

| # | Date | Item | Why it is not in scope |
|---|---|---|---|
| 1 | 2026-11-10 | Dependabot PRs #627 (next 15.5.29, web) and #628 (API minor/patch group) are open and red | Superseded by #631 and #634; close after the security train lands |
| 2 | 2026-11-10 | Railway variables not on the F3 list but of the same kind: `edit_zone_DNS_API_token`, `cloudflare_S3 API endpoint`, `google_OAuth_client_ID` (duplicate) | F3 names an exact list; removing others needs a founder decision |
| 3 | 2026-11-10 | `VERCEL_TOKEN` in GitHub Actions secrets | Not covered by F3 (Railway only); check whether a workflow still uses it |
| 4 | 2026-11-10 | `dependabot_security_updates` is disabled on the repository | Not requested; B2.4 covers secret scanning and push protection only |
| 5 | 2026-11-10 | `CLAUDE.md` still names the Vercel project as `satelinkinternet-collabs-projects/web`; the team slug is now `jakuraa` | Docs truth pass, not a beta phase |
| 6 | 2026-11-10 | `apps/api/migrations/` (27 files) has no applied-state table in production comparable to `schema_migrations` (`_migrations` holds one row) | Schema tooling drift is a known separate topic |
| 7 | 2026-11-10 | Legacy wallet login is broken in production: `POST /auth/verify` fails with `relation "users" does not exist` after the signature check | Pre-existing; the beta signs in through Better Auth |
| 8 | 2026-11-10 | `JWT_REFRESH_SECRET` is not set on Railway although `jwt_service.js` verifies refresh tokens with it | Same dead legacy path as item 7 |
| 9 | 2026-11-10 | `apps/api/src/admin/jobs/settlement_control.js` `setDryRun()` can flip the settlement dry-run flag in-process from an admin route | Settlement code is forbidden territory this session; founder should review or remove |
