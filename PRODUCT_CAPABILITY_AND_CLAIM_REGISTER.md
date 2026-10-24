# PRODUCT CAPABILITY AND CLAIM REGISTER
## Ground-Truth Inventory of Features, Readiness Status, Commercial Boundaries, and Claim Controls

**Date:** 2026-10-16  
**Status Authority:** Monorepo codebase, live contract audits, API endpoints, statutory documents  
**Classification Standards:**  
- **LIVE — VERIFIED:** Deployed capability tested successfully end-to-end.  
- **LIVE — PARTIALLY VERIFIED:** Core functional components work, but bounded to specific environments or workflows.  
- **PRIVATE BETA:** Controlled access environment; functional in testing/simulation only.  
- **EXPERIMENTAL:** Under active development; unverified against live execution or external counterparties.  
- **PLANNED:** Intended architectural roadmap; no functional execution implementation yet.  
- **BLOCKED / PAUSED:** Deliberately deactivated or awaiting external dependencies/approvals.  
- **UNVERIFIED:** Insufficient verifiable evidence to substantiate.

---

## 1. Capability Inventory

### 1.1 Satelink Machine Commerce Platform
| Feature / Sub-Capability | Status | Technical Evidence & Endpoint | Commercial Boundary / Limitations | Permitted Public Claim | Forbidden Claim |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Machine Discovery** | **LIVE — VERIFIED** | `/.well-known/satelink.json`, `/v1/intelligence` | Returns public JSON catalogue of endpoints, pricing, and required payment headers. | "Machine-readable service discovery via `/.well-known/satelink.json`." | Do not claim universal discovery across third-party marketplaces. |
| **HTTP 402 Pay-Per-Call Handshake** | **LIVE — VERIFIED** | x402-v1 middleware in `apps/api/src/middleware/x402.js` | Returns HTTP 402 with signed payment parameters for unpaid calls. | "HTTP-native 402 Payment Required handshake for keyless requests." | Do not claim instant support for every arbitrary fiat currency. |
| **x402 Keyless Payments (Base)** | **LIVE — VERIFIED** | Base mainnet (eip155:8453), USDC micro-transfers | Validated by open-source `x402-kit` (MIT) and on-chain settlements. | "Keyless pay-per-call in USDC on Base; $0.10 buys 1,000 calls." | Do not claim zero network gas costs or off-chain credit cards. |
| **Prepaid Credit Vault (Polygon)** | **LIVE — VERIFIED** | `RevenueVaultV2` at `0x577D3716d6Ad5b676d230f5409deF9838FABaCEF` (Polygon 137) | Deposit USDT once; calls draw down metered balance per key. First claim transaction: `0x814d348...`. | "Prepaid USDT deposits to RevenueVaultV2 on Polygon PoS." | Do not claim support for arbitrary unverified ERC-20 tokens. |
| **API Usage Metering & Caps** | **LIVE — VERIFIED** | `apps/api/src/billing`, `apps/web/src/app/console/usage` | Flat-rate metering deducted per completed call; rate limits and spending caps per key. | "Flat per-call metering with strict spend limits and no post-paid overage." | Do not claim unlimited unmetered enterprise calls. |
| **Automated Provider Routing** | **PLANNED** | Concept in architecture documents | Dynamic real-time broker/provider switching is under design. | "Planned automated routing across verified service providers." | Do not claim live universal broker switching or dynamic arbitrage. |
| **Universal Procurement Marketplace** | **EXPERIMENTAL** | Internal staging routes | Currently restricted to curated endpoints (RPC, Trading Intelligence). | "Programmatic procurement infrastructure for AI agents." | Do not claim an open universal commercial marketplace with thousands of vendors. |

---

