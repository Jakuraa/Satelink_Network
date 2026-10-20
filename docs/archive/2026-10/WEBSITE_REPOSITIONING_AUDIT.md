# WEBSITE REPOSITIONING AUDIT REPORT
## Comprehensive Audit of Satelink Network and Jakuraa Commercial Private Limited

**Date:** 2026-10-16  
**Auditor:** Senior Website Auditor, Information Architect & Technical SEO Engineer  
**Repositories & Workspaces:**  
- Monorepo: `satelink-provider` (`/Users/pradeepjakuraa/satelink`)  
- Flagship Platform Website: `apps/web` (`https://satelink.network/`)  
- Corporate Parent Website: `apps/corporate` (`https://jakuraa.com/`)  
- Shared Libraries: `packages/content`, `packages/seo`, `packages/ui`, `packages/web-ui`, `packages/sdk`  
**Current Working Branch:** `feat/evidence-led-repositioning` (isolated from production)  
**Primary Directive:** Reposition both websites to reflect actual business strategy with high information density, strict capability truthfulness, clear product boundaries, strong SEO/GEO foundations, and surgical code/content changes. Zero visual redesign.

---

## 1. Source of Truth & Environment Baseline

### 1.1 Architecture & Repository Structure
- **Monorepo:** Managed via npm workspaces and Turborepo (`turbo.json`).
- **Frameworks:**
  - `apps/web`: Next.js 15.5.24 (App Router) + React 18.3.1 + Tailwind CSS + Lucide icons.
  - `apps/corporate`: Next.js 15.5.24 (App Router) + React 18.3.1 + Tailwind CSS v4 + Framer Motion + GSAP.
- **Statutory Source of Truth:** `packages/content/src/site.ts` & `apps/corporate/content/company.ts`:
  - Legal Entity: **Jakuraa Commercial Private Limited** (formerly *Falcor Commercial Private Limited*)
  - CIN: `U52190TZ2019PTC033093` (Incorporated 2019-12-04)
  - Registered Office: 38, 39, First Floor, Malaviya Street, Ramnagar, Coimbatore, Tamil Nadu 641009, India
  - GSTIN: `33AADCF9341B1Z1`
  - DGFT IEC: `AADCF9341B` (Coimbatore)
  - Udyam: `UDYAM-TN-03-0082507` (Micro enterprise, NIC 28199)

### 1.2 Baseline Verification Status (Pre-Modification)
- **`@satelink/corporate` Build:** `npm run build --workspace=@satelink/corporate` **PASSED** (Compiled in 4.4s, 32 static routes generated cleanly).
- **`@satelink/corporate` Claims Lint:** `npm run lint:claims --workspace=@satelink/corporate` **PASSED** (54 files, 0 findings).
- **`@satelink/corporate` TypeScript:** `npx tsc --noEmit` **PASSED** (0 errors).
- **`web` Build:** `npm run build --workspace=web` **PASSED** (Compiled successfully, static/SSG routes generated).
- **`web` Claims Lint:** `npm run lint:claims --workspace=web` **PASSED** (strict 16 files, public 212 files, 0 findings).
- **`web` Unit Tests:** `npm run test:run --workspace=web` **PASSED** (20 test files, 251 tests passed).
- **`web` Raw TypeScript (`npx tsc --noEmit`):** Pre-existing 60 errors in internal admin pages (`src/app/admin/command-center/page.tsx`), e2e tests, and Dodo webhook type mismatch. None of these affect the public marketing sites.

---

## 2. Satelink Current-State Audit (`apps/web`)

### 2.1 The "AI Trading Operating System" Monopoly
- **Finding:** In Phase 7, the homepage (`apps/web/src/app/(marketing)/page.tsx`) and root layout metadata (`apps/web/src/app/layout.tsx`) were pivoted completely to "Satelink Trading AI — an AI trading operating system for people, AI agents and machines".
- **Problem:** This misrepresents Satelink's core business identity. Satelink is fundamentally an **AI-agent and machine-commerce infrastructure platform** (programmatic service discovery, API procurement, metering, and settlement). Trading AI is its *first intended application* (currently in private beta, paper trading only), not the company itself. Furthermore, it buried Machine Commerce into a minor card at the bottom of the homepage.
- **Evidence:**
  - `apps/web/src/app/(marketing)/page.tsx` line 1: `// Home (Phase 7) — Satelink Trading AI first, machine commerce second.`
  - `apps/web/src/app/(marketing)/page.tsx` line 18: `title: "Satelink Trading AI — an AI trading operating system for people, AI agents and machines"`
  - `apps/web/src/app/layout.tsx` line 26: `default: "Satelink Trading AI — AI trading operating system for people, AI agents and machines"`
- **Severity:** CRITICAL (P0).

