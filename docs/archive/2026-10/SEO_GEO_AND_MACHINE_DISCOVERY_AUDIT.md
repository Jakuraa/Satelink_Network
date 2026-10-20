# SEO, GEO AND MACHINE DISCOVERY AUDIT REPORT
## Technical SEO, Generative Engine Optimization (GEO) & Machine-Readable Discovery
### Satelink (`satelink.network`) & Jakuraa Commercial Private Limited (`jakuraa.com`)

**Date:** 2026-10-17  
**Branch:** `feat/evidence-led-repositioning`  
**Frameworks:** Next.js App Router Metadata API, Schema.org JSON-LD, Robots & XML Sitemaps, RFC 8615 Well-Known URI, llms.txt standard  

---

## 1. Executive Summary

Search Engine Optimization (SEO) and Generative Engine Optimization (GEO) must establish the unified product hierarchy:
- Satelink is indexed and understood by search engines and generative models as **AI-agent and machine-commerce infrastructure**.
- Jakuraa is indexed as the **corporate technology institution** (est. 2019) operating Satelink.
- Machine-readable endpoints (`/.well-known/satelink.json`, `/llms.txt`) provide deterministic ground truth to autonomous software agents and AI discovery scrapers without authentication.

---

## 2. On-Page SEO Architecture & Metadata Hygiene

### 2.1 Metadata Title & Description Standardization

| Property | Route | Canonical URL | Title Tag | Meta Description |
| :--- | :--- | :--- | :--- | :--- |
| **Satelink** | `/` | `https://satelink.network` | `Satelink — Infrastructure for AI agents that discover and use digital services` | `Programmatic infrastructure for AI agents and automated systems to discover services, evaluate options, and access APIs through controlled, machine-readable workflows.` |
| **Satelink** | `/products/machine-commerce` | `https://satelink.network/products/machine-commerce` | `Machine Commerce \| Satelink` | `Discover a priced API, pay for it without a human, and settle on-chain.` |
| **Satelink** | `/products/rpc` | `https://satelink.network/products/rpc` | `RPC Infrastructure \| Satelink` | `Metered Polygon JSON-RPC at a flat per-call rate ($0.00003/call).` |
| **Satelink** | `/products/x402` | `https://satelink.network/products/x402` | `x402 Machine Payments \| Satelink` | `HTTP-native, keyless pay-per-call payments in USDC on Base.` |
| **Satelink** | `/pricing` | `https://satelink.network/pricing` | `Pricing \| Satelink` | `Flat rate card ($0.00003/call), x402 bundles, and free service discovery. No subscriptions.` |
| **Satelink** | `/trading-agent` | `https://satelink.network/trading-agent` | `Satelink Trading AI (Beta) \| Satelink` | `Controlled paper-trading beta application; AI proposes, deterministic risk and signed mandates decide.` |
| **Satelink** | `/docs` | `https://docs.satelink.network` | `Documentation \| Satelink` | `Developer documentation, API reference, x402 integration, and platform architecture.` |
| **Jakuraa** | `/` | `https://jakuraa.com` | `Jakuraa Commercial Private Limited — Corporate Technology Institution, Established 2019` | `Jakuraa Commercial Private Limited is the corporate technology company behind Satelink (flagship AI-agent and machine-commerce infrastructure), established in 2019 in Coimbatore, India.` |
| **Jakuraa** | `/products` | `https://jakuraa.com/products` | `Products \| Jakuraa` | `Products of Jakuraa Commercial Private Limited: Satelink, the flagship AI-agent and machine-commerce platform, and its application rails.` |
| **Jakuraa** | `/company` | `https://jakuraa.com/company` | `Company \| Jakuraa` | `Corporate governance, statutory registrations, and company history of Jakuraa Commercial Private Limited.` |

