# Reference Information Architecture: Claude.com and Anthropic.com

**Document:** `docs/website-repositioning/reference-information-architecture.md`  
**Date:** 2026-10-16  
**Auditor:** Information Architect & Technical SEO Engineer  
**Inspection Targets:**  
- Product Platform: https://claude.com/  
- Corporate & Research Parent: https://www.anthropic.com/  
**Purpose:** Extract information-density patterns, corporate/product separation models, and discoverability structures to guide the repositioning of Satelink (product platform) and Jakuraa (corporate parent), while strictly honoring the zero-visual-redesign constraint.

---

## 1. Above-the-Fold Identity & Positioning

### Claude.com (The Product Platform)
- **Above the fold:** Immediate, utility-driven value proposition.
- **Title / Meta:** `"Claude is a next generation AI assistant built by Anthropic and trained to be safe, accurate, and secure to help you do your best work."`
- **Hero Statement:** Direct, punchy headline (`"Think fast, build faster"`) paired immediately with audience paths: individual, enterprise, and developer actions.
- **Parent attribution:** Directly declares parentage in metadata and page structure (`publisher: Anthropic PBC`) without allowing the parent's corporate/research scope to crowd out product discovery.

### Anthropic.com (The Corporate & Research Parent)
- **Above the fold:** Mission, institutional legitimacy, and safety governance.
- **Title / Meta:** `"Anthropic is an AI safety and research company that's working to build reliable, interpretable, and steerable AI systems."`
- **Hero Statement:** Focuses on frontier research, public benefit governance, and safety milestones (`"products that put safety at the frontier"`).
- **Product attribution:** Surfaces Claude as its flagship product achievement, linking out directly (`Try Claude`, `Claude.ai`, `Claude Console`), but remains an enterprise/research institution.

### Application to Satelink & Jakuraa
- **Satelink (`apps/web`):** Position as the **AI-agent and machine-commerce infrastructure platform**. Hero immediately answers:
  1. What is Satelink? Programmatic infrastructure for AI agents to discover, evaluate, access, and procure digital services.
  2. Who is it for? AI agent developers, automated workflows, quantitative teams.
  3. What is live? Polygon PoS RPC gateway, x402 keyless micropayments on Base, prepaid USDT vaults.
  4. What is beta? Satelink Trading AI (controlled paper-trading beta; zero live trade execution).
- **Jakuraa (`apps/corporate`):** Position as the **corporate technology institution** (incorporated 2019 in Coimbatore). Explains corporate governance, statutory capabilities (MOA wholesale trade, software publishing, DGFT international trade, Udyam industrial machinery), and introduces Satelink as its flagship technology platform.

---

## 2. Communication of Problem, Value Proposition, Capabilities, Audiences & Next Steps

| Dimension | Anthropic.com Pattern | Claude.com Pattern | Satelink / Jakuraa Translation |
| :--- | :--- | :--- | :--- |
| **The Problem** | Frontier AI systems pose alignment, interpretability, and safety risks that require rigorous research. | Modern workflows are fragmented, slow, and constrained by legacy tools lacking intelligent reasoning. | Autonomous software agents lack programmatic discovery, payment rails, and deterministic risk controls to procure digital services. |
| **Value Proposition** | Foundational AI safety research that translates directly into reliable commercial systems. | High-capability AI that reasons, codes, analyzes, and operates safely inside enterprise workflows. | Machine-native infrastructure: agents discover priced APIs via machine-readable catalogues, pay keylessly via HTTP 402, and settle on-chain. |
| **Capabilities** | Research teams (Alignment, Interpretability, Red Team, Economics), RSP, Constitution. | Artifacts, Connectors, Skills, Claude Code, Models (Opus, Sonnet, Haiku). | Machine Discovery (`/.well-known/satelink.json`), HTTP 402 rails (Base USDC), Metered RPC (Polygon 137), Paper Trading AI (Beta). |
| **Audiences** | Researchers, enterprise buyers, policymakers, institutions, prospective talent. | Developers, Enterprise leaders, individual practitioners, technical teams. | Autonomous AI Agents (programmatic callers), Developers (API consumers/integrators), Enterprise (mandate & spending controls). |
| **Next Steps (CTA)** | Read Research, Review Policy, Explore Careers, "Try Claude". | "Explore plans", "Developer docs", "Console", "Contact sales". | "Explore documentation" (`https://docs.satelink.network`), "Request beta access" (`/contact-sales?interest=beta`). |

