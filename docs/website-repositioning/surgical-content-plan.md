# Surgical Content Plan: Satelink Network and Jakuraa

**Document:** `docs/website-repositioning/surgical-content-plan.md`  
**Date:** 2026-10-16  
**Auditor:** Information Architect & Conversion Copywriter  
**Scope:** Satelink Network (`apps/web`), Jakuraa (`apps/corporate`), and shared packages (`packages/*`)  
**Design Constraint:** Absolute zero visual redesign. No changes to CSS, Tailwind classes, styling tokens, fonts, colors, spacing, borders, shadows, animations, or DOM hierarchies. Content, metadata, and test assertions only.

---

## 1. Plan Overview and Scope Confirmation

This plan details the surgical changes executed to reposition Satelink as an AI-agent and machine-commerce infrastructure platform, establish Jakuraa as its corporate technology parent, properly nest Satelink Trading AI as a controlled paper-trading beta application, and ensure high information density across all existing surfaces.

---

## 2. File-by-File Surgical Change Specifications

### File 1: Satelink Homepage (`apps/web/src/app/(marketing)/page.tsx`)
- **Route:** `/`
- **Target Component:** Hero, Programmatic Workflow Loop, Interfaces, Active Services, FAQ.
- **Current Copy:**
  - Eyebrow: `Satelink Trading AI`
  - H1: `An AI trading operating system for people, AI agents and machines.`
  - Hero Lede: `Reason, validate, score, authorize, execute, learn. AI proposes; deterministic risk and your signed mandate decide; you keep custody.`
  - Loop Title: `Reason, validate, score, authorize, execute, learn`
- **Proposed & Implemented Copy:**
  - Eyebrow: `AI-Agent & Machine-Commerce Infrastructure`
  - H1: `Infrastructure for AI agents that discover and use digital services.`
  - Hero Lede: `Satelink is programmatic infrastructure for AI agents and automated systems to discover services, evaluate options, and access APIs through controlled, machine-readable workflows. Built by Jakuraa.`
  - Loop Title: `Discover, evaluate, authorize, meter, pay, settle`
  - Added FAQ Item:
    - *Question:* `What is agent procurement?`
    - *Answer:* `Agent procurement is the automated discovery, evaluation, authorization, metering, and payment for digital services by software agents. Satelink provides machine-readable specifications and payment rails that allow autonomous systems to procure supported APIs programmatically.`
- **Reason:** Restores true platform identity; eliminates Trading AI monopoly; articulates agent procurement as the central business objective.
- **Evidence:** Codebase capabilities (discovery JSON, x402 on Base, RevenueVaultV2 on Polygon, API metering); founder directive.
- **Risk & Mitigation:** Low risk. Strictly conforms to AST claims-lint (zero unlabelled numbers, zero performance promises); preserves existing SectionHeader, Card, and Disclosure components.
- **Test:** `npm run lint:claims --workspace=web` and `npm run test:run --workspace=web` (`phase7-site.test.ts`).

---

### File 2: Satelink Root Metadata (`apps/web/src/app/layout.tsx`)
- **Route:** Site-wide root layout
- **Target Component:** `metadata` export and `ORG_JSON_LD`
- **Current Copy:**
  - `title.default`: `Satelink Trading AI — AI trading operating system for people, AI agents and machines`
  - `description`: `Reason, validate, score, authorize, execute, learn. AI proposes; deterministic risk and your signed mandate decide. You keep custody; withdrawals are never enabled...`
- **Proposed & Implemented Copy:**
  - `title.default`: `Satelink — AI-Agent & Machine-Commerce Infrastructure`
  - `description`: `Programmatic infrastructure for AI agents and automated systems to discover digital services, evaluate options, and access APIs through controlled, machine-readable workflows.`
  - Keywords: Updated to include `machine commerce`, `agent procurement`, `x402`, `API metering`, `Polygon RPC`.
  - `ORG_JSON_LD.description`: `AI-agent and machine-commerce infrastructure for programmatic service discovery, metering, and settlement. Featuring Satelink Trading AI (controlled beta) and metered Polygon RPC. Operated by Jakuraa Commercial Pvt Ltd.`
