# Website Audit: jakuraa.com (company site, operator of Satelink)

- **Audit date:** 2026-10-15, 21:06 to 21:20 IST
- **Mode:** read-only. The enquiry form (`POST /api/enquiry`) was **not** submitted. Only an unauthenticated `GET` was sent, which returned 405.
- **Method:** `curl -sSL -D-` on the homepage, every nav and footer link, and all 25 sitemap URLs. Text was extracted and compared with satelink.network. Every finding was then grepped back to `apps/corporate`.
- **Access limitations:**
  - MCA records, GST portal entries and DGFT/Udyam registries were **not** queried. The CIN, GSTIN, IEC and Udyam values below are only what the site publishes; they were not verified against government records.
  - The YouTube embed was not played.
  - Whether the many listed `@jakuraa.com` and `@satelink.network` mailboxes accept mail was not tested. MX records exist (Cloudflare Email Routing) for both domains.

---

## 1. Inspection log

| Time (IST) | URL | Status | Final URL | `<title>` |
|---|---|---|---|---|
| 21:06:57 | https://jakuraa.com/ | 200 | same | Jakuraa - a technology and trading company, established 2019 |
| 21:07:06 | https://www.jakuraa.com/ | 200 | https://jakuraa.com/ | (same) |
| 21:08:22 | /businesses | 200 | same | Businesses - Jakuraa |
| 21:08:23 | /businesses/industrial-manufacturing | 200 | same | Industrial Manufacturing - Jakuraa |
| 21:08:25 | /businesses/trading-distribution | 200 | same | Trading & Distribution - Jakuraa |
| ~21:11 | /businesses/technology, /international-trade, /publishing-insights | 200 | same | (sitemap entries) |
| 21:08:26 | /careers | 200 | same | Careers & Engineering Disciplines \| Jakuraa & Satelink - Jakuraa |
| 21:08:27 | /company | 200 | same | Company - Jakuraa |
| 21:08:28 | /company/leadership | 200 | same | Founder & Leadership \| Jakuraa **- Jakuraa** |
| 21:08:29 | /contact | 200 | same | Contact & Institutional Enquiries \| Jakuraa & Satelink - Jakuraa |
| 21:08:30 | /history | 200 | same | Company History & Institutional Archive (2019 - 2026) \| Jakuraa - Jakuraa |
| 21:08:31 | /legal/company-information | 200 | same | Company information - Jakuraa |
| 21:08:32 | /legal/grievance | 200 | same | Grievance officer - Jakuraa |
| 21:08:32 | /legal/privacy | 200 | same | Privacy - Jakuraa |
| 21:08:33 | /legal/terms | 200 | same | Terms of use - Jakuraa |
| ~21:11 | /legal | 200 | same | (sitemap entry) |
| 21:08:34 | /media-kit | 200 | same | Media Kit & Institutional Resources \| Jakuraa - Jakuraa |
| 21:08:35 | /news | 200 | same | Newsroom & Dispatches \| Jakuraa - Jakuraa |
| ~21:11 | /news/satelink-x402-machine-payments, /news/revenue-vault-v2 | 200 | same | (news posts) |
| 21:08:36 | /products | 200 | same | Products - Jakuraa |
| 21:08:37 | /research | 200 | same | Research & Protocol Specifications \| Jakuraa - Jakuraa |
| 21:08:40 | /systems, /technology | 200 | same | Systems & Architecture … / Technology - Jakuraa |
| 21:08:39 | /sitemap.xml | 200 | same | 25 URLs, **all 200** |
| 21:09:02 | /robots.txt | 200 | same | `Allow: /`, sitemap declared |
| 21:09:03 | /about | 200 | /company | Company - Jakuraa |
| 21:09:04 | /privacy, /terms | **404** | same | homepage title on the 404 page |
| 21:09:03 | /llms.txt, /.well-known/security.txt | 404 | same | homepage title |
| ~21:16 | /api/enquiry (GET only) | 405 | same | endpoint exists; form not submitted |
| Outbound links to satelink.network (21:08:49-21:08:51) | /developers, /docs, /pricing, /platform/*, /solutions/*, /trading-agent | 200 | same | ok |
| Outbound | https://satelink.network/products/trading-intelligence ("Trading Intelligence" in footer) | 200 | **/trading-agent/product** (Trading AI page) | Product — Satelink Trading AI |
| Outbound | https://status.satelink.network | 200 | same | Satelink Trading AI title (see Satelink audit SL-23) |