### 1.2 Satelink Trading AI (Application Layer)
| Feature / Sub-Capability | Status | Technical Evidence & Endpoint | Commercial Boundary / Limitations | Permitted Public Claim | Forbidden Claim |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Agent Reasoning Engine** | **PRIVATE BETA** | `apps/web/src/app/(marketing)/trading-agent/ai` | Specialized models ingest market data and suggest order proposals. | "AI agents analyze market conditions and propose structured trading suggestions." | Do not claim predictive intelligence, market forecasting, or 'smart money'. |
| **Deterministic Risk Engine** | **PRIVATE BETA** | `apps/web/src/app/(marketing)/trading-agent/risk` | Fixed rule gates (max loss, concentration, collars, kill-switch). Fails closed. | "Deterministic hard gates and kill switches enforce risk limits without AI discretion." | Do not claim risk-free trading or guaranteed stop-loss execution. |
| **Scorecard (GO / WAIT / REJECT)** | **PRIVATE BETA** | Scorecard evaluation logic | Categorizes proposals into GO, WAIT, or REJECT based on gate validation. | "Deterministic scorecard outputs GO, WAIT, or REJECT with auditable evidence." | Do not claim score implies expected financial returns or profit probabilities. |
| **Signed Mandate Authorization** | **PRIVATE BETA** | TOTP / One-time code mandate signing | Every proposal requires signed mandate specifying limits and accounts. | "Orders require explicit signed mandates; users retain full operational authority." | Do not claim autonomous unconstrained fund movement. |
| **Broker Abstraction Rails** | **EXPERIMENTAL** | Alpaca paper API, Binance testnet, Upstox sandbox | Paper-trading and sandbox environments only. Connector stages in progress. | "Connector abstractions under active development for broker sandboxes." | Do not claim official partner status with brokers, SEBI/SEC approval, or live API links. |
| **Live Order Execution** | **EXPERIMENTAL** | `trading-agent/stage-33-first-trade` branch | **ZERO live trades completed to date.** Live execution disabled in all builds. | "Live execution is not yet available; paper trading in controlled beta." | **STRICTLY FORBIDDEN:** Claiming live trades, profits, win-rate, or execution readiness. |
| **Fund Custody & Withdrawals** | **LIVE — VERIFIED (Non-Custodial)** | Architecture constraint | Satelink never takes custody of funds; withdrawal permissions are rejected at key import. | "Non-custodial architecture; funds remain at your broker; withdrawals are never enabled." | Do not claim escrow services, banking deposits, or yield generation. |

---

### 1.3 Blockchain RPC Gateway & Infrastructure Services
| Feature / Sub-Capability | Status | Technical Evidence & Endpoint | Commercial Boundary / Limitations | Permitted Public Claim | Forbidden Claim |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Polygon PoS JSON-RPC** | **LIVE — VERIFIED** | `https://rpc.satelink.network/rpc/polygon` | Standard Ethereum JSON-RPC proxy to Polygon PoS mainnet (chain 137). | "Metered Polygon PoS JSON-RPC gateway at flat $0.00003 per call." | Do not claim multi-chain support for Solana, Bitcoin, or Ethereum L1. |
| **Anonymous / Keyless Access** | **LIVE — VERIFIED** | x402 headers on `/rpc/polygon` | Unauthenticated callers receive 402; payment completes call keylessly. | "Keyless pay-per-call with x402; no account registration required." | Do not claim permanent free unauthenticated access. |
| **Service Level & Uptime** | **LIVE — PARTIALLY VERIFIED** | Internal monitoring | Monitored by health probes; no statutory SLA or 99.99% uptime guarantee published. | "High-availability gateway with continuous monitoring." | Do not claim fabricated 99.999% uptime or <10ms global latency. |

---

### 1.4 Trading Intelligence Analytics API
| Feature / Sub-Capability | Status | Technical Evidence & Endpoint | Commercial Boundary / Limitations | Permitted Public Claim | Forbidden Claim |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Funding-Rate Heatmaps** | **LIVE — VERIFIED** | `/v1/intelligence/funding-rate-heatmap` | Derived statistical aggregate from public exchange feeds. Research input. | "Derived funding-rate analytics computed from public market data." | Do not claim proprietary trading signals or buy/sell recommendations. |
| **Open-Interest Shifts** | **LIVE — VERIFIED** | `/v1/intelligence/open-interest-shifts` | Derived statistical metric showing aggregate derivative positioning shifts. | "Derived open-interest statistics for quantitative researchers." | Do not claim directional alpha or guaranteed trend indicators. |
| **Liquidation Clusters** | **LIVE — VERIFIED** | `/v1/intelligence/liquidation-clusters` | Proxy/model estimation with explicit limitations. | "Model-estimated liquidation clusters with disclosed methodology limitations." | Do not claim exact visibility into confidential counterparty orderbooks. |
| **Market Microstructure** | **LIVE — VERIFIED** | `/v1/intelligence/market-microstructure` | Statistical volatility, spread, and depth metrics. | "Market microstructure metrics bought per call." | Do not claim market-making guarantees or insider exchange feeds. |
| **Dodo Credit Packs (Card/UPI)** | **LIVE — VERIFIED** | Dodo Payments checkout integration | One-time $9.99 Starter Pack for human developers (card/UPI). Non-recurring. | "One-time $9.99 Starter Pack processed via card/UPI by Dodo Payments." | Do not claim recurring subscription billing or automatic debit renewals. |

---

### 1.5 Node Operator & DePIN Program
| Feature / Sub-Capability | Status | Technical Evidence & Endpoint | Commercial Boundary / Limitations | Permitted Public Claim | Forbidden Claim |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Community Node Operator Program** | **BLOCKED / PAUSED** | `apps/web/src/lib/operator-program.ts` | **PAUSED.** All operator rewards and node recruitment are deactivated. | "The node operator program is paused. Operator payouts are not active." | **STRICTLY FORBIDDEN:** Advertising node earnings, 50% revenue share, APY, or recruitment. |

