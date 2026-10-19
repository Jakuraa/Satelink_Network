# Product Boundaries & Positioning

**Date:** 2026-10-15 · Inputs: REPOSITORY_AND_PRODUCT_INVENTORY, PAYMENT_PROVIDER_POLICY_MATRIX, API_PROCUREMENT_UNIT_ECONOMICS, INDIA_REGULATORY_QUESTIONS, WEBSITE_AUDIT_*.

## 1. Test of the founder's positioning hypothesis

> "Satelink provides software for developers and businesses to discover, access, meter and manage API-based infrastructure services. It supports programmatic service access, usage tracking, spending limits and automated billing integrations for software systems and AI agents."

| Claim fragment | Exists today? | Evidence |
|---|---|---|
| "discover … API-based infrastructure services" (plural) | **No.** One service (Polygon RPC); others are delisted, disabled (`/vnext` 503) or misrepresented (AI gateway) | Inventory #1, #12, #13, #32, #33 |
| "access" | Yes, for Polygon RPC | Inventory #1 |
| "meter" | Yes (per-call credits) | `authorizeAndMeter` |
| "manage" | Partial (console; per-agent limits behind flag) | Inventory #26 |
| "spending limits" | **Not live by default** (`CONSOLE_ACCOUNTS_V1`) | Inventory #26, PAYMENT §3 |
| "automated billing integrations" | x402 + USDT live; card not purchasable | PAYMENT §1 |
| "for software systems and AI agents" | Yes (x402, well-known, MCP server, but npm package unpublished) | Inventory #4, #29 |

**Verdict:** the hypothesis **overstates** the product. Today Satelink sells one thing: **pay-per-call Polygon JSON-RPC, payable by AI agents with x402 or by prepaid USDT.** "Machine commerce" is a credible *direction*, but stating it as a current capability would be a claim the code does not support. That is exactly what an underwriter tests against the live site.

## 2. Are A / B / C genuinely distinct products?

| Test | A. API Infrastructure (RPC) | B. Machine Commerce / API Procurement | C. Trading AI (+ Trading Intelligence) |
|---|---|---|---|
| Real, working capability | Yes | **No** (no supplier contracts, no catalogue, `/vnext/resell` disabled) | Isolated code on an unmerged branch; TI API live but delisted |
| Distinct customers | Devs, bots, agents | (hypothetical) agents buying 3rd-party APIs | Traders / retail investors / funds |
| Distinct data flows | RPC proxy | — | Market data, broker credentials, orders |
| Distinct economics | per-call | procurement margin | subscriptions / performance-adjacent |
| Distinct risk class | Low–medium (crypto-adjacent infra) | High (resale rights, marketplace/PA questions) | **High** (SEBI algo/RA, broker terms, VDA, market-data licences) |
| Provider eligibility (official policies) | Paddle / Polar / Creem / Stripe-India-policy *possible* with written confirmation; Dodo likely excludes "infrastructure… compute credits" | Dodo: "reselling AI APIs… without clear rights" prohibited; Paddle: resale requires reseller certificate | **Prohibited** at Paddle ("trading signals and strategies"), Dodo ("unlicensed financial tools, investment strategies"), Razorpay (crypto covenant) |

**Conclusions:**

- **A is a real product.** Make it the only thing sold under the Satelink brand to card providers. It must still be fixed: contracted upstream, honest pricing, and no misleading surfaces.
- **B is not a product.** Do not present it as one. The legitimate, provider-friendly form of the thesis is **BYO-key orchestration software**: routing, metering, spend limits and audit logs over the customer's own supplier keys. Treat this as a roadmap hypothesis, to be validated by demand before it is built (FIRST_REVENUE_EXPERIMENTS E3). Never describe it on the site as available.
- **C is a genuinely separate product.** It has separate code (`apps/api/src/trading_agent/**`), separate users, a separate risk class and separate gates (Gate 0, B-01…B-11). **It must remain a separately disclosed private beta** with:
  - no payment collection;
  - its own terms;
  - its own page clearly labelled "not available / waitlist";
  - **no shared payment account with A** until legal review (INDIA §5) and a provider has given written approval of the specific activity.
- **Trading Intelligence** (the live `/v1/intelligence` crypto-derivatives metrics) belongs to C, not A. It is already delisted from web and console. **Remove it from the API catalogue and from the card-rail boundary as well** (PAYMENT §5).

## 3. Separation rules (legitimate, not concealment)

Separation is legitimate only if every one of these holds. If any fails, the separation becomes concealment, and Trading AI must be disclosed in every application.

1. **Disclose C in every provider application** as "a separate, unlaunched private-beta product that does not process payments and is not sold through this account". Never omit it. Underwriters review the whole domain, and Dodo verifies "against the live site".
2. **Different surface**:
   - Move Trading AI off the satelink.network homepage hero. Give it its own sub-path or domain, e.g. `satelink.network/trading-ai` (already at `/trading-agent/*`), or a separate domain later.
   - The A homepage may link to it under "Other products (private beta)".
3. **No money path**:
   - No checkout, no credits and no plan allowances that can be spent on C.
   - Delete the `/v2/plans` boundary text that routes card value to Trading Intelligence.
4. **Separate terms**:
   - C gets its own beta terms, risk disclosure and not-investment-advice statement.
   - A's terms state that they do not cover C.
5. **No routing of C's transactions through A**, now or later. If C ever charges, it needs its own provider relationship, approved for that activity in writing.
6. **Remove unrelated dormant businesses** from the same merchant identity. The "500 Verified Local Business Leads" checkout code and its Dodo webhook branch are one such business. If any were ever sold, disclose it historically.

## 4. Jakuraa ↔ Satelink identity

- The jakuraa.com title, "a technology and **trading** company, established 2019", and the H1, "We build the AI that **trades** within your rules", merge the registered goods-trading business (NIC 52190 per INDIA §9) with AI securities and crypto trading. Underwriters will read "trading company" + "AI that trades" + crypto as a financial-trading merchant.
- Recommended framing:
  - **Jakuraa Commercial Pvt Ltd** is the legal entity.
  - **Satelink** is its software product: developer API infrastructure.
  - "Satelink Trading AI" is listed separately as private beta research software (not live, not sold).
- The founder legal-name mismatch on the site ("Pradeep Jakuraa" vs the director's registered name) must be reconciled or explained (WEBSITE_AUDIT_JAKURAA JK-07). KYB compares these names.

## 5. Recommended positioning (truthful today)

**Satelink — Polygon RPC for developers and AI agents. Pay per call.**

> Satelink is a pay-per-call Polygon JSON-RPC API operated by Jakuraa Commercial Pvt Ltd (India). Developers prepay usage credits; AI agents can pay per request using the x402 protocol. No subscriptions or minimums. Usage is metered per call and shown in your console.

Rules for this positioning:
- Use "machine commerce" only as a category descriptor after a second service exists. Until then, describe the mechanism ("pay-per-request for agents via x402").
- Use "infrastructure for AI agents" only for what an agent can actually do today: discover, pay and call RPC.
- Drop "DePIN" and "decentralised network" until third-party nodes serve paid traffic. Today there is 1 active self-operated node.
- **Do not publish the founder's broader hypothesis text** until §1's "No" rows become "Yes".
