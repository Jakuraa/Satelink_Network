#!/usr/bin/env bash
# Content scan of EVERY blob in the object store (reachable, unreachable, dangling,
# packed and loose — all worktrees share it). Emits metadata only:
#   blob_id <TAB> rule <TAB> byte_offset <TAB> blob_size <TAB> class
# It NEVER prints matched content. `class` is computed locally (placeholder-like vs
# non-placeholder) so a reviewer can triage without seeing the value.
#
# Usage: scripts/security/scan-git-objects.sh [out.tsv]
set -euo pipefail
OUT="${1:-/dev/stdout}"
git cat-file --batch-all-objects --batch-check='%(objecttype) %(objectname)' \
  | awk '$1=="blob"{print $2}' \
  | git cat-file --batch \
  | python3 -I -c '
import re, sys
r = sys.stdin.buffer
out = sys.stdout
B = re.compile
PLACEHOLDER = B(rb"(?i)(password|passwd|pass|postgres|user|test|secret|changeme|example|xxx+|\$\{|<|\*{3,}|localhost|127\.0\.0\.1|your[_-]|redacted|placeholder|dummy|fake|local)")
TEXT = [
  ("pg-dump-header", B(rb"-- PostgreSQL database" rb" dump")),
  ("pg-copy-public", B(rb"COPY public\.")),
  ("pg_dump-mention", B(rb"pg_dump")),
  ("create-table-public", B(rb"CREATE TABLE public\.")),
]
CRED = [
  ("postgres-url-with-pass", B(rb"postgres(?:ql)?://[^:\s/@\"\x27]+:[^@\s\"\x27]+@[^\s\"\x27/]+")),
  ("private-key-pem", B(rb"-----BEGIN [A-Z ]*PRIV" rb"ATE KEY-----")),  # split: keeps the gate from matching this file
  ("jwt", B(rb"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
  ("openrouter-key", B(rb"sk-or-v1-[0-9a-f]{32,}")),
  ("stripe-live", B(rb"(?:sk|rk)_live_[0-9A-Za-z]{10,}")),
  ("xprv", B(rb"xprv[1-9A-HJ-NP-Za-km-z]{100,}")),
  ("hex64-near-key-word", B(rb"(?i)(?:priv(?:ate)?[_ -]?key|secret|mnemonic|signer[_ -]?key)[^\n]{0,40}?(?:0x)?[0-9a-fA-F]{64}(?![0-9a-fA-F])")),
  ("aws-access-key", B(rb"(?:AKIA|ASIA)[0-9A-Z]{16}")),
  ("gcp-api-key", B(rb"AIza[0-9A-Za-z_-]{35}")),
  ("gcp-service-account", B(rb"\"type\":\s*\"service_account\"")),
]
EMAIL = B(rb"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
def emit(oid, rule, off, size, cls="-"):
    out.write(f"{oid}\t{rule}\t{off}\t{size}\t{cls}\n")
n = 0
while True:
    hdr = r.readline()
    if not hdr: break
    oid, typ, size = hdr.split()
    size = int(size)
    data = r.read(size); r.read(1)
    oid = oid.decode(); n += 1
    if size > 5*1024*1024: emit(oid, "blob-over-5MB", 0, size)
    head = data[:6]
    if head.startswith(b"PGDMP"): emit(oid, "magic-PGDMP", 0, size)
    elif head.startswith(b"\x1f\x8b"): emit(oid, "magic-gzip", 0, size)
    elif head.startswith(b"PK\x03\x04"): emit(oid, "magic-zip", 0, size)
    elif head.startswith(b"\xfd7zXZ\x00"): emit(oid, "magic-xz", 0, size)
    i = data.find(b"PGDMP", 1)
    if i > 0: emit(oid, "PGDMP-embedded", i, size)
    for rule, rx in TEXT:
        m = rx.search(data)
        if m: emit(oid, rule, m.start(), size)
    emails = EMAIL.findall(data)
    uniq = {e.lower() for e in emails if not e.lower().endswith((b".png", b".jpg", b".svg", b".js", b".ts"))}
    if len(uniq) >= 20: emit(oid, f"emails>=20(unique={len(uniq)})", 0, size)
    if uniq and re.search(rb"(?im)^(INSERT INTO|COPY )", data): emit(oid, "insert-or-copy-with-emails", 0, size)
    for rule, rx in CRED:
        for m in rx.finditer(data):
            cls = "placeholder-like" if PLACEHOLDER.search(m.group(0)) else "NON-PLACEHOLDER"
            emit(oid, rule, m.start(), size, cls)
sys.stderr.write(f"scanned_blobs={n}\n")
' > "$OUT"