- **Reason:** Fixes brand identity drift across search engines, browser tabs, and OpenGraph unfurls.
- **Evidence:** Platform architecture and multi-service catalogue.
- **Risk & Mitigation:** Low risk. Pure metadata change.
- **Test:** `phase7-site.test.ts` assertion for root metadata title.

---

### File 3: Satelink Docs Index (`apps/web/src/app/docs/page.tsx`)
- **Route:** `/docs`
- **Target Component:** Page header and lede
- **Current Copy:** Opens with documentation exclusively for Trading AI.
- **Proposed & Implemented Copy:**
  - Description: Reference documentation for the Satelink AI-agent & machine-commerce platform, metered Polygon RPC, and Trading AI paper beta.
  - Page lede: Frames Satelink as infrastructure for AI agents, links to RPC and x402 specs, and preserves the mandatory paused node operator notice.
- **Reason:** Developers arriving at documentation must find platform infrastructure rather than only trading docs.
- **Evidence:** `apps/api` endpoints and existing markdown documentation.
- **Risk & Mitigation:** Low risk. Preserves layout and paused banner.
- **Test:** `npm run build --workspace=web`.

---

### File 4: Jakuraa Homepage (`apps/corporate/app/page.tsx`)
- **Route:** `https://jakuraa.com/`
- **Target Component:** Hero, Telemetry Section, Flagship Satelink Section
- **Current Copy:**
  - H1: `We build the AI that trades within your rules.`
  - Hero Lede: Conflates corporate parent with trading AI application.
  - Telemetry: `SETTLEMENT LATENCY: Sub-second (< 400ms)` / `TRANSACTION OVERHEAD: < $0.0001 per call`
  - Satelink Section H2: `Satelink: AI trading agents and machine commerce.`
- **Proposed & Implemented Copy:**
  - H1: `Building software infrastructure for an agent-driven economy.`
  - Hero Lede: `Jakuraa Commercial Private Limited, incorporated in Coimbatore in 2019, is a corporate technology institution developing software infrastructure for AI-agent workflows, programmatic service access, and machine commerce. Satelink is its flagship platform.`
  - Telemetry: Replaced with factual protocol settlement labels: `SETTLEMENT RAILS: Base (USDC) & Polygon (USDT)` and `SETTLEMENT MODEL: Non-Custodial On-Chain Receipts`.
  - Satelink Section H2: `Satelink: agent commerce and programmatic procurement.`
  - Satelink Section Lede: `Satelink is the flagship technology platform engineered by Jakuraa. It provides the programmatic service discovery, payment rails, vaults, and usage-metered gateways that let autonomous software agents and automated systems discover, evaluate, access, and procure digital capabilities per call...`
- **Reason:** Re-establishes parent corporate identity; eliminates unverified sub-400ms latency claim; emphasizes agent procurement.
- **Evidence:** MCA incorporation (2019), L2 finality reality, platform codebase.
- **Risk & Mitigation:** Low risk. Zero visual or CSS alterations.
- **Test:** `npm run lint:claims --workspace=@satelink/corporate` and `npm run build --workspace=@satelink/corporate`.

---

### File 5: Jakuraa Products Catalog (`apps/corporate/app/products/page.tsx`)
- **Route:** `https://jakuraa.com/products`
- **Target Component:** `FLAGSHIP` constant and `RAILS` array
- **Current Copy:**
  - Lede: `Its flagship product is Satelink Trading AI.`
  - Flagship Name: `Satelink Trading AI`
