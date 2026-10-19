# Current Site Audit & Route Inventory: Satelink Network and Jakuraa

**Document:** `docs/website-repositioning/current-site-audit.md`  
**Date:** 2026-10-16  
**Auditor:** Information Architect, Senior Website Auditor & Technical SEO Engineer  
**Workspaces Audited:**  
- `apps/web`: Flagship Platform (`https://satelink.network/`)  
- `apps/corporate`: Corporate Parent (`https://jakuraa.com/`)  
- Shared Packages: `packages/content`, `packages/seo`, `packages/sdk`  
**Working Branch:** `feat/evidence-led-repositioning`  

---

## 1. Executive Baseline & Environment Verification

### 1.1 Technical Environment
- **Monorepo:** npm workspaces with Turborepo (`packageManager: npm@11.6.2`).
- **Frameworks:** Next.js 15.5.24/27 (App Router), React 18.3.1, Tailwind CSS v3 (web) and v4 (corporate), Lucide React.
- **Statutory Authority (`packages/content/src/site.ts`, `apps/corporate/content/company.ts`):**
  - Legal Entity: **Jakuraa Commercial Private Limited** (formerly *Falcor Commercial Private Limited*)
  - Corporate Identity Number (CIN): `U52190TZ2019PTC033093` (Incorporated 2019-12-04)
  - Registered Office: 38, 39, First Floor, Malaviya Street, Ramnagar, Coimbatore, Tamil Nadu 641009, India
  - GSTIN: `33AADCF9341B1Z1`
  - DGFT Importer-Exporter Code: `AADCF9341B` (Coimbatore)
  - Udyam Registration: `UDYAM-TN-03-0082507` (Micro enterprise, NIC 28199)

---

## 2. Live Production vs. Repository Comparison (Read-Only Evidence)

A live HTTP/2 and DOM inspection was executed on 2026-10-16T03:06 UTC across production endpoints (`https://satelink.network/` and `https://jakuraa.com/`) and compared against repository source:

| Route / Property | Live Production Response (curl) | Repository Working Branch (`feat/evidence-led-repositioning`) | Drift / Finding |
| :--- | :--- | :--- | :--- |
| **`https://satelink.network/` Title** | `<title>Satelink Trading AI — an AI trading operating system for people, AI agents and machines \| Satelink</title>` | `title: "Satelink — Infrastructure for AI agents that discover and use digital services"` | **LIVE LAG:** Production still shows Phase 7 Trading AI monopoly. Working branch repositions to platform infrastructure. |
| **`https://satelink.network/` H1** | `<h1>An AI trading operating system for people, AI agents and machines.</h1>` | `<h1>Infrastructure for AI agents that discover and use digital services.</h1>` | **LIVE LAG:** Production presents Trading AI as the entire company. Repository positions platform infrastructure first. |
| **`https://satelink.network/` Meta Description** | `"Reason, validate, score, authorize, execute, learn. AI proposes; deterministic risk and your signed mandate decide..."` | `"Programmatic infrastructure for AI agents and automated systems to discover services, evaluate options, and access APIs through controlled, machine-readable workflows."` | **LIVE LAG:** Production description excludes machine commerce and procurement. |
| **`https://satelink.network/llms.txt`** | `# Satelink — Satelink Trading AI and machine commerce\n\nSatelink Trading AI is an AI trading operating system...` | `# Satelink — AI-Agent & Machine-Commerce Infrastructure\n\nSatelink is an infrastructure platform enabling autonomous AI agents...` | **LIVE LAG:** Production LLM text presents Trading AI as primary entity. |
| **`https://satelink.network/.well-known/satelink.json`** | Returns HTTP 200 with JSON machine catalogue (`machine-commerce`, `rpc`, `trading-intelligence`). | Matches `apps/web/src/app/.well-known/satelink.json/route.ts`. | **IN SYNC:** Machine discovery endpoint is live and verified. |
| **`https://jakuraa.com/` Title** | `<title>Jakuraa - a technology and trading company, established 2019</title>` | `<title>Jakuraa - a technology and trading company, established 2019</title>` | **IN SYNC:** Title accurate. |
| **`https://jakuraa.com/` H1** | `<h1>We build the AI that trades within your rules.</h1>` | `<h1>Building software infrastructure for an agent-driven economy.</h1>` | **LIVE LAG:** Production conflates corporate parent with trading AI application. Repository restores institutional scope. |
| **`https://jakuraa.com/` Telemetry Section** | `SETTLEMENT LATENCY: Sub-second (< 400ms)` / `TRANSACTION OVERHEAD: < $0.0001 per call` | `SETTLEMENT RAILS: Base (USDC) & Polygon (USDT)` / `SETTLEMENT MODEL: Non-Custodial On-Chain Receipts` | **LIVE LAG:** Production contains unverified sub-400ms claim. Repository replaces with verifiable protocol facts. |
| **`https://jakuraa.com/products` Flagship** | `"Its flagship product is Satelink Trading AI."` | `"Its flagship technology platform is Satelink, building AI-agent and machine-commerce infrastructure..."` | **LIVE LAG:** Production inverts hierarchy. Repository establishes platform-first taxonomy. |
| **`https://jakuraa.com/llms.txt`** | **HTTP 404 Not Found** | Dynamic Next.js route created at `apps/corporate/app/llms.txt/route.ts`. | **FIXED IN REPO:** Corporate site lacked machine-readable entity declaration. |

