# Release State A — acceptance (2026-11-09)

**Verdict: ACCEPTED under the mandate's rule** (all 13 VERIFIED; AC2 is VERIFIED (FIXTURE), listed as a founder action). This
is the build's own assessment against the criteria; the decision to accept is the founder's. Read the caveats below it: AC13
holds for how the sites describe the preview, but one P5 instruction is only partly done.

Evidence baseline: PR #629 at `c891a0a7`, Release A E2E run
[42621806424](https://github.com/Jakuraa/Satelink_Network/actions/runs/42621806424) (45 passed, 3 skipped), integration run
[42621806402](https://github.com/Jakuraa/Satelink_Network/actions/runs/42621806402) (304 passed, Docker-backed). P6 adds docs,
one architecture test and one CI step; see its draft PR's checks.

| AC | Criterion | Status | Proof |
|---|---|---|---|
| AC1 | Signup + onboarding complete | VERIFIED | `tests/e2e/s1-primary-journey.spec.ts` (first test, 3 viewports) |
| AC2 | Assistant selects a model automatically | **VERIFIED (FIXTURE)** | `apps/api/test/model_router.test.js`; `served_by` shown on tasks and receipts. **Never run against a live model** (founder action 16) |
| AC3 | Capabilities discovered from the unified registry | VERIFIED | `capability_registry_unified.test.js`, Explore step of the S1 E2E, `satelink-mcp` enum and A2A skills compared to the registry in `agent_s5` |
| AC4 | User generates and approves a quote | VERIFIED | S1 E2E; `task_engine.integration`; 10 concurrent approvals → one capture (`assurance_p4`) |
| AC5 | All six demos complete through the shared engine | VERIFIED | `s1-primary-journey`, `s2-food`, `s3-trading`, `s4-developer`, `s5-agent`, `s6-machine`; `tools/architecture-tests/one-engine.test.ts` |
| AC6 | Workflow state survives restarts | VERIFIED | `scripts/preview/restart-drill.sh` (real SIGKILL, S1 path, in CI); `assurance_p4` durability for S1, S2, S3, S4–S6 (simulated crash after the supplier accepted) |
| AC7 | Idempotency + failure recovery tested | VERIFIED | `task_engine.integration`, `developer_s4`, `machine_s6`, `assurance_p4` |
| AC8 | Receipts and usage history correct | VERIFIED | `assurance_p4` › every receipt reproduces its ledger hash, `reconcile()` clean; `sim_ledger_parity`; usage asserted in S4–S6 E2E |
| AC9 | Responsive, professional UI | VERIFIED | `p3-quality` × 390/768/1440 (11 pages: axe serious/critical 0, no overflow, no hydration error); `artifacts/screenshots/`; Lighthouse accessibility 100 on 11 pages (`artifacts/lighthouse/p3-a11y.json`, **measured locally, not in CI**) |
| AC10 | Playwright proves the complete journeys | VERIFIED | Run 42621806424 and its `release-a-screenshots` artifact |
| AC11 | Security, tenant isolation, financial simulation pass | VERIFIED | `docs/build/ASSURANCE_P4.md`; `assurance_p4`, `p4-adversarial`, `egress_guard`, `no-float-money` |
| AC12 | Simulated revenue cannot enter revenue reporting | VERIFIED | `revenue_truth` view (migration 043); asserted $0 in `developer_s4`, `agent_s5`, `machine_s6`, `assurance_p4` |
| AC13 | Websites accurately describe the preview | VERIFIED | `p5-websites` (both sites × 3 viewports), `preview-llms.test.ts`, claims lint 0 findings on both sites |

## Caveats you should weigh
1. **P5 "remove every claim not true today" is not complete.** Trading Intelligence is delisted (#515) yet remains on its product
   page, `/intelligence`, `llms.txt` (unpriced), platform and solutions copy, docs, academy, legal text and checkout. It still
   serves existing keys and the checkout still sells it, so removing it is your decision (founder action 12). "On-Chain Settlement"
   stays in the footer while `SETTLEMENT_DRY_RUN=1` (action 14). AC13 covers the description of the preview, which is accurate; if
   you read AC13 as covering every public claim, treat it, and so Release A, as **NOT ACCEPTED** until these close.
2. **Everything is simulated.** No live model, supplier, broker, payment or facilitator was used.
3. **S1's browser restart drill is skipped in CI** (3 skips: it only runs through `restart-drill-browser.sh`). The SIGKILL shell
   drill does run in CI. Per-slice durability other than S1 is a simulated crash, not a real process kill.
4. **Axe on the marketing sites covers key pages only**, not every page.
5. **Critical production dependency advisories exist today, independent of this work** (OB-14, founder actions 1–3).
