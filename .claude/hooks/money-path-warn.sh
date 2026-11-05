#!/usr/bin/env bash
# PostToolUse(Edit|Write): remind about money-path rules when a money-adjacent file changes.
set -uo pipefail
f="$(jq -r '.tool_input.file_path // empty')"
printf '%s' "$f" | grep -qiE 'ledger|reservation|pricing|payment|x402|receipt|settlement|billing|credit|quote|fee' || exit 0
msg="MONEY PATH edited ($(basename "$f")): integer minor units/NUMERIC only (R4); origin+environment on every money row (R5); idempotency_key + verification (R6); simulated:true + simulation_label (R10); tests must cover the transition (R14). Fees stay PROPOSED — NOT APPROVED."
jq -n --arg m "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$m}}'
exit 0
