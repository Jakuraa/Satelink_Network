# Security Incident & Credential Containment Update (2026-11-10)

Scope: Incident containment, credential inventory, rotation runbooks, and Release A remediation tracking.
Status: **OPEN — Controlled Remediation in Progress. Release A on HOLD.**
Confidentiality: Variables and locations only. No secret values are contained in this document.

---

## 1. Verified Containment Actions Completed (2026-11-10)
1. **Local Credential Permissions Locked Down:**
   - `.env`: mode 600 (`-rw-------`)
   - `.env.local`: mode 600 (`-rw-------`)
   - `~/.railway/config.json`: mode 600 (`-rw-------`)
   - `~/.zshrc`: mode 600 (`-rw-------`)
2. **GitHub Secret Scanning & Push Protection Enabled:**
   - Active on `Jakuraa/Satelink_Network` (verified via GitHub API `security_and_analysis`).
   - Secret Scanning Alert #1 confirmed active for Slack incoming webhook exposed in `SATELINK_ECOSYSTEM_SETUP_PROMPT.md:208` (commit `3d4a5475`).
3. **Evidence Preservation Completed (No Destruction):**
   - Incident evidence, stash reflog, and stash list preserved in `docs/build/evidence/private/preserved_incident_evidence_2026-11-10/` with mode 600/700.
   - September 22 stash (`stash@{3}`) and loose objects retained; `git gc --prune=now` and `git stash drop` strictly withheld pending full rotation and founder authorization.
4. **Untracked Reports Investigated:**
   - Confirmed repeated 26-character `sk_` value (`sk_smoke_test_unfunded_001`, SHA-256 `97f1ae75...`) in `STEP_S`, `STEP_T`, `STEP_U` is a mock test fixture.
   - Live test key `sk_free_...` in `STEP_R` quarantined from git staging.
5. **CI node:test Suite Enforcement:**
   - PR #634 branch (`security/api-lock-transitive`) updated at commit `ac51a07a` to explicitly run all 26 `node:test` suites (159 tests) with `--test-concurrency=1` in the CI baseline job.

---

## 2. Complete Credential Inventory & Rotation Procedures

