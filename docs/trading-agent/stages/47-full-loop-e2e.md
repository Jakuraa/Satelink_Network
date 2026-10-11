# Stage 47 — Full-loop paper E2E, one trace id per leg (Phase 6 item 14)

Proves the locked execution chain end to end on real Postgres with every Phase 6 component in place, and re-runs the 27-question architecture test (`ARCHITECTURE.md` §5b: YES 8 → 23).

## Inspection (reuse before build)

| Existing | Where | Used how |
|---|---|---|
| Stage 30 paper E2E (strategy → backtest → mandate → agent → risk → OMS → MockBroker → fills → portfolio → receipt) | `database/__tests__/trading-e2e.integration.test.ts` | same wiring pattern (risk context, MockBroker, signer, step-up stub); kept unchanged |
| `trading_stamp_trace()` + `tracedPool` / `runWithTrace` (Stage 19, migration 029) | `audit/` | extended to the Phase 6 tables by migration 037 (no new mechanism) |
| orchestrator, scorecard, assistant, proposal service, machine interface, memory, bot runner, Mode B rule | items 6–13 | wired together unchanged except the fixes below |

## What was built / changed

- **Migration 037** `trading_trace_coverage` — `trace_id`, `span_id`, `parent_span_id`, an index and the 029 `trading_stamp_trace()` BEFORE INSERT trigger on `trading_decisions`, `trading_proposals`, `trading_proposal_events`, `decision_memory`, `trade_memory`, `trading_agent_usage`. Adds the `mode_b_executed` proposal-event action. Down migration guards each table and restores the old constraint.
- **`mode_b_executor` bot** (`bots/registry.mjs`) — scheduled every 5 s; flag `MANDATE_MODE_B` (default OFF); acting bot, so the global kill switch skips it. It reads `ProposalService.listModeBCandidates` (pending, `mode_b_candidate`, oldest first, ≤ 20) and calls `executeModeB`.
- **`ProposalService.executeModeB`** — builds the intent **without** `approvedBy` (origin `agent_proposal`, proposer, decision id, bound strategy version) and sends it through OMS acceptance. The risk engine's Mode B rule decides. Refusal → `rejected / execution_refused`; success → `approved / mode_b_executed`, with the order id as result.
- **Machine `propose`** accepts an optional `strategyVersionId` (validated `stv_…`), so a Mode B candidate carries the version its mandate binds.
- **E2E** `database/__tests__/trading-full-loop.integration.test.ts`:
  - **A. Human.** Assistant intent → orchestrator (5 agents, scripted models) → engines → scorecard GO → pending proposal → TOTP approval → acceptance → risk (20 checks) → mandate → `oms_dispatcher` + `fill_consumer` bots → paper fill → position + P&L snapshot → memory (decision, authorization, outcome) → `trade.closed` → `post_trade_review` bot → trade memory.
  - **B. Machine.** Agent key (PROPOSE scope, budgets) → `evaluate` → `propose` → human approval → same chain; 2 usage rows; `model_traces.machine_request_id`; usage posted to the SIMULATED revenue book only (`real` stays empty).
  - **C. Mode B.** Strategy v1 BACKTESTED → PAPER; human signs a Mode B mandate bound to it; an EXECUTE key bound to that mandate evaluates and proposes. `mode_b_executor` with the flag off → `skipped_flag` (proposal still pending). With the flag on → risk `APPROVE` with `risk-checks/1.1` → events `created → mode_b_executed` → paper fill.
  - Each leg runs under one `newTrace()`, and the test asserts **exactly one distinct trace id** across `agent_runs`, `tool_calls`, `model_traces`, `orders`, `order_events`, `fills`, the risk `audit_events`, `trading_decisions`, `trading_proposals`, `trading_proposal_events`, `decision_memory`, `trade_memory` and `trading_agent_usage`, with a row-count floor so the check is never vacuous.
  - `PgOmsStore.listOrders` is checked newest-first on the real orders.

## Bugs the full loop found (each fixed and pinned by a test)

1. **The Mode B risk rule read `termsMode`**, but `MandateService.verifyForOrder` returns `modeCode`, so every real Mode B order would have been refused. The rule now reads `modeCode`, and the fixtures use the real shape.
2. **Approved proposals sent `timeInForce`**, which `ORDER_INTENT_SCHEMA` (risk check 2) rejects, so **every** human approval would have been refused by the real engine. Unit tests had used a stub risk engine. The field is dropped from proposal-built intents, and the review-queue stub now validates intents against the real schema.
3. **Machine Mode B proposals could not carry the bound strategy version**, so the Mode B strategy-match rule would always refuse them. Fixed via the optional `strategyVersionId`.

## Test evidence (2026-10-11, local Postgres 16, guard DB recipe)

| Suite | Result |
|---|---|
| `trading-full-loop.integration.test.ts` | **4 passing** (legs A, B, C + order list) |
| all trading integration suites (21 files) | **79 passing**, 0 failing. `migrations.integration.test.ts` (Docker-only testcontainers) cannot start locally ("no container runtime"); CI runs it with 037 added to its list |
| `apps/api` full suite | **1122 passing / 22 failing / 98 pending**; the 22 failures are identical to the item-13 baseline (`comm -13` → empty) |
| unit: review queue, machine interface, bots, Mode B | 67 passing |
| Mutation checks (10) | all caught. Integration: 037 without trace on `trading_proposals`; 037 without trace on usage; risk reading `termsMode`; Mode B dropping the strategy version; machine propose dropping it; approve sending `timeInForce`; executor not flag-gated. Unit: approve sending `timeInForce`; machine dropping the strategy version; strategy version not validated |

## Blocker impact

| Blocker | Touched? | Why the stage stays inside the accepted isolation |
|---|---|---|
| B-02 (human approval flow) | exercised, **not resolved** | approval works end to end in tests; production still needs the web admin fix + token rotation (founder) |
| B-03 / B-06 / B-10 (unmounted trading routes) | no | nothing mounted; `trading_blocker_register.test.js` still enforces it |
| Migration 037 | yes | applied only to local / ephemeral databases (CI testcontainers); never to a non-local DB |
| Real-money rule | respected | every order is `mode: paper` on `MockBroker`; `MANDATE_MODE_B` default OFF; `LIVE_TRADING` / `AUTONOMOUS_MODE` / `UPSTOX_AUTOMATED` stay LOCKED |
| Revenue | respected | machine usage reaches only the simulated book; draft pricing is a founder decision |