### 2.2 Canonical Tag Hygiene
- Individual routes specify precise canonical URLs via `@satelink/seo` `buildMetadata({ path: '...' })`.
- No blanket canonical tags: internal surfaces and documentation sub-paths carry explicit paths.
- Host map correctly separates `satelink.network`, `docs.satelink.network`, and `jakuraa.com`.

### 2.3 Robots & Sitemap Integrity
- `apps/web/src/app/sitemap.ts` dynamically indexes verified marketing, product, and developer documentation routes.
- Internal surfaces (`/builder`, `/distributor`, `/design`, `/styleguide`) and paused surfaces (`/network`, `/network/run-a-node`) are excluded from sitemaps and disbarred in `robots.txt` (`X-Robots-Tag: noindex, nofollow`).

---

## 3. Generative Engine Optimization (GEO) & Entity Blocks

Generative AI search engines (Perplexity, SearchGPT, Claude, Gemini Overviews) index self-contained, fact-dense entity definitions (≤50 words):

### 3.1 Canonical Entity Definitions

1. **Entity: Satelink**
   > "Satelink is AI-agent and machine-commerce infrastructure developed and operated by Jakuraa Commercial Private Limited. It enables autonomous software agents and automated systems to discover, evaluate, authorize, access, meter, pay for, and settle supported digital services programmatically." (36 words)

2. **Entity: Agent Procurement**
   > "Agent procurement is the automated workflow — discover, evaluate, authorize, access, meter, pay, settle — by which software agents discover services, evaluate pricing, authorize spend, access endpoints, meter consumption, pay keylessly, and settle with verifiable receipts." (35 words)

3. **Entity: Satelink RPC**
   > "Satelink RPC is a metered platform capability providing standard Ethereum JSON-RPC access to Polygon PoS (chain 137) at a flat $0.00003 per call, payable via prepaid USDT credits or keyless x402 bundles in USDC on Base." (36 words)

4. **Entity: Satelink Trading AI**
   > "Satelink Trading AI is an algorithmic trading copilot application built on the Satelink platform. Models propose market suggestions, while deterministic risk engines and signed mandates decide. Currently in controlled paper-trading beta; live trade execution is not yet operational." (39 words)

5. **Entity: Jakuraa Commercial Private Limited**
   > "Jakuraa Commercial Private Limited is an Indian corporate technology institution founded in 2019 in Coimbatore, Tamil Nadu. It engineers software infrastructure for an agent-driven economy, operating Satelink as its flagship technology platform alongside statutory registered commercial capabilities." (36 words)

---

## 4. Machine-Readable Discovery & Manifests

### 4.1 Service Catalogue (`/.well-known/satelink.json`)
Served at `https://satelink.network/.well-known/satelink.json` and `https://api.satelink.network/.well-known/satelink.json`:
- Declares supported service products: `machine-commerce`, `rpc`, `x402`, `metering`, `trading-intelligence`.
- Declares accepted payment schemes: `x402` (Base `eip155:8453`), `usdt` (Polygon `137`), `credits`.
- Declares live endpoint and pricing references.

### 4.2 LLM Entity Declarations (`/llms.txt` & `/llms-full.txt`)
- **Satelink (`https://satelink.network/llms.txt`):** Generated from live product catalogs and documentation index. Defines the machine-commerce platform, 7-stage workflow, and Trading AI paper beta limitations.
- **Jakuraa Corporate (`https://jakuraa.com/llms.txt`):** Route handler returning corporate entity facts (CIN `U51909TZ2019PTC031777`, statutory objects, and Satelink flagship platform relationship).

### 4.3 Structured Data (JSON-LD)
- **Organization Schema (`apps/web` & `apps/corporate`):** Legal name "Jakuraa Commercial Private Limited", founding date 2019-12-04, CIN, GSTIN, registered office, official website URLs.
- **FAQPage Schema (`apps/web/src/app/(marketing)/page.tsx`):** Exact machine-commerce and agent procurement definitions structured into schema.org FAQPage for rich search engine result snippets.
