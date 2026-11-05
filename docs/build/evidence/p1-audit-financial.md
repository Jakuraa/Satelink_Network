# Audit B — financial path (worktree release-a, build/integration-base)
Root: /Users/pradeepjakuraa/satelink/.claude/worktrees/release-a. Read-only.

## 1. Financial OS ledger API
- Packages: `@satelink/financial` (services/financial/package.json:2) and `@satelink/financial-domain` (libs/financial-domain/package.json:2). Both export **raw TS source** (`exports/main/types` = `./src/index.ts`), with no dist and no build step. The only script is `typecheck`.
- Posting: `PostgresLedgerRepository.post(txn: LedgerTransaction)` (infrastructure/repositories/postgres/postgres-ledger-repository.ts:48,51), plus `findByTxnId` :119 and `streamByAccount` :176. Port: application/ports/ledger-repository.ts.
- Unit of work: `PostgresUnitOfWork.commitDrawAndLedger(draw, ledgerTxn)` (postgres-unit-of-work.ts:11,14) and `PostgresAuthorizationCreationUnitOfWork`. The reservation UoW port is application/ports/reservation-unit-of-work.ts. Its only implementation is in-memory.
- Principals and accounts: `PostgresPrincipalRepository.save` (postgres-principal-repository.ts:21,50) and `PostgresAccountRepository.save` / `findByPrincipalKindCurrency` (postgres-account-repository.ts:20,45,56). Backfill lives in infrastructure/backfill/backfill-principals.ts and backfill-cli.ts. There is no "createAccount" command, so callers build the domain aggregate and then call save.
- Balance: the `account_balances` VIEW (database/migrations/003_ledger_entries.sql:56) computes available = posted_credits − posted_debits − pending_debits. Queries: application/queries/ledger-available-balance.ts and get-capacity.ts. Ledger tables: ledger_txns / ledger_entries.
- apps/api → TS call sites: **none at runtime**. apps/api/src/ledger/shadow_ledger_write.js (:142-160, :252-268) and src/capacity/capacity_enforcement.js (:21-22) re-implement the logic in **raw SQL** in JS by design. Only the `*.integration.test.ts` files under src/capacity touch the TS. `apps/api/src/services/financial/truth.js` is an unrelated JS module (it is not the TS package). apps/api starts with `node server.js` (package.json:55) and has no tsx or loader, so it cannot import the TS packages as they stand.

## 2. Reservation (#583)
- Domain: libs/financial-domain/src/reservation/{reservation.ts, reservation-id.ts, errors.ts}.
- Service: services/financial/src/application/commands/reservation-service.ts
  - `reserve(deps, cmd: {reservationId, accountId, amount: Money, idempotencyKey, now, ttlMs})` :69
  - `capture(deps, reservationId, amount, now)` :108
  - `release(deps, reservationId, now)` :112
  - `expireLapsed(deps, now, limit=100)` → `{expired, failed}` :127
  - Deps :48: `reservations`, `uow` (commitHold/commit settle), `balances: AvailableBalanceReader`, `accountsFor(r) → ReservationAccounts`.
- Idempotency: the key is scoped per account (`findByIdempotencyKey(accountId, key)`). A replay goes through `matchRetry`, which returns the original result or a conflict. A duplicate on the unique idempotency_key during `commitHold` is converted to a replay (:96-99). Ledger txn ids are deterministic: `rsv:<id>:hold` and `rsv:<id>:settle` (reservation-postings.ts:57-58). There is one settle txn per reservation, so a capture and a release cannot both happen.
- Postings: libs/financial-domain/src/coordination/reservation-postings.ts. `holdPosting` :61 posts Dr customer / Cr holds. `settlePosting` :73 posts Dr holds / Cr revenue (captured) + Cr customer (remainder), or for a release Dr holds / Cr customer. All entries are POSTED.
- Required accounts: `ReservationAccounts {customer, holds, revenue}` (:30-36), all AccountRefs. Nothing in the code provisions the holds or revenue accounts. The existing system accounts are in migration 005_system_accounts.sql; whether those include a holds account is UNKNOWN.
- Repositories: **in-memory only** (in-memory-reservation-repository.ts, in-memory-reservation-unit-of-work.ts).
- **MISSING:** a Postgres `reservations` table (no migration creates one), a `PostgresReservationRepository`, a `PostgresReservationUnitOfWork` (an atomic hold commit with a balance check under lock), any expiry worker/cron, and the wiring of holds/revenue accounts. Migration 042_ledger_kind_reservation.sql only widens `ledger_txns.kind` to add hold/capture/release. The founder still has to apply it to prod (F14).

