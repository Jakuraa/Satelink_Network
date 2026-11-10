#!/usr/bin/env bash
# SessionStart(compact|resume): print the Release A resume capsule + open blocker count.
set -uo pipefail
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
led="$root/docs/build/BUILD_LEDGER.md"; ob="$root/docs/build/OPEN_BLOCKERS.md"
[ -f "$led" ] || exit 0
echo "=== Release A resume capsule (docs/build/BUILD_LEDGER.md) ==="
awk '/RESUME CAPSULE/{p=1} p{print; n++} n>11{exit}' "$led"
[ -f "$ob" ] && echo "Open blockers: $(grep -cE '^\| OB-[0-9]+' "$ob")"
echo "Read: CLAUDE.md, BUILD_LEDGER.md, STATUS_MATRIX.md, OPEN_BLOCKERS.md, DECISION_LOG.md before acting."
exit 0
