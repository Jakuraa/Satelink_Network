# Runbook — switch the API's DATABASE_URL from `postgres` to `satelink_app` (F1 follow-up)

> **Status: PREPARED, NOT EXECUTED.** Changing `DATABASE_URL`, setting the role's password and running
> migrations in production are founder actions. Derived from code on `origin/main` @ `ed18f23d`
> (2026-10-21); no database was accessed. Evidence: A2 = API connects as `postgres`
> (`docs/build/evidence/SIGNER_AND_FOUNDER_ANSWERS_2026-10-20.md`).

## Bottom line

The existing grants (migration 017) cover every ordinary read/write the API and the reconciler make.
**The switch is still unsafe today**: several code paths run DDL at request/boot time (`ALTER TABLE`,
`CREATE INDEX`, `CREATE TABLE IF NOT EXISTS`). A non-owner role cannot run DDL on tables owned by
`postgres`, and on PostgreSQL ≥ 15 it cannot `CREATE TABLE` in `public` without `CREATE` on the
schema. Four features would fail on every call (D1–D4). Those need code changes first; grants alone
cannot fix them.

## 1. What `satelink_app` has today — `database/migrations/017_satelink_app_role.sql`

| Line | Grant |
|---|---|
| :28 | `CREATE ROLE satelink_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` (password set out-of-band) |
| :35 | `GRANT CONNECT ON DATABASE <current>` |
| :38 | `GRANT USAGE ON SCHEMA public` |
| :44 | `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public` |
| :45 | `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public` |
| :51-54 | default privileges for objects later created by the migrating role (`postgres`) |
| :62 | `REVOKE UPDATE, DELETE ON ledger_entries` (ledger is append-only; also `004`) |

Not granted: `CREATE` on schema `public`, ownership of any table, `pg_monitor`.

## 2. What the services do (from code)

- **apps/api** (`server.js` → `app_factory.mjs`): SELECT/INSERT/UPDATE on ~200 `public` tables
  (billing, epochs/earnings/claims, nodes, auth/console, Financial OS ledger — `ledger_entries` INSERT only);
  DELETE on `api_usage_daily`, `epochs`, `epoch_ledger`, `node_health_logs` (`db_cleanup_job.js`), retention
  tables (`data_retention_job.mjs`), `revenue_events_v2` (`rpc_aggregation_job.mjs`), nonces/auth tables.
  No TRUNCATE, no `setval`. **Covered by 017.** The only `ledger_entries` UPDATEs are in dead
  `nodeops_waterfall.js` copies (not imported by the live app), so 017:62 breaks nothing live.
- **workers/reconciler**: SELECT on `revenue_events_v2`, `ledger_entries`, `ledger_txns`,
  `driver_heartbeats`, `platform_flags`, `schedule_state`, `draws`; INSERT/UPDATE on `outbox`,
  `reconciliation_state`, `schedule_state`, `guardrail_alert_state`, `draws`, `settlements`. No DDL. Covered,
  except D9.
- **Runtime DDL in apps/api** (fails for a non-owner): `server.js` `ensureBillingTables`;
  `db/dodo_rail_schema.js`; `plans/plans_schema.mjs`; `machine-access/tables.js`; `billing/credit_system.mjs`;
  `billing/wallet_challenge.mjs`; `billing/api_keys_route.mjs`; `routes/deposit_notify_api.js`;
  `scheduler/jobs/settlement_anchor_job.js`; `pricing_v2/schema.mjs`; `console_accounts/schema.mjs`;
  `billing/legacy_sub_entitlement.mjs`; `analytics/rpc_traffic_recorder.mjs`; `billing/x402_session_keys.js`
  (guarded by `to_regclass`); `routes/claims_route.mjs`; `services/claims/claim_processor.js`;
  `services/deposit_listener.js`; `jobs/treasury_settlement_job.mjs`; `admin/cron_scheduler.js`;
  `core/feature_flags.js`; `admin/ensure_admin_tables.js`; `workloads/webhooks/index.js`;
  `VACUUM ANALYZE` in retention/cleanup jobs (non-owner: warning, table skipped — not an error).

## 3. Gaps

