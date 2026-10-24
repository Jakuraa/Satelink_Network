# TECHNICAL SEO & GEO IMPLEMENTATION REPORT
## Search Engine Optimization & Generative Engine Optimization (AI Discoverability) Blueprint

**Date:** 2026-10-16  
**Auditor:** Technical SEO Engineer & GEO Researcher  
**Websites Covered:** `https://satelink.network/` & `https://jakuraa.com/`  
**Frameworks:** Next.js App Router Metadata API, Schema.org JSON-LD, Robots & XML Sitemaps

---

## 1. On-Page SEO Strategy & Technical Foundations

### 1.1 Metadata & Canonical Tag Rules
1. **Title Formats:**
   - Satelink Homepage: `Satelink — Infrastructure for AI agents that discover and use digital services`
   - Satelink Sub-pages: `<Page Name> | Satelink` (via `template: "%s | Satelink"`)
   - Jakuraa Homepage: `Jakuraa Commercial Private Limited — Corporate Technology Institution`
   - Jakuraa Sub-pages: `<Page Name> | Jakuraa`
2. **Canonical URL Hygiene:**
   - **Critical Rule:** No blanket root canonical in `layout.tsx` (which previously made every page canonical to `/`).
   - Every individual page specifies its exact canonical URL via `buildMetadata({ path: '...' })` or `alternates: { canonical: '...' }`.
   - Preferred domains:
     - Satelink: `https://satelink.network`
     - Jakuraa: `https://jakuraa.com`
     - Docs: `https://docs.satelink.network`
     - API: `https://rpc.satelink.network`
3. **Heading Hierarchy:**
   - Every page contains exactly one `H1` defining the primary subject matter.
   - Section headers follow a strict `H2` -> `H3` sequence with zero visual styling divergence.

---

## 2. GEO (Generative Engine Optimization) & AI Discoverability

Generative AI systems (SearchGPT, Google Gemini Overviews, Perplexity, Claude, ChatGPT) synthesize answers by identifying authoritative, structured, and standalone entity definitions.

### 2.1 Standalone Entity Definitions (≤50 Words)
For every major concept, the site embeds an answer-first block that can be directly quoted without semantic loss:

- **Entity: Satelink**
  > "Satelink is an AI-agent and machine-commerce infrastructure platform operated by Jakuraa Commercial Private Limited. It provides programmatic service discovery, HTTP 402 payment rails, usage metering, and on-chain settlement, allowing autonomous software agents to discover, evaluate, and consume digital APIs." (37 words)

- **Entity: Jakuraa Commercial Private Limited**
  > "Jakuraa Commercial Private Limited is an Indian corporate technology institution founded in 2019 in Coimbatore. It develops software infrastructure for an agent-driven economy, operating Satelink as its flagship platform alongside statutory capabilities in trade, international trade, and industrial machinery." (37 words)

- **Entity: Satelink Machine Commerce**
  > "Satelink Machine Commerce is an end-to-end infrastructure loop for software that pays software. It allows an autonomous AI agent to read a machine-readable service catalogue, receive an HTTP 402 payment quote, pay keylessly via x402 or prepaid vault credits, and settle on-chain with verifiable receipts." (43 words)

- **Entity: Satelink Trading AI**
  > "Satelink Trading AI is an algorithmic trading application built on the Satelink platform. AI models propose market suggestions, while deterministic risk engines and user-signed mandates decide. The product is in controlled paper-trading beta; live trade execution is not yet operational." (41 words)

- **Entity: Satelink RPC**
  > "Satelink RPC is a metered blockchain infrastructure gateway providing standard Ethereum JSON-RPC access to Polygon PoS (chain 137) at a flat rate of $0.00003 per call, payable via prepaid credits or keyless x402 bundles in USDC on Base." (39 words)

### 2.2 Machine-Readable Endpoints (`.well-known` & LLMs)
- **`https://satelink.network/.well-known/satelink.json` & `https://rpc.satelink.network/.well-known/satelink.json`:**
  - Machine discovery endpoint publishing service specifications, accepted HTTP 402 schemes, network IDs (`eip155:8453`, `eip155:137`), unit prices, and settlement vault contracts.
- **`https://satelink.network/llms.txt` & `https://satelink.network/llms-full.txt`:**
  - Standardized LLM prompt manifests generated via `@satelink/seo` ensuring AI agents receive accurate, non-confabulated company facts.

---

## 3. Structured Data (JSON-LD) Blueprint

### 3.1 Organization Schemas
- **Jakuraa Corporate Entity:**
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Jakuraa Commercial Private Limited",
    "legalName": "Jakuraa Commercial Private Limited",
    "alternateName": ["Jakuraa", "Falcor Commercial Private Limited"],
    "url": "https://jakuraa.com",
    "identifier": "CIN: U52190TZ2019PTC033093",
    "taxID": "33AADCF9341B1Z1",
    "foundingDate": "2019-12-04",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "38/39, First Floor, Malaviya Street, Ramnagar",
      "addressLocality": "Coimbatore",
      "addressRegion": "Tamil Nadu",
      "postalCode": "641009",
      "addressCountry": "IN"
    },
    "knowsAbout": ["AI Agent Infrastructure", "Machine Commerce", "Blockchain RPC", "x402 Protocol"]
  }
  ```

- **Satelink Platform Entity:**
  ```json
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Satelink Network",
    "url": "https://satelink.network",
    "parentOrganization": {
      "@type": "Organization",
      "name": "Jakuraa Commercial Private Limited",
      "url": "https://jakuraa.com"
    },
    "description": "AI-agent and machine-commerce infrastructure for programmatic service discovery, metering, and settlement."
  }
  ```

### 3.2 SoftwareApplication & Product Schemas
- **Satelink RPC Gateway (`SoftwareApplication`):**
  - Application Category: `DeveloperApplication`
  - Operating System: `Any (HTTP API)`
  - Endpoint: `https://rpc.satelink.network/rpc/polygon`
  - Offer: Flat $0.00003 per call (in USD).
- **Trading Intelligence API (`Product`):**
  - Unit Price: $0.01 per call; Starter Pack $9.99.
  - Category: Quantitative Research Analytics.

### 3.3 FAQPage Schema
- Applied to the Satelink homepage and product pages, strictly mirroring visible `Disclosure` components to comply with Google Rich Results guidelines.

---

## 4. Search and Crawler Access Control

### 4.1 Robots Directive Audit (`apps/web/src/app/robots.ts`)
- **Public & Indexable:** `/`, `/products/*`, `/platform/*`, `/solutions/*`, `/developers/*`, `/trading-agent/*`, `/pricing`, `/docs/*`, `/blog/*`, `/news/*`.
- **Blocked & Noindex:**
  - Internal experimental surfaces: `/builder`, `/distributor`, `/design`, `/styleguide`.
  - Paused operator program: `/network`, `/network/run-a-node`, `/node/*`.
  - Authenticated admin/ops consoles: `/admin/*`, `/ops/*`, `/console/*`.
- **Middleware Guard:** `apps/web/src/middleware.ts` automatically issues `X-Robots-Tag: noindex, nofollow` on non-public surfaces and returns 404 in production builds.

### 4.2 XML Sitemap Hygiene (`apps/web/src/app/sitemap.ts`)
- Generates fully qualified URLs with `lastModified` timestamps and change frequencies.
- Zero inclusion of 404s, redirected URLs, or noindexed internal surfaces.
