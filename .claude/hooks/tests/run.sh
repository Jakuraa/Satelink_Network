#!/usr/bin/env bash
# Unit tests for .claude/hooks/*.sh using sample hook JSON. Run: bash .claude/hooks/tests/run.sh
set -u
H="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$H/../.." && pwd)"
export CLAUDE_PROJECT_DIR="$ROOT"
pass=0; fail=0
bash_case() { # bash_case <want-exit> <command>
  got=$(jq -n --arg c "$2" '{tool_name:"Bash",tool_input:{command:$c}}' | bash "$H/guard-bash.sh" 2>/dev/null; echo $?)
  [ "$got" = "$1" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL guard-bash want=$1 got=$got :: $2"; }
}
file_case() { # file_case <want-exit> <path>
  got=$(jq -n --arg p "$2" '{tool_name:"Write",tool_input:{file_path:$p}}' | bash "$H/guard-files.sh" 2>/dev/null; echo $?)
  [ "$got" = "$1" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL guard-files want=$1 got=$got :: $2"; }
}
# --- guard-bash: blocked
bash_case 2 "curl https://api.satelink.network/health"
bash_case 2 "psql postgresql://u:p@x.proxy.rlwy.net:5432/railway"
bash_case 2 "curl https://api.alpaca.markets/v2/orders"
bash_case 2 "DATABASE_URL=postgres://u:p@db.example.com/x node s.js"
bash_case 2 "rm docs/release/production_pre_migration040.dump"
bash_case 2 "mv backups/protected/production_pre_migration040.dump /tmp/"
bash_case 2 "cat docs/release/satelink_rehearsal_backup.dump"
bash_case 2 "chmod 600 docs/release/production_pre_migration040.dump"
bash_case 2 "gpg -c docs/release/production_pre_migration040.dump"
bash_case 2 "echo x > a.dump"
bash_case 2 "git add -A"
bash_case 2 "git add ."
bash_case 2 "git add .env"
bash_case 2 "git add docs/release/x.dump"
bash_case 2 "git push --force origin build/x"
bash_case 2 "git push origin main"
bash_case 2 "git push origin HEAD:main"
bash_case 2 "git commit --no-verify -m x"
bash_case 2 "gh pr merge 610"
bash_case 2 "npm publish"
bash_case 2 "railway up"
bash_case 2 "vercel deploy --prod"
# --- guard-bash: allowed
bash_case 0 "curl https://paper-api.alpaca.markets/v2/account"
bash_case 0 "DATABASE_URL=postgres://u:p@localhost:5432/satelink_local node s.js"
bash_case 0 'DATABASE_URL="$DATABASE_URL_TEST" npx mocha'
bash_case 0 "shasum -a 256 docs/release/production_pre_migration040.dump"
bash_case 0 "git add apps/api/src/x.js .env.example"
bash_case 0 "git push -u origin build/p2-foundation"
bash_case 0 "git commit -m 'feat: x'"
bash_case 0 "npm test"
bash_case 0 "ls docs/release"
# --- guard-files
file_case 2 "$ROOT/.env"
file_case 2 "$ROOT/apps/api/.env.local"
file_case 0 "$ROOT/.env.example"
file_case 2 "$ROOT/docs/release/x.dump"
file_case 2 "$ROOT/apps/api/railway.json"
file_case 2 "$ROOT/apps/web/vercel.json"
file_case 2 "$ROOT/apps/api/migrations/048_x.sql"
file_case 2 "$ROOT/apps/api/migrations/030_new.sql"
file_case 0 "$ROOT/apps/api/migrations/090_new_thing.sql"
file_case 0 "$ROOT/apps/api/src/workflows/engine.js"
# --- money-path-warn
out=$(jq -n '{tool_input:{file_path:"/x/apps/api/src/ledger/post.js"}}' | bash "$H/money-path-warn.sh")
printf '%s' "$out" | jq -e '.hookSpecificOutput.additionalContext|test("MONEY PATH")' >/dev/null && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL money-path-warn ledger"; }
out=$(jq -n '{tool_input:{file_path:"/x/apps/api/src/ui/button.js"}}' | bash "$H/money-path-warn.sh")
[ -z "$out" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL money-path-warn non-money"; }
# --- secret-scan (synthetic random key; never a real one)
t="$(mktemp -d)"; printf 'SIGNER_KEY=0x%s\n' "$(openssl rand -hex 32)" > "$t/k.txt"; printf 'hello\n' > "$t/ok.txt"
got=$(jq -n --arg p "$t/k.txt" '{tool_input:{file_path:$p}}' | bash "$H/secret-scan.sh" 2>/dev/null; echo $?); [ "$got" = 2 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL secret-scan hit got=$got"; }
got=$(jq -n --arg p "$t/ok.txt" '{tool_input:{file_path:$p}}' | bash "$H/secret-scan.sh" 2>/dev/null; echo $?); [ "$got" = 0 ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL secret-scan clean got=$got"; }
rm -rf "$t"
# --- continue-if-unfinished (isolated temp project dir)
p="$(mktemp -d)"; mkdir -p "$p/docs/build"; printf 'P0 DONE\nPT DONE\nP1 TODO\nS2 BLOCKED(FOUNDER)\n' > "$p/docs/build/PHASES.txt"
r=$(CLAUDE_PROJECT_DIR="$p" bash "$H/continue-if-unfinished.sh" <<<'{"session_id":"t1","stop_hook_active":false}')
printf '%s' "$r" | jq -e '.decision=="block" and (.reason|test("P1")) and (.reason|test("S2")|not)' >/dev/null && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL stop: block with P1"; }
r=$(CLAUDE_PROJECT_DIR="$p" bash "$H/continue-if-unfinished.sh" <<<'{"session_id":"t1","stop_hook_active":true}')
[ -z "$r" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL stop: stop_hook_active must pass"; }
for i in $(seq 2 20); do CLAUDE_PROJECT_DIR="$p" bash "$H/continue-if-unfinished.sh" <<<'{"session_id":"t1"}' >/dev/null; done
r=$(CLAUDE_PROJECT_DIR="$p" bash "$H/continue-if-unfinished.sh" <<<'{"session_id":"t1"}')
[ -z "$r" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL stop: cap of 20"; }
touch "$p/docs/build/FINAL_REPORT.md"; r=$(CLAUDE_PROJECT_DIR="$p" bash "$H/continue-if-unfinished.sh" <<<'{"session_id":"t2"}')
[ -z "$r" ] && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL stop: FINAL_REPORT ends loop"; }
rm -rf "$p"
# --- resume-capsule
out=$(bash "$H/resume-capsule.sh"); printf '%s' "$out" | grep -q 'RESUME CAPSULE' && pass=$((pass+1)) || { fail=$((fail+1)); echo "FAIL resume-capsule"; }
echo "hooks: $pass passed, $fail failed"
[ "$fail" = 0 ]
