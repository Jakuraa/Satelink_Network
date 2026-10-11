# Stage 46 — Proposal review queue, order list, "Talk to Satelink Trading AI" (Phase 6 item 13)

Closes the two Stage 24 gaps that answered **501**: the proposal review queue (B-02's human approval flow) and the order list. Turns the console Agent page into the human path through the one core.

## Inspection (reuse before build)

| Existing | Where | Used how |
|---|---|---|
| Stage 24 routes `GET /proposals`, `POST /proposals/:id/approve` (step-up), `POST /proposals/:id/reject`, `GET /orders` | `api/router.mjs`, `api/ports.mjs` | same routes, now backed by real services; `approve` now receives the verified step-up method |
| proposal sink used by the Stage 12 tools, MCP and the machine interface | `agent/tools.mjs`, `access/` | `ProposalService.create` is that sink; it normalises every shape and resolves an agent's **human owner** |
| OMS acceptance → mandate → risk engine | `oms/acceptance.mjs` (Stage 17), `risk/` | an approved order proposal becomes a **human-approved** intent through acceptance — nothing bypasses risk |
| strategy versions | `strategies/` (Stage 13) | an approved strategy proposal becomes a DRAFT version (must still validate) |
| orchestrator + scorecard | items 8, 6 | the assistant's evaluation |
| console server-side client, flag guard, disclosure, Stage 25 static rules | `apps/console` | reused; new actions in their own file, each flag-guarded; `randomUUID()` idempotency keys |

## What was built

- **Migration 036** — `trading_proposals` (status moves once: pending_review → approved / rejected / expired; `decided_at` tracks it; order proposals need a mandate) + append-only `trading_proposal_events` (an `approved` event must carry the step-up method).
- **`proposals/service.mjs`** — `ProposalService` (create / list / approve / reject). Approve: human + step-up, owner only, pending and unexpired, single transition (compare-and-set). A risk refusal closes the proposal as rejected with `execution_refused` and the reason (422).
- **`proposals/assistant.mjs`** + `POST /assistant/evaluate` (human only) — intent (capital, max loss ≤ capital, broker, 1–5 markets) → orchestrator → GO / WAIT / REJECT card + agent notes; **a pending proposal only on GO** when an order was described.
- **`listOrders`** on both OMS stores (newest first, status filter, limit ≤ 200).
- **Console** `/trading/agent` → "Talk to Satelink Trading AI": intent form → decision card (score explained as decision quality, not a probability of profit; plain-language gate reasons; evidence; expiry; receipt id) → **Authorise paper order** with a 6-digit code → the existing order page / receipt. Pending proposals listed with Authorise / Decline. "Paper trading only. Live execution is not available."

## Test evidence (2026-10-11)

| Suite | Result |
|---|---|
| `apps/api/test/trading_review_queue.test.js` | **9 passing**: an agent's Stage 12 proposal lands in the owner's queue (501 gone), tenant isolation; approve needs step-up (none / wrong → 401), then a human-approved `agent_proposal` intent (paper, mandate-resolved account + venue) through OMS acceptance; order appears in `GET /orders`; events created → approved(totp); second approval refused before OMS ("proposal is approved"); risk refusal → 422, closed as rejected, no order; reject, foreign 404, agent 403, expiry → 409 EXPIRED; strategy proposal → DRAFT v1; service-level defence in depth (no step-up method, agent approver, agent assistant); assistant GO → card + pending proposal → approve → `llm_proposal` order carrying the decision id; WAIT/REJECT → no proposal; bad intents 400; order larger than capital 400; order list newest first + limit; 501 without a store |
| `apps/api/test/trading_api.test.js` (Stage 24 incl. OpenAPI contract) | **22 passing** (`GET /orders` expectation 501 → 200; `/assistant/evaluate` documented) |
| `database/__tests__/trading-proposals.integration.test.ts` (local Postgres) | **5 passing**: create → owner list → approve once with step-up recorded, events append-only; refusal → rejected; constraints (order needs mandate, approved event needs step-up, decided_at); `PgOmsStore.listOrders` query valid on the real schema (ordering asserted in-memory; real Postgres orders in item 14); down migration |
| `apps/console` vitest | **20 passing** (5 new: GO card with authorise form, REJECT card without it, intent form + paper-only copy, gate text, flag guards / no live claims); `tsc` 0 errors in `src` |
| Mutation checks (10) | all caught: foreign proposals decidable, approve without step-up method, router step-up removed, expiry ignored, decide twice (survived at first → early-exit message pinned), risk refusal treated as approved, agent proposals in the agent's own queue, proposal on WAIT/REJECT, agents using the assistant, approval not stamped on the order |

A real bug fixed while testing: `create()` did not set `status`, so the in-memory store saw every proposal as already decided.

## Blocker impact

| Blocker | Touched? | Why the stage stays inside the accepted isolation |
|---|---|---|
| **B-02** (human proposal-review / approval flow) | **code exists, not resolved** | the queue is human-only with step-up, but B-02 also needs the web admin fix in production + token rotation (founder); trading routes stay unmounted |
| B-03 / B-06 / B-10 | yes (routes + migration 036) | not mounted; 036 applied only to local ephemeral databases |
| Real-money rule | respected | console orders are `mode: "paper"`; live needs the LOCKED `LIVE_TRADING` |
