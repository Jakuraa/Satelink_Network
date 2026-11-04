#!/usr/bin/env bash
# Stop hook: keep working while an unblocked Release A phase remains.
#  - exit 0 if stop_hook_active (never loop on our own block)
#  - exit 0 if docs/build/FINAL_REPORT.md exists
#  - otherwise, if docs/build/PHASES.txt has a phase whose status is not DONE/BLOCKED,
#    emit {"decision":"block"} with the remaining phases
#  - hard cap: 20 blocks per session (counter in .claude/hooks/.state/, gitignored)
set -uo pipefail
in="$(cat)"
[ "$(printf '%s' "$in" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[ -f "$root/docs/build/FINAL_REPORT.md" ] && exit 0
phases="$root/docs/build/PHASES.txt"
[ -f "$phases" ] || exit 0
remaining="$(awk '!/^#/ && NF>=2 && $2!="DONE" && $2!~/^BLOCKED/ {printf "%s ", $1}' "$phases")"
[ -z "$remaining" ] && exit 0
sid="$(printf '%s' "$in" | jq -r '.session_id // "nosession"' | tr -cd 'A-Za-z0-9_-')"
state="$root/.claude/hooks/.state"; mkdir -p "$state"
n=$(( $(cat "$state/stop-$sid" 2>/dev/null || echo 0) + 1 ))
[ "$n" -gt 20 ] && exit 0
echo "$n" > "$state/stop-$sid"
jq -n --arg r "Release A unfinished. Remaining unblocked phases: $remaining. Continue with the first one (see BUILD_LEDGER resume capsule), or mark it BLOCKED in docs/build/PHASES.txt with the reason. (auto-continue $n/20)" '{decision:"block", reason:$r}'
exit 0
