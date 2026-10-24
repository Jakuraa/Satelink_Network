# WEBSITE CONTENT CHANGE MATRIX
## Detailed Page-by-Page Repositioning Blueprint & Exact Implementation Plan

**Date:** 2026-10-16  
**Auditor:** Senior Website Auditor & Conversion Copywriter  
**Scope:** Satelink Network (`apps/web`) & Jakuraa Commercial Private Limited (`apps/corporate`)  
**Design Constraint:** Zero layout alterations. Zero new CSS/UI frameworks. Surgical content & metadata changes only.

---

## 1. Summary of Changes by Priority

- **Priority P0 (Misleading or Materially Incorrect Public Claims):**
  - **Satelink Home (`apps/web/src/app/(marketing)/page.tsx`):** Replace "AI trading operating system" company monopoly with AI-Agent & Machine-Commerce Infrastructure positioning. Re-integrate Trading AI as first intended application (Beta) and RPC as an existing service.
  - **Satelink Layout Metadata (`apps/web/src/app/layout.tsx`):** Remove "Satelink Trading AI — AI trading operating system..." from default title, metadata, and Organization schema.
  - **Jakuraa Home (`apps/corporate/app/page.tsx`):** Replace "We build the AI that trades within your rules" with parent corporate technology institution positioning: "Building software infrastructure for an agent-driven economy." Remove unverified settlement latency ("< 400ms").
  - **Jakuraa Products (`apps/corporate/app/products/page.tsx`):** Correct description stating "Its flagship product is Satelink Trading AI" to "Its flagship platform is Satelink".

- **Priority P1 (Core Positioning & Product Taxonomy Inconsistencies):**
  - **Global Navigation Model (`packages/content/src/navigation.ts`):** Rebalance Products menu so that "Machine commerce" and "Satelink Trading AI (Beta)" reflect the proper platform/application hierarchy.
  - **Corporate Navigation (`apps/corporate/content/navigation.ts`):** Fix broken links where Research pointed to `/news` and Systems pointed to `/businesses`.
  - **Developer SDK Metadata (`packages/sdk/package.json`, `packages/sdk/README.md`):** Purge obsolete "DePIN network" terminology; replace with "machine-commerce network".

- **Priority P2 (Missing Explanatory Content, High Information Density & Link Integrity):**
  - **Satelink Home Section 2 (Workflow):** Reframe the 6-step loop from purely trading terms into the universal programmatic procurement cycle: *Discover, Evaluate, Authorize, Meter, Pay, Settle*.
  - **Satelink Home Section 6 (Active Services):** Highlight active production services (Machine Commerce, Polygon RPC, x402 Keyless Payments).
  - **Satelink Home Section 7 (FAQs):** Direct answers for what Satelink is, who it is for, machine commerce procurement, Trading AI status, RPC role, and Jakuraa parent entity relationship.

- **Priority P3 (Metadata, Structured Data, SEO & GEO Refinements):**
  - **GEO / Answer Engine Optimization (`packages/seo/src/llms.ts`):** Update system prompts and `.well-known` representations to define Satelink as machine-commerce infrastructure for AI agents and Jakuraa as the parent technology institution.
  - **Sitemap & Canonical Verification:** Verify zero duplicate titles, clean canonical URLs, and exclusion of internal/paused surfaces.

---

## 2. Page-by-Page Content Specification

### Page 1: Satelink Homepage
- **File:** `apps/web/src/app/(marketing)/page.tsx`
- **Route:** `/`
- **Purpose:** Primary public landing page for Satelink Network.
- **Primary Audience:** AI-agent developers, autonomous system engineers, quantitative teams, enterprise buyers.
- **Search & GEO Intent:** Discover AI-agent infrastructure, machine commerce rails, HTTP 402 payments, metered APIs.
- **Current Content to Correct:**
  - H1 currently: *"An AI trading operating system for people, AI agents and machines."*
  - Eyebrow currently: *"Satelink Trading AI"*
  - Page title currently: *"Satelink Trading AI — an AI trading operating system for people, AI agents and machines"*
  - Entire hero and flow presents Trading AI as the company itself.
