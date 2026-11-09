# Release State A — acceptance (reassessed 2026-11-09)

**Verdict: NOT ACCEPTED / HOLD** (founder decision, 2026-11-09). This stays until every condition below is met and the security
risks are appropriately addressed. Only the founder can change it. The build's earlier "ACCEPTED under the mandate's rule" is withdrawn.

Nothing below is merged or deployed. A row saying PR open means prepared, not resolved.

| AC | Criterion | Status | Evidence | Still open |
|---|---|---|---|---|
| AC1 | Signup + onboarding complete | Evidence holds | `s1-primary-journey` | Re-confirmed on patched deps by #637 |
| AC2 | Assistant selects a model automatically | **OPEN** | `model_router.test.js`: fixture only | **Never run against a live model** (founder action 16) |
| AC3 | Capabilities from the unified registry | Evidence holds | `capability_registry_unified`, S1, `agent_s5` | #637 |
| AC4 | User generates and approves a quote | Evidence holds | S1, `task_engine.integration`, `assurance_p4` | #637 |
| AC5 | All six demos through the shared engine | Evidence holds, **simulated** | `s1`–`s6`, `one-engine` | #637. No live model, supplier, broker, payment or facilitator |
| AC6 | Workflow state survives restarts | Evidence holds, with limits | `restart-drill.sh`, `assurance_p4` | Only S1 has a real SIGKILL; S2–S6 are a simulated crash. The S1 browser drill is skipped in CI |
| AC7 | Idempotency + failure recovery | Evidence holds | `task_engine.integration`, `developer_s4`, `machine_s6`, `assurance_p4` | #637 |
| AC8 | Receipts and usage history correct | Evidence holds | `assurance_p4`, `sim_ledger_parity` | #637 |
| AC9 | Responsive, professional UI | Evidence holds, with limits | `p3-quality`, `p5-websites` | Lighthouse is local only. Axe on marketing sites covers key pages only |
| AC10 | Playwright proves complete journeys | Evidence holds | Run 42621806424 | Must be re-run on the integrated, patched tree: #637 |
| AC11 | Security, tenant isolation, financial simulation | **OPEN** | `ASSURANCE_P4.md` for isolation and simulation | Critical advisories unpatched in production; exposed credentials unrotated. See below |
| AC12 | Simulated revenue excluded from reporting | Evidence holds | `revenue_truth`, asserted $0 | #637 |
| AC13 | Websites accurately describe the product | **OPEN** | #636: `AC13_PUBLIC_CLAIMS_2026-11-09.md` | PR unmerged and undeployed; checkout, legal and other decisions outstanding |

"Evidence holds" means the proof from the stack still stands. It does not mean accepted, since the stack is unmerged.

## Why AC11 is open
The earlier VERIFIED covered the assurance suites. It did not cover exposure.
- `next` with the RCE advisory is on all three production sites (`SECURITY_TRIAGE_2026-11-09.md`). #631 is prepared, not merged.
- Credentials in public history and plaintext keys on the build machine are unrotated (`CREDENTIAL_ROTATION_CHECKLIST.md`).
- **Corrected:** production's `better-auth` and `proxy-addr` are patched, unlike what OB-14 said. The stack's auth evidence ran on the root lock's vulnerable `better-auth` 1.7.5, which #632 fixes.

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
