# Remaining Founder Decisions

**Document:** `docs/website-repositioning/remaining-founder-decisions.md`  
**Date:** 2026-10-16  
**Auditor / Engineer:** Information Architect & Systems Lead  
**Scope:** Actionable strategic and deployment decisions reserved exclusively for the founder.

---

## 1. Context & Status

All code, content, taxonomy, metadata, and test adjustments have been executed strictly according to evidence and founder directives on branch `feat/evidence-led-repositioning`. Local claims-lint checks and test suites pass 100% (251/251 tests green; 0 lint findings across both workspaces).

The following four items cannot be resolved solely from source-code evidence and are submitted for founder determination.

---

## 2. Decision Log

### Decision 1: Production Deployment & Release Sign-Off
- **Context:** All surgical content modifications are staged on the local working branch `feat/evidence-led-repositioning`. Live production curl checks confirm that `satelink.network` and `jakuraa.com` still serve the Phase 7 copy (Trading AI monopoly and unverified latency claims).
- **Options for the Founder:**
  - **Option A (Recommended):** Review the staged diff via `git diff` and authorize a production merge/deployment to Vercel.
  - **Option B:** Maintain the branch in staging/preview environment for external stakeholder review prior to production release.

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