- **Approved Replacement Copy:**
  - **Title:** `Satelink — Infrastructure for AI agents that discover and use digital services`
  - **Meta Description:** `Satelink is programmatic infrastructure for AI agents to discover services, evaluate options, and access APIs through controlled, machine-readable workflows. Built by Jakuraa.`
  - **Eyebrow:** `AI-Agent & Machine-Commerce Infrastructure`
  - **H1:** `Infrastructure for AI agents that discover and use digital services.`
  - **Hero Lede:** `Satelink is programmatic infrastructure for AI agents and automated systems to discover services, evaluate options, and access APIs through controlled, machine-readable workflows. Featuring Satelink Trading AI in private beta and live Polygon RPC rails.`
  - **Hero Badge:** `Trading AI in controlled paper beta · API services live`
  - **Primary CTA:** `Explore documentation` (`https://docs.satelink.network`)
  - **Secondary CTA:** `Request beta access` (`/contact-sales?interest=beta`)
  - **Section 2 (Workflow Loop - 6 Steps):**
    - Eyebrow: `Programmatic workflow`
    - Title: `Discover, evaluate, authorize, meter, pay, settle`
    - Lede: `Every client — a person, an AI agent, or an automated service — operates through controlled, machine-readable steps.`
    - Step 1: `Discover` (icon: `Brain`): "Agents query machine-readable endpoints (`/.well-known/satelink.json`) to find services and pricing before authenticating."
    - Step 2: `Evaluate` (icon: `FileCheck2`): "The caller assesses endpoint specifications, capabilities, and unit costs against deterministic budget rules."
    - Step 3: `Authorize` (icon: `KeyRound`): "Spending limits, API keys, or signed mandates determine what the agent is permitted to call."
    - Step 4: `Meter` (icon: `LineChart`): "Every request is counted and measured against prepaid balances or per-call caps."
    - Step 5: `Pay` (icon: `PlugZap`): "Micropayments execute keylessly in USDC on Base via HTTP 402 or draw down prepaid USDT balances on Polygon."
    - Step 6: `Settle` (icon: `CheckCircle2`): "Usage records and payments reconcile with cryptographic certainty, producing verifiable on-chain receipts."
  - **Section 3 (Scorecard / Decisions):**
    - Eyebrow: `Control boundary`
    - Title: `GO, WAIT or REJECT — verifiable gates for every agent action`
    - Lede: `Whether executing market analysis or procuring an upstream API, deterministic hard gates verify budget, freshness, and authorization before any action occurs.`
    - GO: "Every hard gate passed and quotas clear. The proposal or request proceeds."
    - WAIT: "Conditions are not met or confirmation is pending. No action or spend is initiated."
    - REJECT: "A limit was exceeded, data was stale, or authorization expired. The request fails closed."
  - **Section 4 (Safety Boundary):**
    - Eyebrow: `Safety boundary`
    - Title: `AI proposes. Deterministic controls and your signed limits decide.`
    - Cards:
      - `AI proposes`: "Autonomous models can analyze and draft requests, but have no unilateral authority to exceed configured limits."
      - `Deterministic limits decide`: "Fixed rules enforce kill switches, per-call budgets, data freshness, and spending caps."
      - `Signed mandates govern`: "Operations run within explicit parameters authenticated by one-time codes or cryptographically signed limits."
      - `Non-custodial custody`: "Satelink never takes custody of broker funds or customer treasury; withdrawals are never enabled."
  - **Section 5 (Three Interfaces):**
    - Eyebrow: `Three interfaces`
    - Title: `Web for people. API and MCP for AI agents and machines.`
    - Lede: `One unified core with auditable receipts — accessible whichever way your systems connect.`
    - Web (Badge: Live): "Manage accounts, configure spending limits, review transaction receipts, and monitor active services."
    - API (Badge: Live): "Programmatic service discovery, metered Polygon RPC, and Trading Intelligence endpoints over HTTP."
    - MCP (Badge: Private beta): "Model Context Protocol tools for AI agents to discover resources, evaluate data, and propose actions."
  - **Section 6 (Active Infrastructure Services):**
    - Eyebrow: `Active services`
    - Title: `Infrastructure running today on Satelink`
    - Lede: `The production-ready payment, data, and execution rails Satelink operates today for developers and autonomous agents.`
    - Card 1: `Machine Commerce` (`/products/machine-commerce`): "Programmatic service discovery and machine-to-machine procurement infrastructure."
    - Card 2: `RPC Infrastructure` (`/products/rpc`): "Metered Polygon PoS JSON-RPC gateway at flat $0.00003 per call."
    - Card 3: `x402 Machine Payments` (`/products/x402`): "HTTP 402 payment rail for keyless pay-per-call in USDC on Base."
  - **Section 7 (Comprehensive FAQs):**
    - Q1: `What is Satelink?`  
      A: "Satelink is programmatic infrastructure for AI agents and automated systems to discover services, evaluate options, and access APIs through controlled, machine-readable workflows. Operated by Jakuraa Commercial Private Limited."
    - Q2: `Who is Satelink for?`  
      A: "Satelink serves AI agent developers building autonomous workflows, software systems needing pay-per-call infrastructure, quantitative researchers, and enterprises requiring auditable API procurement."
    - Q3: `Where does Trading AI fit into Satelink?`  
      A: "Trading AI is Satelink's first intended application: an agent workflow where AI proposes market decisions, but deterministic risk and signed mandates decide. It is currently in controlled paper-trading beta; live execution is not yet available."
    - Q4: `Where does RPC infrastructure fit?`  
      A: "Blockchain RPC is one active production service running on Satelink today. It provides metered Polygon PoS JSON-RPC access at a flat $0.00003 per call, payable via prepaid credits or keylessly with x402."
    - Q5: `What can developers do on Satelink today?`  
      A: "Developers can query the public machine catalogue (`/.well-known/satelink.json`), access metered Polygon RPC, execute keyless pay-per-call HTTP requests via x402 on Base, and consume derived market analytics via the Trading Intelligence API."
    - Q6: `Does Satelink take custody of funds?`  
      A: "No. Satelink is non-custodial. Broker funds remain with your broker, and withdrawals are never enabled. Machine payments execute directly via user-funded wallets or prepaid credit vaults."
    - Q7: `Is this investment advice?`  
      A: "No. Satelink does not provide financial or investment advice. Trading Intelligence endpoints provide derived statistical calculations from public market data, and Trading AI is a paper-trading beta tool."
  - **Section 8 (Beta CTA & Disclosures):**
    - Badge: `Trading AI in controlled paper beta · API services live`
    - Heading: `Build on Satelink's machine-commerce infrastructure.`
    - Primary CTA: `Request beta access` (`/contact-sales?interest=beta`)
    - Secondary CTA: `Explore documentation` (`https://docs.satelink.network`)
    - Disclosures: `Not investment advice`, `Independence`, `AI disclosure`.

