#!/usr/bin/env bash
# PreToolUse(Edit|Write) guard. exit 2 blocks the edit.
#  - env files (except .env.example), dumps/backups/keys
#  - migrations: may only ADD new files numbered above the highest number already on origin/main
#    in that directory; files that exist on origin/main are immutable (additive-only, R3)
#  - production deploy config (railway.json, nixpacks.toml, vercel.json)
set -uo pipefail
f="$(jq -r '.tool_input.file_path // empty')"
[ -z "$f" ] && exit 0
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
rel="${f#"$root"/}"
base="$(basename "$f")"
block() { echo "guard-files: BLOCKED — $1 ($rel)" >&2; exit 2; }

case "$base" in
  .env.example) ;;
  .env|.env.*) block "env file" ;;
esac
case "$base" in
  *.dump|*.pgdump|*.backup|*.sql.gz|*.pem|*.key|id_rsa*) block "dump/backup/key file" ;;
esac
case "$rel" in
  railway.json|*/railway.json|nixpacks.toml|*/nixpacks.toml|vercel.json|*/vercel.json|railway.toml|*/railway.toml)
    block "production deploy config (founder-only)" ;;
esac

case "$rel" in
  */migrations/*|migrations/*)
    dir="$(dirname "$rel")"
    if git -C "$root" cat-file -e "origin/main:$rel" 2>/dev/null; then
      block "migration already on origin/main is immutable (add a new numbered migration)"
    fi
    num="$(printf '%s' "$base" | grep -oE '^[0-9]+' || true)"
    if [ -n "$num" ]; then
      max="$(git -C "$root" ls-tree --name-only "origin/main:$dir" 2>/dev/null | grep -oE '^[0-9]+' | sort -n | tail -1)"
      if [ -n "$max" ] && [ $((10#$num)) -le $((10#$max)) ]; then
        block "migration number $num must be greater than highest on origin/main ($max) in $dir"
      fi
    fi
    ;;
esac
exit 0
