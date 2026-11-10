# Release B (Public Beta) — founder actions

Everything below needs you: credentials, money, legal, supplier relationships or production access. Ordered by urgency.
**1–7 do not wait for Release B:** they are live exposures that exist today regardless of this work.

| # | Action | Why it blocks | Where | Default if not done | Unblocks |
|---|---|---|---|---|---|
| 1 | Review, merge, deploy #631 (`next` 15.5.29 + `sharp` 0.35.5) and confirm jakuraa.com rebuilds | RCE advisory GHSA-2464-fhr4-w9xw on all three sites | #631 | Exposure stays live | OB-14 |
| 2 | Review and merge #632, #633: root lock `better-auth`, `proxy-addr`, `dompurify`, MCP SDK | Production's `better-auth` is already patched; CI tests a vulnerable one. See `SECURITY_TRIAGE_2026-11-09.md` | #632, #633 | CI keeps testing the wrong version | OB-14 |
| 3 | Review and merge #634; decide #635 (`@x402` 2.30, live payment rail, needs a controlled settlement); remove or upgrade `apps/cms` | API high advisories; zod stays until `@coinbase/x402` moves | #634, #635 | Highs stay open | OB-14 |
| 4 | Work through `CREDENTIAL_ROTATION_CHECKLIST.md`, starting with keys that control money. Rotate the exposed JWT secret | In public git history | Production auth config | Tokens forgeable | OB-1 |
| 5 | Delete/recreate the Slack and Discord webhooks | In public git history | Slack, Discord | Anyone can post | OB-2 |
| 6 | Move signer/treasury keys, then drop the local stash + gc | Plaintext keys in a local stash | This machine | Agents keep not touching it | OB-3 |
| 7 | Make an encrypted off-device and off-site backup copy | Only ONE real copy of the production dump exists | `docs/build/BACKUP_POSTURE.md` | A disk failure loses it | OB-5 |
| 8 | Enable GitHub secret scanning + push protection | Defence in depth | Repo settings | CI gitleaks on new commits only | OB-4 |
| 9 | Confirm the GitLab remote never received the keys; assess PII notification | Incident scope | GitLab; counsel | Assumed unknown | OB-6, OB-7 |
| 10 | Review and merge the PR stack in order (see FINAL_REPORT §4) | Nothing here is on `main` | GitHub | Preview stays on branches | everything below |
| 11 | Review ADR-5 before any production apply; apply migrations 042–046 yourself | Writes alongside the frozen ledger | `docs/build/DECISION_LOG.md`, `database/migrations` | Local/CI only | production money simulation |
| 12 | D14 already decides Trading Intelligence is not a standalone product; #636 applies it. Decide the rest: keep, rename or stop the checkout sale; legal text with counsel | Checkout and legal still describe the sale | #636, `AC13_PUBLIC_CLAIMS_2026-11-09.md` | Public copy and checkout disagree | AC13 |
| 13 | Check the replaced root JSON-LD product against any payment-provider review | It was commented as the merchant account's primary product | `apps/web/src/app/layout.tsx` | Possible mismatch with a merchant review | #629 merge |
| 14 | Decide whether "On-Chain Settlement" stays in the footer | `SETTLEMENT_DRY_RUN=1` still blocks settlement broadcasting | `packages/content/src/navigation.ts` | Link stays | truthful public claims |
| 15 | Approve or change all fees | Every fee is PROPOSED — NOT APPROVED | `apps/api/config/pricing.preview.json` | No charging | any real charge |
| 16 | Provide a live model key and verify routing | AC2 is VERIFIED (FIXTURE) only; #579 adapter unverified | `OPENROUTER_API_KEY` | Fixture provider | real assistant answers, AC2 live |
| 17 | Choose real suppliers and sign terms | Every supplier is a local mock | `apps/api/config/capabilities.preview.json` | Mocks remain | real shopping, data |
| 18 | Apply for food platform access | No relationship exists | `docs/build/SWIGGY_PRODUCTION_APPLICATION.md` | Food stays mock; Zomato blocked (terms unverified) | real food orders |
| 19 | Choose a payment rail and complete KYB | Razorpay suspended; Dodo/Cashfree prohibit crypto/trading; Transacty needs KYB + CA review | Payments config | No fiat | customer payments |
| 20 | Decide x402 live for task capabilities: mainnet, real `payTo`, CDP facilitator, refund path | Preview uses a mock facilitator; failed paid tasks keep the deposit as credit | `apps/api/config/x402.preview.json` | Preview only | machine revenue on tasks |
| 21 | Tax and legal review | Taxes are not computed; legal text describes today's product | `apps/web/src/lib/legal.ts`, counsel | Preview wording | public charging |
| 22 | Provide Alpaca paper keys | Adapter never run against Alpaca | `ALPACA_PAPER_KEY_ID`, `ALPACA_PAPER_SECRET_KEY` | Internal paper broker | paper broker test |
| 23 | License a recorded market dataset | Trading uses synthetic data only | F32 | Synthetic data | meaningful evaluations |
| 24 | Provide Turnstile keys | Public sign-up has no bot protection | Cloudflare (not wired in code yet) | Better Auth per-IP limits | public sign-up |
| 25 | Provide a KMS signing key | A2A card is unsigned | KeyProvider | Unsigned card | signed Agent Card |
| 26 | Publish `satelink-mcp` | Founder-only (F12); 2.2.0 is pack-tested | `.github/workflows/publish-mcp.yml` | Unpublished | public MCP |
| 27 | Resolve the `apps/api` lockfile edge | Invalid x402 edge; any dep change re-resolves the payment stack (blocks #2 too) | `apps/api/package-lock.json` (OB-12) | apps/api deps frozen | safe API dependency changes |
| 28 | Build the DNS-rebinding check before beta connectors | Egress guard does not resolve DNS | `connectors/egress_guard.js` | Preview is loopback-only | real external connectors |
