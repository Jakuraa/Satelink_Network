# Release State A — acceptance (reassessed 2026-11-10)

**Verdict: NOT ACCEPTED / HOLD** (founder decision reaffirmed, 2026-11-10). This remains on HOLD until every condition below
is met and security remediation is independently verified on live production systems. Only the founder can change it.

Code being green or merged does NOT equate to production being secure. Deployed states and credential revocations must be verified separately.

Nothing below is deployed to production. A row saying PR open means prepared, not resolved in production.

| AC | Criterion | Status | Evidence | Still open |
|---|---|---|---|---|
| AC1 | Signup + onboarding complete | Evidence holds | `s1-primary-journey` | Re-confirmed on patched deps (#637) |
| AC2 | Assistant selects a model automatically | **OPEN** | `model_router.test.js`: fixture only | **Never run against a live model** (founder action 16) |
| AC3 | Capabilities from the unified registry | Evidence holds | `capability_registry_unified`, S1, `agent_s5` | none |
| AC4 | User generates and approves a quote | Evidence holds | S1, `task_engine.integration`, `assurance_p4` | none |
| AC5 | All six demos through the shared engine | Evidence holds, **simulated** | `s1`–`s6`, `one-engine` | No live model, supplier, broker, payment or facilitator |
| AC6 | Workflow state survives restarts | Evidence holds, with limits | `restart-drill.sh`, `assurance_p4` | Only S1 has a real SIGKILL; S2–S6 are a simulated crash. The S1 browser drill is skipped in CI |
| AC7 | Idempotency + failure recovery | Evidence holds | `task_engine.integration`, `developer_s4`, `machine_s6`, `assurance_p4` | none |
| AC8 | Receipts and usage history correct | Evidence holds | `assurance_p4`, `sim_ledger_parity` | none |
| AC9 | Responsive, professional UI | Evidence holds, with limits | `p3-quality`, `p5-websites` | Lighthouse is local only. Axe on marketing sites covers key pages only |
| AC10 | Playwright proves complete journeys | Evidence holds | Run 42621806424 | Re-run green on the integrated, patched tree (#637) |
| AC11 | Security, tenant isolation, financial simulation | **OPEN** | `ASSURANCE_P4.md` for isolation and simulation | Critical advisories unpatched in production; exposed credentials unrotated. See below |
| AC12 | Simulated revenue excluded from reporting | Evidence holds | `revenue_truth`, asserted $0 | none |
| AC13 | Websites accurately describe the product | **OPEN** | #636: `AC13_PUBLIC_CLAIMS_2026-11-09.md` | PR unmerged and undeployed; checkout, legal and other decisions outstanding |

**Progress as of 2026-11-10:**
- Local permissions locked down (`chmod 600` on `.env`, `.env.local`, `~/.railway/config.json`, `~/.zshrc`).
- Inactive GitHub PAT returning HTTP 401 identified in `~/.zshrc`.
- GitHub Secret Scanning and Push Protection enabled on `Jakuraa/Satelink_Network` (Alert #1 confirmed active for Slack webhook).
- PR #634 updated (`ac51a07a`) to explicitly execute all 26 `node:test` suites (159 tests) with `--test-concurrency=1` in the CI baseline job.
- PR #635 held on HOLD; upstream `@coinbase/x402` 2.1.0 dependency constraint documented (GHSA-mrhx-c7xc-m3w5 Zod 3 vulnerability remains open upstream).
- Pre-rotation incident evidence safely preserved in `docs/build/evidence/private/preserved_incident_evidence_2026-11-10/` without dropping stash or pruning loose objects.

## Why AC11 is open
The earlier VERIFIED covered the assurance suites. It did not cover exposure.
- `next` with the RCE advisory is on all three production sites (`SECURITY_TRIAGE_2026-11-09.md`). #631 is prepared, not merged or deployed.
- Credentials in public history and plaintext keys on the build machine are unrotated (`CREDENTIAL_ROTATION_CHECKLIST.md`).
- Production's `better-auth` and `proxy-addr` are patched in the API lockfile, but CI was testing the older root lock; PR #632 aligns CI with production.
- Production Railway API runs unpatched `body-parser`, `follow-redirects`, `ws`; PR #634 is prepared, not deployed.

## Why AC13 is open
#636 corrects the outdated Trading Intelligence and rejected-identity claims, applying D14. Left for decision, because they describe a sale or contract that still exists: checkout and Dodo, legal terms, console, `/corporate`, the "On-Chain Settlement" wording. The live sites still show the old copy.

## Conditions for acceptance
1. AC2 run against a live model, or the founder formally accepts the fixture.
2. #631, #632, #633, #634 reviewed, merged and deployed, with the deployed versions confirmed. Decision recorded on #635.
3. Credential checklist items 1–13 done or explicitly accepted.
4. AC13 decisions made, #636 merged and deployed, and the live sites re-checked.
5. The Release A stack merged in order, and journeys re-run on the result.
6. Founder records acceptance here.

Real payments, live trading and production migrations stay off throughout.
