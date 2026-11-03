#!/usr/bin/env bash
# Local customer preview: workflows beta API (LOCAL Postgres, persistent) + the real console.
# Usage: bash scripts/preview/beta-preview.sh   then open http://localhost:4400/preview/login
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
unset DATABASE_URL REDIS_URL
DB="${PREVIEW_DB_NAME:-satelink_beta_preview}"
psql -h 127.0.0.1 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 || createdb -h 127.0.0.1 "$DB"
export PREVIEW_DATABASE_URL="postgresql://$(whoami)@127.0.0.1:5432/$DB"
NODE_ENV=development node "$ROOT/apps/api/scripts/preview_workflows_beta.mjs" &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
cd "$ROOT/apps/console"
SATELINK_API_BASE=http://127.0.0.1:4400 WORKFLOWS_BETA_ENABLED=true CONSOLE_ACCOUNTS_V1= npx next dev -p 3400