**Homepage meta:**
- `lang="en-IN"`.
- Description: "Jakuraa Commercial Private Limited is a Coimbatore-based company established in 2019. It operates Satelink, machine-commerce infrastructure, and holds registrations for trading, international trade an…"
- `robots: index, follow`. **No canonical on any page.** og:title "Jakuraa"; twitter:card summary; **no og:image**.
- JSON-LD Organization: `legalName` Jakuraa Commercial Private Limited, `alternateName` Falcor Commercial Private Limited, `email` hello@jakuraa.com, `foundingDate` 2019-12-04, `taxID` 33AADCF9341B1Z1, CIN U52190TZ2019PTC033093, address "38, 39, First Floor, Malaviya Street, Ramnagar, Coimbatore 641009", `subOrganization` Satelink.

**Security headers:** HSTS (max-age=63072000), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy camera/mic/geo off. **No CSP.**

**Accessibility:** one H1 per page, every image has alt text, `lang` is set. There is a skip-to-content link.

---

## 2. Answers to the audit questions

**Legal identity consistency (Jakuraa ↔ Satelink ↔ a payment application).**

| Field | jakuraa.com | satelink.network | Consistent? |
|---|---|---|---|
| Legal name | Jakuraa Commercial **Private Limited** (former name Falcor Commercial Private Limited) | Jakuraa Commercial **Pvt Ltd** | Acceptable abbreviation. A payment application should use the full MCA name |
| CIN | U52190TZ2019PTC033093 (home, footer, company-information, contact) | **absent** | No |
| GSTIN / IEC / Udyam | 33AADCF9341B1Z1 / AADCF9341B / UDYAM-TN-03-0082507 | absent | No |
| Registered address | "38, 39, First Floor, Malaviya Street, Ramnagar, Coimbatore, Tamil Nadu 641009" | "38/39 Malaviya Street, Ram Nagar, Coimbatore 641009" | **No** (format and "First Floor" differ) |
| Primary email | hello@jakuraa.com (JSON-LD, company info, grievance); contact@jakuraa.com (contact page, footer mailto) | satelinknetwork@gmail.com (legal pages); support@satelink.network (status page) | **No.** Four different "primary" addresses |
| Phone | none (`phone: null`, "Founder to supply") | none | Missing on both |
| Grievance officer | "Grievance Officer - hello@jakuraa.com" (no name) | "Grievance Officer at satelinknetwork@gmail.com (named officer will be designated…)" | **No.** Different emails, no name on either site |
| Founder / director | "Pradeep Jakuraa, Founder, Systems Architect & Managing Director"; board lists "Ramasamy Balasubramanian Pradeep, Director" and "Sivakumar Kuzhandaivelu, Director" | not shown | Name mismatch needs an explanation (see JK-07) |
| Satelink start date | "2026: Began building Satelink" (/company) | JSON-LD `foundingDate: 2025` | No |

**Note on the CIN.** The activity segment in the CIN (`52190`) is a trade/retail classification. The business described today is software and an AI/fintech-adjacent product. An underwriter will likely ask for the MoA object clause covering software and IT services. The site cites "MoA 3(a)" only for Trading & Distribution.

**Contact and legal information.**
- Company information is good and follows Companies Act s.12 and Rule 26: CIN, registered office, GSTIN, IEC, Udyam and the former name are all present.
- Contact lists 11 departmental addresses: 6 at jakuraa.com and 5 at satelink.network, plus the status page.
- Gaps:
  - There is no telephone number.
  - The grievance officer is unnamed.
  - `/privacy` and `/terms` 404; the real pages are under `/legal/*`.
  - Terms of use are site-only. They correctly defer Satelink use to satelink.network terms, which are themselves drafts.

