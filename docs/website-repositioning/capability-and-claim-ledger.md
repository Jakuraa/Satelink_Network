# Capability and Claim Ledger: Satelink Network and Jakuraa

**Document:** `docs/website-repositioning/capability-and-claim-ledger.md`  
**Date:** 2026-10-16  
**Status Authority:** Monorepo codebase, on-chain contract verifications, live API responses, statutory corporate filings  
**Classification Standards:**
- **`LIVE_VERIFIED`:** Operationally confirmed in production via live endpoints, real contract transactions, or public API responses.
- **`CODE_VERIFIED_ONLY`:** Implemented in codebase and passes tests, but production endpoint or external counterparties have not been independently tested.
- **`PRIVATE_BETA`:** Controlled access environment; functional in simulation or sandboxes only.
- **`EXPERIMENTAL`:** Partial implementation, sandbox connectors, or active research branch.
- **`PLANNED`:** Roadmap concept; no functional production implementation exists today.
- **`BLOCKED`:** Known technical or regulatory prerequisite prevents deployment.
- **`PAUSED`:** Intentionally suspended or deactivated.
- **`UNKNOWN`:** Evidence is contradictory or absent.

---

## 1. Master Capability Matrix & Claim Controls

| Area / Capability | Status | Exact Production Environment / Endpoint | Pricing & Currency | Technical Dependencies & Limits | Permitted Public Claim | Strictly Forbidden Claim |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Agent Procurement: Discovery** | `LIVE_VERIFIED` | `https://rpc.satelink.network/.well-known/satelink.json` | Free public read | HTTPS JSON catalogue of active endpoints and pricing. | "Machine-readable service discovery via `/.well-known/satelink.json`." | Claiming universal discovery across arbitrary third-party web APIs. |
| **Agent Procurement: Machine Payments** | `LIVE_VERIFIED` | Base mainnet (`eip155:8453`) & Polygon PoS (`137`) | $0.10 per 1,000 calls (USDC on Base) | x402 middleware parses payment headers and verifies on-chain transfers. | "Keyless pay-per-call via HTTP 402 in USDC on Base; prepaid USDT credits on Polygon PoS." | Claiming instant zero-fee gasless payments on every blockchain. |
| **Agent Procurement: Metering & Caps** | `LIVE_VERIFIED` | `apps/api/src/billing`, `apps/web/src/app/console/usage` | Flat per-call rate ($0.00003/RPC call) | Database ledger deducts per completed successful request; rejects on zero balance. | "Per-call usage metering with deterministic spend limits and zero post-paid surprises." | Claiming unmetered unlimited calls or post-paid commercial credit accounts. |
| **Agent Procurement: Universal Marketplace** | `EXPERIMENTAL` / `PLANNED` | N/A (Curated services only) | N/A | Restricted to in-house RPC and Trading Intelligence APIs. | "Building infrastructure for autonomous AI agents to discover, evaluate, and procure digital capabilities." | **FORBIDDEN:** Claiming Satelink is an open universal marketplace selling thousands of cloud APIs today. |
| **Blockchain RPC Gateway** | `LIVE_VERIFIED` | `https://rpc.satelink.network/rpc/polygon` | Flat **$0.00003 per call** (USDT or USDC) | Polygon PoS mainnet (Chain ID 137). Standard Ethereum JSON-RPC methods only. | "Metered Polygon PoS JSON-RPC gateway at flat $0.00003 per call." | **FORBIDDEN:** Claiming multi-chain coverage (Solana, Bitcoin, Ethereum L1) or unmetered free tiers. |
| **x402 Protocol Rails** | `LIVE_VERIFIED` | Base mainnet (`eip155:8453`) | $0.10 for 1,000 calls (USDC) | Open-source `x402-kit` (MIT). Keyless request returns HTTP 402 with parameters. | "Keyless HTTP 402 micropayment rail in USDC on Base." | Conflating Base USDC with Polygon USDT; claiming off-chain credit card support for x402. |
| **Prepaid Credit Vault** | `LIVE_VERIFIED` | `RevenueVaultV2` at `0x577D3716d6Ad5b676d230f5409deF9838FABaCEF` (Polygon 137) | Minimum deposit per vault rules (USDT) | Verified smart contract. Deposit listener tracks on-chain events and credits API keys. | "Prepaid USDT deposits to RevenueVaultV2 on Polygon PoS." | Claiming support for arbitrary unverified ERC-20 tokens or yield generation. |
| **Trading Intelligence Analytics** | `LIVE_VERIFIED` | `https://rpc.satelink.network/v1/intelligence` | $0.01 per call (crypto rail); **$9.99 Starter Pack** (Dodo Payments card/UPI) | 4 derived metrics: funding-rate heatmap, open-interest shifts, liquidation clusters, microstructure. | "Derived market analytics API bought per call or via one-time $9.99 Starter Pack." | Claiming trading signals, alpha, price predictions, or recurring subscription billing. |
| **Trading AI: Reasoning & Risk Engine** | `PRIVATE BETA` | `/trading-agent/*` routes | Free controlled beta access | Deterministic rule gates (loss collars, concentration limits, TOTP signed mandates). Fails closed. | "AI models propose; deterministic risk engines and signed user mandates decide." | Claiming predictive certainty, superior intelligence, or autonomous order placement. |
| **Trading AI: Live Order Execution** | **`BLOCKED` / `EXPERIMENTAL`** | `trading-agent/stage-33-first-trade` (in-progress branch) | None | **ZERO live trades completed to date.** All live execution is strictly disabled in code and UI. | "Paper trading in controlled beta. Live execution is not yet available." | **STRICTLY FORBIDDEN:** Claiming live trades, real profits, win rates, returns, or market outperformance. |
| **Custody & Broker Withdrawals** | `LIVE_VERIFIED` (Non-Custodial) | Architectural boundary | N/A | Satelink rejects withdrawal permissions upon broker key import. Funds remain at broker. | "Strictly non-custodial; funds remain at your broker; withdrawals are never enabled." | Claiming banking deposits, fund escrow, asset custody, or portfolio management. |
| **Node Operator / DePIN Program** | **`PAUSED`** | `apps/web/src/lib/operator-program.ts` | Payouts inactive | Node operator rewards and recruitment have been suspended. | "The node operator program is paused. Operator payouts are not active." | **STRICTLY FORBIDDEN:** Advertising node earnings, APY, 50% revenue share, or node hardware sales. |
| **Jakuraa Corporate Entity** | `LIVE_VERIFIED` | MCA India, DGFT Coimbatore | N/A | Certificate of Incorporation (2019-12-04), CIN `U52190TZ2019PTC033093`, GSTIN `33AADCF9341B1Z1`. | "Jakuraa Commercial Private Limited is an Indian corporate technology institution founded in 2019." | Claiming public listing, venture funding rounds, or unrelated trading volume. |
| **Jakuraa Statutory Capabilities** | `LIVE_VERIFIED` (Registered) | MOA Objects 3(a), 3(b)(6), DGFT IEC `AADCF9341B`, Udyam `UDYAM-TN-03-0082507` | N/A | Statutory business objects cover wholesale/retail trade, software publishing, foreign trade, machinery. | "Holds registered capabilities for software publishing, wholesale trade, and international trade." | Claiming operational physical factories, shipping lines, or active commodity trading. |

