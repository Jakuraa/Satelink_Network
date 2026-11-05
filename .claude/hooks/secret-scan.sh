#!/usr/bin/env bash
# PostToolUse(Edit|Write): gitleaks on the changed file; exit 2 (feedback to Claude) on a hit.
# Never prints the secret (--redact, report discarded).
set -uo pipefail
f="$(jq -r '.tool_input.file_path // empty')"
[ -f "$f" ] || exit 0
command -v gitleaks >/dev/null 2>&1 || exit 0
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cfg=(); [ -f "$root/.gitleaks.toml" ] && cfg=(--config "$root/.gitleaks.toml")
if ! gitleaks dir --redact --no-banner "${cfg[@]}" "$f" >/dev/null 2>&1; then
  echo "secret-scan: gitleaks flagged $(basename "$f") — remove the secret (use .env.example placeholders; R13)" >&2
  exit 2
fi
exit 0
