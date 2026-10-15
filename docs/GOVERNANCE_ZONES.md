# Satelink Repository Governance Zones

This document classifies all code and documentation by publication scope.
Run `bash scripts/check-zone3-exposure.sh` before any public sync.

---

## Zone 1 — Fully Open Source (MIT)

Published to: `jakuraa/contracts`, `jakuraa/node-agent`

### Contracts (MIT License)
- `contracts/NodeRegistryV2.sol`
- `contracts/SplitEngine.sol`
- `contracts/RevenueVault.sol`
- `contracts/RevenueDistributor.sol`
- `contracts/ClaimsContract.sol`
- `contracts/ClaimsWithdrawals.sol`
- `contracts/EpochAnchor.sol`
- `contracts/EligibilityPolicy.sol`
- `contracts/GovernanceTimelock.sol`

See `contracts/LICENSE` (MIT) and `contracts/README.md`.

---

## Zone 2 — Source-Available (BSL 1.1)

Published to: `jakuraa/platform`
Readable but not commercially forkable until 2030.

### Files
- `apps/api/src/nodes/reputation_engine.js` — weights externalized to env
- `apps/api/src/economics/economic_ledger.js` — interface only
- `apps/api/src/settlement/` — adapter interface (Simulated, Base, interface)
- `apps/api/src/gateway/routes/public_*.js` — public API routes
- `apps/api/src/gateway/routes/builder_*.js` — builder API routes
- `apps/api/src/gateway/routes/node_*.js` — node operator API routes
- `apps/api/src/security/auth_middleware.js` — JWT auth (public flows)
- `apps/web/src/app/` — node operator and builder dashboards (excluding admin/)

### Publication checklist for Zone 2 repo
Before syncing to jakuraa/platform:
1. Run: `bash scripts/check-zone3-exposure.sh`
2. Verify LICENSE.BSL file is present
3. Confirm no ADMIN routes present
4. Confirm no sentinel/ directory present
5. Confirm .env.example has no real values

---

## Zone 3 — Internal Private (never publish to public repo)

These files must NEVER appear in any public GitHub repository.
They contain operational security logic that would enable platform abuse if exposed.

### Core Operational Engines
- `apps/api/src/core/operations_engine.js` — Pricing, surge, rate limit logic
- `apps/api/src/monitoring/sla_engine.js` — SLA breach thresholds, circuit breakers
- `apps/api/src/workloads/auto_ops_engine.js` — Autonomous revenue operations
- `apps/api/src/monitoring/replay_engine.js` — Ops replay and forensics

### Sentinel (not yet implemented)
- `apps/api/src/sentinel/` — Revenue integrity sentinel (classify as Zone 3 when built)
- `src/sentinel/` — Legacy path (classify as Zone 3 when built)

### Multi-Agent Orchestration
- `apps/api/src/ops-agent/` — Multi-agent framework

### Scheduler Internals
- `apps/api/src/scheduler/jobs/` — Epoch timing, automation intervals

### Vendor Integrations
- `apps/api/src/integrations/nodeops.js` — Managed node vendor integration

### Admin API Routes (20 files)
- `apps/api/src/gateway/routes/admin_api_v2.js`
- `apps/api/src/gateway/routes/admin_autonomous.js`
- `apps/api/src/gateway/routes/admin_control_api.js`
- `apps/api/src/gateway/routes/admin_control_room_api.js`
- `apps/api/src/gateway/routes/admin_distributors.js`
- `apps/api/src/gateway/routes/admin_economics.js`
- `apps/api/src/gateway/routes/admin_flywheel.js`
- `apps/api/src/gateway/routes/admin_forensics.js`
- `apps/api/src/gateway/routes/admin_genesis.js`
- `apps/api/src/gateway/routes/admin_growth.js`
- `apps/api/src/gateway/routes/admin_launch.js`
- `apps/api/src/gateway/routes/admin_lifecycle.js`
- `apps/api/src/gateway/routes/admin_network.js`
- `apps/api/src/gateway/routes/admin_partners.js`
- `apps/api/src/gateway/routes/admin_reputation.js`
- `apps/api/src/gateway/routes/admin_revenue.js`
- `apps/api/src/gateway/routes/admin_sla.js`
- `apps/api/src/gateway/routes/admin_system.js`
- `apps/api/src/gateway/routes/admin_workloads.js`
- `apps/api/src/routes/admin_mal_route.mjs`

### Admin UI Pages
- `apps/api/src/gateway/pages/admin/` — Admin gateway pages
- `apps/web/src/app/admin/` — Web admin dashboard
- `apps/dashboard/src/app/admin/` — Dashboard admin pages
- `apps/dashboard/src/components/admin/` — Admin components

### Security Gate Scripts
- `scripts/security/check-auth-middleware.sh`
- `scripts/security/check-hardcoded-keys.sh`
- `scripts/security/check-jwt-fallback.sh`
- `scripts/security/check-secrets.sh`
- `scripts/security/check-sqlite.sh`
- `scripts/security/check-test-endpoints.sh`

### Why these are sealed
- **Operations Engine pricing**: Publishing enables free-execution attacks
- **Sentinel thresholds**: Publishing enables adversaries to stay below detection
- **Reputation weights**: Publishing enables optimized Sybil farming
- **Security gates**: Publishing reveals monitored vs unmonitored attack vectors
- **Admin routes**: Publishing enables targeted attacks on high-privilege endpoints
- **SLA thresholds**: Publishing enables circuit breaker manipulation

---

## Zone 4 — Never Commit (secrets)

See `.gitignore` for the complete list. Rotate quarterly.

### Environment variables that must never be committed
- `JWT_SECRET` — Authentication signing key
- `POLYGON_SIGNER_KEY` — On-chain transaction signing
- `SETTLEMENT_EVM_SIGNER_PRIVATE_KEY` — Settlement wallet
- `MASTER_ADMIN_TOKEN` — Super admin access
- `ADMIN_API_KEY` — Admin API authentication
- `DEFENDER_KEY` / `DEFENDER_SECRET` — OpenZeppelin Defender
- Real reputation weights (use defaults in code, override in prod via env)
- Real settlement thresholds (externalized to env)

### Files that must never be committed
- `.env` (all variants except `.env.example`)
- `*.key`, `*.pem` — Private keys and certificates
- `token.txt` — Any token files
- `agent/memory/CURRENT_TASK.md` — Agent session state
- `agent/memory/PROGRESS.md` — Agent progress state
- `satelink-keys/`, `satelink-env/` — Key directories

---

## Zone Summary

| Zone | License | Published To | File Count |
|------|---------|--------------|------------|
| Zone 1 | MIT | jakuraa/contracts | 9 contracts |
| Zone 2 | BSL 1.1 | jakuraa/platform | ~30 files |
| Zone 3 | Private | Never | 35+ files |
| Zone 4 | N/A | Never (secrets) | N/A |
