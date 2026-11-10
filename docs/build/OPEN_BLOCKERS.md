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
| OB-13 | MCP 2026-07-28: official `@modelcontextprotocol/sdk` (latest 1.32.2) supports ≤ 2025-11-25 | BLOCKED (EXTERNAL) | negotiate 2025-11-25 (ADR-9) | 2026-07-28 conformance once the SDK ships it |
| OB-14 | **Critical dependency advisories.** Corrected 2026-11-09, see `SECURITY_TRIAGE_2026-11-09.md`. Live: `next` RCE advisory (GHSA-2464-fhr4-w9xw) on all three sites. `better-auth` and `proxy-addr` are patched in production's lock and vulnerable only in the root lock CI installs. Not deployed: `apps/cms`, MCP SDK | BLOCKED (FOUNDER): draft PRs #631–#635 await review; merge and deploy are founder-only | CI audit gate fails on any NEW high/critical | closes the exposure |
| OB-15 | Infrastructure admin tokens on the production API service; staff tokens without a rotation record; local token files | BLOCKED (FOUNDER) | Agents read names only | `CREDENTIAL_ROTATION_CHECKLIST.md` |
| OB-16 | AC13 decisions: checkout and Dodo, legal text, console, `/corporate`, "On-Chain Settlement" | BLOCKED (FOUNDER + COUNSEL) | Left unchanged and working | AC13 |