> [!IMPORTANT]
> A passing local test or build does not equal a production deployment. Production remains running the earlier deployment until a production release is explicitly authorized and triggered by the founder.

---

## 3. Information Architecture and Content Gaps

### 3.1 Satelink Platform (`apps/web`)
1. **Agent Procurement Framing:** The platform had functional primitives for machine commerce (discovery, 402, vaults, metering), but the term and business concept of "agent procurement" was absent from primary hero and FAQ surfaces.
2. **Trading AI Monopoly:** In Phase 7, the homepage was rewritten as if Satelink were solely an AI trading operating system, demoting machine commerce into an afterthought.
3. **Legacy DePIN Remnants:** While marketing copy removed DePIN, `packages/sdk/package.json` and `packages/sdk/README.md` still claimed Satelink was a "DePIN network".

### 3.2 Jakuraa Corporate Parent (`apps/corporate`)
1. **Conflation with Application:** The corporate homepage opened with "We build the AI that trades within your rules", reducing a 2019-incorporated corporate entity with statutory trade and industrial registrations to a single trading software script.
2. **Unverified Performance Claims:** Telemetry footers displayed `< 400ms` settlement latency and `< $0.0001` overhead—neither of which is supported by standard L2 finality evidence.
3. **Internal Link Misdirection:** Navigation pointed `Research` to `/news` and `Systems` to `/businesses`, bypassing dedicated `/research` and `/systems` pages.

---

## 4. Comprehensive Route Inventory

### 4.1 Satelink Flagship Website (`apps/web` — 148 Total Routes)