**The Jakuraa ↔ Satelink relationship.**
- It is clearly stated: "Jakuraa … builds Satelink", `subOrganization` in JSON-LD, the products page and footer links. This is good.
- But Jakuraa's own H1 is now "**We build the AI that trades within your rules.**" and its title is "a technology and **trading** company". "Trading" (commodities/distribution, per the MoA) and "AI that trades" (securities/crypto) are blurred together. For a payment application this ambiguity is the main problem.

**Unsupported or contradictory claims.** Detailed in the issues table below:
- Sub-second (<400 ms) settlement; "Mainnet Operational"; "reconcile on-chain with cryptographic certainty" (settlement is in DRY_RUN and deposits need about 25 confirmations).
- "Header returned with cryptographically signed price quote" (the x402 challenge is not server-signed).
- x402 and RevenueVaultV2 papers dated **Nov/Dec 2023** with status "Live standard". x402 is an external open standard, and RevenueVaultV2 went live on 5 July 2026 according to Jakuraa's own news page.
- "Sub-50ms endpoint response", "Verifiable oracle feeds", "Claude & Anthropic MCP compatible" (no MCP server is published), "Zero external SDK dependency".
- "the premier machine-to-machine payment and settlement protocol".
- trading@satelink.network for "algorithmic execution".
- A static "Network Status: Operational" badge.
- A third-party YouTube video labelled "Verified Analysis" and titled "The $5 Trillion M2M Economy…".

**Broken pages.**
- No broken internal links were found in the sitemap or nav.
- `/privacy`, `/terms`, `/llms.txt` and `/.well-known/security.txt` return 404 (only the first two matter to reviewers).
- The footer link labelled "Trading Intelligence" lands on the Trading AI page.

**How Trading AI is disclosed.**
- It is not concealed. It is in the homepage H1, the hero paragraph, the "Primary application direction" section, the products page and footer links.
- The status line "Paper trading in controlled beta. Live execution is not yet available." appears in the hero and in the capability status block ("CONTROLLED BETA (PAPER)").
- Gaps:
  - Jakuraa does **not** repeat the not-investment-advice, risk-of-loss or broker-independence disclosures that satelink.network carries.
  - It also describes "Authorised Execution: Orders … go to your broker exactly once", which is not available today.
  - The H1 overclaims compared with the beta status.
- No returns, win-rate, P&L or performance claims were found.

**Credibility for due diligence.**
- Strengths: full statutory disclosures, an honest-sounding principles page ("Say only what is true"), a detailed history including divested ventures, and named directors.
- Weaknesses:
  - Backdated research papers (2023).
  - Infrastructure performance numbers with no evidence.
  - Static "Operational" badges.
  - A founder-name mismatch.
  - An unnamed grievance officer and no phone number.
  - History that includes crypto mining (2019) and unrelated restaurant and supermarket ventures without saying which legal entity ran them (the restaurant says "under the Falcor entity"; the supermarket entity is unclear).

---

## 3. Issues

