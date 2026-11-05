#!/usr/bin/env bash
# PreToolUse(Bash) guard. Reads the hook JSON on stdin; exit 2 blocks the command
# (stderr is shown to Claude). Release A forbidden list: docs/build/MASTER_BUILD_PROMPT.md §1.
set -uo pipefail
cmd="$(jq -r '.tool_input.command // empty')"
[ -z "$cmd" ] && exit 0

block() { echo "guard-bash: BLOCKED — $1" >&2; exit 2; }
has() { printf '%s' "$cmd" | grep -qE -- "$1"; }

# Production hosts / URLs (API, RPC, admin, console, Railway DB proxies).
has '(api|rpc|admin|console)\.satelink\.network' && block "production host"
has '\.rlwy\.net|\.railway\.internal|railway\.app' && block "Railway host (production infrastructure)"
# Live trading host (paper host paper-api.alpaca.markets is allowed).
has '(^|[^-.a-z])api\.alpaca\.markets' && block "live trading host api.alpaca.markets"

# DATABASE_URL assignments must point at a local host; DATABASE_URL_LOCAL/_TEST names are fine.
if has '(^|[^A-Z_])DATABASE_URL='; then
  printf '%s' "$cmd" | grep -oE '(^|[^A-Z_])DATABASE_URL=[^ ]*' | while read -r a; do
    printf '%s' "$a" | grep -qE '@(localhost|127\.0\.0\.1|\[::1\])[:/]|\$\{?DATABASE_URL_(LOCAL|TEST)' || exit 9
  done
  [ $? -eq 9 ] && block "DATABASE_URL must be local (use DATABASE_URL_LOCAL / DATABASE_URL_TEST)"
fi

# Backup / dump files: no destructive, copying, printing or uploading command may name one.
DUMP='[^ ]*\.(dump|pgdump|backup)([^A-Za-z0-9]|$)|backups/protected'
if has "$DUMP"; then
  has '(^|[;&|(` ]|sudo )(mv|rm|cp|shred|truncate|dd|gpg|age|chmod|chown|chflags|xattr|ln|tar|zip|gzip|rsync|scp|cat|less|more|head|tail|xxd|hexdump|od|strings|base64|pg_restore|split|tee|touch|open)( |$)' && block "command touches a backup/dump file"
  has '>{1,2} *[^ ]*\.(dump|pgdump|backup)' && block "redirect onto a backup/dump file"
  has 'curl .*(-T|--upload-file|-F|--data-binary)' && block "upload of a backup/dump file"
fi

# Git safety.
has 'git( -C [^ ]+)? add( .*)? (-A|--all|\.)( |$)' && block "git add -A / git add . (stage explicit paths)"
if has 'git( -C [^ ]+)? add '; then
  has 'git( -C [^ ]+)? add .*(\.env($|[^.a-z]|\.[a-z]+)|\.dump|\.pgdump|\.backup|\.pem|\.key( |$)|id_rsa)' \
    && ! has 'git( -C [^ ]+)? add .*\.env\.example( |$)' && block "git add of env/dump/key file"
fi
has 'git( -C [^ ]+)? push .*(--force|-f( |$)|--force-with-lease|\+[A-Za-z0-9_/.-]+)' && block "force push"
has 'git( -C [^ ]+)? push( [^ ]+)* [^ ]*:?(refs/heads/)?main( |$)' && block "push to main"
has 'git( -C [^ ]+)? commit .*--no-verify|git( -C [^ ]+)? commit .* -n( |$)' && block "commit --no-verify"
has 'gh pr merge' && block "merging PRs is founder-only"
has '(^|[;&| ])(npm|pnpm|yarn) publish' && block "publishing packages"
has '(^|[;&| ])(railway|vercel)( |$)' && block "railway/vercel CLI (deploy/production config)"
exit 0
