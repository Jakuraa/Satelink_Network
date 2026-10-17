# Website Repositioning Specification (proposal — NOT deployed)

**Date:** 2026-10-15 · Based on WEBSITE_AUDIT_SATELINK (SL-xx), WEBSITE_AUDIT_JAKURAA (JK-xx), PRODUCT_BOUNDARY_AND_POSITIONING.
Nothing in this file has been published. Every claim carries an evidence reference and an owner.

## 0. Principles

1. Lead with the one product that works and can be paid for: Polygon RPC.
2. Trading AI stays visible but separate, labelled as private beta. It is not concealed.
3. Every number on a page comes from an endpoint or document listed in the claim register (§6). Otherwise it is removed.
4. Company identity is identical everywhere: name, CIN, registered office, one support email, a phone number, and a named grievance officer.

## 1. Information architecture — satelink.network

```
Home (RPC)        Pricing        Docs        Status        Company ▾          [Console]
                                                           ├ About Jakuraa Commercial Pvt Ltd
                                                           ├ Contact / Support
                                                           └ Legal (Terms, Privacy, Refunds, AUP, Billing)
Footer: "Other products — Satelink Trading AI (private beta, not available for purchase)"
```

Remove from top navigation: Trading AI hero, Trading Intelligence, "Machine Commerce", "DePIN", node-operator earnings.

## 2. Homepage (before → after)

| Element | Before (live 2026-10-15) | After (proposal) | Evidence / owner |
|---|---|---|---|
| `<title>` | "Satelink Trading AI — an AI trading operating system for people, AI agents and machines \| Satelink" | "Satelink — Pay-per-call Polygon RPC for developers and AI agents" | SL-01 · Eng |
| H1 | "An AI trading operating system for people, AI agents and machines." | "Polygon RPC. Pay per call." | SL-01 · Founder |
| Sub-head | "Reason, validate, score, authorize, execute, learn…" | "A JSON-RPC endpoint for Polygon PoS. Developers prepay usage credits; AI agents can pay per request with x402. No minimums." | Inventory #1, #4 · Founder |
| Primary CTA | "Join the paper-trading beta" | "Get an API key" → console · secondary "Read the quick start" | Inventory #8 |
| Proof strip | (varies) | Only `/api/public/stats` fields, labelled with their source and timestamp: requests in the last 24h, uptime in the last 24h. No revenue, no node earnings, no TX counts | `/api/public/stats` · Eng |
| Code sample | — | `curl -X POST https://rpc.satelink.network/rpc/polygon -H "X-API-Key: …" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'` | live endpoint |
| Operator line (footer) | "Jakuraa Commercial Pvt Ltd, 38/39 Malaviya Street…" (no CIN) | "Satelink is operated by Jakuraa Commercial Pvt Ltd · CIN ⟨…⟩ · ⟨registered office, identical to MCA record⟩ · GSTIN ⟨…⟩ · support@⟨domain⟩ · ⟨phone⟩" | SL-08, JK-10, INDIA §9 · Founder |
| JSON-LD | Organization + SoftwareApplication describing Trading AI / multi-chain | `Organization` (legal name, address, contactPoint) + `WebAPI`/`Product` for Polygon RPC with `offers` = actual price | SL-01, SL-21 · Eng |
| llms.txt | Trading AI lead | RPC lead, with x402 discovery links | SL-01 · Eng |

## 3. Pricing page

Show **one** price list, matching `/v1/pricing` and the 402 response:

| Way to pay | Price | Who | Refunds |
|---|---|---|---|
| Prepaid credits, card (once a provider is approved) | $X per 1,000 calls; minimum top-up $10 | Developers | Per refund policy |
| Prepaid credits, USDT on Polygon | $0.03 per 1,000 calls ($0.00003/call) | Developers / bots | Unused credits per refund policy; on-chain transfers are irreversible |
| x402 (USDC on Base) | $0.10 per 1,000-call bundle | AI agents, no account | No automatic refund; see policy |

Fixes required:
- **SL-02:** yearly plans are rendered as "$190/month". Fix `apps/web/src/components/PlanCards.tsx:19–22`, or remove those plans.
- **SL-12 / SL-13:** remove Trading Intelligence rows and the "Available soon" plan cards.
- **SL-14:** remove the "free tier / monthly quota" copy.

Then delete or align the legacy API catalogues:
- `/v1/plans` (Free 300 / Pro $19 / Max $79, overage $0.008)
- the `/v1/pricing` `free` tier row
- the `/v2/plans` TI-only boundary text

Explain why x402 costs more than USDT (no account, per-request settlement) in one sentence.

Note on Paddle-class providers:
- If the MoR treats prepaid credits as "stored value" (Paddle AUP prohibits "store credit"), sell **usage-based billing** (metered, invoiced in arrears) or fixed **plans with included calls**, not open-ended credit balances.
- Confirm this in writing before building (PROVIDER MATRIX questions).

## 4. Docs

