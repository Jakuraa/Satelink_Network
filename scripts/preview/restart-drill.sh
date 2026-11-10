#!/usr/bin/env bash
# Release A restart drill (P2.6): start a task, kill -9 the API while the step is EXECUTING (the supplier
# is still processing the order), restart, and prove: the task completes exactly once, the supplier holds
# exactly one order, exactly one capture is posted, and the receipt reconciles with the ledger.
# Local only: fresh database on the local Postgres, mock store on loopback.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"; API_PID=""; STORE_PID=""
cleanup() { [ -n "$API_PID" ] && kill -9 "$API_PID" 2>/dev/null || true; [ -n "$STORE_PID" ] && kill "$STORE_PID" 2>/dev/null || true; }
trap cleanup EXIT
BASE="${DRILL_PG_BASE:-postgresql://$(whoami)@127.0.0.1:5432}"
DB="satelink_drill_$$"
psql "$BASE/postgres" -qc "CREATE DATABASE $DB"
export DATABASE_URL_LOCAL="$BASE/$DB"
( cd "$ROOT" && npx tsx scripts/preview/migrate-local.mts "$DATABASE_URL_LOCAL" ) | tail -1
API=http://127.0.0.1:${PREVIEW_API_PORT:-4590}; STORE_PORT=${MOCK_STORE_PORT:-4591}
export PREVIEW_API_PORT=${API##*:} MOCK_STORE_URL=http://127.0.0.1:$STORE_PORT
MOCK_STORE_PORT=$STORE_PORT MOCK_STORE_STATE="$TMP/orders.json" MOCK_STORE_ORDER_DELAY_MS=4000 node "$ROOT/tools/mock-digital-store/server.mjs" > "$TMP/store.log" 2>&1 & STORE_PID=$!
start_api() { node "$ROOT/apps/api/scripts/preview_release_a.mjs" >> "$TMP/api.log" 2>&1 & API_PID=$!; for _ in $(seq 1 60); do curl -sf "$API/health" >/dev/null && return 0; sleep 0.5; done; echo "API did not start"; tail -20 "$TMP/api.log"; exit 1; }
start_api
H=(-H 'X-Preview-Key: sk_preview_local_drill' -H 'content-type: application/json')
T=$(curl -sf "${H[@]}" -X POST "$API/v1/tasks" -d '{"text":"Buy a sci-fi e-book gift code under $12","idempotency_key":"drill-000000001"}')
ID=$(echo "$T" | jq -r .task.id); QID=$(echo "$T" | jq -r .task.quote.quote_id); QV=$(echo "$T" | jq -r .task.quote.version)
echo "task $ID state $(echo "$T" | jq -r .task.state)"
curl -sf "${H[@]}" -H "Idempotency-Key: drill-approve-$ID" -X POST "$API/v1/tasks/$ID/approve" -d "{\"quote_id\":\"$QID\",\"quote_version\":$QV}" | jq -r '"approved → " + .task.state'
for _ in $(seq 1 40); do S=$(curl -sf "${H[@]}" "$API/v1/tasks/$ID" | jq -r .task.state); [ "$S" = EXECUTING ] && break; sleep 0.1; done
echo "state before kill: $S"; [ "$S" = EXECUTING ] || { echo "FAIL: never observed EXECUTING"; exit 1; }
kill -9 "$API_PID"; wait "$API_PID" 2>/dev/null || true; API_PID=""
echo "API killed with SIGKILL during EXECUTING; waiting for the store to finish the in-flight order…"; sleep 5
start_api
for _ in $(seq 1 60); do S=$(curl -sf "${H[@]}" "$API/v1/tasks/$ID" | jq -r .task.state); case "$S" in SUCCEEDED|FAILED|REQUIRES_RECONCILIATION) break;; esac; sleep 0.5; done
echo "state after restart: $S"
EVENTS=$(curl -sf -N --max-time 3 "${H[@]}" "$API/v1/tasks/$ID/events" | grep '^data:' | sed 's/^data: //' | jq -rs '[.[] | .to // empty] | join(",")' || true)
ORDERS=$(jq --arg p "step_${ID#run_}_1" '[keys[] | select(startswith($p))] | length' "$TMP/orders.json")
SETTLES=$(psql "$DATABASE_URL_LOCAL" -Atc "SELECT count(*) FROM ledger_txns WHERE txn_id = 'rsv:rsv_${ID#run_}:settle' AND kind = 'capture'")
RECEIPT=$(curl -sf "${H[@]}" "$API/v1/tasks/$ID" | jq -r .task.receipt_id)
RCPT=$(curl -sf "${H[@]}" "$API/v1/receipts/$RECEIPT" | jq -c '{outcome: .receipt.outcome, label: .receipt.simulation_label, kinds: [.receipt.ledger.transactions[].kind]}')
RECON=$(curl -sf -X POST "$API/preview/reconcile" | jq -c .problems)
echo "events: $EVENTS"; echo "supplier orders for this step: $ORDERS"; echo "capture transactions: $SETTLES"; echo "receipt: $RCPT"; echo "reconcile problems: $RECON"
fail=0
[ "$S" = SUCCEEDED ] || { echo "FAIL: final state $S"; fail=1; }
echo "$EVENTS" | grep -q UNKNOWN_EXECUTION_OUTCOME || { echo "FAIL: crash not observed as UNKNOWN_EXECUTION_OUTCOME"; fail=1; }
[ "$ORDERS" = 1 ] || { echo "FAIL: expected exactly 1 supplier order, got $ORDERS"; fail=1; }
[ "$SETTLES" = 1 ] || { echo "FAIL: expected exactly 1 capture, got $SETTLES"; fail=1; }
[ "$RCPT" = '{"outcome":"succeeded","label":"SIMULATED — NO MONEY MOVED","kinds":["hold","capture"]}' ] || { echo "FAIL: receipt $RCPT"; fail=1; }
[ "$RECON" = '[]' ] || { echo "FAIL: reconcile $RECON"; fail=1; }
kill -9 "$API_PID" 2>/dev/null || true; API_PID=""; sleep 0.3
psql "$BASE/postgres" -qc "DROP DATABASE IF EXISTS $DB" || true
[ "$fail" = 0 ] && echo "RESTART DRILL: PASS" || { echo "RESTART DRILL: FAIL"; tail -30 "$TMP/api.log"; exit 1; }
