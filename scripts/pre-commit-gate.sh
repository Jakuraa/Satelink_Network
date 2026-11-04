#!/usr/bin/env bash
# Satelink pre-commit gate: secret leak check + repo-hygiene/bloat gate.
# Ported 2026-07-16 from .git/hooks/pre-commit (dead since core.hooksPath
# points at .husky/ — this file is invoked by .husky/pre-commit so it runs).
# Hygiene gate added 2026-06-22 after .git was cleaned 999MB -> 86MB.
# Root cause it prevents: a ~854MB backup .tar.gz committed then removed,
# left dangling in history. This gate blocks the patterns that bloat git.

echo "🔒 Running secret leak check..."

# --diff-filter=ACM (added/copied/modified) — a deleted file can't leak a
# secret or add .env bloat; only files that still exist need scanning.
staged=$(git diff --cached --name-only --diff-filter=ACM)

# This script contains the secret patterns as literals; exclude it from the
# content scan or it can never be committed.
scan_files=$(echo "$staged" | grep -v -E '^scripts/(pre-commit-gate\.sh|security/secret_scan\.mjs)$')

# Check for private key / API key patterns (staged content). The patterns and the one
# narrow allowlist entry (a masked key placeholder) live in scripts/security/secret_scan.mjs,
# which has tests (node --test scripts/security/secret_scan.test.mjs, run in CI).
if [ -n "$scan_files" ]; then
  # shellcheck disable=SC2086
  if ! echo "$scan_files" | tr '\n' '\0' | xargs -0 node scripts/security/secret_scan.mjs; then
    echo "❌ BLOCKED: Private key detected in staged files"
    exit 1
  fi
fi

# Block .env files
if echo "$staged" | grep -E "^\.env$|^\.env\." | grep -v ".env.example"; then
  echo "❌ BLOCKED: .env file staged for commit"
  exit 1
fi

# Block token.txt
if echo "$staged" | grep -i "token\.txt\|secret\.txt"; then
  echo "❌ BLOCKED: Sensitive file staged for commit"
  exit 1
fi

# Block database dumps/backups by name and content (PGDMP magic, pg_dump header).
if [ -n "$staged" ]; then
  # shellcheck disable=SC2086
  if ! echo "$staged" | tr '\n' '\0' | xargs -0 bash scripts/security/check-no-dumps.sh; then
    echo "❌ BLOCKED: database dump or backup staged for commit"
    exit 1
  fi
fi

# gitleaks on the staged diff when installed (CI always runs it; see ci.yml).
if command -v gitleaks >/dev/null 2>&1; then
  if ! gitleaks git --pre-commit --staged --redact --no-banner --config .gitleaks.toml . >/dev/null 2>&1; then
    echo "❌ BLOCKED: gitleaks found a secret in staged changes (run: gitleaks git --pre-commit --staged --redact -v)"
    exit 1
  fi
fi

echo "✅ No secrets detected"

# ── REPO HYGIENE / BLOAT GATE ────────────────────────────────────
echo "🧹 Running repo hygiene check..."

MAX_BYTES=524288  # 500KB per file

BLOCKED_PATTERNS=(
  '\.db$'
  '\.db-wal$'
  '\.db-shm$'
  '\.sqlite[0-9]?$'
  '\.tar\.gz$'
  '\.tgz$'
  '(^|/)node_modules/'
  '(^|/)\.next/'
  '(^|/)artifacts/build-info/'
  '(^|/)\.turbo/'
  '(^|/)signoz/'
  '(^|/)chainlist/'
  '(^|/)design-v2-review/'
)

staged_acm=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged_acm" ] && { echo "✅ Pre-commit checks passed"; exit 0; }

fail=0

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  matches=$(echo "$staged_acm" | grep -E "$pattern")
  if [ -n "$matches" ]; then
    echo "❌ BLOCKED: pattern /$pattern/ matches staged files:"
    echo "$matches" | sed 's/^/    /'
    echo "    These should not be committed. Run: git reset HEAD <file>"
    fail=1
  fi
done

while IFS= read -r file; do
  [ -f "$file" ] || continue
  case "$file" in
    *package-lock.json|*yarn.lock|*pnpm-lock.yaml) continue ;;
  esac
  size=$(wc -c < "$file" 2>/dev/null | tr -d ' ')
  if [ "${size:-0}" -gt "$MAX_BYTES" ]; then
    echo "❌ BLOCKED: $file is $((size/1024))KB — over 500KB limit"
    echo "    Large files should not be committed. Use git-lfs or external storage."
    fail=1
  fi
done <<< "$staged_acm"

if [ "$fail" -ne 0 ]; then
  echo "Repo hygiene check FAILED. Commit aborted."
  exit 1
fi

echo "✅ Pre-commit checks passed"
exit 0
