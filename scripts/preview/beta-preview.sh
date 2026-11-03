#!/usr/bin/env bash
# Local customer preview: workflows beta API (in-memory, no DB) + the real console.
# Usage: bash scripts/preview/beta-preview.sh   then open http://localhost:4400/preview/login
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
unset DATABASE_URL REDIS_URL
NODE_ENV=development node "$ROOT/apps/api/scripts/preview_workflows_beta.mjs" &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
cd "$ROOT/apps/console"
SATELINK_API_BASE=http://127.0.0.1:4400 WORKFLOWS_BETA_ENABLED=true CONSOLE_ACCOUNTS_V1= npx next dev -p 3400
