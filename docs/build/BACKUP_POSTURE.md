# Backup posture — 2026-11-04 (Release A, Phase P0.7)

The originals were **not** moved, copied, renamed, chmod-ed, encrypted or opened. Metadata only
(`stat`, `shasum -a 256`, first 5 bytes as hex).

## Copies on this machine
| Path (repo-relative, main checkout) | Bytes | mtime | Mode | SHA-256 | Magic |
|---|---|---|---|---|---|
| `backups/protected/production_pre_migration040.dump` | 44,319,101 | 2026-11-03 12:27 | `-r--r--r--` | `144535de…a4a31aa9` | `PGDMP` |
| `docs/release/production_pre_migration040.dump` | 44,319,101 | 2026-11-03 12:27 | `-r--r--r--` | `144535de…a4a31aa9` | `PGDMP` |
| `docs/release/satelink_rehearsal_backup.dump` (rehearsal, not production) | 175,774 | 2026-11-03 11:21 | `-rw-r--r--` | `44e2ffc3…7ed428995` | `PGDMP` |

Both production copies match the expected hash `144535de…31aa9` exactly. They are separate inodes
(not hard links), on the same APFS container (`disk1`).

## Independence
**The two production copies count as ONE copy for recovery.** Same disk, same APFS container, same
machine: a disk failure, container corruption, theft, ransomware or an accidental `rm -rf` of the
checkout loses both. There is no verified off-device copy.

## Exposure risk (what could publish them)
| Path | Before P0 | After P0 (branch `build/p0-safety`) |
|---|---|---|
| Git | Ignored only by an **uncommitted** `*.dump` line in the main checkout's `.gitignore`; `origin/main` did not ignore `.dump` | `.gitignore` ignores `*.dump *.pgdump *.backup *.sql.gz backups/ docs/release/**/*.dump .env*`; pre-commit + CI block by name **and** content (`PGDMP` magic, pg_dump header) |
| Docker build context (root) | `backups/` excluded, `docs/release/*.dump` **included** | excluded (`**/*.dump`, `**/backups/`), verified with Docker's matcher |
| Vercel CLI upload (root) | `/docs/` excluded, `backups/` **included** | excluded |
| Railway CLI upload | only `.env*` listed; relied on the uncommitted `.gitignore` | excluded |
| Git-connected deploys | ship tracked files only → never contained the dumps | unchanged |

Until `build/p0-safety` is merged, the protection on `main` checkouts still depends on the local,
uncommitted `.gitignore` line. Do not run `git add -A`, `railway up` or `vercel` from the main checkout.

## Founder actions
1. Make an **encrypted off-device copy** now (e.g. `age`/`gpg` encrypt a *copy*, then store on a separate physical device **and** off-site object storage with object lock — R2 or S3). Verify the off-site copy's SHA-256 after download.
2. Merge `build/p0-safety` (or cherry-pick its ignore + gate changes) so protection no longer depends on an uncommitted file.
3. Then decide whether to remove the plaintext dumps from the repository tree (move them outside the checkout). Agents will not move or delete them.
4. The dump contains production customer data: treat the build machine as holding PII (disk encryption on, no cloud sync of this folder).
