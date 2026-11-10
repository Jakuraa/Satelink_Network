# Credential rotation and revocation checklist (2026-11-09)

Categories only, because this repository is public. Exact names and locations are in
`docs/build/evidence/private/CREDENTIAL_ROTATION_DETAIL_2026-11-09.md` on the build machine (gitignored). No document holds a value.

**Status of every row: OPEN, founder action.** No agent rotated, revoked or tested anything, so whether each credential is
still live is unknown. "Reported" means your 2026-10-20 statement, not verified at the provider.

| Order | Credential class | Why | Founder action | How to confirm | Blocker |
|---|---|---|---|---|---|
| 1 | Treasury and production signer keys | Plaintext in a local stash | Move funds and roles to new keys; drop the stash entry; `git gc` | Stash entry gone; on-chain roles show new addresses | OB-3 |
| 2 | Claims contract signer | Same address as treasury and payTo; route was reachable without staff auth until #549 | `runbooks/SIGNER_ROTATION.md` | Read `platformSigner` on-chain | F21 |
| 3 | Signer keys in the production environment | Replace with the above | Keep only what is used; keep `SETTLEMENT_DRY_RUN=1` | Deployed signer address matches the new key | F21 |
| 4 | JWT signing secret | Public git history | Rotate in production and CI; signs everyone out | Old token rejected | OB-1 |
| 5 | Slack and Discord webhooks | Public git history. **Discord records conflict** (reported cleared vs. unrotated) | Delete and recreate; update every store | Old URL returns an error | OB-2 |
| 6 | Admin password | Hash in public history | Change anywhere it is reused | n/a | OB-1 |
| 7 | Infrastructure admin tokens on the API service | Reading the API environment would give control of DNS, deploys and the repository | Revoke, reissue least-privilege, store elsewhere | Variables removed; old tokens rejected | new |
| 8 | Staff tokens | One reported rotated; one has no rotation on record | Rotate; delete if unused | Old token returns 401 | new |
| 9 | Production database credential | Superuser role still in use; URL in a local file readable by other accounts | Switch role, rotate password, tighten the file | `current_user` is the app role | F1 |
| 10 | Local tokens on the build machine | Plain-text shell exports; CLI token file readable by other accounts; one stale token now returns 401 | Keychain, `chmod 600`, rotate | Not in shell or readable | new |
| 11 | Unreachable local objects | Includes an RSA private key | Check use; `git gc` | Objects gone | OB-3 |
| 12 | API key value in untracked local reports | Repeated in three reports not ignored by git; may be a placeholder, **unverified** | Read it; revoke if real; sanitize before any `git add` | Scanner clean | new |
| 13 | Reported-rotated provider keys | Reported only | Confirm in each provider's console | Old key rejected | F1 |
| 14 | Other provider keys | No evidence of exposure | Rotate only if item 7's environment was read | n/a | none |

## Controls
- [ ] GitHub secret scanning and push protection: **verified disabled** on 2026-11-09 (OB-4).
- [ ] Branch protection on `main` (F15).
- [ ] Confirm the GitLab remote never received the local keys (OB-6).
- [ ] Assess notification for third-party email addresses in history (OB-7).
- [ ] History rewrite is optional and comes after rotation. Rotation is what closes the risk.

## Scans on 2026-11-09 (redacted output)
gitleaks across all refs since 2026-11-04: 0 findings. Untracked local files: 13 hits, classified with masked output (item 12).