---

### Page 2: Satelink Root Layout & Metadata
- **File:** `apps/web/src/app/layout.tsx`
- **Purpose:** Root HTML shell and site-wide metadata defaults.
- **Current Content to Correct:**
  - `default: "Satelink Trading AI — AI trading operating system for people, AI agents and machines"`
  - Keywords include `"AI trading operating system"` as primary.
  - Organization JSON-LD defines entity as `"Satelink Trading AI"`.
- **Approved Replacement Copy:**
  - `default: "Satelink — AI-Agent & Machine-Commerce Infrastructure"`
  - `template: "%s | Satelink"`
  - `description: "Programmatic infrastructure for AI agents and automated systems to discover digital services, evaluate options, and access APIs through controlled, machine-readable workflows."`
  - `keywords: ["Satelink", "machine commerce", "AI agents", "agent procurement", "x402", "API metering", "Polygon RPC", "Satelink Trading AI", "micropayments"]`
  - `openGraph.title: "Satelink — AI-Agent & Machine-Commerce Infrastructure"`
  - `openGraph.description: "Programmatic infrastructure for AI agents and automated systems to discover digital services, evaluate options, and access APIs through controlled, machine-readable workflows."`
  - `twitter.title: "Satelink — AI-Agent & Machine-Commerce Infrastructure"`
  - `twitter.description: "Programmatic infrastructure for AI agents and automated systems to discover digital services, evaluate options, and access APIs through controlled, machine-readable workflows."`
  - `ORG_JSON_LD`:
    - `name: "Satelink Network"`
    - `description: "AI-agent and machine-commerce infrastructure for programmatic service discovery, metering, and settlement. Operated by Jakuraa Commercial Private Limited."`

