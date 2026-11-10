#!/usr/bin/env bash
# Release A S1 restart drill, browser-driven: approve in the console, SIGKILL the API while the step is EXECUTING,
# restart it, and require the same browser page to reach SUCCEEDED with exactly one supplier order and one capture.
# Own stack on separate ports (store 4610, API 4600, console 3410). Local only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"; SIG="$TMP/signal"; mkdir -p "$SIG"
API_PID=""; pids=()
cleanup() { [ -n "$API_PID" ] && kill -9 "$API_PID" 2>/dev/null || true; kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup EXIT
BASE="${DRILL_PG_BASE:-postgresql://$(whoami)@127.0.0.1:5432}"; DB="satelink_bdrill_$$"
psql "$BASE/postgres" -qc "CREATE DATABASE $DB"
export DATABASE_URL_LOCAL="$BASE/$DB" PREVIEW_API_PORT=4600 MOCK_STORE_URL=http://127.0.0.1:4610 \
  PREVIEW_CONSOLE_ORIGIN=http://localhost:3410 PREVIEW_STATE_DIR="$TMP" AUTH_PREVIEW_RATE_LIMIT=off
( cd "$ROOT" && npx tsx scripts/preview/migrate-local.mts "$DATABASE_URL_LOCAL" ) | tail -1
MOCK_STORE_PORT=4610 MOCK_STORE_STATE="$TMP/orders.json" MOCK_STORE_ORDER_DELAY_MS=4000 node "$ROOT/tools/mock-digital-store/server.mjs" > "$TMP/store.log" 2>&1 & pids+=($!)
start_api() { node "$ROOT/apps/api/scripts/preview_release_a.mjs" >> "$TMP/api.log" 2>&1 & API_PID=$!; for _ in $(seq 1 60); do curl -sf http://127.0.0.1:4600/health >/dev/null && return 0; sleep 0.5; done; echo "API did not start"; exit 1; }
start_api
CONSOLE_CMD="${DRILL_CONSOLE_CMD:-npx next dev -p 3410}"
( cd "$ROOT/apps/console" && SATELINK_PREVIEW=1 SATELINK_API_BASE=http://127.0.0.1:4600 CONSOLE_ORIGINS=http://localhost:3410 exec $CONSOLE_CMD > "$TMP/console.log" 2>&1 ) & pids+=($!)
for _ in $(seq 1 120); do curl -sf -o /dev/null http://localhost:3410/sign-in && break; sleep 1; done
( cd "$ROOT" && RESTART_DRILL_SIGNAL_DIR="$SIG" PW_BASE_URL=http://localhost:3410 npx playwright test -c tests/e2e/playwright.config.ts tests/e2e/s1-restart-drill.spec.ts --project=desktop-1440 > "$TMP/pw.log" 2>&1 ) & PW=$!
for _ in $(seq 1 120); do [ -f "$SIG/executing" ] && break; sleep 0.5; done
[ -f "$SIG/executing" ] || { echo "FAIL: browser never reached EXECUTING"; tail -30 "$TMP/pw.log"; exit 1; }
ID=$(cat "$SIG/executing")
kill -9 "$API_PID"; wait "$API_PID" 2>/dev/null || true; API_PID=""
echo "API SIGKILLed while $ID was EXECUTING (browser page still open)"; sleep 5
start_api; touch "$SIG/restarted"
wait $PW && PWOK=1 || PWOK=0
ORDERS=$(jq --arg p "step_${ID#run_}_1" '[keys[] | select(startswith($p))] | length' "$TMP/orders.json")
CAPS=$(psql "$DATABASE_URL_LOCAL" -Atc "SELECT count(*) FROM ledger_txns WHERE txn_id = 'rsv:rsv_${ID#run_}:settle' AND kind = 'capture'")
UNK=$(grep -c "UNKNOWN_EXECUTION_OUTCOME" <(psql "$DATABASE_URL_LOCAL" -Atc "SELECT payload::text FROM wf_journal WHERE stream_id = 'task:$ID'") || true)
echo "browser test: $([ $PWOK = 1 ] && echo PASS || echo FAIL) · supplier orders: $ORDERS · captures: $CAPS · unknown-outcome events: $UNK"
kill -9 "$API_PID" 2>/dev/null || true; API_PID=""
[ "$PWOK" = 1 ] && [ "$ORDERS" = 1 ] && [ "$CAPS" = 1 ] && [ "$UNK" -ge 1 ] && echo "BROWSER RESTART DRILL: PASS" || { echo "BROWSER RESTART DRILL: FAIL"; tail -25 "$TMP/pw.log"; exit 1; }