## 3. Outbox / worker
- BullMQ: apps/api/src/queue/workloadQueue.js:1,10 (`new Queue(WORKLOAD_QUEUE_NAME)`), plus job_producer.js, job_consumer.js, workerProcessor.js and job_dispatcher.js. These are for RPC/workload jobs.
- Pg outbox: migration 039_payments_core.sql:6 mentions "→ outbox" in the payments flow (payments in apps/api/src/payments/{ingest,reconcile,plans}.mjs). 011_reconciliation.sql also references it. The exact table name was not confirmed (UNKNOWN).
- #609 workflows do **not** use BullMQ or the outbox (no hits in apps/api/src/workflows). They rely on their own Postgres journal and recovery tables (wf_journal, wf_idempotency, wf_dlq in 041).

## 4. Revenue truth
- Revenue is computed in apps/api/src/services/financial/truth.js (mounted at app_factory.mjs:21,542, `/api/financial`, admin-only). The sources are `revenue_events_v2` (:54,260), `credit_deposits` (:68), epoch_ledger, epoch_earnings, node_claims and settlement_batches. Also relevant: src/admin/financial_metrics.js and src/dashboard_api/earnings_overview.js.
- Origin/environment concept: the existing tables use the `is_test_data` boolean (founder wallets). There is no `origin` or `environment` column. In 041:
  - Tables: wf_journal, wf_idempotency, wf_suppliers, wf_dlq, workflow_definitions, workflow_strategies, workflow_runs (`receipt_id` :92, `is_test_data DEFAULT true` :96), workflow_run_steps, workflow_usage_records, workflow_receipts.
  - workflow_usage_records (:115-128) has these money columns: `supplier_cost_micros`, `customer_charge_micros` and `list_price_micros` (all BIGINT micro-USD), plus `pricing_approved`. It also has the revenue guards `money_moved CHECK(=false)` and `counted_as_revenue CHECK(=false)`, and `is_test_data DEFAULT true`.
  - workflow_receipts is append-only, enforced by triggers (:140-148).
  - The header (:15-17) states that these tables are NOT a ledger and that money moves only through the Financial OS reserve/capture/release.

## 5. Floats in #609 workflow code
- Money: apps/api/src/workflows/supplier_catalog.js:190 `basePrice: Number(this.price(o).chargeMicros)` converts bigint micros to a JS number. Micros below 2^53 are exact, but this still breaks invariant 2 in output.
- Fee and percentage math, which is not ledger money but is cost modelling: workload_adapters.js:80 (`Number(bps)/100`) and :92 (feeBps/halfSpreadBps/slippageBps → Number).
- The remaining hits are not money: strategy_compiler.js:90,102,103,109,116 (strategy params) and workflow_service.js:513 (timestamp). There are no parseFloat or toFixed calls.

## 6. Pricing / fee config
- apps/api/config/plan_catalog.v2.json: `price_usd_per_call: 3e-05` (:23, LIVE) and a bundle `price_usd: 0.1` (:31, LIVE). These are float USD values in JSON.
- apps/api/config/supplier_catalog.v1.json: every offer has `"approved": false` (:104,146,196,246,295,345,395,444,489,523). Statuses are preview, evaluation or not_authorized. run_store.js:277 and workflow_service.js:213,384 carry `pricing_approved`.
- Also present: trading_ai_plans.v1.json, mcp_workflow_tools.v1.json and workflows_openapi.v1.json (not inspected in detail).
- docs/build/REVENUE_MODEL.md:13 has Status PROPOSED: "No prices in this file are decided" (F8). §3 (:51-62) gives only the shape (`amount_micro` null = unpublished, `cost_plus.markup_bps`, `floor_micro`). It contains no fee numbers beyond the live RPC $0.00003/call and $0.10 per 1,000 calls (:26).