| Credential Category | Affected Service | Exposure Evidence | Revocation Method | Replacement Method | Validation | Founder Approval Required |
|---|---|---|---|---|---|---|
| **Treasury & Operational Signer Private Keys** | Base / Polygon Hot Wallets | Plaintext in local git stash `stash@{3}` (commit `b150db91`, dated 2026-09-22) | Move on-chain assets & roles to new keys; drop stash entry & run `git gc` only after approval | Generate new keypair offline/hardware; update Railway `SETTLEMENT_EVM_SIGNER_PRIVATE_KEY` | Read on-chain balances at new address; confirm old address balance is $0 | **YES (Explicit Approval Required)** |
| **Claims Contract Platform Signer** | Polygon Smart Contract `0x6987...1CC9` | Contract authority is set to treasury address `0x966E...7Ad4` (found in stash `stash@{3}`) | Admin multisig/owner call to rotate `platformSigner` via `SIGNER_ROTATION.md` | Deploy new signer address; call `setPlatformSigner(newSigner)` on contract | Call `platformSigner()` on-chain; verify old signatures return 400 | **YES (Explicit Approval Required)** |
| **Outbound x402 Signer / PayTo** | API Outbound Settlement | Bound to treasury address in `apps/api/src/vnext/` | Update backend `x402` payTo destination in Railway config | Point payTo to new verified treasury address; retain `SETTLEMENT_DRY_RUN=1` | Testnet/mock facilitator settlement proof; inspect transaction recipient | **YES (Explicit Approval Required)** |
| **JWT Signing Secret** | Railway `Satelink-api` & GitHub Actions | Public commit `18db42fe` in `agent/memory/CURRENT_TASK.md` | Set new `JWT_SECRET` in Railway dashboard and GitHub repository secrets | `openssl rand -hex 32` | Previous user/node bearer JWTs return HTTP 401; new tokens sign in cleanly | **YES** |
| **Slack Incoming Webhook URL** | GitHub Actions & Notifications | Public commit `3d4a5475` in `SATELINK_ECOSYSTEM_SETUP_PROMPT.md:208` (GH Alert #1) | Delete incoming webhook in Slack App Management Console | Recreate webhook endpoint in Slack; update GitHub Actions secret `SLACK_WEBHOOK_URL` | Post test message from new URL; verify old URL returns HTTP 404 | No (Standard Revocation) |
| **Discord Webhook URLs** | Railway `Satelink-api` & GitHub Actions | Historical commit `3d4a5475`; conflict in records between cleared vs unrotated | Delete webhooks in Discord Server Channel Settings | Recreate webhooks; update Railway `DISCORD_WEBHOOK_URL`, `DISCORD_REVENUE_WEBHOOK_URL` | Send alert via new webhook; verify old webhook returns HTTP 404 | No (Standard Revocation) |
| **Client-Side Admin Password Hash** | Production Web Dashboard | Public commit `9fbe9fca` in `apps/web/src/app/dashboard/admin/page.tsx` | Reset password across any services where reused | Generate fresh high-entropy password | Verify previous password no longer authenticates | No |
| **Railway Container Infrastructure Admin Tokens** | Cloudflare DNS, Vercel, Railway, GitHub | Present in Railway `Satelink-api` container environment variables | Revoke tokens in Cloudflare, Vercel, Railway, GitHub dashboards; delete variables from container | Reissue least-privilege tokens stored exclusively in founder password manager | Attempt API call with old tokens (verify 401/403); verify API functions without host admin tokens | **YES** |
| **Staff Admin Secret Token** | Railway `Satelink-api` (`/admin/*` endpoints) | Exposed in CLI transcripts via `railway variables --kv` | `railway variables --service Satelink-api --set "ADMIN_SECRET_TOKEN=$(openssl rand -hex 32)"` | Update admin clients with new token | Request `/admin/health` with old token (verify 401); request with new token (verify 200) | **YES** |
| **Master Admin Token** | Railway `Satelink-api` (Super-Admin) | Found in initial commit history; no rotation on record | Revoke / delete variable from Railway `Satelink-api` if unused | Rotate or purge from codebase | Verify super-admin endpoints reject previous token | **YES** |
| **Production Database URL & User Role** | Railway Postgres | Production container connects as superuser `postgres` (Blocker F1) | Execute role switch runbook: alter table ownership to `satelink_app` | Update Railway `DATABASE_URL` to connect as `satelink_app`; rotate password | Verify `SELECT current_user` returns `satelink_app`; verify superuser commands fail | **YES (Requires Tested Recovery Plan)** |
| **Workstation GitHub PAT** | Developer Local Shell Profile | Exported in plaintext in `~/.zshrc`; returns HTTP 401 | Confirm deletion in GitHub Settings → Developer Settings → Personal Access Tokens | Reissue fine-grained PAT with minimal repo scope, stored in macOS Keychain | Verify `gh auth status` or git over HTTPS with new token | No |
| **Paperclip AI Provider Key** | Paperclip Container (Decommissioned) | Recorded in Step P report as unrotated during decommissioning | Revoke key in Anthropic Console | No replacement required (Paperclip decommissioned) | Attempt API call with old key (verify HTTP 401) | No |
| **Alchemy RPC Keys** | Railway `Satelink-api` | Historical commits; reported rotated 2026-10-20 | Rotate in Alchemy Dashboard | Update Railway `ALCHEMY_API_KEY`, `ALCHEMY_POLYGON_KEY` | Query block number with old key (verify 401); verify new key succeeds | No |

---

## 3. Treasury & Signer Replacement Protocol & Recovery Plan

```
Step 1: Generate Offline Keypairs (Cold/Hardware)
Step 2: On-Chain Authority & Balance Verification
Step 3: Testnet / Dry-Run Verification (SETTLEMENT_DRY_RUN=1)
Step 4: Contract Administration Call (setPlatformSigner)
Step 5: Operational Variable Updates on Railway
Step 6: Balance Migration (USDT Transfer to New Treasury)
Step 7: Verification & Local Evidence Archival
```

### Verification Checks Prior to Execution:
1. **Contract Authority Check:**
   - Execute read call on Polygon Claims contract (`0x6987...1CC9`): `platformSigner()`
   - Confirm current signer matches `0x966E...7Ad4`.
   - Confirm caller is the contract `owner`.
2. **Independent Address Verification:**
   - Verify checksum format of new treasury and signer addresses.
   - Confirm private keys derive to the expected public addresses using offline tooling (`cast wallet address --private-key ...`).
3. **Emergency Recovery Plan:**
   - If contract admin call fails or reverts: contract continues accepting current signer; no funds are locked.
   - If signer transactions are rejected by nodes: maintain `SETTLEMENT_DRY_RUN=1` to prevent transaction broadcasting; restart API container with previous operational key.
   - If unexpected token transfer issues occur: contract pause mechanism (`pause()`) can be invoked by owner to temporarily halt claims.