### 2.2 Legacy DePIN Positioning
- **Finding:** While marketing copy in `apps/web` has eliminated DePIN slogans, legacy DePIN wording remains in developer packages.
- **Evidence:**
  - `packages/sdk/package.json` line 4: `"description": "Official SDK for the Satelink DePIN network — RPC, MEV relay, AI inference, and blockchain tools"`
  - `packages/sdk/README.md` line 9: `Official SDK for the Satelink DePIN network`
- **Problem:** Confuses developers and investors about whether Satelink is a hardware DePIN miner network or software agent infrastructure.
- **Severity:** HIGH (P1).

### 2.3 Trading AI Status & Boundaries
- **Finding:** The dedicated `/trading-agent/*` sub-pages are well-disciplined with disclaimers:
  - "Paper trading in controlled beta. Live execution is not yet available."
  - "AI proposes; deterministic risk and your signed mandate decide; you keep custody."
  - "Not investment advice."
  - Branch history confirms branch `trading-agent/stage-33-first-trade` is in progress; **no verified live trade has ever been completed**.
- **Requirement:** Ensure that all references to Trading AI across both websites clearly describe it as *private beta* or *experimental paper trading*, never claiming profitability, live trade completion, or execution readiness.
- **Severity:** CRITICAL (P0).

### 2.4 RPC and Machine Commerce Infrastructure
- **Finding:**
  - RPC is live on Polygon PoS (chain 137) at flat rate `$0.00003` per call (`https://rpc.satelink.network/rpc/polygon`).
  - Keyless x402 payment rail is live on Base (USDC eip155:8453) at `$0.10` for 1,000 calls.
  - USDT credit deposits live on Polygon into `RevenueVaultV2` (`0x577D3716d6Ad5b676d230f5409deF9838FABaCEF`).
  - Discovery endpoint is live at `https://rpc.satelink.network/.well-known/satelink.json`.
  - Trading Intelligence API is live at `https://rpc.satelink.network/v1/intelligence` returning 4 derived market metrics ($0.01/call or $9.99 Starter Pack via Dodo).
- **Boundaries:** RPC is one production service within the broader machine commerce platform, not the entire future of the company. Do not overclaim multi-chain coverage beyond Polygon.
- **Severity:** MEDIUM (P2).

### 2.5 Node Operator Program State
- **Finding:** The node operator program was paused in earlier phases, and earnings claims were replaced with the notice: `"The node operator program is paused. Operator payouts are not active."`
- **Verification:** All `/network/*` routes are excluded from sitemap and tagged `noindex`. This truthful status must be strictly maintained.
- **Severity:** HIGH (P1).

---

## 3. Jakuraa Current-State Audit (`apps/corporate`)

### 3.1 Conflation of Corporate Institution with Satelink Product
- **Finding:** The Jakuraa homepage (`apps/corporate/app/page.tsx`) currently leads with:
  - H1: `"We build the AI that trades within your rules."`
  - Lede: `"Jakuraa Commercial Private Limited, incorporated in Coimbatore in 2019, builds Satelink Trading AI: an AI trading operating system for people, AI agents and machines..."`
- **Problem:** Jakuraa is the parent corporate technology institution, not the trading AI product. This completely obscures Jakuraa's institutional scope (commercial enterprise, technology engineering, physical & digital infrastructure, registered capabilities in international trade and industrial machinery).
- **Severity:** CRITICAL (P0).

### 3.2 Product Taxonomy Inconsistency on Corporate Products Page
- **Finding:** `apps/corporate/app/products/page.tsx` states: `"Its flagship product is Satelink Trading AI."`
- **Problem:** Satelink is the **flagship platform**, while Trading AI is merely one application within that platform. Calling Trading AI the flagship product inverts the corporate hierarchy.
- **Severity:** HIGH (P1).

### 3.3 Unverified Telemetry & Performance Metrics
- **Finding:** `apps/corporate/app/page.tsx` lines 224-233 displays an architecture diagram with:
  - `SETTLEMENT LATENCY: Sub-second (< 400ms)`
  - `TRANSACTION OVERHEAD: < $0.0001 per call`
- **Problem:** Unverified, unmeasured performance claims violate the truthfulness rules. Layer 2 blockchain finality varies and sub-400ms settlement is not a measured guarantee.
- **Severity:** HIGH (P1).

### 3.4 Navigation Link Discrepancies
- **Finding:** In `apps/corporate/content/navigation.ts`:
  - `{ label: 'Research', href: '/news' }` (points to `/news`, despite a dedicated `/research` route existing).
  - `{ label: 'Systems', href: '/businesses' }` (points to `/businesses`, despite a dedicated `/systems` route existing).
- **Severity:** MEDIUM (P2).

---

## 4. Material Issue Log

