#!/usr/bin/env bash
# Blocks database dumps and backups from entering Git (pre-commit, staged files) or a
# tracked tree (CI). Checks by NAME and by CONTENT so a renamed dump is still caught:
#   - extensions: .dump .pgdump .backup .sql.gz .bak.sql
#   - magic bytes: "PGDMP" (pg_dump custom format) at offset 0
#   - text header: a line exactly "-- PostgreSQL database dump" in the first 8 KB
# Prints only the path and the rule — never file content.
#
# Usage: check-no-dumps.sh <file>...        (exit 1 on any hit)
#        check-no-dumps.sh --tracked        (every file tracked by Git)
set -uo pipefail

if [ "${1:-}" = "--tracked" ]; then
  # xargs may split into several batches; any non-zero batch makes xargs exit non-zero.
  git ls-files -z | xargs -0 "$0" || exit 1
  exit 0
fi

# Grandfathered: a JavaScript source copy committed before this gate existed (not a DB dump).
ALLOW='apps/api/src/nodes/node_onboarding.js.backup'

fail=0
for f in "$@"; do
  [ -f "$f" ] || continue
  [ "$f" = "$ALLOW" ] && continue
  case "$f" in
    *.dump|*.pgdump|*.backup|*.sql.gz|*.bak.sql)
      echo "BLOCKED dump-extension: $f"; fail=1; continue ;;
  esac
  if [ "$(head -c5 "$f" 2>/dev/null)" = "PGDMP" ]; then
    echo "BLOCKED pgdump-magic: $f"; fail=1; continue
  fi
  # Whole-line match: real pg_dump output has the header on its own line; docs that merely
  # mention it (quoted, in a table) are not blocked.
  if head -c 8192 "$f" 2>/dev/null | LC_ALL=C grep -qx -- '-- PostgreSQL database dump'; then
    echo "BLOCKED pgdump-text-header: $f"; fail=1
  fi
done
exit "$fail"
