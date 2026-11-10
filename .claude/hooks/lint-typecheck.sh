#!/usr/bin/env bash
# PostToolUse(Edit|Write): lint the edited JS/TS file inside its workspace (fast, file-scoped).
# Failures go to stderr with exit 2 so Claude sees them; missing tooling is a silent no-op.
set -uo pipefail
f="$(jq -r '.tool_input.file_path // empty')"
case "$f" in *.ts|*.tsx|*.js|*.mjs|*.cjs|*.jsx) ;; *) exit 0 ;; esac
[ -f "$f" ] || exit 0
dir="$(dirname "$f")"
# Walk up to the nearest package.json (the workspace).
while [ "$dir" != "/" ] && [ ! -f "$dir/package.json" ]; do dir="$(dirname "$dir")"; done
[ -f "$dir/package.json" ] || exit 0
eslint="$dir/node_modules/.bin/eslint"; [ -x "$eslint" ] || eslint="${CLAUDE_PROJECT_DIR:-.}/node_modules/.bin/eslint"
[ -x "$eslint" ] || exit 0
ls "$dir"/eslint.config.* "$dir"/.eslintrc* >/dev/null 2>&1 || exit 0
out="$(cd "$dir" && timeout 45 "$eslint" --no-warn-ignored --quiet "$f" 2>&1)" || { echo "lint-typecheck: eslint errors in $(basename "$f"):" >&2; printf '%s\n' "$out" | tail -20 >&2; exit 2; }
exit 0