---

### 1.6 Jakuraa Corporate Registrations & Business Verticals
| Business Vertical / Area | Status | Statutory / Corporate Authority | Operational Scope | Permitted Public Claim | Forbidden Claim |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Corporate Parent Institution** | **LIVE — VERIFIED** | Certificate of Incorporation (2019-12-04), CIN `U52190TZ2019PTC033093` | Technology engineering, enterprise governance, digital and physical systems. | "Jakuraa Commercial Private Limited is a corporate technology institution founded in 2019." | Do not claim public listing, venture capital backing, or unverified valuations. |
| **Technology — Satelink** | **LIVE — VERIFIED** | MOA Object 3(b)(6): software development and publishing | Flagship software platform for AI agents and machine commerce. | "Satelink is Jakuraa's flagship AI-agent and machine-commerce platform." | Do not claim Jakuraa is merely a trading tool. |
| **Trading & Distribution** | **REGISTERED CAPABILITY** | MOA Main Object 3(a): wholesale/retail trade | Statutory registered capability covering wholesale trade, power tools, equipment. | "Registered capability for wholesale and retail trade under MOA Object 3(a)." | Do not claim active nationwide logistics warehouses or active trade turnover. |
| **International Trade** | **REGISTERED CAPABILITY** | DGFT Importer-Exporter Code `AADCF9341B` | Statutory license to import and export commercial goods. | "Holds an active Importer-Exporter Code issued by DGFT Coimbatore." | Do not claim active international shipping lanes or customs partnerships. |
| **Industrial Manufacturing** | **REGISTERED CAPABILITY** | Udyam Registration `UDYAM-TN-03-0082507` (NIC 28199) | Registered micro enterprise covering general-purpose machinery and parts. | "Udyam registered capability for general-purpose machinery (NIC 28199)." | Do not claim operational automated factories or mass production capacity. |
| **Publishing & Insights** | **PLANNED** | MOA Object 3(b)(1) | Future technical whitepapers, research write-ups, and systems analysis. | "Planned technical research and insights on machine economics." | Do not claim academic peer-reviewed journal publishing status. |

---

## 2. Claim-Risk Register & Content Guardrails

### 2.1 Strictly Forbidden Terms & Patterns
The automated claims linter (`scripts/claims-lint.mjs`) enforces zero-tolerance across both sites:

1. **Partnership & Regulatory Claims:**
   - *Forbidden:* `partner`, `partnership`, `affiliated with`, `endorsed by`, `approved by SEBI/SEC/RBI/FCA`, `certified by`, `licensed broker`, `official exchange partner`, `as seen on`.
   - *Reason:* No official regulatory certifications or exchange sponsorships exist. All broker interactions are client-side API integrations.
2. **Performance & Return Claims:**
   - *Forbidden:* `profit`, `profitable`, `returns`, `gains`, `yield`, `APY`, `ROI`, `win rate`, `beat the market`, `outperform`, `alpha`, `guarantee`, `risk-free`, `passive income`, `smart money`.
   - *Reason:* Satelink Trading AI is in paper-trading beta; historical or backtested simulations must be explicitly marked `<Hypothetical>`.
3. **Availability & Premature Live Claims:**
   - *Forbidden:* `trade now`, `start trading`, `sign up to trade`, `live trading is open`, `available today` (in relation to live execution).
   - *Reason:* Live execution is not operational; zero live trades have been executed.
4. **AI Overclaims:**
   - *Forbidden:* `predicts the market`, `never wrong`, `autonomous trading without risk`, `fully automated trading profits`.
   - *Reason:* AI models propose; deterministic rules and signed mandates decide.
5. **Unverified Technical Metrics:**
   - *Forbidden:* `sub-second (<400ms) settlement`, `99.999% uptime`, `zero latency`.
   - *Reason:* Must accurately describe network reality without fabricated SLAs.

### 2.2 Mandatory Disclaimers
- **Trading Agent & Financial Surfaces:**  
  `"Not investment advice. Satelink does not manage funds, provide financial advice, or execute live trades. Paper trading in controlled beta. AI proposes; deterministic risk and your signed mandate decide. You keep custody; withdrawals are never enabled."`
- **Trading Intelligence API:**  
  `"Derived statistical analytics computed from public market data. Intended as quantitative research inputs, not financial or investment advice."`
- **Node Operator Surfaces:**  
  `"The node operator program is paused. Operator payouts are not active."`
- **Registered Corporate Capabilities:**  
  `"Describes a statutory registration or corporate authorization; does not represent active commercial trading volumes, facilities, or customer accounts."`