| Route | Owning App | Current Message & Audience | Existing Sections & CTA | SEO Metadata (Title, Desc, Canonical, Robots) | Internal Links In / Out | Verified Capabilities & Claims | Recommended Surgical Action | Risk Level & Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | `web` | AI-agent & machine-commerce infrastructure. For agent developers, quantitative teams. | Hero, Loop (6 steps), Gates (GO/WAIT/REJECT), Safety Boundary, Interfaces, Active Services, FAQ, Beta CTA. | Title: `Satelink — Infrastructure for AI agents...`, Desc: Programmatic discovery & access. Canonical: `https://satelink.network/`. Robots: index, follow. | In: Header logo, footer. Out: `/contact-sales`, `docs.satelink.network`, `/trading-agent`, `/products/*`. | Polygon RPC ($0.00003/call), Base USDC x402, USDT vaults, Paper Trading AI (Beta). | Reposition H1 and loop to programmatic service procurement; add procurement FAQ; retain zero-redesign styling. | Low. Validated by `claims-lint` and `phase7-site.test.ts`. |
| `/.well-known/satelink.json` | `web` | Machine-readable catalogue for autonomous software agents. | JSON API route returning services, endpoints, specs, and pricing. | Content-Type: `application/json`. | In: External agent scanners. Out: `/products/*`, `/rpc/*`. | Live discovery verified. Returns JSON array with machine-commerce, RPC, and TI endpoints. | None needed. Truthful and operational. | Zero risk. |
| `/products/machine-commerce` | `web` | Machine commerce explanation for software paying software. | Product hero, 3 value cards, capability list, curl example, FAQ. | Title: `Machine Commerce — software that pays software`. Canonical: `/products/machine-commerce`. | In: Home, nav, sitemap. Out: `/products/rpc`, `/products/x402`, `/pricing`. | Discovery JSON, 402 handshake, flat metering, RevenueVaultV2. | Ensure definition explicitly mentions agent procurement lifecycle. | Low. Build and lint verified. |
| `/products/rpc` | `web` | Metered Polygon PoS JSON-RPC gateway at flat $0.00003/call. | Product hero, rate comparison, supported methods, x402 bundle, curl snippet. | Title: `RPC Infrastructure — metered blockchain RPC`. Canonical: `/products/rpc`. | In: Home, nav, sitemap. Out: `/products/x402`, `/docs`. | Polygon PoS (137) only. No multi-chain claims. No unmetered tiers. | Preserve exact pricing and chain specificity. | Low. Tested by `pricing-parity.test.ts`. |
| `/products/x402` | `web` | HTTP-native keyless pay-per-call payments in USDC on Base. | Protocol explanation, handshake diagram, error 402 code sample, curl. | Title: `x402 Machine Payments`. Canonical: `/products/x402`. | In: Home, products, sitemap. Out: GitHub `x402-kit`, `/products/rpc`. | Keyless USDC on Base (8453). $0.10 buys 1,000 calls. MIT licensed open-source kit. | Maintain clear chain separation from Polygon USDT vault. | Low. Claims-lint verified. |
| `/products/trading-intelligence/[metric]` | `web` | Derived market analytics API for quantitative researchers. | 4 SSG metric pages (funding rate, open interest, liquidation clusters, microstructure). | Dynamic per-metric titles and schemas. Canonical: `/products/trading-intelligence/*`. | In: Nav, sitemap. Out: Dodo starter pack ($9.99), API endpoints. | Derived statistics from public exchange data. Model metrics carry explicit limitations. | Preserve non-advice disclaimers and one-time pack limits. | Low. Tests pass. |
| `/trading-agent` | `web` | First intended platform application: algorithmic market analysis in paper beta. | Hero, workflow diagram, scorecard, mandate rules, beta waitlist form. | Title: `Satelink Trading AI`. Status: Controlled paper beta. Canonical: `/trading-agent`. | In: Home, nav, sitemap. Out: `/trading-agent/how-it-works`, `/trading-agent/risk`, `/trading-agent/ai`. | Zero live trades completed. Paper trading only. Non-custodial; withdrawals disabled. | Maintain all disclaimers word-for-word (`disclaimers.json`). | Low. Strictly guarded by AST claims linter. |
| `/trading-agent/risk` | `web` | Deterministic risk engine and mandate enforcement documentation. | Hard gates explanation, loss collars, TOTP mandate signing, kill switch. | Title: `Risk and Safety \| Satelink`. Canonical: `/trading-agent/risk`. | In: Trading AI pages, footer. Out: `/trading-agent/how-it-works`. | Fails closed. AI cannot bypass deterministic limits. | Preserved intact. | Low. |
| `/docs` & `/docs/[slug]` | `web` | Technical documentation for developers and agent builders. | Sidebar navigation, markdown articles, endpoint specifications, SDK guides. | Dynamic doc metadata. Canonical: `/docs/*`. | In: Nav header, home CTA. Out: API endpoints, SDK repository. | Documented endpoints reflect live production API behaviour. | Updated docs index to introduce platform infrastructure first. | Low. |
| `/pricing` | `web` | Comprehensive pricing schedule for RPC, x402, and Trading Intelligence. | Comparison table, credit pack breakdown, settlement explanations. | Title: `Pricing \| Satelink`. Canonical: `/pricing`. | In: Nav, footer, sitemap. Out: Checkout routes, contact sales. | $0.00003/RPC call, $0.10/1000 x402 calls, $9.99 TI Starter Pack. | Preserved. No subscription or unverified offers added. | Low. Checked by `pricing-parity.test.ts`. |
| `/network/*` | `web` | Legacy node operator and community node pages. | Node setup guide, operator earnings (paused). | Tagged `noindex, nofollow`. Excluded from sitemap. | In: None (orphaned). Out: Paused notice. | Operator program is paused; operator payouts are not active. | Preserved mandatory paused notice (`OPERATOR_PROGRAM_PAUSED`). | Low. |
| `/admin/*`, `/satelink/os/*` | `web` | Internal operational consoles, telemetry, and revenue ops. | Admin dashboards, database metrics, node lists, billing reconciliation. | Excluded via `robots.txt` (`Disallow: /admin/`, `Disallow: /satelink/os/`). | In: Internal auth only. Out: None. | Internal operational surfaces. | Ensure none leak into public sitemap or search indices. | Zero risk. Validated by `sitemap-coverage.test.ts`. |

