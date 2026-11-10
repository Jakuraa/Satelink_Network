# P2 design — shared execution foundation (Release A)

Branch `build/p2-foundation` (stacked on `build/integration-base`). Principle: **extend #609, never fork** (R1).
Everything below lives in `apps/api/src/workflows/` + `database/migrations/043_*`, mounted by the existing
`createWorkflowsRouter` under `/v1`. Build order = the numbered list; each step lands with its tests.

## 1. Lifecycle state machine (P2.1) — `workflows/task_state_machine.js`
- `STATES` = CREATED, UNDERSTANDING, PLANNING, AWAITING_INPUT, QUOTED, AWAITING_APPROVAL, AUTHORIZED, RESERVED,
  EXECUTING, VERIFYING, SUCCEEDED, REJECTED, FAILED, CANCELLED, EXPIRED, PARTIALLY_SUCCEEDED,
  REQUIRES_RECONCILIATION, UNKNOWN_EXECUTION_OUTCOME. `TRANSITIONS` is data (from → [to]).
- `transition(store, runId, {from, to, expectedVersion, patch})` → one SQL `UPDATE … WHERE state=$from AND
  version=$v` (optimistic lock); illegal pair → `ILLEGAL_TRANSITION`; lost race → `VERSION_CONFLICT`.
- `legacyStatus(state)` keeps #609's `status` column valid (awaiting_approval/running/completed/failed/blocked/
  cancelled) so Strategy Lab + procurement journeys are unchanged.

## 2. Schema (043, additive, local/CI only)
- `workflow_runs` + `state`, `version`, `tenant_id`, `actor_type`, `environment`, `origin`, `intent`, `plan`,
  `quote_id`, `expires_at`.
- `workflow_run_steps` + `step_no`, `capability_id`, `provider_id`, `idempotency_key` UNIQUE, `attempts`,
  `last_error_code`, `result`, `verified_at`.
- `workflow_quotes` (immutable lines in integer minor units, currency, expires_at, version, disclosure, origin/env).
- `capability_registry` (id+version PK, entry JSONB, release_status, internal_only) — seeded from config.
- `ledger_txns` + nullable `origin`, `environment` (CHECK value sets; NULL = historical/unclassified).
- `workflow_reservations` (id, run_id, quote_id, amount_minor BIGINT, currency, state, hold/settle txn ids,
  idempotency_key UNIQUE, origin/env).
- View `revenue_truth` = only `origin='external' AND environment='live'` (preview → $0.00).
- Events: the existing append-only `wf_journal` stream `run:<id>` (no new events table).

## 3. Registry (P2.2) — `workflows/capability_registry.js`
One module: loads `config/capabilities.preview.json` (mandate field set) into `capability_registry`, exposes
`search({q,intent,market,status})`, `get(id)`; the supplier catalog offers become registry `providers[]`.
#582's `pricing_v2/capability_registry.mjs` (RPC price rules) is re-exported, not duplicated. Eulerpool entries
`internal_only` → filtered from every customer surface (test). R9 test: insert a row → offered without code change.

## 4. Model routing (P2.3) — `workflows/model_router.js`
`classify(text)` → route policy (`conversation` | `plan`). `OpenRouterProvider` (only when `OPENROUTER_API_KEY`
is set; `openrouter/auto` + allowlist plugin, `provider.data_collection:"deny"`, `allow_fallbacks` within the
allowlist, `max_price`). `FixtureModelProvider` otherwise: rule-based classifier, deterministic proposals,
`served_by:"fixture/<model>"`. Typed errors MODEL_UNAVAILABLE / MODEL_NOT_ALLOWLISTED / BUDGET_EXCEEDED /
UPSTREAM_TIMEOUT. Model cost lines in integer micro-USD. Status without a key: **VERIFIED (FIXTURE)**.

## 5. Planner (P2.4) — `workflows/planner.js`
Model proposes `{steps:[{capability_id, inputs}]}` from **registry search results only**; server validates each
step (exists, release_status allowed in preview, input schema, permission, market). Missing input →
AWAITING_INPUT with one specific question. Model output is untrusted (R7/R8).

## 6. Quote → approve → reserve → execute → verify → receipt (P2.5)
- `pricing.js`: fees from `config/pricing.preview.json` (`"status":"PROPOSED — NOT APPROVED"`), BigInt minor
  units, banker-safe integer rounding (ceil to minor unit), minimum fee.
- Approval bound to `quote_id`+`version`, idempotent; expired → EXPIRED, re-quote required.
- `sim_ledger.js`: JS writer for hold/capture/release on `ledger_txns`/`ledger_entries` (txn ids `rsv:<id>:hold`,
  `rsv:<id>:settle`), `origin='simulated'`, `environment='preview'`; **parity test** vs TS `reservation-postings`.
- Execution through the existing DurableKernel (procurement adapter + a `mock_store` connector).
- Capture only after VERIFYING passes; release on failure/cancel/expiry. Receipt (existing append-only table)
  gains `ledger_hash` (sha256 of its canonical ledger entries), `served_by` model + provider, plan, lines,
  verification, `simulated:true`, `simulation_label:"SIMULATED — NO MONEY MOVED"`.
- Promotional demo credit $1: ledger deposit `origin='promotional'` (never revenue).
- `reconcile.js`: ledger ↔ steps ↔ receipts; mismatch → REQUIRES_RECONCILIATION.

## 7. Worker (ADR-6)
DurableKernel + `wf_journal`/`wf_dlq` is the outbox. `recover()` runs at boot (not lazily) and a single in-process
sweep expires quotes/approvals/reservations. Unknown in-flight outcome → verify-then-decide → else
UNKNOWN_EXECUTION_OUTCOME. No second queue.

## 8. API
`POST /v1/tasks` · `GET /v1/tasks` · `GET /v1/tasks/:id` · `GET /v1/tasks/:id/events` (SSE) ·
`POST /v1/tasks/:id/input` · `POST /v1/tasks/:id/approve` · `POST /v1/tasks/:id/cancel` · `GET /v1/receipts/:id` ·
`GET /v1/usage` · `GET /v1/capabilities` · `GET /v1/capabilities/:id`. Errors `{code,message,retryable,
correlation_id}` (R11). Every order/payment/receipt object carries `simulated:true` + `simulation_label` (R10;
contract test).

## 9. Tests (P2.6)
Transition matrix · fee property tests · double submit/approve/dispatch → one effect · expired quote · supplier
failure → FAILED + release + no capture · revenue truth · label contract · R9 registry discovery · sim-ledger
parity · restart drill `scripts/preview/restart-drill.sh` (kill -9 during EXECUTING → exactly one capture).
