# Production migrations 038–046 — evidence (2026-11-10)

Authorization: founder mandate F5 (backup, then additive migrations). Scope note: the mandate named 040/041 and
042–046; production was at 019, so 038 and 039 were pending too and were applied as prerequisites (decision D-B2).
No secret value appears in this file.

## Backup taken first
| Item | Value |
|---|---|
| File | `~/satelink-secure/satelink_prod_prebeta_20261110T171533Z.dump` (outside the repository; dir 700, file 600) |
| Format | `pg_dump -Fc`, client 18.4, server 18.6, with ownership and grants |
| Size | 47,339,487 bytes |
| SHA-256 | `daca4d3e6758164141ea06f77202ed8ef0ea7e095e45cbe706b4a2bd4feb7793` |
| Restore check | Docker `postgres:18` (18.6); `pg_restore --exit-on-error` exit 0; 98 base tables; 2,221,257 rows |
| Count check vs live | 93 of 98 tables identical; 5 live-append tables grew after the snapshot |
| Encryption | none (`age` not installed, no recipient configured) |
| Independence | **none** — same machine and disk as the 2026-11-03 dump |

## Rehearsal on the restored copy
`database/runner.ts migrate` applied 038→046 in 0.9 s; `verify` passed; post-state captured with the queries below.

## Production apply
- Runner: `database/runner.ts migrate`, one transaction per file, `lock_timeout=5s`.
- Start 2026-11-10T17:51:03Z, end 17:51:15Z, exit 0.
- Applied, in order: 038_ledger_kind_payments, 039_payments_core, 040_trading_strategy_evaluations,
  041_customer_workflows, 042_ledger_kind_reservation, 043_task_lifecycle_and_simulated_money,
  044_connector_connections, 045_developer_api_keys, 046_agent_spend_preauth.
- `verify` after apply: all applied migrations match their file checksums.
- Files 038–040 are byte-identical to `origin/main`; 041–046 come from the release line (`beta/launch`) and must reach
  `main` unchanged or the runner will report a checksum mismatch.

## Post-state in production (read-only session)
The output below is identical, line for line, to the same queries on the rehearsed copy.

```
migrations | 28 | 046_agent_spend_preauth.sql
new_tables_present | 23
kind_check | CHECK ((kind = ANY (ARRAY['draw'::text, 'settlement'::text, 'deposit'::text, 'adjustment'::text, 'reversal'::text, 'refund'::text, 'payment'::text, 'subscription'::text, 'commission'::text, 'rebate'::text, 'provider_fee'::text, 'hold'::text, 'capture'::text, 'release'::text])))
reservation_tagged | CHECK (((ref_type <> 'reservation'::text) OR ((origin IS NOT NULL) AND (environment IS NOT NULL)))) | t
trigger | ledger_entries | trg_ledger_entries_balance | O
trigger | trading_decisions | trading_decisions_append_only | O
trigger | trading_decisions | trading_decisions_no_truncate | O
trigger | trading_strategy_evaluations | trading_strategy_evaluations_append_only | O
trigger | trading_strategy_evaluations | trading_strategy_evaluations_no_truncate | O
trigger | wf_journal | wf_journal_no_truncate | O
trigger | wf_journal | wf_journal_no_update | O
trigger | workflow_quotes | workflow_quotes_no_update | O
trigger | workflow_receipts | workflow_receipts_no_truncate | O
trigger | workflow_receipts | workflow_receipts_no_update | O
ledger_txns_new_cols | txn_id:text:-:NO, ref_type:text:-:NO, ref_id:text:-:NO, currency:text:-:NO, state:text:-:NO, posted_at:timestamp with time zone:-:YES, origin:text:-:YES, environment:text:-:YES
app_role_ledger_entries_privs | INSERT,SELECT
app_role_new_table_privs | developer_api_keys | DELETE,INSERT,SELECT,UPDATE
app_role_new_table_privs | payment_intents | DELETE,INSERT,SELECT,UPDATE
app_role_new_table_privs | wf_journal | DELETE,INSERT,SELECT,UPDATE
app_role_new_table_privs | workflow_runs | DELETE,INSERT,SELECT,UPDATE
```

## Row counts of pre-existing tables, immediately before vs after the apply
98 tables compared. Changed:

```
epoch_ledger: 184907 -> 184908
epochs: 87590 -> 87591
intelligence_snapshots: 74746 -> 74750
node_health_logs: 108942 -> 108944
rpc_traffic_daily: 236650 -> 236656
schema_migrations: 19 -> 28
```

`schema_migrations` is the runner's own bookkeeping. The other five are live-append tables that also grew between
the backup and the baseline; no ledger, account, credit, payment or customer table changed.
`ledger_txns` 345,658 and `ledger_entries` 691,316 before and after. 23 new tables, all empty.

## Deployed API after the apply (commit `885826d6`, code that predates these tables)
- `/health` ok, db ok.
- 12-route smoke set: status codes identical to the pre-change baseline.
- Last 200 API log lines: no `permission denied`, constraint violation, missing relation, unhandled or FATAL line.

## Rollback
Not needed. If ever required: `database/migrations-down/0NN_*.down.sql` in reverse order (046→038), valid only
while no row uses the new ledger kinds or tables. Restoring the dump is the last resort and loses later writes.