---

### Page 3: Jakuraa Corporate Homepage
- **File:** `apps/corporate/app/page.tsx`
- **Route:** `/`
- **Purpose:** Institutional homepage for Jakuraa Commercial Private Limited.
- **Primary Audience:** Enterprise partners, institutional stakeholders, regulators, researchers, prospective engineering talent.
- **Search & GEO Intent:** Understand Jakuraa Commercial Private Limited, corporate governance, engineering scope, and parent relationship to Satelink.
- **Current Content to Correct:**
  - H1 currently: *"We build the AI that trades within your rules."*
  - Lede currently: *"Jakuraa Commercial Private Limited... builds Satelink Trading AI: an AI trading operating system..."*
  - Section 1 diagram contains unverified metric: `"SETTLEMENT LATENCY: Sub-second (< 400ms)"`.
- **Approved Replacement Copy:**
  - **H1:** `Building software infrastructure for an agent-driven economy.`
  - **Hero Lede:** `Jakuraa Commercial Private Limited, incorporated in Coimbatore in 2019, is a corporate technology institution developing software infrastructure for AI-agent workflows, programmatic service access, and machine commerce. Satelink is its flagship platform.`
  - **Telemetry Footer in Hero Diagram:**
    - Label 1: `PROTOCOL RAILS` -> Value: `Base (USDC) & Polygon (USDT)`
    - Label 2: `SETTLEMENT MODEL` -> Value: `Non-Custodial On-Chain Receipts`
  - **Section 2 (Flagship Technology Platform):**
    - Eyebrow: `FLAGSHIP TECHNOLOGY PLATFORM`
    - H2: `Satelink: AI-agent infrastructure and machine commerce.`
    - Lede: `Satelink is the flagship platform engineered and operated by Jakuraa. It provides the programmatic service discovery, payment rails, vaults, and usage-metered gateways that let autonomous software agents and automated systems consume APIs per call. Satelink Trading AI is its first intended application, currently in controlled paper-trading beta.`
  - **Section 3 (Application Direction):**
    - Eyebrow: `PRIMARY APPLICATION DIRECTION`
    - H2: `Satelink Trading AI: reason, validate, score, authorize, execute, learn.`
    - Lede: `An agent application where AI models propose market suggestions, but deterministic risk engines and signed user mandates decide. Currently in controlled paper-trading beta; live execution is not yet available.`

---

### Page 4: Jakuraa Corporate Products Page
- **File:** `apps/corporate/app/products/page.tsx`
- **Route:** `/products`
- **Purpose:** Catalog of technology products and platforms built by Jakuraa.
- **Current Content to Correct:**
  - Meta description: `"Products of Jakuraa Commercial Private Limited: Satelink Trading AI, the flagship AI trading operating system..."`
  - Page hero lede: `"Its flagship product is Satelink Trading AI."`
  - Flagship heading: Points exclusively to Satelink Trading AI.
- **Approved Replacement Copy:**
  - **Title:** `Products & Platforms | Jakuraa`
  - **Meta Description:** `Technology platforms and infrastructure built by Jakuraa Commercial Private Limited: Satelink, our flagship machine-commerce platform, and its applications.`
  - **Hero Lede:** `Jakuraa Commercial Private Limited builds and operates Satelink, its flagship AI-agent and machine-commerce platform, alongside specialized applications and payment rails.`
  - **Flagship Section Title:** `Satelink Platform`
  - **Flagship Section Lede:** `The machine-commerce platform connecting autonomous agents with digital services through programmatic discovery, HTTP 402 payment rails, and on-chain settlement.`
  - **Flagship Points:**
    - `Satelink Trading AI`: "First application on Satelink — AI proposes; deterministic risk and signed mandates decide. Controlled paper beta; live execution is not yet available."
    - `Machine Commerce Rails`: "Keyless pay-per-call payments in USDC on Base (x402) and prepaid USDT credit vaults on Polygon PoS."
    - `RPC & Data Infrastructure`: "Metered blockchain RPC and derived trading intelligence APIs consumed per call without subscriptions."
    - `Non-Custodial Security`: "Satelink never holds customer funds; broker integrations remain strictly non-custodial."