---

## 2. Critical Clarifications and Boundary Distinctions

### A. Agent Procurement: Strategic Objective vs. Current State
- **The Strategic Objective:** Satelink is being positioned as the programmatic infrastructure layer for agent commerce—allowing autonomous software agents to discover, evaluate, authorize, meter, pay for, and settle digital capabilities.
- **Current Technical Completeness:** Satelink operates production discovery (`/.well-known/satelink.json`), HTTP 402 handshake verification, on-chain vault settlement, and metered usage for **curated endpoints** (Polygon PoS RPC, Trading Intelligence).
- **Guardrail:** Never claim Satelink is an open universal marketplace where any third-party SaaS can be procured today. Describe the verified workflow accurately and frame broader catalog expansion as planned.

### B. Payment Rails: Base USDC vs. Polygon USDT
- **x402 Micropayments:** Operates on **Base mainnet (eip155:8453)** using **USDC**. It is **keyless**—the client receives an HTTP 402 with signed payment parameters, sends USDC, and receives the response without creating an account. The bundle price is **$0.10 for 1,000 calls**.
- **Prepaid Credit Vault:** Operates on **Polygon PoS (137)** using **USDT**. The client deposits USDT into `RevenueVaultV2` (`0x577D3716d6Ad5b676d230f5409deF9838FABaCEF`), which associates credits with an API key. Each call draws down from the key's balance at **$0.00003 per call**.
- **Guardrail:** Never confuse or merge these two rails. Do not claim USDC works in RevenueVaultV2 or that x402 settles on Polygon.

### C. Dodo Payments vs. Crypto Rails
- **Dodo Payments:** A human-oriented payment processor offering a **one-time $9.99 Starter Pack** for the Trading Intelligence API via Credit/Debit Cards and UPI. It is non-recurring and strictly decoupled from the crypto rails.
- **Guardrail:** Do not describe Dodo Payments as a machine-commerce rail. Machines pay via x402 or on-chain USDT deposits; humans buy starter packs via Dodo.

### D. Satelink Trading AI: Mandatory Disclaimers
The automated claims linter enforces zero-tolerance on Trading AI surfaces:
1. **Status:** Must always state: `"Paper trading in controlled beta. Live execution is not yet available."`
2. **Safety Boundary:** Must always state: `"AI proposes; deterministic risk and your signed mandate decide; you keep custody."`
3. **Non-Custodial:** Must always state: `"Your funds remain at your broker; withdrawals are never enabled."`
4. **Non-Advice:** Must always state: `"Not investment advice. Satelink does not manage funds or provide financial advice."`

---

## 3. Unresolved Claims and Edge Boundaries

1. **Broker Integration Sandboxes:** The repository contains connector abstractions for Alpaca paper trading, Binance testnet, and Upstox sandbox. None of these have been certified as official broker partnerships. Status: `EXPERIMENTAL`. Permitted public claim: "Connector abstractions under active development for broker paper sandboxes."
2. **Automated Dynamic Routing:** Architecture documents mention dynamic provider failover. The active production RPC proxy routes to configured upstream nodes on Polygon, but dynamic multi-broker routing remains `PLANNED`.
3. **Model Context Protocol (MCP) Server:** The repository contains `@satelink/mcp-server` (version 2.1.2) supporting polygon RPC tools. Its status on the public homepage is truthfully labelled as `"Not public yet"` / `"Private beta"`.
