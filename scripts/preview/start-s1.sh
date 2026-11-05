#!/usr/bin/env bash
# Release A local preview stack: Demo Digital Store (MOCK) :4410 · Food Delivery (MOCK) MCP :4420 · preview API :4500 · console :3400.
# Fresh local database each run (localhost only). Ctrl-C stops everything.
#   bash scripts/preview/start-s1.sh            # browse http://localhost:3400/signup
#   PREVIEW_QUOTE_TTL_MS=25000 bash scripts/preview/start-s1.sh   # E2E (short quote expiry)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="${PREVIEW_STATE_DIR:-$HOME/.satelink-preview}"; mkdir -p "$STATE"; chmod 700 "$STATE"
BASE="${PREVIEW_PG_BASE:-postgresql://$(whoami)@127.0.0.1:5432}"
DB="satelink_preview_$(date +%Y%m%d%H%M%S)"
psql "$BASE/postgres" -qc "CREATE DATABASE $DB"
export DATABASE_URL_LOCAL="$BASE/$DB" MOCK_STORE_URL=http://127.0.0.1:4410 MOCK_FOOD_URL=http://127.0.0.1:4420 PREVIEW_STATE_DIR="$STATE"
( cd "$ROOT" && npx tsx scripts/preview/migrate-local.mts "$DATABASE_URL_LOCAL" )
pids=()
trap 'kill "${pids[@]}" 2>/dev/null || true' EXIT INT TERM
MOCK_STORE_PORT=4410 MOCK_STORE_STATE="$STATE/orders-$DB.json" node "$ROOT/tools/mock-digital-store/server.mjs" & pids+=($!)
MOCK_FOOD_PORT=4420 MOCK_FOOD_STATE="$STATE/food-$DB.json" node "$ROOT/tools/mock-food-mcp/server.mjs" & pids+=($!)
node "$ROOT/apps/api/scripts/preview_release_a.mjs" & pids+=($!)
for _ in $(seq 1 60); do curl -sf http://127.0.0.1:4500/health >/dev/null && break; sleep 0.5; done
( cd "$ROOT/apps/console" && SATELINK_PREVIEW=1 SATELINK_API_BASE=http://127.0.0.1:4500 CONSOLE_ORIGINS=http://localhost:3400 exec npx next dev -p 3400 ) & pids+=($!)
echo "[preview] database $DB · open http://localhost:3400/signup"
wait