---

### Page 5: Jakuraa Corporate Company Page
- **File:** `apps/corporate/app/company/page.tsx`
- **Route:** `/company`
- **Purpose:** Corporate identity, operating principles, history, and statutory governance.
- **Current Content to Correct:**
  - Lede mentions: `"Today it builds Satelink, whose flagship product is Satelink Trading AI..."`
- **Approved Replacement Copy:**
  - **Lede:** `Jakuraa Commercial Private Limited (formerly Falcor Commercial Private Limited) was incorporated in Coimbatore on 4 December 2019. Today it develops software infrastructure for an agent-driven economy, operating Satelink as its flagship technology platform, and maintains statutory registrations for trade, international trade, and industrial manufacturing.`

---

### Page 6: Shared Content & Navigation Models
- **File:** `packages/content/src/navigation.ts`
- **Purpose:** Canonical navigation model for headers and footers across both apps.
- **Current Content to Correct:**
  - Products dropdown leads with: `title: "Satelink Trading AI"` as primary menu group.
  - Footers list Trading AI before platform capabilities.
- **Approved Replacement:**
  - **Group 1 (Platform & Infrastructure):**
    - `Machine Commerce` (`/products/machine-commerce`, description: "Programmatic discovery, payment, and settlement")
    - `RPC Infrastructure` (`/products/rpc`, description: "Metered Polygon RPC at flat $0.00003 per call")
    - `x402 Machine Payments` (`/products/x402`, description: "HTTP-native pay-per-call in USDC on Base")
    - `API Metering` (`/products/metering`, description: "Usage attribution, spending caps, and receipts per key")
  - **Group 2 (Applications & Intelligence):**
    - `Satelink Trading AI` (`/trading-agent`, badge: "Beta", description: "First application: AI proposes, deterministic risk decides")
    - `Trading Intelligence` (`/products/trading-intelligence`, description: "Derived market analytics bought per call")

- **File:** `apps/corporate/content/navigation.ts`
- **Purpose:** Corporate navigation links.
- **Current Content to Correct:**
  - `{ label: 'Research', href: '/news' }`
  - `{ label: 'Systems', href: '/businesses' }`
- **Approved Replacement:**
  - `{ label: 'Systems', href: '/systems' }`
  - `{ label: 'Research', href: '/research' }`

---

### Page 7: SDK & Developer Packages
- **Files:** `packages/sdk/package.json`, `packages/sdk/README.md`
- **Purpose:** Official developer client library.
- **Current Content to Correct:**
  - Mentions "DePIN network" and obsolete hardware node mining terminology.
- **Approved Replacement:**
  - `description: "Official SDK for the Satelink machine-commerce network — RPC gateway, x402 payments, and agent tools"`
  - Update README overview to emphasize machine-to-machine API access, x402 integration, and agent tooling.

---

### Page 8: SEO & LLM Answer Engine Profiles
- **File:** `packages/seo/src/llms.ts`
- **Purpose:** Automated `.well-known` and LLM crawler discovery text.
- **Current Content to Correct:**
  - Prompt starts with `"Satelink Trading AI is an AI trading operating system..."`
- **Approved Replacement:**
  - `"Satelink is an AI-agent and machine-commerce platform operated by Jakuraa Commercial Private Limited. It provides programmatic infrastructure for software agents to discover digital services, evaluate machine-readable terms, pay per call via HTTP 402 (x402 in USDC on Base or prepaid USDT on Polygon), and settle on-chain. Satelink Trading AI is its first intended application (currently in private paper-trading beta; live execution is not yet available). Metered Polygon PoS RPC is available at flat $0.00003 per call."`