---

## 3. Separation of Product Categories from Parent Identity

### Anthropic vs. Claude Separation Rules
1. **Domain Isolation:** `anthropic.com` is the institutional hub; `claude.com` (and `claude.ai`) is the product execution surface.
2. **Entity Typing:** In JSON-LD, Anthropic is typed `@type: Organization` (legal name: Anthropic PBC); Claude is typed `@type: WebSite` and `@type: Brand`, published by Anthropic.
3. **No Monopolization:** Anthropic does not call itself "Claude PBC". Claude does not pretend to be a research institute; it is a software product.
4. **Application Nesting:** Sub-products (Claude Code, Claude Security, Claude Science, Claude Console) sit under the Claude brand as capabilities/applications, not as competing companies.

### Architectural Blueprint for Satelink & Jakuraa
```
┌─────────────────────────────────────────────────────────────┐
│             Jakuraa Commercial Private Limited              │
│       (Corporate Parent, Technology Institution, 2019)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Operates & Engineers
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Satelink Network                       │
│    (AI-Agent & Machine-Commerce Infrastructure Platform)    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       Active Infrastructure             Application Layer
               │                               │
  ┌────────────┴────────────┐             ┌────┴────────────┐
  │  Machine Discovery      │             │ Satelink        │
  │  HTTP 402 Pay-Per-Call  │             │ Trading AI      │
  │  Polygon PoS RPC        │             │ (Controlled     │
  │  Prepaid Credit Vaults  │             │  Paper Beta)    │
  │  Trading Intelligence   │             └─────────────────┘
  └─────────────────────────┘
```

---

## 4. Explanatory Depth: Summaries, FAQs, Proof Points & Technical Resources

- **Progressive Disclosure:** Reference sites employ short 1-line value statements above the fold, followed by structured cards with 2-3 sentence technical explanations, expandable deep-dive accordions, and links to raw documentation.
- **Proof Points Over Buzzwords:** Anthropic and Claude avoid generic claims like "best in class" or "revolutionary". Instead, they cite:
  - Exact model names and benchmark evaluations.
  - Parameter windows and context limits (e.g., 200k tokens).
  - Explicit rate limits and unit costs ($/MTok).
- **Transferable Pattern for Satelink:**
  - Flat $0.00003 per RPC call on Polygon PoS.
  - x402 discovery bundle: $0.10 for 1,000 calls in USDC on Base (eip155:8453).
  - RevenueVaultV2 smart contract address on Polygon (`0x577D3716d6Ad5b676d230f5409deF9838FABaCEF`).
  - Standard JSON-RPC methods (`eth_blockNumber`, `eth_getBalance`, `eth_call`).
  - Verifiable scorecard outputs (GO, WAIT, REJECT) with hard gates that fail closed.

---

## 5. Navigation & Taxonomy Groupings

### Claude.com Navigation Model
- **Products:** Claude, Claude Code, @Claude; Specialized (Security, Science); Capabilities (Artifacts, Connectors, Skills); Extensions (Chrome, Microsoft 365); Models (Opus, Sonnet, Haiku).
- **Developers:** Build with (Claude Code, Platform); For developers (Academy, Community, Developer blog); Footer actions (Developer docs, Console).
- **Enterprise:** Overview, Claude Code for Enterprise, Platform; Use Cases (Agents, Coding, Commerce); Departments; Industries.
- **Pricing:** Direct link to pricing matrix.

### Anthropic.com Navigation Model
- **Research:** Overview, Alignment, Economics, Engineering, Frontier Red Team, Interpretability, Science, Societal Impacts.
- **Policy & Commitments:** Constitution, RSP, Transparency, Policy on AI Exponential.
- **Learn:** Academy, Tutorials, Use cases, Developer docs.
- **Company:** About, Leadership, Careers.

