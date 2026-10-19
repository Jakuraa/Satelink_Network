# Prioritized Action Plan

**Date:** 2026-10-15
**Status:** proposal only. **No item has been implemented.** Each Eng item requires founder approval, a PR, and a founder merge (merge to `main` deploys).

**Scoring:** approval impact · revenue impact · customer impact · security · evidence confidence · effort (S/M/L) · legal dependency · time.

## P0: misleading claims, financial integrity, serious security, blocking compliance

| ID | Action | Why (evidence) | Owner | Effort | Legal dep. | Acceptance |
|---|---|---|---|---|---|---|
| P0-1 | **Unmount the AI gateway** (`app_factory.mjs:458`), or rebuild it with honest model names, billing and no stub responses | SEC F-01: `gpt-4o`/`claude` → Llama substitution; fake completions; unbilled | Eng → founder merge | S | — | `GET /v1/models` 404; no `gpt-*`/`claude-*` strings in public catalogues |
| P0-2 | **Gate `/api/economics/summary` and `/internal/*-parity`** behind `requireAdminAuth` | SEC F-02 / F-04: public "revenue" $20.53 is founder money; internal sums exposed | Eng → founder | S | — | Both return 401 without token |
| P0-3 | **Close the `satelink-mcp` squat window**: publish 2.1.1, or remove the name from 402 bodies until published | SEC F-03; live 402; npm 404 | Founder (publish) / Eng (copy) | S | — | `npm view satelink-mcp version` = 2.1.1, or 402 bodies contain no package name |
| P0-4 | **Upstream supply legitimacy**: (a) founder reads which upstream serves paid traffic; (b) obtain written resale confirmation (dRPC first) or run an owned node; (c) remove keyless public endpoints from the *paid* path | API_PROCUREMENT §1–2: paid traffic defaults to PublicNode / dRPC public; no supplier confirms resale | Founder (contract) + Eng (config) | M | Supplier contract | Signed or emailed written permission on file; paid pool = contracted endpoints only |
| P0-5 | **Make the homepage tell the truth about what is sold**: RPC lead, Trading AI moved to "Other products (private beta)" | SL-01 (title/H1 = "AI trading operating system"); BOUNDARY §3 | Eng (copy per REPOSITIONING §2) → founder | S | — | `<title>` and H1 describe Polygon RPC; Trading AI disclosure block present |
| P0-6 | **One price list**: delete `/v1/plans`, fix the `/v1/pricing` free row, fix `PlanCards.tsx` "$190/month", remove free-tier claims from docs | F-10, SL-02, SL-03, SL-14 | Eng → founder | S | — | `catalog_consistency.test.js` extended to `/v1/plans`, `/v2/plans`, docs; live curl consistent |
| P0-7 | **Remove the card→Trading Intelligence boundary** and TI from the API catalogue (`/v1/intelligence` unlisted); remove dormant leads-product code (`/tasks`, `/api/tasks/start`, webhook surface 1) | PAYMENT §5; F-11; Dodo/Paddle prohibitions | Eng → founder | S | — | `/v2/plans` boundary text gone; `/v1/intelligence` not discoverable; task-commerce code deleted |
| P0-8 | **Do not apply to any provider (and pause pending Dodo/Cashfree reviews if possible)** until P0-5…P0-7 and P1-1/P1-2 are live | Providers review the live site; Dodo's policy conflicts with today's site on 3 counts | Founder | — | — | Decision recorded |
| P0-9 | **Rotate pending credentials** (B-01 leaked credential, B-02/B-03 admin tokens) and set `autoApprove:false` in `.claude/settings.json` | SEC F-07 | Founder | S | — | Rotation confirmed; settings file changed |

## P1: product and payment-provider readiness

