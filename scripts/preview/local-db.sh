#!/usr/bin/env bash
# Creates the Release A local databases and prints their URLs (localhost only).
#   satelink_local — preview runtime (DATABASE_URL_LOCAL)
#   satelink_test  — integration tests (DATABASE_URL_TEST / TEST_DATABASE_URL), carries __test_db_marker
# Usage: bash scripts/preview/local-db.sh [--docker]     (--docker: docker-compose.preview.yml on :55432)
#        eval "$(bash scripts/preview/local-db.sh --env)"  to export the variables
set -euo pipefail
if [ "${1:-}" = "--docker" ] || [ "${2:-}" = "--docker" ]; then
  BASE="postgresql://preview:preview_local_only@127.0.0.1:55432"
else
  BASE="postgresql://$(whoami)@127.0.0.1:5432"
fi
case "$BASE" in postgresql://*@127.0.0.1:*) ;; *) echo "refusing non-local base" >&2; exit 1 ;; esac
for db in satelink_local satelink_test; do
  psql "$BASE/postgres" -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 || psql "$BASE/postgres" -qc "CREATE DATABASE $db"
done
psql "$BASE/satelink_test" -q -c "CREATE TABLE IF NOT EXISTS __test_db_marker (ok boolean PRIMARY KEY DEFAULT true);" \
  -c "INSERT INTO __test_db_marker VALUES (true) ON CONFLICT DO NOTHING;"
if [ "${1:-}" = "--env" ] || [ "${2:-}" = "--env" ]; then
  echo "export DATABASE_URL_LOCAL=$BASE/satelink_local"
  echo "export DATABASE_URL_TEST=$BASE/satelink_test"
  echo "export TEST_DATABASE_URL=$BASE/satelink_test"
else
  echo "DATABASE_URL_LOCAL=$BASE/satelink_local"
  echo "DATABASE_URL_TEST=$BASE/satelink_test"
fi