| ID | URL | Exact existing text / behavior | Evidence | Severity | Business impact | Payment-underwriting impact | Recommended change | Code change needed? (source file:line) | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|---|
| JK-01 | https://jakuraa.com/ (H1 + title) | H1 "We build the AI that trades within your rules." Title "Jakuraa - a technology and trading company, established 2019" | curl 21:06:57 | **Critical** | The company reads as an AI trading firm, and the MoA trading business and AI trading are conflated | The reviewer cannot tell whether "trading" means goods distribution (MoA, GST) or securities/crypto trading (high-risk, possibly SEBI-regulated). This conflicts with whatever business description goes on the PG/MoR application | Lead with the registered, operating activity (software / machine-commerce APIs). Describe Satelink Trading AI as "paper beta, not available"; replace "trading company" with "technology and goods-distribution company" or similar | Yes: `apps/corporate/app/page.tsx:87,93`; `apps/corporate/app/layout.tsx:17,21-22` | Title and H1 do not use "trades" or "trading" ambiguously; the business description matches the payment application text |
| JK-02 | https://jakuraa.com/ (hero diagram) | "SETTLEMENT LATENCY **Sub-second (< 400ms)**", "TRANSACTION OVERHEAD **< $0.0001 per call**", "x402-v1 / RevenueVaultV2 **Mainnet Operational**"; "Permissionless USDT deposits … for **sub-second micro-settlement**"; "Sub-second, sub-cent transaction settlement" | Satelink docs: USDT credits appear "after ~25 block confirmations (about 5 minutes)"; status page "Settlement Engine: DRY_RUN"; x402 bundle effective cost $0.0001/call (not "<") | **High** | Unsupported performance claims | Specific performance numbers without evidence are a misrepresentation red flag in diligence | Remove the numbers, or cite measured values with method and date; drop "sub-second" for the USDT vault | Yes: `apps/corporate/app/page.tsx:146,227,231,283,825` | No latency or cost figure without a linked measurement |
| JK-03 | https://jakuraa.com/ ("Receive" stage, Step 04) | "The payment and the usage record **reconcile on-chain with cryptographic certainty**." / "Workload dispatched; cryptographic receipt reconciled on-chain." | Satelink status: Settlement Engine **DRY_RUN** (`apps/web/src/app/status/page.tsx:38`); settlement is not broadcasting | **High** | Claims a capability that is switched off | Overstates the money flow; the reviewer may believe on-chain revenue settlement is live | Say "payments settle on-chain (x402 on Base, USDT deposits on Polygon); usage reconciliation is off-chain today" | Yes: `apps/corporate/app/page.tsx:34` and the Step 04 copy near `:180-200` | Copy matches the dry-run state |
| JK-04 | https://jakuraa.com/ (Step 02) | "Header returned with **cryptographically signed price quote**." | The live 402 challenge (api.satelink.network, 21:12) contains unsigned JSON `accepts[]`; the payer signs, not Satelink | Medium | Technical overclaim | Minor | "Returns machine-readable payment requirements" | Yes: `apps/corporate/app/page.tsx:180` | Wording matches the x402 protocol |
| JK-05 | https://jakuraa.com/research, homepage "Technical foundations" | "Protocol · **15 November 2023** · x402: A Standard for Machine-to-Machine Payments … Status: **Live standard**"; "Smart Contracts · **1 December 2023** · RevenueVaultV2 … Status: Live standard" | Jakuraa's own /news: RevenueVaultV2 went live **5 July 2026**; /company: Satelink "2026 Began building"; x402 is an externally authored open standard | **High** | Backdated or misattributed research damages credibility | Due-diligence reviewers check dates; implying authorship of x402 is a misrepresentation | Re-date the papers to their real publication dates; label x402 as "Satelink's implementation of the x402 standard" | Yes: `apps/corporate/content/research.ts:22,31`; `apps/corporate/app/research/page.tsx:103` | No pre-2026 dates on Satelink artefacts; x402 attribution is explicit |
| JK-06 | https://jakuraa.com/ (Connectivity layer) | "Claude & Anthropic MCP compatible", "**Sub-50ms endpoint response**", "Verifiable oracle feeds", "Zero external SDK dependency", "allowing LLM agents to … query orderbooks, and trigger payments securely" | Satelink homepage: MCP "Not public yet"; `satelink-mcp` not on npm (404); no oracle product exists; homepage itself notes no SLA | **High** | Claims products that do not exist | Unsupported product claims = misrepresentation | Remove these, or label them "planned" | Yes: `apps/corporate/app/page.tsx:605,622,639,656` | Every capability badge is either live and verifiable or labelled planned |
| JK-07 | /company/leadership, /history, /media-kit | Founder shown as "**Pradeep Jakuraa** — Founder, Systems Architect & Managing Director"; Board: "**Ramasamy Balasubramanian Pradeep** — Director" | Page text (21:08:28) | **High** | Looks like two different people, or an alias | KYC: the director/UBO name on the application must match MCA. An unexplained alias causes rejection or delay | State "Pradeep Jakuraa (legal name: Ramasamy Balasubramanian Pradeep, DIN …)"; check that "Managing Director" matches the MCA designation | Yes: `apps/corporate/app/history/page.tsx:51,58,81`; `apps/corporate/app/media-kit/page.tsx:268`; `apps/corporate/content/people.ts:22` | One legal name, with an alias note if needed; designation matches MCA |
| JK-08 | /legal/grievance, /legal/company-information | "Grievance Officer - hello@jakuraa.com" (designation only, no name) | Page text; source comment "founder to supply the named officer" | **High** | Incomplete statutory disclosure | IT (Intermediary) Rules and the Consumer Protection (E-Commerce) Rules 2020 require a named grievance officer with contact details; Indian PG reviews check this | Name the officer and add a phone number and a response timeline (acknowledge within 48 h, resolve within 30 days or as applicable) | Yes: `apps/corporate/content/company.ts` (`grievanceOfficer.name: null`, `phone: null`, about lines 30-37) | Named officer, phone number and timelines rendered |
| JK-09 | Site-wide (contact, footer, JSON-LD) vs satelink.network | jakuraa: hello@jakuraa.com (JSON-LD, grievance), contact@jakuraa.com (contact, footer); satelink: satelinknetwork@gmail.com; status: support@satelink.network | Page text, JSON-LD | Medium | Scattered contact points | Inconsistent merchant contact across the operator's sites | Pick one company email and one Satelink support email and use them on both sites | Yes: `apps/corporate/content/company.ts:29,37`; `apps/corporate/app/contact/page.tsx`; (Satelink side: see SL-07) | One email per role on both sites |
| JK-10 | Site-wide vs satelink.network | Registered office "38, 39, First Floor, Malaviya Street, Ramnagar, Coimbatore 641009" vs Satelink "38/39 Malaviya Street, Ram Nagar, Coimbatore 641009" | Page text | Medium | Minor inconsistency | Address string should match MCA and GST exactly on both sites | Use the MCA string in the shared `LEGAL_ENTITY` constant | Yes: `packages/content/src/site.ts:8-9` (shared) | Identical address on both sites |
| JK-11 | /contact | "AI Trading Systems — trading@satelink.network — Orderbook microstructure feeds, quantitative models, and **algorithmic execution**."; "Security & Vulnerability — **PGP-encrypted** responsible disclosure" | Page text (21:08:29); no PGP key published; Satelink brokers page "not available" | Medium | Overclaims trading execution and a PGP channel | "Algorithmic execution" signals a live trading service | Describe it as "Satelink Trading AI paper beta enquiries"; publish a PGP key or drop "PGP-encrypted" | Yes: `apps/corporate/app/contact/page.tsx:42,59` | Contact copy matches product status; any PGP claim has a key link |
| JK-12 | Footer (all pages) | "Network Status: Operational ↗" (static) | Hardcoded string | Medium | Static "operational" badge is not live data | Fabricated live-status signal | Remove it, or fetch real status | Yes: `apps/corporate/components/layout/FooterWrap.tsx:99` | Badge removed or data-driven |
| JK-13 | Homepage video block | "Source: ScaleUp Sage · **Verified Analysis** · The $5 Trillion M2M Economy AI Agents Are Building Right Now" | Third-party YouTube embed | Medium | "Verified" implies Jakuraa endorsement or validation of a third-party market-size claim | Unsupported market-size claim on the merchant site | Remove "Verified Analysis"; label it "Third-party video, views are the creator's own" | Yes: `apps/corporate/components/ConversationVideo.tsx:66`; `apps/corporate/app/page.tsx:839` | No "Verified" label on third-party content |
| JK-14 | Homepage "Primary application direction" and products | "03 / EXECUTION RAILS — Authorised Execution: Orders pass a fixed risk engine and your signed mandate, then go to your broker exactly once"; no not-investment-advice or risk-of-loss text on jakuraa.com | Text scan: no "investment advice" string on jakuraa.com | **High** | Trading AI is described as executing, with none of the satelink.network safeguards text | Trading claims without risk disclosure on the operator's site are a compliance flag | Add the same "Not investment advice / can lose money / not affiliated with brokers / paper only" block wherever Trading AI is described | Yes: `apps/corporate/app/page.tsx:378-475`; `apps/corporate/app/products/page.tsx:13-53` | Disclosure block present on every jakuraa.com page mentioning Trading AI |
| JK-15 | /history | "Explore how seven years of operational learning culminated in **the premier** machine-to-machine payment and settlement protocol"; "Jakuraa commenced operations in **early 2019**" (incorporation 4 Dec 2019) | Page text | Medium | Superlative; operations predate incorporation | Reviewers notice date mismatches | Remove "premier"; say pre-incorporation activity was by the founder personally | Yes: `apps/corporate/content/history.ts:50`; `apps/corporate/app/history/page.tsx:294` (and `:342` area) | No superlatives; dates reconcile with incorporation |
| JK-16 | /history, /company, /media-kit | Crypto GPU mining (2019), "Hotel Delhi Darbarr" restaurant (2021-22, "under the Falcor entity"), "Wholesale Syndicate supermarket" (3,000+ SKUs) | Page text | Medium | Honest history, but entity attribution is unclear | PGs ask whether the merchant entity ran crypto mining, a restaurant or a supermarket (possible MCC or tax questions) | For each venture state the legal entity that ran it and its status (ceased or divested) | Yes: `apps/corporate/content/history.ts` | Each venture shows entity and status |
| JK-17 | Footer "Trading Intelligence" link | Goes to `satelink.network/products/trading-intelligence`, which redirects to `/trading-agent/product` ("Satelink Trading AI") | curl 21:08:50 | Low | Link label does not match the destination | Reinforces the product confusion | Point it at the TI catalog (`/products/trading-intelligence/funding-rate-heatmap` or /pricing) or rename it | Yes: corporate footer link list (`apps/corporate/components/layout/FooterWrap.tsx`) | Label matches the destination page |
| JK-18 | All pages | No `<link rel="canonical">`; no `og:image` | Meta scan of 25 pages | Low | SEO and social preview | None | Add `alternates.canonical` per page and a default OG image | Yes: `apps/corporate/app/layout.tsx:14-30` | Canonical and OG image on every page |
| JK-19 | /company/leadership, /history, /research, /news, /media-kit, /careers, /contact | Titles end "\| Jakuraa - Jakuraa" (double brand) | Titles in the inspection log | Low | Sloppy SERP titles | None | Drop "\| Jakuraa" from page titles (the template already appends it) | Yes: e.g. `apps/corporate/app/company/leadership/page.tsx:9` (template at `apps/corporate/app/layout.tsx:18`) | No title contains "Jakuraa - Jakuraa" |
| JK-20 | /privacy, /terms, /.well-known/security.txt | 404 | curl 21:09:04 | Low | Common reviewer URLs fail | Minor | 301 /privacy → /legal/privacy and /terms → /legal/terms; publish security.txt (security@jakuraa.com) | Yes: `apps/corporate/next.config.ts` (redirects); `apps/corporate/public/.well-known/security.txt` (new) | Both return 301 to /legal/*; security.txt 200 |
| JK-21 | All responses | No Content-Security-Policy header (other headers present) | curl -I 21:15 | Low | Posture | Scanner finding | Add a CSP (report-only first) | Yes: `apps/corporate/next.config.ts:12-20` | CSP header present |
| JK-22 | /legal/company-information, home | CIN activity segment `52190`; "Trading & Distribution — MoA 3(a)"; "Industrial Manufacturing — Udyam NIC 28199"; no MoA object reference for software or IT services | Page text | Medium | n/a | The underwriter will ask whether the company's objects cover software and IT services and online sale of digital services | Publish (or have ready) the MoA object clause covering software, IT and digital services; list it under Businesses → Technology | Content: `apps/corporate/content/company.ts`, `/businesses/technology` page | The objects clause covering Satelink is cited on the site |

### Positive findings (keep)
- The statutory disclosure page is complete and well structured: CIN, former name, registered office, GSTIN, IEC, Udyam and incorporation date.
- Directors are named. The principles page commits to "Say only what is true … label which is which".
- The capability status block correctly separates "LIVE IN PRODUCTION: x402 & RevenueVaultV2 rails" from "CONTROLLED BETA (PAPER): Satelink Trading AI" and "ROADMAP".
- News posts are factual and dated (5 July and 9 July 2026), and link to Polygonscan.
- Good baseline security headers (XFO DENY, nosniff, referrer-policy, permissions-policy, HSTS). The sitemap is complete and every entry returns 200.
- No returns or performance claims for Trading AI, and no "1,878 TX" or similar fabricated live metric.
