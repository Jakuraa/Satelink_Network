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
| OB-8 | Review ADR-5 (JS reservation writer + origin/environment columns on the frozen ledger) before any production apply | BLOCKED (FOUNDER) | local/CI only; parity test guards drift | production use of Release A money simulation |
| OB-9 | #583 alone is unsafe (migration 020 vs 038); merge `build/integration-base` or renumber on #583 | BLOCKED (FOUNDER) | fixed on integration base (042) | Financial OS reservations |
| OB-10 | OpenRouter: live key optional; PR #579 adapter is draft/unverified | BLOCKED (FOUNDER) | FixtureModelProvider; AC2 = VERIFIED (FIXTURE) | live model routing |
| OB-11 | Turnstile on sign-up (needs Cloudflare site/secret keys; test keys still call challenges.cloudflare.com) | BLOCKED (FOUNDER) | preview sign-up without CAPTCHA; Better Auth per-IP limits on in production | bot protection on public sign-up |
| OB-12 | `apps/api/package-lock.json` holds an invalid x402 edge (`@coinbase/cdp-sdk` → `@x402/evm ^2.25.0`, lock 2.18.0); any dependency change re-resolves the payment stack | BLOCKED (FOUNDER) | apps/api dependencies untouched (ADR-7) | declaring new apps/api dependencies safely |