---

### 4.2 Jakuraa Corporate Website (`apps/corporate` — 21 Total Routes)

| Route | Owning App | Current Message & Audience | Existing Sections & CTA | SEO Metadata (Title, Desc, Canonical, Robots) | Internal Links In / Out | Verified Capabilities & Claims | Recommended Surgical Action | Risk Level & Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | `corporate` | Corporate technology institution engineering agent infrastructure. | Hero, Overview, Flagship Satelink, Systems, Leadership, Contact. | Title: `Jakuraa - a technology and trading company...`. Canonical: `https://jakuraa.com`. | In: Logo, footer. Out: `/products`, `/company`, `/systems`, `satelink.network`. | Incorporated 2019. CIN U52190TZ2019PTC033093. Operates Satelink. | Reposition H1 to institutional scope; eliminate `< 400ms` claim; link Satelink platform. | Low. Validated by `claims-lint (jakuraa.com)`. |
| `/products` | `corporate` | Portfolio overview: Satelink platform and application rails. | Page hero, Flagship card, Application rails list, beta link. | Title: `Products \| Jakuraa`. Canonical: `/products`. | In: Nav, home, sitemap. Out: `satelink.network`, `/contact-sales`. | Satelink is flagship platform; Trading AI is paper beta; RPC/x402 are production rails. | Corrected flagship definition from "Trading AI" to "Satelink Platform". | Low. Build passes. |
| `/company` | `corporate` | Corporate entity history, governance, and registered office. | About narrative, timeline, statutory table, leadership links. | Title: `About \| Jakuraa`. Canonical: `/company`. | In: Nav, footer, sitemap. Out: `/company/leadership`, `/contact`. | Full statutory registration details verified against MCA and DGFT. | Aligned opening lede with corporate technology institution positioning. | Low. |
| `/systems` | `corporate` | Technical systems, digital rails, and physical distribution infrastructure. | Technology grid, architecture overview, non-custodial boundaries. | Title: `Systems \| Jakuraa`. Canonical: `/systems`. | In: Nav (`Systems`), home. Out: `/technology`, `/businesses`. | Infrastructure specifications for machine commerce and metering. | Restored direct navigation link from header (`/systems`). | Low. |
| `/research` | `corporate` | Research scope on machine economics and deterministic safety. | Working papers, research focus areas, publication roadmap. | Title: `Research \| Jakuraa`. Canonical: `/research`. | In: Nav (`Research`), home. Out: `/systems`. | Engineering research on deterministic execution and agent commerce. | Restored direct navigation link from header (`/research`). | Low. |
| `/businesses` & `/[slug]` | `corporate` | Registered statutory business capabilities under MOA. | 5 vertical pages: Technology, Trading, International Trade, Industrial, Insights. | Dynamic titles. Canonical: `/businesses/*`. | In: Footer, sitemap. Out: `/company`. | MOA Objects 3(a), 3(b)(6), DGFT IEC, Udyam registration. | Maintained distinction between active software and statutory capabilities. | Low. |
| `/legal/*` | `corporate` | Statutory company disclosures, terms, privacy, grievance policy. | Company information, MCA details, Grievance Officer contacts. | Canonical: `/legal/*`. Robots: index, follow. | In: Footer, sitemap. Out: Email, phone. | Verified registered address and statutory officers. | Preserved without alteration. | Zero risk. |
| `/llms.txt` | `corporate` | Machine-readable declaration of corporate entity and platform hierarchy. | Plain text markdown route generated dynamically. | Content-Type: `text/plain`. Cache: 300s. | In: AI search crawlers. Out: Authoritative URLs. | Declares Jakuraa as parent entity and Satelink as flagship platform. | Created new route `apps/corporate/app/llms.txt/route.ts`. | Low. Tested and verified. |

