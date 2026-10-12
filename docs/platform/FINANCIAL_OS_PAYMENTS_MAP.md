# Financial OS — Payments Map (Wave 1.1, 2026-10-12)

This is a read-only inventory of every money path on `trading-agent/integration` (with `origin/main` merged in) as of 2026-10-12. Every claim carries a file:line reference. Anything marked UNVERIFIED was not confirmed against running code.

**Headline: before Wave 1, no money path posted to the Financial OS ledger in the same DB transaction as its business write.** Every ledger post goes through `apps/api/src/ledger/shadow_ledger_write.js`. That writer:
- runs on its own pool connection ("never the caller's", `:14-15`);
- is gated by `LEDGER_SHADOW_WRITE`, which defaults OFF (`:39`);
- swallows its own errors (`:179-187`).

Wave 1 adds `apps/api/src/payments/`, the first path that posts **inside** the business transaction. The existing writers are not changed.

## 1. `api_credits` credits and debits

### Credits

| Path | Location | What it writes |
|---|---|---|
| `creditAccount()` | `apps/api/src/billing/credit_service.mjs:295` | Inserts `api_deposits` (:314), then updates `credits_usdt += amount` (:330-339). For Dodo funding it also sets `dodo_funded_usdt += amount` (:326). |
| x402 bundle | `apps/api/src/payments/x402/settlement.js:43` | Find-or-create the account (:69), insert `api_deposits` (:88), update `credits_usdt +=` (:93-102). |
| Manual deposit claim | `apps/api/src/billing/api_keys_route.mjs:196` | Insert at :378, update at :383-390. |
| Dodo unfreeze | `apps/api/src/routes/internal_dodo.js:411` | Update at :415. |
| Key rotation | `apps/api/src/console_accounts/keys.mjs:200` | Moves the balance to the new key (:228, :233). |

`creditAccount()` is called by the DepositListener (`deposit_listener.js:405`) and by Dodo `/credit` (`internal_dodo.js:711`).

### Debits

- **`deductSql()`** (`apps/api/src/billing/deduct_sql.mjs:14-31`) is used by:
  - `authorizeAndMeter` (`credit_service.mjs:174`, at :250);
  - `deductWithAccountLimits` (`console_accounts/limits.mjs:124`).
- **Dodo:**
  - clawback (`internal_dodo.js:369`);
  - freeze (`:394`);
  - release (`:423`).

## 2. Writers of `revenue_events_v2`

**Payments:**
- x402: `settlement.js:115`
- Dodo `/credit`: `internal_dodo.js:691`
- Dodo reversals: `internal_dodo.js:434`
- Pricing V2: `pricing_v2/webhooks.mjs:84`

**Per-call usage:**
- RPC: `rpc_gateway/rpc_billing.js:94`, `node_dispatcher.js:238`, `ws_gateway.js:295`
- `mev_relay/index.js:211`
- `ai_gateway/index.js:76`
- `bandwidth_proxy/index.js:20,40`
- `oracle/index.js:96`
- `webhooks/index.js:143`

**Legacy, live status UNVERIFIED:**
- `core/operations_engine.js:278`
- `security/middleware/billing.js:59`
- `queue/job_dispatcher.js:206`
- `gateway/global/global_gateway_router.js:81`

The DepositListener writes **no** `revenue_events_v2` row.

## 3. Ledger posting APIs

**Before Wave 1:**
- `shadowWriteRevenueLedger` (`shadow_ledger_write.js:96`): kind `deposit`, debit suspense / credit revenue.
- `shadowReverseRevenueLedger` (`:206`): kind `refund`.
- `shadowWriteDraw` (`shadow_draw_write.js:30`): kind `draw`.
- `PostgresLedgerRepository.post()` (`services/financial/.../postgres-ledger-repository.ts:51`) opens its own connection. Its only apps/api import is a test.
- Stage 27 Razorpay posts to an in-memory `SimSubscriptionBook` only (`trading_agent/billing/books.mjs:9`). `RealBookPosting.post()` throws `LEDGER_NOT_APPROVED` (:29-33).

**New in Wave 1:**
- `apps/api/src/payments/ledger_posting.mjs`: `postSettledPayment(client, …)` and `postReversal(client, …)`. Both take the **caller's client**, throw on failure, and use the 038 kinds.

## 4. Payment handlers

| Rail | Entry | Writes | Ledger posting relative to the business write |
|---|---|---|---|
| Dodo legacy | `apps/web/src/app/api/dodo-webhook/route.ts:437` → `/internal/dodo/credit` (`internal_dodo.js:565`), `/reversal` (:764) | `payment_sources`, `revenue_events_v2`, `api_credits`, `subscriptions` | **After COMMIT, not awaited** (`internal_dodo.js:740-742`) |
| Dodo Pricing V2 | `POST /webhooks/dodo/v2` (`app_factory.mjs:448`) → `pricing_v2/webhooks.mjs:97` | `pv2_*`, `revenue_events_v2`, `payment_sources` | **After COMMIT, awaited**; the writer swallows its errors (:156, :215, :226-227) |
| Razorpay (Stage 27) | `trading_agent/billing/router.mjs:42` → `service.mjs:89` | `billing_*`, `invoices` | Sim book only. `mountBillingRoutes` is **not mounted** in `app_factory.mjs` |
| x402 | `payments/x402/middleware.js:172` → `settlement.js:43` | `api_credits`, `api_deposits`, `payment_sources`, `revenue_events_v2` | **Fired before COMMIT, not awaited** (`settlement.js:122,125` vs COMMIT at :127). **Latent bug:** a rollback can leave an orphaned ledger txn |
| Polygon vault | `services/deposit_listener.js:332` (`_handleDeposit`) | `credit_deposits` (own transaction, :351-365), then `creditAccount(pool)` | **No ledger post.** The `api_deposits` insert and the `api_credits` update are separate autocommits (`deposit_listener.js:26`); the same is true of `/api/keys/deposit` |
| **New: `/webhooks/:provider`** | `payments/webhook_router.mjs` → `payments/ingest.mjs` | `payment_events`, ledger, `payment_entitlement_grants`, `outbox` | **Same transaction** |