- **SL-03:** remove "free tier, no account required, 500 calls/day per IP". Fix `apps/web/src/content/docs/quick-start.md:12` and the 5 other files listed in SL-03.
- **SL-20:** use the real live 402 body (x402 v2: `accepts[].scheme:"exact"`, `amount`, `payTo`, `PAYMENT-REQUIRED` header).
- **SL-21:** state the supported chains truthfully. Polygon is the documented paid chain; drop or caveat Ethereum, Arbitrum and Base.
- **SL-19:** one statement that the node operator programme is paused and no payouts are active. Remove settlement-latency claims.
- Add a "How billing works" page: 402 → pay → credits → metering → console usage → refunds → wrong-network disclosure.
- Name the MCP package only after `npm view satelink-mcp` returns the published version (SEC F-03).

## 5. Company & legal (both sites)

| Item | Requirement | Ref |
|---|---|---|
| Legal pages | Remove "Draft pending legal review" only after counsel/CA approval. Until then, do **not** apply to providers that review policies (they read drafts as missing) | SL-05, #525 |
| Refund policy | Publish at a stable URL on both domains (jakuraa.com/legal/refunds is 404 today) | SEC F-14 |
| Grievance officer | Named person, email, phone, response timeline (Consumer Protection (E-Commerce) Rules) | SL-06, JK-08, INDIA §7 |
| Support | One support mailbox on a company domain (replace `satelinknetwork@gmail.com`); phone number | SL-07, JK-09 |
| Terms scope | Satelink Terms cover RPC/API only and exclude Trading AI; Trading AI has separate beta terms | SL-09 |
| Founder identity | Use the registered director name, or add "(also known as …)" consistently; must match KYB documents | JK-07 |
| Jakuraa home | Title "Jakuraa Commercial Pvt Ltd — software company, operator of Satelink"; remove "AI that trades within your rules" from H1; keep goods-trading history factual | JK-01, JK-14 |
| Unsupported claims (jakuraa.com) | Remove "Sub-second (<400ms) settlement", "reconcile on-chain with cryptographic certainty", "Mainnet Operational", "Sub-50ms", "Claude & Anthropic MCP compatible", oracle feeds, "the premier…", the "Verified Analysis" video label, the static "Network Status: Operational" badge | JK-02…06, JK-12, JK-13, JK-15 |
| Backdated research | Re-date x402/RevenueVaultV2 papers to actual publication dates; x402 is a Coinbase-originated open standard, not Jakuraa's | JK-05 |
| Corporate history | Keep factual (GPU mining 2019, hospitality 2021–22) and consistent with the provider application. Do not delete history | JK-16 |
| Security headers | CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy on both sites; `security.txt` | SL-22, JK-21 |

## 6. Claim register (every public claim → evidence → owner)

| Claim | Evidence source | Refresh | Owner |
|---|---|---|---|
| Price per call $0.00003 (USDT credits) | `credit_service.mjs PRICE_PER_CALL_USDT`; `/v1/pricing`; `catalog_consistency.test.js` | CI on every PR | Eng |
| x402 $0.10 / 1,000 calls | 402 `accepts.amount=100000`; `/.well-known/x402` | CI | Eng |
| Requests (24h), uptime | `/api/public/stats` (live, timestamped) | live | Eng |
| Supported chain(s) | `providers.js` + paid-path test | per release | Eng |
| Upstream provider & resale right | Signed supplier agreement (not yet existing) | per contract | Founder |
| Company identity | MCA master data | yearly | Founder |
| Refund terms | Approved policy (#525 after CA) | on change | Founder + CA |
| "Trading AI is not available / private beta" | `BLOCKERS.md` Gate 0 status | per gate change | Founder |

## 7. Trading AI disclosure block (proposed copy)

> **Satelink Trading AI — private beta (not available for purchase).** Research software for strategy design, backtesting and paper trading. Live order execution is not available. Satelink Trading AI is not investment advice, and Jakuraa Commercial Pvt Ltd is not a SEBI-registered research analyst, investment adviser or broker. No payments are accepted for this product. [Join the waitlist]

Placement: footer "Other products", plus its own `/trading-agent/*` pages. Not the homepage hero. Fix internal placeholder text on `/trading-agent/pricing` (SL-10) and resolve the beta-status contradiction (SL-11). Review the "capital band" field on the beta form (SL-18) with counsel; remove it if there is no purpose.

## 8. SEO / conversion / accessibility

- Canonical URLs on all pages (SL-26, JK-18). `og:image` (SL-25). One `<h1>` per page (SL-27). The 404 page title must not reuse the homepage title (SL-28).
- Remove the dead `app.satelink.network` redirect in `apps/web/vercel.json` and its DNS record (SL-24).
- Conversion events (privacy-respecting): `docs_quickstart_view`, `key_created`, `first_call`, `first_402`, `first_payment`, `second_payment`. These map to FIRST_REVENUE_EXPERIMENTS metrics.
- Mobile: verify the code blocks scroll horizontally inside their container; keep 16px gutters.
