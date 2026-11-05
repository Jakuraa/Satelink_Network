#!/usr/bin/env bash
# Release A, Slice S4 — a developer procures a service through the task API with nothing but curl.
#   capabilities → POST /v1/tasks → quote → approve (tasks:approve scope + Idempotency-Key) → result → receipt → usage
# Usage: SATELINK_API_KEY=slk_preview_… [API=http://127.0.0.1:4500] bash tests/dev/procure.sh
# Everything is SIMULATED — NO MONEY MOVED. Local preview only: refuses any non-loopback API.
set -euo pipefail
API=${API:-http://127.0.0.1:4500}
case "$API" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "procure.sh: API must be a local preview URL" >&2; exit 2;; esac
: "${SATELINK_API_KEY:?set SATELINK_API_KEY to a slk_preview_ key with tasks:create, tasks:read, tasks:approve, receipts:read, usage:read}"
command -v jq >/dev/null || { echo "procure.sh: jq is required" >&2; exit 2; }
H=(-H "Authorization: Bearer $SATELINK_API_KEY" -H 'content-type: application/json')
RUN=${PROCURE_RUN_ID:-$(date +%s)-$RANDOM}
TEXT=${PROCURE_TEXT:-"Extract the contacts from: Invoice due 2026-12-01 for \$40.00 — reply to billing@example.com or see https://example.com/inv/42"}

echo "1. capabilities"
curl -sf "$API/v1/capabilities?q=extract" | jq -e '.capabilities[] | select(.id == "dev.data.extract") | "   " + .id + " — " + .name' -r

echo "2. create task"
TASK=$(curl -sf "${H[@]}" -X POST "$API/v1/tasks" -d "$(jq -n --arg t "$TEXT" --arg k "procure-$RUN" '{text: $t, idempotency_key: $k, actor_type: "developer"}')")
ID=$(jq -r .task.id <<<"$TASK"); echo "   task $ID → $(jq -r .task.state <<<"$TASK")"

echo "3. quote"
for _ in $(seq 1 30); do T=$(curl -sf "${H[@]}" "$API/v1/tasks/$ID"); S=$(jq -r .task.state <<<"$T"); [ "$S" = AWAITING_APPROVAL ] && break; sleep 1; done
[ "$S" = AWAITING_APPROVAL ] || { echo "   expected AWAITING_APPROVAL, got $S" >&2; jq . <<<"$T" >&2; exit 1; }
QID=$(jq -r .task.quote.quote_id <<<"$T"); QV=$(jq -r .task.quote.version <<<"$T")
echo "   quote $QID v$QV: total $(jq -r .task.quote.total_usd <<<"$T"), credits $(jq -r .task.quote.credit_charge_usd <<<"$T") ($(jq -r .task.quote.simulation_label <<<"$T"))"

echo "4. approve (Idempotency-Key approve-$RUN)"
APPROVE=(-X POST "$API/v1/tasks/$ID/approve" -H "Idempotency-Key: approve-$RUN" -d "{\"quote_id\":\"$QID\",\"quote_version\":$QV}")
curl -sf "${H[@]}" "${APPROVE[@]}" | jq -r '"   → " + .task.state'
curl -sf "${H[@]}" "${APPROVE[@]}" | jq -r '"   replay → changed=" + (.changed | tostring)'

echo "5. result"
for _ in $(seq 1 45); do T=$(curl -sf "${H[@]}" "$API/v1/tasks/$ID"); S=$(jq -r .task.state <<<"$T"); case "$S" in SUCCEEDED|FAILED|REQUIRES_RECONCILIATION|REFUNDED) break;; esac; sleep 1; done
[ "$S" = SUCCEEDED ] || { echo "   expected SUCCEEDED, got $S" >&2; jq .task.error <<<"$T" >&2; exit 1; }
jq -c '.task.output.result // .task.output' <<<"$T" | sed 's/^/   /'

echo "6. receipt"
RID=$(jq -r .task.receipt_id <<<"$T")
curl -sf "${H[@]}" "$API/v1/receipts/$RID" | jq -r '.receipt | "   " + .receipt_id + " " + .outcome + " credits " + .charges.credits_charged_usd + " — " + .simulation_label'

echo "7. usage"
curl -sf "${H[@]}" "$API/v1/usage" | jq -r --arg r "$RID" '.usage | "   receipts: \(.receipts | length) (this one listed: \([.receipts[].receipt_id] | index($r) != null)); external revenue \(.external_revenue_usd)"'
echo "PROCURE_OK $ID $RID"