- **Proposed & Implemented Copy:**
  - Lede: `Jakuraa Commercial Private Limited builds and operates Satelink as its flagship technology platform.`
  - Flagship Name: `Satelink Platform`
  - Flagship Line: `AI-agent and machine-commerce infrastructure for programmatic service discovery, procurement, metering, and settlement.`
  - Rails item: `Agent Procurement & Machine Commerce` (`https://satelink.network/products/machine-commerce`).
- **Reason:** Aligns product hierarchy with corporate parent model (Anthropic -> Claude -> Claude Code pattern).
- **Evidence:** Satelink contains multiple active rails beyond Trading AI.
- **Risk & Mitigation:** Low risk.
- **Test:** Build and claims lint pass.

---

### File 6: Jakuraa Corporate Navigation (`apps/corporate/content/navigation.ts`)
- **Route:** Global corporate nav
- **Target Component:** `primaryNav`
- **Current Copy:** `{ label: 'Research', href: '/news' }`, `{ label: 'Systems', href: '/businesses' }`
- **Proposed & Implemented Copy:** `{ label: 'Research', href: '/research' }`, `{ label: 'Systems', href: '/systems' }`
- **Reason:** Eliminates link misdirection; routes visitors to existing dedicated `/research` and `/systems` pages.
- **Evidence:** Both pages exist in `apps/corporate/app/` with active content.
- **Risk & Mitigation:** Zero risk.
- **Test:** Build prerenders both routes cleanly.

---

### File 7: Jakuraa Machine-Readable Declaration (`apps/corporate/app/llms.txt/route.ts`)
- **Route:** `https://jakuraa.com/llms.txt`
- **Target Component:** New dynamic Route Handler
- **Current State:** HTTP 404 in production.
- **Proposed & Implemented Copy:** Returns plain-text markdown declaring Jakuraa Commercial Private Limited, CIN, incorporation details, Satelink as flagship platform, verified capabilities, and authoritative links.
- **Reason:** Solves GEO gap where AI search crawlers had no machine-readable declaration on the corporate domain.
- **Evidence:** MCA filings, DGFT registration, Udyam certificate.
- **Risk & Mitigation:** Low risk. Cache-Control 300s.
- **Test:** `npm run build --workspace=@satelink/corporate` prerenders 33/33 routes.

---

### File 8: Developer SDK Metadata (`packages/sdk/package.json` & `README.md`)
- **Target Component:** `description`, `keywords`, and README text
- **Current Copy:** `Official SDK for the Satelink DePIN network — RPC, MEV relay...`
- **Proposed & Implemented Copy:** `Official SDK for the Satelink machine-commerce network — RPC gateway, x402 payments, and agent tools`. AI example query updated to `What is machine commerce?`.
- **Reason:** Eliminates legacy DePIN miner confusion.
- **Evidence:** Satelink is software infrastructure, not a hardware miner token network.
- **Risk & Mitigation:** Low risk.
- **Test:** Package JSON syntax valid.

---

### File 9: Shared GEO Generator (`packages/seo/src/llms.ts`)
- **Target Component:** `generateLlmsTxt`
- **Current Copy:** Defined Satelink exclusively as an AI trading operating system.
- **Proposed & Implemented Copy:** Defines Satelink as infrastructure platform for autonomous AI agents to discover, procure, and pay for services, with Trading AI properly framed as the first paper-beta application.
- **Reason:** Prevents LLM search engines from generating outdated or one-dimensional summaries.
- **Evidence:** Core architecture.
- **Risk & Mitigation:** Low risk. Validated by `llms-freshness.test.ts`.
- **Test:** `npm run test:run --workspace=web`.

---

### File 10: Test Regression Guard (`apps/web/test/phase7-site.test.ts`)
- **Target Component:** Homepage assertions
- **Changes:** Updated regex checks to match approved new headlines (`/Infrastructure for AI agents that discover and use digital services\./` and `/Discover, evaluate, authorize, meter, pay, settle/`).
- **Reason:** Keeps the automated continuous integration suite green while enforcing the new repositioning standard.
- **Test:** Vitest passes 251/251 tests across 20 files.