## 5. Floating-point money (audit-04 prerequisite e)

| Area | Location | What it does |
|---|---|---|
| x402 | `settlement.js:60` | `bundleCalls * 0.000030` |
| x402 | `settlement.js:103`, `:133` | `parseFloat` |
| credit_service | `credit_service.mjs:155-156, :228, :259, :297, :344` | `parseFloat` |
| limits | `limits.mjs:129` | `parseFloat` |
| Dodo | `internal_dodo.js:67-79` | `Number/100 * rate`, `.toFixed(6)` |
| Dodo | `internal_dodo.js:357, :363, :373, :383, :398, :407, :818, :864` | `Number`, `+toFixed` |
| Pricing V2 | `webhooks.mjs:120, :204-205` | `Number/100` |
| Deposits | `deposit_listener.js:334`, `api_keys_route.mjs:300` | `parseFloat(formatUnits)` |

Correct by contrast:
- `toMinorUnits` (`shadow_ledger_write.js:49`) uses strings/BigInt.
- **All of `apps/api/src/payments/` uses BigInt minor units and refuses excess precision** (`contract.mjs` `decimalToMinor`).

## 6. Kinds and accounts

**`ledger_txns_kind_check`:**
- 009 created it.
- 019 widened it with DROP + ADD, adding `refund`.
- **038** widens it again, additively (founder-approved 2026-10-12), with `payment`, `subscription`, `commission`, `rebate`, `provider_fee`.
- The domain mirror is `libs/financial-domain/src/ledger/ledger-kind.ts`.

**`accounts.kind`:**
- It has **no CHECK**; it is free text, unique on `(principal_id, kind, currency)` (`002:14,24`).
- Kinds in use before Wave 1: `revenue`, `suspense` (005) and `capacity` (`shadow_draw_write.js:79`).

**Wave 1 adds platform accounts, created on demand, one per currency:**

| Kind | Normal balance | Notes |
|---|---|---|
| `clearing_<provider>` | debit | |
| `revenue` | credit | Reuses `acct_platform_revenue` for USDT |
| `customer_credit` | credit | Per-customer split by `ref_type='customer_credit'`, `ref_id=<customer>` |

## 7. Plans, entitlements, outbox

**Plans:**
- Pricing V2 catalog: `pricing_v2/catalog.mjs` + `config/plan_catalog.v2.json`, web mirror `apps/web/src/lib/plan-catalog.ts`. Whether this is the #452 PlanCatalog is UNVERIFIED.
- Stage 27 plans: `trading_agent/billing/plans.mjs:7` (draft, INR).

**Entitlements:**
- Trading Intelligence: `pricing_v2/metering.mjs:34`.
- Trading Agent key budgets: `trading_agent/access/guard.mjs:35-38`.
- Stage 27 `entitlementsFor` is not enforced on any route (UNVERIFIED).
- **New:** `payment_entitlement_grants` (039).

**Outbox:**
- `outbox` (011), which Wave 1 writes `payment.<status>` events to.
- `trading_outbox` (021).

## 8. Name collisions avoided

- **Existing tables:** `payment_sources`, `payments_inbox`, `billing_payments`, `pv2_payments`, `pv2_reconciliation_runs`, `payout_*`.
- **New tables:** `payment_intents`, `payment_events`, `payment_entitlement_grants`, `provider_reconciliation_runs`.
- **Migration numbering:** `database/migrations/0xx` and `apps/api/migrations/0xx` overlap. 038/039 live in `database/migrations/` (runner: `npx tsx database/runner.ts migrate <url>`).

## Support procedures (on-chain)

- **Wrong network or wrong token: not detected.**
  - The DepositListener only watches `Deposited` on RevenueVaultV2, Polygon 137.
  - USDT sent on another chain, a plain `transfer()` to the vault (no `deposit()`), or another token sent to the vault produces **no event**.
  - **Procedure:**
    1. The customer opens a support ticket with the tx hash.
    2. Support confirms the transfer on the explorer.
    3. If the funds are recoverable to the treasury, issue a manual `adjustment` posting plus a customer credit. Both are human-approved, two-person.
    4. Otherwise, reply that the funds were sent to an address Satelink cannot access.
  - The checkout page must state the network, token and amount next to the QR (Wave 1.8).
- **Underpayment (`partially_paid`):**
  - No entitlement and no posting; the event is recorded.
  - Support either requests the remainder against the same invoice (a new event settles it) or refunds or credits it manually.
- **Overpayment (`overpaid`):** posted automatically. The plan amount goes to revenue and the remainder to `customer_credit`.

## Open items

1. **x402 orphan risk** (`settlement.js:122-127`, ledger write before COMMIT) is pre-existing. It needs a founder-reviewed fix; it is **not changed here**, because changing an existing Financial OS posting path is a STOP condition.
2. **DepositListener / `/api/keys/deposit` non-atomic credit** is pre-existing and not changed here.
3. **Wiring the live rails into `ingestCanonicalEvent`** (the listener and x402 emitting canonical events) is a follow-up behind a flag. Wave 1.3 only normalises, so RPC customer behaviour is unchanged.
