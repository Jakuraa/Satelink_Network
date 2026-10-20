# REMAINING FOUNDER DECISIONS
## Satelink + Jakuraa Evidence-Led Full-Ecosystem Repositioning

**Date:** 2026-10-17  
**Branch:** `feat/evidence-led-repositioning`  
**Scope:** Strategic and operational decisions reserved exclusively for the founder.

---

## 1. Context & Status

All surgical content, taxonomy, metadata, machine-readable documentation, developer ecosystem, and test adjustments have been executed strictly according to evidence and founder directives on working branch `feat/evidence-led-repositioning`.

Both preview deployments have been successfully built and deployed to Vercel:
1. **Satelink Platform Preview:**  
   `https://web-816iyrpi9-satelinkinternet-collabs-projects.vercel.app`
2. **Jakuraa Corporate Preview:**  
   `https://jakuraa-corporate-4xd000um5-satelinkinternet-collabs-projects.vercel.app`

Local claims-lint checks and test suites pass 100%:
- `npm run lint:claims --workspace=web`: 212 public files, 16 strict files — 0 findings.
- `npm run lint:claims --workspace=@satelink/corporate`: 55 files — 0 findings.
- `npm run test:run --workspace=web`: 20 test files, 251 tests — 100% green.
- Next.js production builds: Both workspaces compile with zero errors.

The following strategic items cannot be resolved solely from source-code evidence and are submitted for founder determination.

---

## 2. Decision Log

### Decision 1: Production Deployment & Release Sign-Off
- **Context:** All surgical content modifications are staged on the local working branch `feat/evidence-led-repositioning` and live on Vercel Preview Deployments. Live production domains (`satelink.network` and `jakuraa.com`) remain completely untouched.
- **Options for the Founder:**
  - **Option A (Recommended):** Review the staged diff and preview URLs, and upon approval authorize merging `feat/evidence-led-repositioning` to `main` and deploying to production.
  - **Option B:** Maintain the preview deployment for internal stakeholder review prior to production release.

---

### Decision 2: Scope of Dodo Payments on Marketing Surfaces
- **Context:** Satelink operates two distinct payment models:
  1. *Machine-Commerce Rails:* Keyless x402 micropayments in USDC on Base, and prepaid USDT credit deposits into `RevenueVaultV2` on Polygon PoS.
  2. *Human Developer Checkout:* One-time $9.99 Starter Pack for Trading Intelligence processed via card/UPI by Dodo Payments.
- **Current Position:** Dodo Payments is strictly confined to the Trading Intelligence product pages (`/products/trading-intelligence`), while the global navigation, hero, and machine-commerce pages highlight purely autonomous machine rails (x402 and USDT vaults).
- **Options for the Founder:**
  - **Option A (Recommended):** Keep Dodo Payments confined to the Trading Intelligence page so the core Satelink identity remains pure machine-to-machine commerce.
  - **Option B:** Surface card/UPI starter packs in the primary pricing matrix for non-crypto developers.

---

### Decision 3: Public Disclosure of Broker Paper-Trading Connectors
- **Context:** The repository contains experimental connector code for Alpaca paper trading, Binance testnet, and Upstox sandbox. To prevent regulatory or partner misrepresentation, current public marketing copy describes these only generically as: `"Connector abstractions under active development for broker sandboxes."`
- **Options for the Founder:**
  - **Option A (Recommended):** Retain generic sandbox descriptions until formal developer API agreements or partner terms are executed.
  - **Option B:** Explicitly name supported paper-trading sandbox brokers in documentation, with bold disclaimers that Satelink has no affiliation or endorsement from those institutions.

---

### Decision 4: Lifecycle of Paused Node Operator Program
- **Context:** Per non-negotiable founder directives, all historical node operator pages feature the mandatory notice: `"The node operator program is paused. Operator payouts are not active."` These routes (`/network/*`, `/node/*`) are excluded from sitemaps and tagged `noindex`.
- **Options for the Founder:**
  - **Option A (Recommended):** Keep the paused notice on orphaned routes to ensure complete transparency for legacy node operators who may hold bookmarks.
  - **Option B:** Fully sunset and 301 redirect `/network/*` and `/node/*` to `/products/rpc` once legacy community communications are finalized.
