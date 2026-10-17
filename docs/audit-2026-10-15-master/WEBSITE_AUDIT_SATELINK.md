# Website Audit: satelink.network (plus console, docs, status, api)

- **Audit date:** 2026-10-15, 21:06 to 21:20 IST
- **Auditor role:** conversion, technical SEO and payment-underwriting readiness. This was a READ-ONLY audit: no forms were submitted, no account was created and nothing was paid for.
- **Method:** `curl -sSL -D-` for status, redirects and headers. All 137 sitemap URLs plus the nav and footer links were crawled. Playwright (local) rendered `/pricing` and `status.satelink.network`. Every finding was then grepped back to its source in `apps/web`, `apps/console`, `packages/content` and `apps/api`.
- **Access limitations:** No page behind a login was inspected (console, `/satelink/os/*`). The Trading AI paper beta could not be exercised because it is not open. No x402 or USDT payment was made, so the "pay, then get a result" step is inferred from the 402 bodies only. `npmjs.com` returned 403 to curl, so npm package existence was checked through `registry.npmjs.org`.

---

## 1. Inspection log

| Time (IST) | URL | Status | Final URL | `<title>` |
|---|---|---|---|---|
| 21:06:56 | https://satelink.network/ | 200 | same | Satelink Trading AI — an AI trading operating system for people, AI agents and machines \| Satelink |
| 21:07:05 | https://www.satelink.network/ | 200 | https://satelink.network/ | (same as above) |
| 21:07:00 | https://console.satelink.network/ | 200 | /sign-in | Sign in · Satelink Console (robots noindex) |
| 21:07:00 | https://docs.satelink.network/ | 200 | same | Satelink Documentation \| Satelink |
| 21:07:01 | https://api.satelink.network/ | 404 | same | Error ("Cannot GET /") |
| 21:07:02 | https://api.satelink.network/health | 200 | same | JSON `{"ok":true,"server":"ok","db":"ok","uptime":17617}` |
| 21:07:03 | https://app.satelink.network/ | TLS fail (curl 60) | n/a | certificate `*.satelink.network` expired **18 Jul 2026**; with `-k` the page returns 404 |
| 21:07:04 | https://status.satelink.network/ | 200 | same | **Satelink Trading AI — AI trading operating system…** (homepage title reused) |
| 21:12:01 | POST https://api.satelink.network/rpc/polygon `eth_blockNumber` | **402** | same | x402 v2 body; `alternativePayment.error.data.limit: 0` |
| 21:13 | POST https://rpc.satelink.network/rpc `eth_blockNumber` | **402** | same | same 402 body. The docs quick-start promises "a normal JSON-RPC response" here |
| 21:13 | GET https://rpc.satelink.network/v1/intelligence | 200 | same | catalog JSON (4 metrics at $0.01) |
| 21:13 | GET https://rpc.satelink.network/v1/intelligence/funding-rate-heatmap | 402 | same | "Provide an API key funded with credits". **No x402 challenge** |
| 21:08:59 | https://api.satelink.network/.well-known/x402 | 200 | same | JSON: rpc_credits $0.00003/call; x402 bundle $0.10/1000 = **$0.0001/call** |
| 21:08:58 | https://satelink.network/.well-known/x402, /.well-known/mcp.json, /.well-known/security.txt | 404 | same | 404 page carries the homepage title |
| 21:09:00 | https://api.satelink.network/.well-known/mcp.json, /llms.txt | 404 | same | Error |
| 21:08:57 | https://satelink.network/robots.txt | 200 | same | Allows `/`; disallows /admin, /ops, /api, /satelink/os, /login, /checkout … |
| 21:08:57 | https://satelink.network/sitemap.xml | 200 | same | 137 URLs, **all 200** |
| 21:08:58 | https://satelink.network/llms.txt (+ /llms-full.txt) | 200 | same | text |
| 21:08:52 | https://satelink.network/login | 200 | console.satelink.network/sign-in | Sign in · Satelink Console |
| 21:08:53 | https://satelink.network/signup | 200 | console…/sign-in?mode=signup | Sign in · Satelink Console (H1 "Give your software a way to pay") |
| 21:08:53 | /sign-in, /about, /legal | 404 | same | homepage title |
| 21:08:01 | /pricing | 200 | same | Pricing \| Satelink |
| 21:08:05 | /refund | 200 | same | Refund & Cancellation Policy \| Satelink |
| 21:07:46 | /billing-policy | 200 | same | Billing & Payment Policy \| Satelink |
| 21:08:16 | /terms | 200 | same | Terms of Service \| Satelink |
| 21:08:02 | /privacy | 200 | same | Privacy Policy \| Satelink |
| 21:07:45 | /acceptable-use | 200 | same | Acceptable Use Policy \| Satelink |
| 21:07:49 | /contact | 200 | same | Contact \| Satelink |
| 21:07:51 | /contact-sales?interest=beta | 200 | same | Contact sales \| Satelink |
| 21:08:15 | /support | 200 | same | Support \| Satelink |
| 21:08:14 | /status | 200 | https://status.satelink.network/ | (homepage title) |
| 21:08:17 | /trading-agent | 200 | same | Satelink Trading AI — Satelink \| Satelink |
| 21:08:18 | /trading-agent/how-it-works, /risk, /docs | 200 | same | … — Satelink Trading AI \| Satelink |
| 21:08:50 | /trading-agent/product (also the target of /products/trading-intelligence) | 200 | same | Product — Satelink Trading AI \| Satelink |
| ~21:10 | /trading-agent/brokers, /ai, /pricing, /status, /security | 200 | same | … — Satelink Trading AI |
| 21:08:04 | /products/rpc, /products/x402, /products/metering, /products/machine-commerce | 200 | same | product titles |
| 21:07:53 | /developers/api, /developers/quickstart, /developers/sdks | 200 | same | developer titles |
| 21:08:08 | /solutions/* (8 pages incl. /solutions/trading) | 200 | same | solution titles |
| 21:07:52 | /cookies, /data-processing, /sub-processors, /security, /responsible-disclosure | 200 | same | policy titles |
| 21:08:56 | https://rpc.satelink.network/ | 404 | same | Error |
| 21:08:56 | https://admin.satelink.network/ | 404 | same | text/plain |
| ~21:14 | https://satelink.network/network/operator-terms | 200 | same | (linked from Terms §11) |
| ~21:14 | https://registry.npmjs.org/satelink-mcp | **404** | n/a | package does not exist (it is named in every RPC 402 body) |
| ~21:14 | https://registry.npmjs.org/@satelink%2fsdk | 200 | n/a | v0.2.0, maintainer satelinknetwork@gmail.com |
| ~21:15 | https://satelink.network/og-image.png | 404 | n/a | referenced by status-page `og:image` |

**Homepage meta (21:06):** `lang="en"`; description "Reason, validate, score, authorize, execute, learn. AI proposes; … Paper trading in controlled beta. Live execution is not yet availa…"; canonical `https://satelink.network`; og:title, og:description and twitter:card are present; **no og:image**. JSON-LD has four blocks: Organization (email `satelinknetwork@gmail.com`, foundingDate `2025`), Product "Satelink Trading Intelligence" ($0.01/call, `InStock`, url /trading-agent/product), SoftwareApplication "Satelink RPC Gateway" ("Multi-chain … Polygon, Ethereum, Arbitrum, Base … No free RPC tier") and FAQPage.

**Security headers on satelink.network and docs.satelink.network (21:07 and 21:15):** only `strict-transport-security: max-age=63072000`. **No CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy or Permissions-Policy.** The console and jakuraa.com do send XFO DENY, nosniff, referrer-policy and permissions-policy. api.satelink.network sends the full helmet set, including CSP.

---

## 2. Answers to the audit questions

**Hero claim.**
- H1: "An AI trading operating system for people, AI agents and machines."
- Sub-line: "Paper trading in controlled beta. Live execution is not yet available."
- Primary CTA: "Request beta access".
- Source: `apps/web/src/app/(marketing)/page.tsx:91`, `:25`, `:99`.

**What a first-time buyer understands in 10 seconds.**
- They understand: an AI trading product that is not live, with a waitlist.
- They do not see that the company sells a metered RPC gateway, x402 payments and a Trading Intelligence data API. Those appear only in the 4th section ("Rails for software that pays software", `page.tsx:173`).

**Category clarity.** Poor. The site describes three overlapping offerings:
- (a) Satelink Trading AI: paper beta. `/trading-agent/status` says "Paper-trading preview: Not open" and "Public sign-up: Not open".
- (b) Trading Intelligence: a $0.01/call market-data API, which is the thing the plans and packs sell.
- (c) Machine commerce: RPC at $0.00003 per call plus x402.

Further confusion:
- `/products/trading-intelligence` redirects to the Trading AI product page (`apps/web/src/middleware.ts:43`, `packages/content/src/site.ts:25`, "standalone TI sale page removed").
- The docs index calls the only live paid product the "legacy Satelink RPC gateway".

**Explicit target buyer.**
- Homepage: "people, AI agents and machines". That names everyone.
- The beta form asks "I am a… Person / AI agent / Automated system" plus a capital band of up to "> $1M".
- The Terms say "intended for business and developer use".
- These three statements are not consistent with each other.

**Identifiable paid service.** Only after digging, and the answer differs by rail:
- Live and payable today: Polygon RPC via x402 ($0.10 = 1,000 calls) or USDT credits ($0.00003/call); Trading Intelligence via USDT/x402-funded credits.
- Not yet payable: card/UPI plans and packs. Every plan card and pack shows "Available soon".
- So the fiat (Dodo) rail currently sells nothing.

**Pricing and billing clarity vs the stated ground truth ($0.00003/call; x402 bundle $0.10 = 1,000 calls).**
- Consistent: `/pricing`, `/products/rpc`, `/products/x402`, the homepage JSON-LD, llms.txt, `.well-known/x402`, `.well-known/satelink.json` and the 402 body all state $0.00003 and $0.10/1,000.
- Inconsistent:
  - `/pricing` shows the x402 rail for RPC at "$0.00003 … credits or x402 / USDT", but x402 actually costs $0.0001/call (the `.well-known/x402` label says so).
  - `/pricing` says Trading Intelligence is paid with "credits or x402", but the live endpoint has no x402 challenge.
  - Yearly plans are displayed as "**$190/month** … Billed monthly" and "**$790/month**" (rendered and visible, confirmed in Playwright).
  - The docs say there is a "free tier: 500 calls/day per IP"; the live API returns 402 with `limit: 0`.
  - The Billing policy says "monthly call quota"; the pricing page says weekly allowances that reset on Monday.

**Documented endpoints and examples.**
- Yes, and they are extensive: `/developers/quickstart`, `/developers/api`, docs.satelink.network (API reference, quick start, machine customers) and machine-readable discovery.
- Defects:
  - Docs quick start step 1 promises a free JSON-RPC response that does not happen.
  - The x402 example ("maxAmountRequired": "0.01", scheme "x402") does not match the live challenge (scheme `exact`, amount `100000` = $0.10).
  - Supported chains are listed as Polygon, Ethereum, Arbitrum and Base, while llms.txt and the product pages say Polygon only.

**Can a developer go sign up → auth → call → pay → get a result?**
- **x402 path:** discover → 402 → pay $0.10 USDC on Base → call. This is plausible and documented. It was not executed here (paying is out of scope).
- **USDT path:** register via `POST /v1/machine/register` → deposit through RevenueVaultV2 → call with X-API-Key. Documented; not executed.
- **Card path:** console sign-up (Google or magic link) works up to the sign-in page, but there is nothing to buy ("Available soon").
- **The 402 body tells agents to use `satelink-mcp` from npm, which does not exist** (registry 404).

**Live metrics (uptime, volume, nodes, customers, performance, TX).**
- No live traffic, customer or node counts appear on the marketing pages.
- "1,878" does not appear anywhere (grep across all 155 crawled pages).
- `status.satelink.network` shows component states (RPC Gateway, Billing, Polygon) with "Last checked". The "Settlement Engine: DRY_RUN" row is hardcoded (`apps/web/src/app/status/page.tsx:38`). There is no uptime history.
- The docs say "uptime and latency are measured and published live", but no published uptime or latency figure was found.

**AI, blockchain, trading and automation descriptions vs reality.**
- Trading AI disclosure is mostly honest. Every Trading AI page carries "Paper trading in controlled beta. Live execution is not yet available.", a not-investment-advice block, an independence statement (Binance, Upstox and Alpaca are "not affiliated") and an AI disclosure.
- No returns or performance claims were found on satelink.network.
- Contradictions:
  - Homepage "Paper trading in controlled beta" vs the status page "Paper-trading preview: Not open".
  - Homepage step "Execute: … the order manager sends each one once, through your broker", with brokers listed as "In development … not available".
  - The brokers page says "The agent may send an order only after you approve it"; the AI page says the agent "Sends, changes or cancels an order: No, never".
  - `/trading-agent/pricing` shows the visible internal placeholder "RPrC — this section requires professional (legal) review before it is published. It is intentionally empty."
- Docs and settlement pages still describe "split 50% to node operators", while the docs index says "The node operator program is paused. Operator payouts are not active."

**Operator identity.**
- The footer shows "Jakuraa Commercial Pvt Ltd, 38/39 Malaviya Street, Ram Nagar, Coimbatore 641009". The Terms and Privacy policy name the entity.
- **No CIN, GSTIN or phone number anywhere on satelink.network.**
- The address format differs from the MCA-style address on jakuraa.com ("38, 39, First Floor, Malaviya Street, Ramnagar").
- The support and legal contact is a **Gmail address** (`satelinknetwork@gmail.com`). The status page instead says `support@satelink.network`, and jakuraa.com lists `developers@`, `sales@`, `trading@` and `security@satelink.network`.

**Terms, privacy, refund, AUP and support.**
- All of these pages exist and return 200.
- **Every policy carries the banner "Draft pending legal review… not yet approved by counsel."**
- Privacy says "(The named officer will be designated before this policy is published.)"
- Terms do not cover the headline product (Trading AI: mandates, broker connections, paper orders). They describe "derived analytics and metered RPC" only.
- Refund timelines are vague ("within a few business days"), and Contact says "We respond within 24 hours".

**SEO.**
- Good: titles, descriptions and canonicals on most pages; sitemap valid with 137 URLs all returning 200; robots sane; llms.txt present.
- Gaps:
  - No canonical on `/trading-agent/*`, `/contact` or the status page.
  - No `og:image` on 141 of 155 pages. The status page `og:image` 404s.
  - The status subdomain and every 404 page reuse the homepage title.
  - 16 hub pages have no `<h1>` (blog, news, changelog, academy hubs, support collections, contact-sales).
  - JSON-LD Product "Satelink Trading Intelligence" points to the Trading AI page and is marked `InStock`, although the card purchase is "Available soon".

**Security headers.**
- HSTS only, on the marketing and docs sites.
- The CSP exists only on `/checkout/*` (`apps/web/next.config.ts:101-139`).

**Accessibility.**
- `lang` is set. No `<img>` without alt was found. Headings are logical on content pages.
- Missing H1 on 16 hub pages (see SEO above).

**Can an underwriter understand the product and its economic purpose?**
- **Not reliably.**
- The homepage, meta description, `<title>`, llms.txt and Organization JSON-LD all lead with an unlaunched AI trading OS that names Binance and Upstox. That reads as a high-risk investment or crypto-trading MCC.
- The thing actually sold for money is a developer data/RPC API, paid mostly in stablecoins on-chain. The card/UPI rail Dodo would underwrite sells nothing today.
- Legal pages are self-declared drafts, the contact is Gmail, and there is no CIN or phone number.

---

## 3. Issues

Severity scale: Critical means it blocks underwriting or is materially misleading. High means a likely reviewer rejection or loss of buyer trust. Medium means clarity or consistency. Low means polish.

| ID | URL | Exact existing text / behavior | Evidence | Severity | Business impact | Payment-underwriting impact | Recommended change | Code change needed? (source file:line) | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|---|
| SL-01 | https://satelink.network/ (also `<title>`, meta description, llms.txt, Organization JSON-LD) | H1 "An AI trading operating system for people, AI agents and machines." / title "Satelink Trading AI — an AI trading operating system…" / CTA "Request beta access" | curl 21:06:56; homepage H2 order shows machine commerce only as section 4 | **Critical** | First-time buyers see a non-purchasable waitlist product; the live paid products are below the fold | Reviewer classifies the merchant as AI or crypto trading or investment software (high-risk MCC, Binance named) while the card rail sells a data API. The description in the payment application will not match the site | Lead the homepage (title, H1, meta, JSON-LD) with what is sold today (metered market-data and RPC API, pay per call). Present Trading AI as a clearly labelled "paper beta, not available" secondary section | Yes: `apps/web/src/app/(marketing)/page.tsx:20,25,65,91,99`; `apps/web/src/app/layout.tsx:78-84` (Org JSON-LD description); llms.txt generator | Homepage title and H1 name the paid product; Trading AI appears below it with the beta label; a reviewer can name the billable product within 10 s |
| SL-02 | https://satelink.network/pricing | Visible cards "Pro **$190** /month — Billed monthly. Cancel any time." and "Max **$790** /month — Billed monthly…" next to Pro $19 and Max $79 | Playwright `article[data-plan=pro_yearly|max_yearly]` visible=true, price "$190/month", note "Billed monthly" (21:13) | **Critical** | Duplicate tiers with 10x prices and wrong period; buyers cannot tell what they would pay | A price misstatement on the pricing page is a direct mismatch against checkout amounts (consumer-protection and MoR risk) | Render yearly plans as "/year, billed annually" or behind a monthly/yearly toggle; never show two "Pro" cards at once | Yes: `apps/web/src/components/PlanCards.tsx:19-22` (period label and "Billed monthly" hardcoded for all non-intro plans); catalog filter in `apps/web/src/app/(marketing)/pricing/page.tsx` | Exactly one card per plan per billing period; yearly shows "/year"; text matches the Dodo product interval |
| SL-03 | https://docs.satelink.network/quick-start (and /docs pricing, authentication, troubleshooting, glossary, machine-customers) | "Make your first metered RPC call in under two minutes — free tier, no account required… You get a normal JSON-RPC response. Free tier: **500 calls per day per IP**" | Live `POST rpc.satelink.network/rpc` returns **402**, `limit: 0`, `error_code: FREE_TIER_LIMIT_REACHED` (21:12-21:13); JSON-LD on the same site says "No free RPC tier" | **Critical** | Step 1 of onboarding fails; developers churn and see the docs as untrustworthy | Advertised free access that does not exist is a misrepresentation; contradicts the site's own JSON-LD | Remove every "500 calls/day" free-tier claim; describe the 402-first flow | Yes: `apps/web/src/content/docs/quick-start.md:12`, `pricing.md:8`, `authentication.md:6`, `troubleshooting.md:3`, `glossary.md:18`, `machine-customers.md:9`; also `apps/web/src/lib/docs.ts` pricing description ("Free tier limits…") | `grep -r "500 calls" apps/web/src/content` returns 0; quick-start step 1 matches the live 402 |
| SL-04 | 402 body of POST https://api.satelink.network/rpc/polygon | "Or see the satelink-mcp package (npmjs.com/package/satelink-mcp) to automate payment." plus an `mcp.npm_url` field | `registry.npmjs.org/satelink-mcp` → 404 (21:14) | **High** | Agents follow a dead instruction | Supply-chain risk: anyone can publish `satelink-mcp` and receive agent traffic told to "automate payment". A reviewer reading the API sees an unowned dependency | Remove the reference until the package is published under an org-owned scope, or publish it first | Yes: `apps/api/src/middleware/free_tier_gate.js:456`; `apps/api/src/workloads/rpc_gateway/rpc_gateway.js:39`; `apps/api/src/middleware/credit_gate.js:148` | 402 bodies reference no package that does not resolve on the npm registry |
| SL-05 | /terms, /privacy, /refund, /billing-policy, /acceptable-use, /cookies, /data-processing | Banner: "**Draft pending legal review.** This policy … is not yet approved by counsel." | Text in every crawled policy page (21:07-21:08) | **High** | Undermines trust at checkout | Payment processors require final, binding Terms, Refund and Privacy policies; a self-declared draft usually fails website review | Get counsel sign-off, then remove the banner and publish versioned final text | Yes: `apps/web/src/components/LegalView.tsx:29`; status flags in `apps/web/src/lib/legal.ts` | No "Draft" or "not yet approved by counsel" text on any policy page |
| SL-06 | /privacy | "contact the Grievance Officer at satelinknetwork@gmail.com. (The named officer will be designated before this policy is published.)" | Privacy §1 (21:08) | **High** | Visible internal note | DPDP Act and IT Rules expect a named grievance or contact officer; Indian PA/PG reviews check this | Name the Grievance Officer (name, designation, email, address) and remove the parenthetical | Yes: `apps/web/src/lib/legal.ts:114` (and `:105`) | Privacy names a person; no "will be designated" text |
| SL-07 | /contact, /refund, /billing-policy, /terms, /privacy, footer JSON-LD | "Support email satelinknetwork@gmail.com"; no phone number; status page says "support@satelink.network" | Contact page (21:07:49); status page render (21:13); `dig MX satelink.network` → Cloudflare routing exists | **High** | Free-mail support signals low legitimacy; three different support addresses across properties | Merchant-verification checklists expect a domain email and a phone number matching the application | Use one domain mailbox (e.g. support@satelink.network) everywhere; add a business phone number | Yes: `apps/web/src/lib/legal.ts:10` (`LEGAL_CONTACT`); `apps/web/src/app/(marketing)/contact/page.tsx:30-31`; `apps/web/src/app/layout.tsx:82`; `apps/web/src/app/docs/layout.tsx:70`; `apps/web/src/app/(marketing)/corporate/EnquiryForm.tsx:117`; `apps/web/src/app/status/page.tsx:73-76` | One support email on all Satelink pages and the status page; phone number shown on Contact |
| SL-08 | /contact, footer (all pages) | "Jakuraa Commercial Pvt Ltd, 38/39 Malaviya Street, Ram Nagar, Coimbatore 641009" — no CIN or GSTIN | grep "U52190" across 100+ satelink pages = 0 hits | **High** | Buyers cannot verify the operator | The merchant site should show legal name, CIN and registered address exactly as on MCA (jakuraa.com shows "38, 39, First Floor, Malaviya Street, Ramnagar") | Show CIN and GSTIN on Contact and in the footer; use the MCA address string; link to jakuraa.com/legal/company-information | Yes: `packages/content/src/site.ts:6-11` (`LEGAL_ENTITY`); `apps/web/src/app/(marketing)/contact/page.tsx:38` | CIN appears on /contact and in the footer; address is byte-identical to jakuraa.com |
| SL-09 | /terms | "We sell derived analytics and metered RPC — priced per call." §2 lists (a) Trading Intelligence (b) RPC (c) payment rails only | Terms text (21:08:16) | **High** | The headline product (Trading AI: mandates, broker links, paper orders, beta form collecting capital band) is not governed by the ToS | A reviewer sees a product with no applicable terms; `/trading-agent/pricing` admits the Trading AI terms are "intentionally empty" | Add Trading AI beta terms (or explicitly exclude it until launch) after legal review | Yes: `apps/web/src/lib/legal.ts:46-60`; `apps/web/src/components/trading-agent/Parts.tsx:46-51` | ToS references Trading AI and its beta status; no empty terms section |
| SL-10 | https://satelink.network/trading-agent/pricing | "RPrC — this section requires professional (legal) review before it is published. It is intentionally empty." | Page text (21:10) | **High** | Visible internal placeholder | Looks unfinished or unreviewed to a reviewer | Hide the section until reviewed text exists | Yes: `apps/web/src/components/trading-agent/Parts.tsx:51`; `apps/web/src/lib/trading-agent/copy.ts:4` | No "RPrC" or "intentionally empty" text on any public page |
| SL-11 | / vs /trading-agent/status | Homepage: "Paper trading in controlled beta… Join the paper-trading beta." Status page: "Paper-trading preview — **Not open**", "Public sign-up — Not open" | Both pages (21:06, 21:10) | **High** | Contradictory availability claims | An unclear product-availability state is a classic underwriting query | Use one source of truth: if the preview is not open, say "waitlist" on the homepage | Yes: `apps/web/src/app/(marketing)/page.tsx:20,25`; `apps/web/src/lib/trading-agent/status.ts:31-35`; `apps/web/src/lib/trading-agent/copy.ts:22,41` | Homepage availability text derives from `PLATFORM.paperPreviewOpen` |
| SL-12 | /pricing | Pricing table: "Polygon RPC $0.00003 — credits or x402 / USDT"; Trading Intelligence rows "$0.01 — credits or x402" | `.well-known/x402`: x402 bundle = `$0.0001 per call`; TI endpoint 402 has no x402 challenge ("Provide an API key… funded with credits") | Medium | Buyers paying via x402 pay about 3.3x the advertised per-call rate | Price shown must equal the price charged per rail | Split the rows: "USDT credits $0.00003 / call; x402 bundle $0.10 per 1,000 ($0.0001 / call)"; TI: "credits (funded by USDT or an x402 bundle)" | Yes: `apps/web/src/lib/plans.ts:96-100` | Each row's price matches `.well-known/x402` for that rail |
| SL-13 | /pricing (all plan and pack cards) | Every plan except Free, and every credit pack, shows "Available soon"; FAQ explains Dodo/UPI checkout | Page render (21:13) | Medium | No card/UPI purchase is possible | The underwriter is asked to approve a rail with no live SKU; JSON-LD says `InStock` | State "Card/UPI checkout opens on <date>"; set JSON-LD availability to `PreOrder` or remove it | Yes: `apps/web/src/app/layout.tsx:91-107`; `apps/web/src/components/PlanCards.tsx:29-35` | JSON-LD availability matches purchasability |
| SL-14 | /billing-policy | "The free tier … subject to a **monthly** call quota"; "Included **monthly** call allowances reset at the start of each period" | Pricing FAQ: "weekly allowance (resets every Monday)" | Medium | Contradictory allowance terms | Policy vs pricing mismatch | Align the policy with weekly UU allowances | Yes: `apps/web/src/lib/legal.ts:206,212` | Policy wording matches the pricing FAQ |
| SL-15 | /terms §1 vs console sign-in | Terms: "You may sign in with email and password, or with Google." Console: "We'll email you a sign-in link — no password." | Console HTML (21:07) | Low | Minor inaccuracy | Policy vs product mismatch | Say "email link or Google" | Yes: `apps/web/src/lib/legal.ts:56` | Terms match the console auth methods |
| SL-16 | /refund, /contact | Refund: "We aim to acknowledge within a few business days"; Contact: "We respond within 24 hours." No refund-processing day count | Page text | Medium | Vague SLA | Indian e-commerce rules and PG checklists expect explicit refund timelines (e.g. "processed within 5–7 business days") | Give concrete acknowledgement and refund-processing timelines, consistent across pages | Yes: `apps/web/src/lib/legal.ts` (refund sections 4, 5, 13); `apps/web/src/app/(marketing)/contact/page.tsx:44` | A numeric timeline appears on the Refund page and matches Contact |
| SL-17 | /trading-agent/brokers vs /trading-agent/ai | Brokers: "The agent may send an order only after you approve it". AI page: "Sends, changes or cancels an order — **No, never**" | Page text (21:10) | Medium | Self-contradictory safety claims on a trading product | Inconsistent risk disclosures attract compliance questions | Use "the system (not the AI) may send an order after you approve it" consistently | Yes: `apps/web/src/lib/trading-agent/status.ts:40`; `apps/web/src/lib/trading-agent/copy.ts:62` | No page attributes order sending to "the agent" |
| SL-18 | /contact-sales?interest=beta | Form fields "Capital band (optional): < $10k … $250k–$1M, > $1M", "Broker (optional)" | Form render (21:07:51) | Medium | Collects investment-capital data for an unlaunched service | Investor-capital collection by a non-registered entity can read as investment-advisory or PMS solicitation (SEBI). Not covered by the Privacy data-category table | Drop the capital band or explain its purpose; add it to the Privacy data categories | Yes: `apps/web/src/app/(marketing)/contact-sales/BetaRequestForm.tsx:73` | Field removed, or justified in Privacy |
| SL-19 | https://docs.satelink.network/ and /docs/revenue-model, /platform/settlement, /news/revenue-vault-v2-live | Index: "The node operator program is paused. Operator payouts are not active." vs settlement page: "split 50% to node operators, 30% to the platform, 20% to the distribution pool." Docs index calls RPC "the **legacy** Satelink RPC gateway" | Page text | Medium | Confusing economics; "legacy" undercuts the only live paid product | Revenue-share or payout promises to third parties prompt questions (marketplace or payout licensing) | Mark the 50/30/20 split as paused or historical everywhere; drop the word "legacy" | Yes: `apps/web/src/app/docs/page.tsx`; `apps/web/src/content/docs/revenue-model.md`; `apps/web/src/lib/platform.ts` (settlement copy) | Every page mentioning node revenue says "paused" |
| SL-20 | /developers/quickstart, academy tutorial | Example 402: `{ "accepts": [{ "scheme": "x402", "network": "eip155:8453", "maxAmountRequired": "0.01", "asset": "USDC" }] }` (labelled "Illustrative") | Live challenge: `scheme: "exact"`, `amount: "100000"` ($0.10), USDC contract 0x8335… | Low | Developers copy a wrong price and shape | Minor | Paste a real redacted 402 | Yes: `apps/web/src/app/(marketing)/developers/quickstart/page.tsx:54`; `apps/web/src/lib/products.ts:217`; `apps/web/src/lib/academy.ts:72` | Example equals the live challenge fields |
| SL-21 | Homepage JSON-LD SoftwareApplication; docs "Supported chains" | "Multi-chain JSON-RPC gateway (Polygon, Ethereum, Arbitrum, Base)" vs llms.txt and /products/rpc "on Polygon PoS"; x402 resource is only `/rpc/polygon` | Pages and `.well-known/x402` | Medium | Scope ambiguity | Product description mismatch | State the chains that are live and payable; label the others | Yes: `apps/web/src/app/layout.tsx:121`; `apps/web/src/content/docs/quick-start.md` (chains table) | One chain list across JSON-LD, docs and llms.txt |
| SL-22 | satelink.network, docs.satelink.network (all routes except /checkout) | Response headers: only `strict-transport-security` | `curl -I` 21:15 | Medium | Clickjacking and MIME-sniffing exposure; weak posture | Security scanners used by PGs flag missing XFO, nosniff and CSP | Add global XFO/frame-ancestors, nosniff, Referrer-Policy and Permissions-Policy; then a site-wide CSP (report-only first) | Yes: `apps/web/next.config.ts:101-139` | `curl -I https://satelink.network/` shows XFO (or CSP frame-ancestors), nosniff, referrer-policy and permissions-policy |
| SL-23 | https://status.satelink.network/ | Title "Satelink Trading AI — AI trading operating system…"; `og:url` = https://satelink.network; `og:image` /og-image.png → 404; favicons 404; "Settlement Engine DRY_RUN" hardcoded; no history | Playwright render 21:13 + console errors | Medium | Status page looks like a homepage clone; no uptime evidence | Reviewers look for an operational status history | Give it its own title, canonical and favicon; add an incident or uptime history, or present it as a "health check" only | Yes: `apps/web/src/app/status/page.tsx:38,73`; `apps/web/src/app/status/layout.tsx` | Unique title; no 404 assets; data is either live or clearly labelled static |
| SL-24 | https://app.satelink.network/ | TLS certificate expired 18 Jul 2026; with `-k` → 404. `vercel.json` still has a redirect for this host | `openssl s_client` notAfter=Jul 18 2026; no crawled page links to it (grep 0 hits) | Low | Old links and bookmarks show a browser security error | Expired TLS on a company subdomain is a scanner finding | Remove the DNS record or re-attach a valid cert with a 301 to satelink.network | Yes: `apps/web/vercel.json:24-33`; `apps/web/README.md:7` still says "Production: https://app.satelink.network" | `curl https://app.satelink.network` → valid TLS and a 301, or NXDOMAIN |
| SL-25 | 141 of 155 pages | No `og:image`; homepage has none | Meta scan | Low | Poor social and preview cards | None | Add a default OG image in root metadata | Yes: `apps/web/src/app/layout.tsx` (openGraph.images) | Homepage `og:image` resolves 200 |
| SL-26 | /trading-agent/*, /contact, status | No `<link rel="canonical">` | Meta scan | Low | Minor duplicate-content risk | None | Add canonicals | Yes: `apps/web/src/app/(marketing)/trading-agent/*/page.tsx` metadata; `contact/page.tsx` | Canonical present on every indexable page |
| SL-27 | /blog, /news, /changelog, /academy/*, /support/* collections, /contact-sales, /corporate | No `<h1>` | Heading scan (16 pages) | Low | Accessibility and SEO | None | Add one H1 per page | Yes: respective `apps/web/src/app/(marketing)/**/page.tsx` | Every page has exactly one H1 |
| SL-28 | Any 404 (e.g. /about, /legal, /.well-known/security.txt) | 404 page title = homepage Trading AI title; no `/about`, no `security.txt` | curl 21:08:53-21:08:59 | Low | /about and /legal are common reviewer guesses | Reviewers often try /about, /legal and security.txt | Redirect /about → jakuraa.com/company and /legal → /terms; publish `/.well-known/security.txt`; give the 404 a "Page not found" title | Yes: `apps/web/src/middleware.ts` redirect map; `apps/web/public/.well-known/security.txt` (new) | /about and /legal resolve; security.txt 200 |
| SL-29 | JSON-LD Organization | `foundingDate: "2025"` | jakuraa.com says Satelink "Began building … 2026"; Jakuraa research pages date Satelink specs to 2023 | Low | Inconsistent history | Date inconsistencies reduce credibility in due diligence | Use one founding date for Satelink across both sites | Yes: `apps/web/src/app/layout.tsx:83` | Same year on both sites |

### Positive findings (keep)
- Trading AI pages consistently disclose "Paper trading in controlled beta. Live execution is not yet available." They also include not-investment-advice, independence (Binance, Upstox, Alpaca not affiliated) and AI-model disclosure blocks. No returns, win-rate or performance claims were found.
- There is no "1,878 TX" or other fabricated live metric on any crawled page.
- Machine-readable pricing discovery (`.well-known/x402`, `.well-known/satelink.json`, the 402 body) is internally consistent on $0.00003 per call and $0.10 per 1,000.
- The pricing page clearly explains the fiat/crypto rail boundary (Dodo only funds Trading Intelligence).
- The sitemap is complete (137 URLs, all 200). No crawled page links to the dead app.satelink.network.