| ID | Action | Evidence | Owner | Effort | Legal dep. |
|---|---|---|---|---|---|
| P1-1 | Legal identity on both sites: CIN, registered office (identical to MCA), GSTIN, one company-domain support email, phone, **named grievance officer**, founder-name consistency | SL-06/07/08, JK-07/08/09/10, INDIA §7, §9 | Founder | S | Company Secretary |
| P1-2 | Approve and publish Terms (RPC-only scope), Privacy, **Refund policy** (#525 after CA L1–L10), AUP; remove "Draft" banners only after approval | SL-05, SEC F-14 | Founder + lawyer/CA | M | Yes |
| P1-3 | **CA + lawyer opinion on crypto receipts** (GST export status, FEMA bank-channel rule, VDA/FIU) before scaling x402/USDT | INDIA §1, §4 | Founder | M | Yes |
| P1-4 | Choose the MoR. Recommended **Paddle** (RPC only; usage-billing or plans, not "stored value" credits), backups Polar / Creem / Cashfree. Send written pre-application questions (drafts in PROVIDER MATRIX) | PROVIDER MATRIX §1 | Founder | S | — |
| P1-5 | Merge #520 (Financial OS / PaymentAdapter) behind its flag so one canonical ledger exists before card money; fix S6 (`truth.js` op_type filter) | PAYMENT §3; SEC F-05 | Eng + founder review | M | — |
| P1-6 | x402 settle→record gap: persist the facilitator receipt before the DB write, or a nightly facilitator↔`payment_sources` reconciliation; handle `settlement_pending` | SEC F-06 | Eng | M | — |
| P1-7 | One non-founder end-to-end paid test + reconciliation (`X402_PAID_TEST_RUNBOOK.md`) | FIRST_REVENUE 7-3 | Founder | S | — |
| P1-8 | jakuraa.com: remove unsupported claims (JK-02…06, 12, 13, 15), re-date research papers (JK-05), separate "trading company" (goods) from AI trading (JK-01, JK-14) | WEBSITE_AUDIT_JAKURAA | Eng (corporate app) → founder | S | — |
| P1-9 | Fix `polygon-rpc.com` keyless defaults in 4 internal paths (`withdraw_service.js:25`, `settlement_control.js:39`, …); replace the WS `demo` Alchemy key | research §B2 | Eng | S | — |
| P1-10 | Staging environment (B-06) and a log drain with ≥180-day retention (CERT-In 2022 direction; INDIA notes) | SEC F-09, F-13 | Founder | M | — |
| P1-11 | Reverse-charge GST review on imported services (Railway, Vercel, Cloudflare, RPC suppliers) | INDIA §2 | CA | S | Yes |

## P2: conversion, additional providers, nonessential integrations

- Direct outreach to identified integrators (FIRST_REVENUE 7-2).
- Docs: real 402 example (SL-20), chain truthfulness (SL-21), "How billing works" page.
- SEO: canonicals, og:image, `<h1>`, 404 title, security headers, `security.txt` (SL-22…28, JK-18…21).
- Remove the dead `app.satelink.network` redirect and DNS record (SL-24).
- Restrict CORS on `/admin` and `/v1/me` (F-12).
- Affiliate sign-ups (Chainstack, QuickNode, dRPC) as zero-risk supplementary revenue.
- BYO-key orchestration landing page and waitlist (demand test only).
- Re-apply to Stripe India once documented cross-border receipts exist.

## P3: speculative or cosmetic

- MPP, ACP, AP2, Visa/Mastercard agent programmes (not available to an India entity; revisit only with a non-India entity).
- Multi-chain expansion; generic API procurement marketplace; node-operator payouts.
- Trading AI monetisation (requires SEBI/broker/legal review, separate provider approval, Gate 0).
- Licence conflict cleanup (B-11).

## Build / buy / partner / defer (Q11)

| Build | Buy | Partner | Defer |
|---|---|---|---|
| P0 removals and fixes; canonical ledger (#520); reconciliation job; honest pricing and docs | MoR (Paddle-class) instead of own acquiring; log drain; staging | **Upstream RPC supplier with written resale rights** (dRPC / Infura / Ankr), or node hosting; Indian CA + fintech lawyer | API-procurement marketplace; MPP/ACP; node payouts; Trading AI payments and live trading; AI gateway |
