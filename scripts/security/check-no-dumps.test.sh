#!/usr/bin/env bash
# Tests for check-no-dumps.sh using synthetic files only (no real dump is read).
set -u
here="$(cd "$(dirname "$0")" && pwd)"
t="$(mktemp -d)"; trap 'rm -rf "$t"' EXIT
pass=0; failn=0
expect() { # expect <exit> <desc> <file>
  "$here/check-no-dumps.sh" "$3" >/dev/null 2>&1; got=$?
  if [ "$got" = "$1" ]; then pass=$((pass+1)); else failn=$((failn+1)); echo "FAIL: $2 (exit $got, want $1)"; fi
}
printf 'PGDMP\x01\x0e' > "$t/renamed.txt";                 expect 1 "PGDMP magic in renamed file" "$t/renamed.txt"
printf 'x' > "$t/a.dump";                                   expect 1 ".dump extension" "$t/a.dump"
printf 'x' > "$t/a.pgdump";                                 expect 1 ".pgdump extension" "$t/a.pgdump"
printf 'x' > "$t/a.sql.gz";                                 expect 1 ".sql.gz extension" "$t/a.sql.gz"
printf -- '--\n-- PostgreSQL database dump\n--\n' > "$t/p.sql"; expect 1 "plain-text pg_dump header" "$t/p.sql"
printf 'CREATE TABLE x (id int);\n' > "$t/m.sql";           expect 0 "normal migration allowed" "$t/m.sql"
printf 'run pg_dump to back up\n' > "$t/doc.md";            expect 0 "doc mentioning pg_dump allowed" "$t/doc.md"
printf 'the header `-- PostgreSQL database dump` marks a dump\n' > "$t/doc2.md"; expect 0 "doc quoting the header allowed" "$t/doc2.md"
expect 0 "missing file ignored" "$t/nope"
echo "check-no-dumps: $pass passed, $failn failed"
[ "$failn" = 0 ]