---

## 5. SEO & GEO Audit Findings and Severity Classification

| Issue ID | Surface | Evidence & Observation | Severity | Resolution Implemented |
| :--- | :--- | :--- | :--- | :--- |
| **GEO-01** | `apps/web/src/app/layout.tsx` | Root default title was: `"Satelink Trading AI — AI trading operating system for people, AI agents and machines"`, misleading AI crawlers about brand identity. | **Critical (P0)** | Updated to: `"Satelink — AI-Agent & Machine-Commerce Infrastructure"`. Description updated to highlight programmatic service discovery and procurement. |
| **GEO-02** | `packages/seo/src/llms.ts` | Dynamic `llms.txt` generator opened with Trading AI as the sole definition of Satelink. | **High (P1)** | Rewritten to define Satelink as machine-commerce infrastructure for AI agents, with Trading AI properly nested as the first application in controlled beta. |
| **GEO-03** | `apps/corporate/app/llms.txt` | `https://jakuraa.com/llms.txt` returned HTTP 404 in production, leaving LLM search engines without an authoritative corporate declaration. | **High (P1)** | Created `apps/corporate/app/llms.txt/route.ts` declaring Jakuraa Commercial Private Limited, CIN, statutory registrations, and Satelink platform relationship. |
| **SEO-01** | `apps/corporate/content/navigation.ts` | Nav item `Research` routed to `/news`; Nav item `Systems` routed to `/businesses`, causing internal link dilution and cannibalization of dedicated pages. | **Medium (P2)** | Fixed href targets: `Research` -> `/research`, `Systems` -> `/systems`. |
| **SEO-02** | `apps/web/src/app/sitemap.ts` | Private/admin/builder pages were previously excluded, but `/trading-agent/product` duplicate needed cleanup. | **Medium (P2)** | Sitemap confirmed to include only canonical, indexable public URLs. Filtered out duplicate/login routes. |
| **SEO-03** | `apps/corporate/app/page.tsx` | Unverified performance metrics (`< 400ms` settlement latency) risked indexing as factual claims. | **High (P1)** | Replaced with verified protocol finality descriptions: Base L2 (USDC) and Polygon PoS (USDT). |
