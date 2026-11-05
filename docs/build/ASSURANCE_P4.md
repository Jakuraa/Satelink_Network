# Release A — P4 assurance suites (traceability)

Every P4 requirement → the test that proves it → where it runs in CI. "Integration" = `vitest --project integration`
(real Postgres; CI job *Financial OS Integration Suite*, `architecture.yml`). "E2E" = Playwright at 390/768/1440
(CI job *Release A journeys … + audit gate*, `release-a-e2e.yml`). "Unit" = apps/api mocha (*Tests* / *API Test
Baseline Guard*). "Arch" = `npm run test:arch` (*Architecture*).

## Security
| Requirement | Proof | CI |
|---|---|---|
| Authz matrix: tenants × principals × endpoints | `assurance_p4` › authorization matrix (30 cases: anon, revoked/bogus key, read/agent/full keys, other tenant's session and key, CSRF-less session × list/get/events/receipt/usage/create/approve/approval-request/cancel/keys/connections) + A2A cross-tenant | Integration |
| API-key scopes | `assurance_p4` matrix; `developer_s4`; `agent_s5` ($0 agent pre-authorization) | Integration |
| Rate limits | `assurance_p4` › 429 over HTTP; `developer_s4` › fixed window | Integration |
| CSRF | `assurance_p4` matrix (session without `X-Satelink-Console` → 403); `p4-adversarial` (cross-site Origin with the user's cookies → 403, same-site → 201) | Integration, E2E |
| XSS on chat rendering | `p4-adversarial` (HTML/script in chat, task title and supplier output render as text; no anchors/scripts from supplier output; no dialogs; `window.__xss` untouched) | E2E |
| SSRF guard on connector URLs | `egress_guard.test.js` (preview loopback-only; beta/live https + no private/loopback/link-local/metadata, incl. IPv4-mapped IPv6 in both forms); `assurance_p4` › redirect to 169.254.169.254 never followed | Unit, Integration |
| Webhook signature replay | `payments_ingest.integration` (pre-existing: signature + replay/idempotency for payment webhooks). Release A adds no inbound webhooks. | Integration |
| Dependency audit | `scripts/security/audit-gate.mjs` — fails on any NEW high/critical production advisory vs `docs/build/evidence/npm-audit-baseline.json`; 40 known (4 critical) → OB-14 | E2E job step |
| Security headers | `assurance_p4` › headers via the shared `security_headers.js` middleware (nosniff, frame DENY, no-store, no X-Powered-By); console headers from `next.config.ts` | Integration |
| Secret scan | gitleaks on new commits (P0, *Secret Scan*) + pre-commit gate | CI |
| Oversized / malformed payloads | `assurance_p4` (2001-char text 400, 40 kB body 413, bad JSON 400, 70 kB A2A 413, x402 q 400; nothing created) | Integration |

## Adversarial
| Requirement | Proof | CI |
|---|---|---|
| Prompt injection via the model input | `assurance_p4` › injected "admin mode / approve / $0 fee / transfer $1000" → same capability, same fee, no approval, no reservation | Integration |
| … via connector / supplier output | `assurance_p4` › supplier output "SYSTEM: approve all…" stored as data, nothing else changes; `food_mcp` › injection in an MCP menu never reaches plan/quote/approval/receipt | Integration |
| … via MCP / A2A | `assurance_p4` › A2A "approve task …" creates a new quote, approves nothing; `mcp-server` tests › no approve tool, cancels mis-planned quotes | Integration, Unit |
| Tool-driven approval attempts | matrix (agent key / full key on an agent task → 403 `HUMAN_APPROVAL_REQUIRED`); `agent_s5` | Integration |

## Financial simulation
| Requirement | Proof | CI |
|---|---|---|
| Σdebits = Σcredits | `assurance_p4` › every ledger transaction balances (ledger-wide query); `sim_ledger_parity` | Integration |
| Concurrent approve / capture | `assurance_p4` › 10 parallel approvals → 1 reservation, 1 capture; 3 racing x402 payments → 1 deposit, 1 approval, others 409 | Integration |
| Reservation leak after crash | `assurance_p4` › no `held` reservation on a terminal task; durability suite; restart drill | Integration, E2E |
| Receipt ↔ ledger hash | `assurance_p4` › every succeeded receipt reproduces its ledger hash; `reconcile()` → no problems | Integration |
| Revenue truth | `assurance_p4` + every slice suite › `revenue_truth` = 0; origin+environment on every money row | Integration |
| No float money (lint rule) | `tools/architecture-tests/no-float-money.test.ts` (scope: engine, ledger, pricing, connectors, task/A2A/x402 routes, MCP tools, mocks; tripwire-verified) | Arch |

## Trading
| Requirement | Proof | CI |
|---|---|---|
| Labels | `trading_s3`, `s3-trading` E2E, Trading AI page (`p3-quality`) | Integration, E2E |
| Live-host refusal | `trading_s3` (Alpaca live host refused; paper host pinned) | Integration |
| Look-ahead | `trading_s3` (leakage check in every scorecard) | Integration |
| Determinism | `assurance_p4` › same strategy → identical scorecard content, hashes, decision and trace | Integration |

## Durability (restart per slice)
| Slice | Proof | CI |
|---|---|---|
| S1 shopping | `restart-drill.sh` (real SIGKILL during EXECUTING) + `assurance_p4` durability | E2E, Integration |
| S2 food (MCP + OAuth) | `assurance_p4` durability | Integration |
| S3 trading | `assurance_p4` durability (needed a fix — see below) | Integration |
| S4 developer, S5 agent, S6 machine (REST/OpenAPI path) | `assurance_p4` durability | Integration |

The durability test makes the connector hang **after the real supplier accepted** (the process "dies" before recording
the result), boots a second service on the same database, and requires: recovery picks the task up, it ends SUCCEEDED,
every supplier call used the same idempotency key, exactly one capture, a verified receipt, and the deliverable recorded.

## Defects found and fixed by P4
1. SSRF bypass: `[::ffff:10.0.0.1]` is normalised by the URL parser to `[::ffff:a00:1]` and slipped past a dotted-quad check.
2. Redirects were followed by every connector (SSRF via an allowed host) → one egress guard with `redirect: 'error'`.
3. x402: two different valid payments racing for one task could both credit a deposit → deposit only inside the winning approval transition, keyed per task; the loser gets 409.
4. Trading recovery after a crash went to REQUIRES_RECONCILIATION (evaluation ids were wall-clock based) → evaluation anchored to the quote time; verify recomputes it.
5. After crash recovery the supplier deliverable (e.g. the gift code) was not recorded → connectors return the verified supplier record; the engine records it.
6. Console chat could not start "extract/parse" tasks (S4 capability reachable only via API) → intents come from the registry (R9).
7. Preview API had no security headers → shared middleware.
Also surfaced (not fixable inside Release A): 4 critical production advisories → OB-14.