### Applied Navigation Structure for Satelink & Jakuraa (Content-Only)
- **Satelink (`packages/content/src/navigation.ts`):**
  - Products: Machine Commerce, RPC Infrastructure, x402 Machine Payments, API Metering, Trading Intelligence, Satelink Trading AI (Beta).
  - Solutions: AI Agents, Machine Commerce, Developers, Enterprise.
  - Developers: Documentation, Quickstart, RPC Gateway, x402 Protocol, MCP Tools.
  - Platform: Machine Identity, Payments, Settlement, Metering.
- **Jakuraa (`apps/corporate/content/navigation.ts`):**
  - Products (`/products`) -> Satelink platform and application rails.
  - Systems (`/systems`) -> Enterprise technology, industrial trade, physical infrastructure.
  - History (`/history`) -> Company journey since 2019 incorporation.
  - Research (`/research`) -> Systems research and engineering papers.
  - Technology (`/technology`) -> Tech stack and infrastructure specifications.
  - About (`/company`) -> Corporate entity, statutory governance, leadership.
  - Contact (`/contact`) -> Statutory office and enquiries.

---

## 6. Information Density Gradient: Homepage vs. Deeper Pages

- **Homepage Standard:** High signal-to-noise overview. Answer-first definition, primary workflow loop, capability boundary, active services overview, comprehensive FAQ, and low-friction next steps.
- **Deeper Pages Standard:**
  - `/products/*`: Exact unit pricing, authentication headers, curl code samples, parameter schemas, input/output specifications.
  - `/solutions/*`: Real architectural scenarios, budget limit controls, failure modes, cryptographic receipt verifications.
  - `/docs/*`: Interactive endpoints, error codes (HTTP 402, 429, 502), SDK installation snippets (`@satelink/sdk`), JSON response payloads.

---

## 7. Techniques Applicable Through Text and Metadata Alone (PERMITTED)

1. **Answer-First Heading Hierarchy:** Converting generic marketing headings into factual, information-dense declarations (`Infrastructure for AI agents that discover and use digital services.`).
2. **Structured Micro-Copy:** Updating card subtitles to include exact chains, tokens, and settlement models (`Base (USDC)`, `Polygon (USDT)`).
3. **Explanatory FAQs with Schema.org JSON-LD:** Answering direct technical and institutional questions in visible DOM and reflecting verbatim in `FAQPage` structured data.
4. **Entity Separation in Metadata:** Setting root layout metadata to declare Jakuraa as the parent organization and Satelink as the infrastructure platform.
5. **GEO / LLM Ingestible Text:** Providing clean, machine-readable documentation in `llms.txt` and `llms-full.txt` that defines the exact entity hierarchy and capability status.
6. **Descriptive Link Anchor Text:** Replacing generic "Learn more" or "Read more" links with descriptive targets ("Explore documentation", "Trading AI overview").

---

## 8. Ideas Requiring Visual Redesign (STRICTLY PROHIBITED & EXCLUDED)

The following architectural techniques observed on Claude/Anthropic were evaluated and **explicitly rejected** to uphold the zero-visual-redesign constraint:

1. **Multi-Column Mega-Dropdown Panels:** Claude.com uses extensive 4-column mega menus with visual separators and category tabs. Prohibited: Preserved existing lightweight navigation components in both sites.
2. **Interactive Plan Selectors & Tabbed Sliders:** Claude.com uses custom tabbed pricing sliders and Webflow-driven plan switchers. Prohibited: Preserved existing static pricing tables and cards.
3. **Custom Video Embed Overlays & Word-Rotation Animations:** Anthropic.com uses GSAP/Webflow word-rotation keyframes (`animate-word`) and modal video embeds. Prohibited: Preserved existing Tailwind CSS styles and motion primitives.
4. **Asymmetric Grid Layouts & Custom Editorial Typography:** Anthropic.com uses proprietary editorial serif fonts (`Anthropic Serif`) and 12-column variable margin systems. Prohibited: Preserved existing Geist, IBM Plex Mono, and Tailwind design tokens.
5. **Floating Terminal Demos with Tab Switching:** Prohibited: Preserved existing pre-formatted code cards and terminal blocks without adding new interactive DOM elements.