| Issue ID | Website & Route | Current Claim / Content | Evidence & Source | Severity | Proposed Correction | Exact File / Component | Expected Benefit | Risk & Mitigation | Authorized? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ISS-01** | Satelink (`/`) | H1: "An AI trading operating system for people, AI agents and machines." | `apps/web/src/app/(marketing)/page.tsx` | **Critical (P0)** | Reposition H1 to: "Infrastructure for AI agents that discover and use digital services." Position Satelink as machine-commerce infrastructure; Trading AI as first application (Beta). | `apps/web/src/app/(marketing)/page.tsx` | Restores true business positioning; aligns with core architecture | Low risk; preserves existing layout, cards, and styling | Yes |
| **ISS-02** | Satelink (`layout.tsx`) | Title: "Satelink Trading AI — AI trading operating system..." | `apps/web/src/app/layout.tsx` | **Critical (P0)** | Change default title to: "Satelink — AI-Agent & Machine-Commerce Infrastructure". Update description, keywords, and Organization JSON-LD. | `apps/web/src/app/layout.tsx` | Fixes site-wide metadata drift and Knowledge Graph representation | Low risk; tested across all layouts | Yes |
| **ISS-03** | Jakuraa (`/`) | H1: "We build the AI that trades within your rules." | `apps/corporate/app/page.tsx` | **Critical (P0)** | Change H1 to: "Building software infrastructure for an agent-driven economy." Lede defines Jakuraa as parent tech institution, Satelink as flagship platform. | `apps/corporate/app/page.tsx` | Re-establishes parent corporate identity without duplicating product copy | Low risk; keeps exact styling and layout | Yes |
| **ISS-04** | Jakuraa (`/products`) | "Its flagship product is Satelink Trading AI." | `apps/corporate/app/products/page.tsx` | **High (P1)** | Correct to: "Its flagship platform is Satelink, building AI-agent and machine-commerce infrastructure..." | `apps/corporate/app/products/page.tsx` | Corrects product taxonomy hierarchy | Low risk; zero visual changes | Yes |
| **ISS-05** | Jakuraa (`/`) | "SETTLEMENT LATENCY: Sub-second (< 400ms)" | `apps/corporate/app/page.tsx` | **High (P1)** | Replace unverified metric with factual protocol description: "Base L2 & Polygon PoS finality" / "Direct on-chain execution". | `apps/corporate/app/page.tsx` | Eliminates unverified latency claim | Low risk; technical accuracy improved | Yes |
| **ISS-06** | Satelink (`navigation.ts`) | Products menu leads with "Satelink Trading AI" as sole category title | `packages/content/src/navigation.ts` | **High (P1)** | Rebalance menu: "Platform & Rails" (Machine Commerce, API Metering) + "Applications" (Satelink Trading AI [Beta]). | `packages/content/src/navigation.ts` | Reflects actual platform hierarchy in header & footer | Low risk; schema-validated | Yes |
| **ISS-07** | Jakuraa (`navigation.ts`) | Research links to `/news`; Systems links to `/businesses` | `apps/corporate/content/navigation.ts` | **Medium (P2)** | Fix hrefs: Research -> `/research`, Systems -> `/systems`. | `apps/corporate/content/navigation.ts` | Fixes internal link integrity | Zero risk; targets existing pages | Yes |
| **ISS-08** | Satelink (`packages/sdk`) | "Official SDK for the Satelink DePIN network" | `packages/sdk/package.json`, `packages/sdk/README.md` | **High (P1)** | Replace legacy "DePIN" wording with: "Official SDK for the Satelink machine-commerce network — RPC gateway, x402 payments, and agent tools". | `packages/sdk/package.json`, `packages/sdk/README.md` | Eliminates obsolete DePIN terminology | Low risk; metadata only | Yes |
| **ISS-09** | Satelink (`packages/seo`) | LLM prompt and entity definition equates Satelink to Trading AI | `packages/seo/src/llms.ts` | **Medium (P2)** | Update `packages/seo/src/llms.ts` to define Satelink as machine-commerce infrastructure for AI agents, with Trading AI as an application. | `packages/seo/src/llms.ts` | Informs AI answer engines (GEO) with accurate core definition | Low risk; validated by tests | Yes |
| **ISS-10** | Satelink (`docs/page.tsx`) | "Satelink Trading AI is an AI trading operating system..." | `apps/web/src/app/docs/page.tsx` | **Medium (P2)** | Align docs overview to introduce Satelink platform infrastructure alongside Trading AI beta docs. | `apps/web/src/app/docs/page.tsx` | Prevents contradiction between docs and platform pages | Low risk; copy improvement | Yes |

---

## 5. Audit Conclusions & Implementation Clearance

The audit confirms that the codebase possesses all the necessary technical primitives (machine commerce, discovery JSON, x402 on Base, USDT vault on Polygon, metered RPC, derived intelligence metrics, and statutory company records).

The misalignment was primarily editorial and taxonomic: Phase 7 over-pivoted both websites to make the experimental *Trading AI* application the sole company identity, obscuring the *Platform* and the *Parent Corporate Institution*.

By correcting these headlines, descriptions, taxonomies, metadata, and link targets—while strictly preserving all visual styles, component structures, grids, and design tokens—both websites will truthfully and powerfully reflect the actual business strategy.