**Hard breaks — fail on every call after the switch (fix in code BEFORE switching):**
- **D1 Pricing V2** — `pricing_v2/schema.mjs` runs `ALTER TABLE pv2_pack_grants ...` and `CREATE INDEX ...`
  inside `ensurePricingV2Schema`, awaited by metering, account plan, webhooks, reconcile and console onboarding.
- **D2 Console accounts** — `ensureConsoleAccountsSchema` (`CREATE INDEX` on the request log) awaited by the
  console router, limits and alerts.
- **D3 Subscription grants** — `legacy_sub_entitlement.mjs` runs DDL inside the caller's transaction, so
  every grant transaction aborts.
- **D4 Traffic analytics** — `rpc_traffic_recorder.mjs` calls `ensureSchema` on every flush; every batch is dropped.

**Non-fatal but noisy:** D5 `dodo_rail_schema.js` rolls back and sends a Discord critical alert on every boot;
D6 other ensure-functions log failures (mostly caught); D7 x402 tables fine if present.

**Missing privileges:** D8 tables not yet created in prod (lazy `CREATE TABLE IF NOT EXISTS`) need `CREATE`
on schema `public` (PG ≥ 15); D9 reconciler `guardrails/metrics.ts` calls `pg_ls_waldir()` (needs
`pg_monitor` or EXECUTE) — only if the reconciler's URL is switched too.

**`claim_expiry_job.js` (D10 — broken under either role, not a grants issue):** its reallocation inserts
`epoch_earnings` without `role` (NOT NULL, part of the PK) so the transaction rolls back whenever there is
anything to reallocate; it sets `expired_at`, a column only added by its own never-called
`ensureExpiryTables`. Fix is code (Step 4.3), and must not rely on runtime `ALTER TABLE`.

Sequences/default privileges: OK (`SERIAL`/`IDENTITY` need only USAGE, granted).

## 4. Plan

**Phase A — code (PRs, before any switch):** for D1–D6 and D10, move each DDL statement into a numbered
migration under `database/migrations/` (run as `postgres` by `database/runner.ts`), and make every
ensure-function *check first and skip DDL when the object exists* (the `to_regclass` pattern in
`x402_session_keys.js`). Order: D1, D2, D3, D4 (hard breaks), then D5/D6, D10.

**Phase B — additive grant migration `020_satelink_app_grants_catchup.sql` (founder approves, runner applies):**
```sql
-- D8 (only if PG >= 15 and lazy tables remain after Phase A)
GRANT CREATE ON SCHEMA public TO satelink_app;
-- catch-up for tables created after 017 by roles other than the default-privileges owner;
-- skips ledger_entries so the append-only revoke (017:62) stays intact
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'ledger_entries' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO satelink_app', t);
  END LOOP;
  EXECUTE 'GRANT SELECT, INSERT ON public.ledger_entries TO satelink_app';
END $$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO satelink_app;
-- D9, only if the reconciler is switched: GRANT pg_monitor TO satelink_app;
```
(Do not re-run `GRANT ... ON ALL TABLES`: it would hand back UPDATE/DELETE on `ledger_entries`.)
Down script: none needed for safety (grants are additive); a `REVOKE CREATE ON SCHEMA public` is the only
reversal worth keeping.

**Phase C — the switch (founder):**
1. Set the `satelink_app` password out-of-band; build the new URL; keep the current `postgres` URL saved.
2. Set `DATABASE_URL` on Satelink-api only (reconciler later). Redeploy.
3. Verify: `/health` db ok; boot logs have no `[POST-BOOT]` permission warnings or `[dodo-schema]` alert;
   a staff probe confirms `SELECT current_user` = `satelink_app` and records `SHOW server_version`;
   exercise Pricing V2 metering, console sign-in, a subscription grant webhook in test mode, traffic analytics flush.
4. Watch 24 h of logs for `permission denied`.

**Rollback:** set `DATABASE_URL` back to the saved `postgres` URL and restart (founder). Grants are harmless to
leave. Tables created by `satelink_app` while switched stay owned by it; `postgres` keeps full access
(`ALTER TABLE ... OWNER TO postgres` if wanted).

Alternative to Phase A (not recommended): a NOLOGIN owner role that owns the touched tables, granted to
`satelink_app` — weakens least privilege and must never include `ledger_*`.
