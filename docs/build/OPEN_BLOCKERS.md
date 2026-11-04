# Open blockers — Release State A

Status values: BLOCKED (FOUNDER) · BLOCKED (EXTERNAL). Each item lists the default the build uses meanwhile.

| ID | Blocker | Status | Default while open | Unblocks |
|---|---|---|---|---|
| OB-1 | Rotate exposed JWT secret (E1) | BLOCKED (FOUNDER) | Build never reads or uses production auth secrets | closes incident |
| OB-2 | Delete/recreate Slack + Discord webhooks (E2, E3) | BLOCKED (FOUNDER) | No webhook code touched | closes incident |
| OB-3 | Local stash holds plaintext signer + treasury keys (L1): decide key move, then drop stash + gc | BLOCKED (FOUNDER) | Agents never read, pop, apply or drop it | closes incident |
| OB-4 | Enable GitHub secret scanning + push protection | BLOCKED (FOUNDER) | CI gitleaks on new commits (branch `build/p0-safety`) | defence in depth |
| OB-5 | Encrypted off-device + off-site backup copy | BLOCKED (FOUNDER) | Originals untouched; documented as ONE copy | recovery |
| OB-6 | Confirm GitLab remote never received L1 | BLOCKED (FOUNDER) | assumed unknown | incident scope |
| OB-7 | Assess PII notification (E6/E7) | BLOCKED (FOUNDER) | none | privacy |
