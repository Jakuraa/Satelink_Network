# Release State A — remaining phases (verbatim from the approved master prompt v2026-11-04b)

Copied so later sessions can resume without the chat transcript. Authoritative scope for S5–P6 and FINAL_REPORT.

```text
SLICE S5 — AI AGENT COMMERCE (adds: Satelink MCP server + A2A card generated from the registry)
  - apps/mcp-server tools generated from the registry:
    satelink_discover, satelink_quote, satelink_request_approval, satelink_task_status, satelink_receipt
  - every call creates/advances a workflow run
  - agent spend pre-authorization defaults to $0 → every spend needs human approval in the console
  - /.well-known/agent-card.json (A2A v1.0) and /.well-known/satelink-capabilities.json from the registry
  - tests/agents/mcp-client.e2e.ts uses the official MCP SDK client: initialize → tools/list → discover →
    quote → approval requested; Playwright approves in the console; client fetches the receipt
  - satelink-mcp: build + npm pack only

SLICE S6 — MACHINE COMMERCE (adds: x402 preview)
  - GET /v1/x402/preview/:capability_id → HTTP 402 + base64 PAYMENT-REQUIRED (x402 v2: scheme "exact",
    testnet CAIP-2 network, asset, amount, placeholder payTo, resource, extra.simulated=true)
  - scripted machine client: 402 → mock-signed PAYMENT-SIGNATURE → mock facilitator verify → simulated
    execution → PAYMENT-RESPONSE + receipt
  - never call a real facilitator /settle; the live USDT/Polygon vault is untouched (test asserts no
    vault client is constructed in preview)
  - E2E s6-machine.spec.ts + receipt visible in /usage

Announce ✅ per slice. 🏁 LAYER Slices FINISHED.

=====================================================================
PHASE P3 — PRODUCT QUALITY PASS
=====================================================================
- consistent Signal design across console pages
- assistant suggested tasks for all six domains; pending-approvals widget on home; navigation:
  Home/Assistant · My Tasks · Explore · Agent Marketplace · Trading AI · Connections · Wallet & Usage ·
  Developer/Agent Hub · Activity & Security · Settings
  (pages without a working function show an honest "Coming soon", never fake data)
- Connections page lists connector status, permissions and revoke for the mock food connector
- responsive 390/768/1440, axe clean, Lighthouse accessibility ≥ 90 on the main pages

=====================================================================
PHASE P4 — ASSURANCE SUITES (all run in CI)
=====================================================================
- Security: authz matrix (tenants × roles × endpoints), API-key scopes, rate limits, CSRF/XSS on chat
  rendering, SSRF guard on connector URLs, webhook signature replay, dependency audit, headers, secret scan
- Adversarial: prompt-injection corpus through model, connector, MCP and supplier outputs; tool-driven
  approval attempts; oversized payloads
- Financial simulation: Σdebits = Σcredits, concurrent approve/capture, reservation leak after crash,
  receipt ↔ ledger hash, revenue truth, no float money (lint rule)
- Trading: labels, live-host refusal, look-ahead, determinism
- Durability: restart drill for each slice

=====================================================================
PHASE P5 — WEBSITES MATCH THE PREVIEW (PR only; no deploy)
=====================================================================
- satelink.network:
  - positioning: universal AI Assistance and Agent Commerce for humans, developers, agents and machines
  - Trading AI as one workflow
  - pay-per-use, no mandatory subscription
  - "Preview — simulated, no charges" clearly shown
  - real Playwright screenshots from S1–S6
  - remove every claim not true today
  - llms.txt and capability JSON generated from the registry; JSON-LD; sitemap
- jakuraa.com: company identity, Satelink as product, contact, legal pages present
- tests: link check, llms.txt snapshot, axe

=====================================================================
PHASE P6 — RELEASE STATE A ACCEPTANCE + RELEASE B FOUNDER LIST
=====================================================================
Write docs/build/RELEASE_A_ACCEPTANCE.md. Each criterion gets a status and the exact proving test,
screenshot or command:
AC1  Signup + onboarding complete                                  (s1 E2E)
AC2  Assistant selects a model automatically                       (router tests + served_by;
                                                                    VERIFIED or VERIFIED (FIXTURE))
AC3  Capabilities discovered from the unified registry             (R9 test + explore E2E)
AC4  User generates and approves a quote                           (s1 E2E + idempotency tests)
AC5  All six demos complete through the shared engine              (s1–s6 E2E; engine-uniqueness check)
AC6  Workflow state survives restarts                              (restart drills)
AC7  Idempotency + failure recovery tested                         (P2.6 + P4)
AC8  Receipts and usage history correct                            (ledger↔receipt reconciliation tests)
AC9  Responsive, professional UI                                   (3-viewport screenshots, axe, Lighthouse)
AC10 Playwright proves the complete journeys                       (CI run URLs, artifacts)
AC11 Security, tenant isolation, financial simulation tests pass   (P4)
AC12 Simulated revenue cannot enter revenue reporting              (revenue-truth tests)
AC13 Websites accurately describe the preview                      (P5)
Release A = ACCEPTED only if all 13 are VERIFIED (AC2 may be VERIFIED (FIXTURE) and must then be
listed as a founder action). Otherwise NOT ACCEPTED, with the gap list.

Also write:
- docs/architecture/ARCHITECTURE.md — ONE document describing what was ACTUALLY built (engine, registry,
  router, planner, money simulation, connectors, protocols, trading), with Mermaid diagrams
- docs/build/RELEASE_B_FOUNDER_ACTIONS.md — every action needed for Public Beta, numbered:
  action | why it blocks | where (env var name / setting / file) | default if not done | unblocks

=====================================================================
STOP CONDITIONS (halt, record in OPEN_BLOCKERS.md + FINAL_REPORT.md)
=====================================================================
S1 Production data or live credentials found in any public ref, artifact or deploy (P0.5)
S2 Any step would touch a production DB, credential, deployment or payment rail
S3 Any code path could move real money, place a live order or reach a live trading host
S4 A test can only pass by weakening a money, security or label assertion
S5 Unexplained ledger invariant violation
S6 A destructive git operation appears necessary
Everything else: log it, route around it, continue.

=====================================================================
FINAL REPORT (docs/build/FINAL_REPORT.md + chat; only these items)
=====================================================================
1  Release A verdict (ACCEPTED / NOT ACCEPTED) + AC1–AC13 table
2  P0 exposure result + backup posture
3  Final progress board
4  Branches, draft PRs (URLs) and the exact founder merge order
5  Tests: suite | passed | failed | skipped (with reason) | CI run URL
6  Six demos: status, E2E file, screenshot folder
7  How to run the preview locally (3 commands)
8  Toolchain installed vs skipped (Superpowers decision)
9  Top 10 tech-debt items
10 Release B founder actions (numbered, with defaults)
```
