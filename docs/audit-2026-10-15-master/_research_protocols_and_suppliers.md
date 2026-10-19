# Research notes: payment protocols, supplier resale rights, unit economics

Date: 2026-10-15. Mode: read-only. These are raw research notes, not a decision document.
Every web citation gives the URL, the access date (2026-10-15 unless stated) and the section.
Labels used in this file:
- **[OFFICIAL]**: read directly from the vendor's own page.
- **[OFFICIAL-SNIPPET]**: the official page blocked the fetcher (HTTP 403 or JS-rendered), so the text comes from a search-engine snippet of that page. Treat it as lower confidence.
- **[SECONDARY]**: a third-party source. Not authoritative; confirm before quoting.

Gaps I could not close are listed in §7.

---

## Part A — Protocols

### A1. x402

| Item | Finding | Source |
|---|---|---|
| Current version | **v2**. The payload carries `x402Version: 2`. v1 (`x402Version: 1`) is "legacy". It is not formally deprecated: "the facilitator supports both V1 and V2 protocols", and a v2 server can still accept v1 client payments. | [OFFICIAL] https://docs.x402.org/guides/migration-v1-to-v2.md, "Header Name Changes" / "Version" sections |
| Headers (v2) | `PAYMENT-REQUIRED` (server → client, sent with the 402), `PAYMENT-SIGNATURE` (client → server), `PAYMENT-RESPONSE` (server → client). All carry base64 JSON. | [OFFICIAL] https://docs.x402.org/core-concepts/http-402 (header table) |
| Headers (v1) | `X-PAYMENT` and `X-PAYMENT-RESPONSE`. v2 renamed these to `PAYMENT-SIGNATURE` and `PAYMENT-RESPONSE`. | [OFFICIAL] migration guide above |
| Network IDs | v2 uses CAIP-2 IDs: `eip155:8453` is Base mainnet, `eip155:84532` is Base Sepolia. v1 used strings such as `base-sepolia`. | [OFFICIAL] migration guide |
| Packages | v2 SDKs are `@x402/*` (`@x402/express`, `@x402/axios`, `@x402/evm`, `@x402/svm`). v1 used `x402-express` and similar. | [OFFICIAL] migration guide |
| Schemes | `exact`: fixed price; the buyer authorizes exactly the advertised amount. `upto`: usage-based; the buyer signs a maximum and the server settles the actual usage, which can be "0". On EVM it uses Permit2; on SVM it uses a payment-channels escrow. `batch-settlement`: escrow plus off-chain vouchers, redeemed on-chain in batches. | [OFFICIAL] https://docs.x402.org/llms.txt; https://docs.x402.org/schemes/upto.md |
| Facilitator role | It verifies payment payloads and settles them on-chain for the server. It **does not hold funds**: "does not hold funds or act as a custodian". If on-chain confirmation can't be seen, it returns `settlement_pending` (a non-terminal state) with the tx hash, and the server must reconcile. | [OFFICIAL] https://docs.x402.org/core-concepts/facilitator.md |
| Refunds | **None native.** CDP FAQ: "Payments made with `exact` or `upto` are irreversible once settled, so there are no chargebacks." To refund, "send a transfer back to the payer address from the settlement record". | [OFFICIAL] https://docs.cdp.coinbase.com/x402/support/faq.md, "How do refunds work?" |
| Finality / latency | The CDP facilitator targets "P95 settlement at 900ms on Base and 1500ms on Solana" and "99.9% availability". | [OFFICIAL] CDP FAQ, "Settlement latency" |
| Bazaar | A resource is catalogued only when a settled `PaymentPayload` carries the echoed `bazaar` extension. The paying client has to echo it; server-side metadata alone does nothing. Discovery endpoints: `GET {facilitator}/discovery/resources` plus a search endpoint. Required metadata: `input.type` (`http` + method, or `mcp` + `toolName` + `inputSchema`). Optional fields: `serviceName` (≤32 chars), `tags` (≤5), `iconUrl`. Cataloguing status comes back in the `EXTENSION-RESPONSES` header (`success`, `processing` or `rejected`). | [OFFICIAL] https://docs.x402.org/extensions/bazaar.md |

**Coinbase CDP facilitator**

| Item | Finding | Source |
|---|---|---|
| Networks | "Base, Base Sepolia, Polygon, Arbitrum, Monad, World, World Sepolia, Solana, and Solana Devnet". ERC-20 on EVM, SPL on Solana. **Polygon is supported**, so Satelink could accept x402 on Polygon as well as Base. | [OFFICIAL] https://docs.cdp.coinbase.com/x402/seller/facilitator |
| Schemes | EVM: `exact`, `upto`, `batch-settlement`. Solana: `exact`, `upto`. "x402 v2 support". | same |
| Fees | The first **1,000 settlements per month are free**, then **$0.001 per settlement**. "Payment verification is always free", and a settle call that fails with 4xx/5xx is not billed. | same; CDP FAQ "What does x402 cost end to end?" / "What counts as billable?" |
| KYT / OFAC | "Every payment is screened against OFAC sanctions lists and Know Your Transaction (KYT) risk signals before it settles." A blocked payment fails with `kyt_risk_detected`. | CDP FAQ, "What screening does CDP Facilitator run?" |
| Merchant eligibility / India | **Not stated** in the x402 docs or FAQ. The CDP Terms of Service (https://www.coinbase.com/legal/developer-platform/terms-of-service) return HTTP 403 to automated fetch. Search snippets of that page say the contracting party is "Coinbase, Inc., Coinbase Crypto Services, LLC, or one of its affiliates that provide the CDP Tools". A secondary source says India is served via "Coinbase India Private Limited" for some services and that Coinbase re-opened Indian sign-ups in Dec 2025 after registering with India's FIU. Excluded jurisdictions are the US-sanctioned ones (Cuba, Iran, North Korea, Syria, occupied Ukrainian regions). **Verdict: NOT VERIFIED.** No official text I could read bars an India-based seller from the CDP facilitator. The facilitator is non-custodial and settles to the seller's own address. Satelink has already settled on mainnet through it (CLAUDE.md, payTo `0x966E…7Ad4`). The founder should read the CDP ToS in a browser, specifically the "eligibility" and "restricted jurisdictions" clauses. | [OFFICIAL-SNIPPET] CDP ToS; [SECONDARY] https://www.datawallet.com/crypto/coinbase-countries |
| Scale claim | "processed more than 100 million x402 payments across Base and Solana". | [OFFICIAL] https://docs.cdp.coinbase.com/x402/welcome |

### A2. Stripe Machine Payments, MPP / Tempo, and Stripe's x402

- **Machine payments** page [OFFICIAL] https://docs.stripe.com/payments/machine, sections "Features" and "Availability":
  - Stripe supports **MPP** (Machine Payments Protocol, co-authored with Tempo; spec at https://github.com/tempoxyz/mpp-specs) for cards and stablecoins.
  - It also supports **x402** for stablecoins.
  - Stablecoin matrix: MPP/Tempo USDC.e, MPP/Solana USDC, **x402/Base USDC**.
  - Minimums: SPT (card) **US$0.50**; stablecoin **0.01 USDC**; MPP sessions allow sub-cent charging with a 0.01 USDC minimum settlement.
  - Refunds go through the Refunds API.
- **Stripe x402** [OFFICIAL] https://docs.stripe.com/payments/machine/x402:
  - Status: **preview**. It requires API version `2026-05-27.preview`, and the sandbox uses `2026-07-29.preview`.
  - Mainnet payments **settle through the Coinbase CDP facilitator**: "Sign up for a Coinbase Developer Platform Account". Stripe supplies a deposit address (`/v1/crypto/deposit_addresses`, network=base) and records the settled transaction as a PaymentIntent in `transaction_verification` mode.
  - The CDP facilitator fee therefore still applies, and Stripe's crypto fee comes on top of it.
- **Availability**: "Stablecoin payments are available to businesses in all US states, except New York. For businesses operating outside of the US, email machine-payments@stripe.com … to request access to stablecoin payments in 30+ countries." [OFFICIAL] both pages above.
- **Stablecoin payments business locations** [OFFICIAL] https://docs.stripe.com/payments/stablecoin-payments, "Business locations":
  - US, plus a **private preview** for EU/EEA countries, CH, GI, HK, LI, MX and NO.
  - **India is not listed.**
  - Customers can pay from anywhere, sanctioned countries excepted. Transactions are capped at $10,000. Refunds are returned in stablecoin. There are no disputes.
- **SPT (card) seller countries** [OFFICIAL] https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens.md?agent-seller=seller: US, CA and European countries. **India is not listed.** Uses API `2026-09-30.preview`.
- **Stripe India**: "Stripe services are invite-only in India. Businesses from India are not able to sign up for a new Stripe account through our website, and instead need to request an invite." [OFFICIAL] https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india. Stripe India pricing shows 2% for India-issued cards and 3% for international cards [OFFICIAL] https://stripe.com/pricing (served the India variant).
- **Stablecoin fee**: Stripe's 1.5% stablecoin fee is reported only by a [SECONDARY] source (eco.com). I could not confirm it on an official page fetched today.
- **Verdict for an India-domiciled Satelink: Stripe MPP, Stripe x402 and Stripe stablecoin acceptance are NOT AVAILABLE** unless Satelink has a non-India entity (for example a US LLC) with a Stripe account, plus approval for stablecoin and machine payments.

### A3. Agentic Commerce Protocol (ACP) and Google AP2

**ACP (OpenAI + Stripe).** ACP is an open standard (Apache 2.0) that defines product feeds, a checkout API, and delegated payment through Stripe's Shared Payment Token. Stripe is "the first compatible PSP". Each AI platform runs its own merchant onboarding ("each AI platform will manage their own process"). For ChatGPT, merchants apply. Sources: [OFFICIAL] https://www.agenticcommerce.dev/ and https://developers.openai.com/commerce/guides/key-concepts.

Instant Checkout in ChatGPT launched 2025-09-29. [SECONDARY] reports say OpenAI charges merchants 4% and, as of March 2026, routes checkout through retailers' own apps. ACP targets merchant-of-record retail checkout, not per-call API metering. Its payment leg rests on SPTs, which are US/CA/EU-only (§A2), so **an India-domiciled Satelink is not eligible today**. The fit is also poor: there are sub-cent calls and no cart.

**AP2 (Google).** AP2 extends A2A/MCP with signed "mandates" (intent, cart, payment) that prove user authorization. v0.2 shipped and was **donated to the FIDO Alliance on 2026-04-28**. v0.2 added "Human Not Present" autonomous payments and companion work on Verifiable Intent with Mastercard ([OFFICIAL] https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/). AP2 is a protocol rather than a merchant program, so it has no merchant eligibility gate. It is payment-rail agnostic; earlier [SECONDARY] coverage mentions an x402 extension, which I did not confirm from an official page today. Status: **pre-1.0 standard under FIDO governance; no settlement network of its own.**

### A4. Visa Intelligent Commerce and Mastercard Agent Pay (status only)

- **Visa Intelligent Commerce**:
  - Developer capability page, [OFFICIAL-SNIPPET] https://developer.visa.com/capabilities/visa-intelligent-commerce (direct fetch returned 403): "free use in Sandbox, and fees in Production upon contacting Visa". Listed regions: N. America, AP, Europe, CEMEA, LAC.
  - Intelligent Commerce Connect was in **pilot** with select partners in April 2026: [OFFICIAL-SNIPPET] https://corporate.visa.com/en/sites/visa-perspectives/newsroom/visa-intelligent-commerce-connect-ai-shopping-for-businesses.html.
  - Status: **pilot or limited production. It is a card-network token program for issuers, acquirers and agent platforms, not a merchant API that Satelink can join directly.**
- **Mastercard Agent Pay**:
  - Agentic Tokens built on MDES. Live transactions are reported in the US, LAC, ASEAN, Hong Kong and Ukraine (2025–26).
  - "Agent Pay for Machines" was announced in **June 2026**: [OFFICIAL-SNIPPET] https://www.mastercard.com/global/en/news-and-trends/press/2026/june/mastercard-launches-agent-pay-for-machines.html (403 to direct fetch).
  - Status: **rolling out through certified processors; Satelink would reach it only through a PSP.**
  - Stripe's SPT resolve may use Agent Pay or VIC tokens "on your behalf" ([OFFICIAL] Stripe SPT page).

---

## Part B — Which upstream RPC providers Satelink actually uses

The data comes from grepping `/Users/pradeepjakuraa/satelink/apps/api` (excluding node_modules and tests). **I could not read the production env**: listing Railway variable names was denied by the permission classifier as credential exploration. "Enabled in prod" therefore stays unverified wherever a provider depends on an env var.

### B1. RPC gateway provider pool (`src/workloads/rpc_gateway/providers.js`), Polygon 137

| Provider id | file:line | URL | Keyed? | Enabled |
|---|---|---|---|---|
| llamarpc-polygon | providers.js:71-76 | `RPC_POLYGON_1` or `https://polygon.llamarpc.com` | public | **`enabled:false`** (hardcoded) |
| alchemy-polygon | providers.js:79-88 | `ALCHEMY_POLYGON_URL` or `polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_POLYGON_KEY‖ALCHEMY_API_KEY}` | **keyed** | only if one of those env vars is set (prod: unverified) |
| publicnode-polygon | providers.js:91-96 | `PUBLICNODE_POLYGON_URL` or `https://polygon-bor-rpc.publicnode.com` | **public, keyless** | **`enabled:true`** |
| ankr-polygon | providers.js:99-106 | `ANKR_POLYGON_URL` or `rpc.ankr.com/polygon/${ANKR_API_KEY}` | keyed | **`enabled:false`** (hardcoded) |
| drpc-polygon | providers.js:109-113 | `DRPC_POLYGON_URL` or `https://polygon.drpc.org` | **public, keyless** unless the env var overrides it | enabled (no flag) |
| emergency fallback | router.js:152 | `https://polygon.drpc.org` | public, keyless | always |

Other chains:
- Ethereum: llamarpc `eth.llamarpc.com`, disabled at providers.js:123-128; Alchemy keyed at :131-139; Ankr keyed at :143-147; dRPC public `eth.drpc.org` at :151-155; emergency fallback `eth.llamarpc.com` at router.js:153.
- Arbitrum: `arb1.arbitrum.io/rpc`, public, at providers.js:~165; Ankr keyed at :172-176.
- Base: `mainnet.base.org`, public, at providers.js:~187; Ankr keyed at :194-198.
- Amoy testnet: polygon official, Alchemy (`|| "demo"` key, providers.js:41), Ankr, dRPC.

Routing:
- `router.js` first tries registered Satelink nodes. `node_dispatcher.js:134-140` explicitly excludes registered nodes whose URL contains drpc.org, ankr.com, llamarpc.com, alchemy.com, infura.io, satelink.network or 1rpc.io.
- It then falls back to the provider pool, sorted by EMA latency and then priority (router.js:98-105), and finally to EMERGENCY_FALLBACKS.
- Memory notes that the only network node is the self-heartbeat, which is excluded. **In practice paid /rpc traffic is served by publicnode (keyless), dRPC (keyless by default) and possibly Alchemy (keyed, if its env var is set).**

WebSocket (`ws_gateway.js:21-24`): the defaults are `wss://polygon-mainnet.g.alchemy.com/v2/demo` and similar, i.e. **Alchemy's public "demo" key**, unless `WS_POLYGON` etc. are set.

MEV relay (`src/workloads/mev_relay/index.js:44,47`): `polygon.llamarpc.com`, `arbitrum.llamarpc.com`.

### B2. Non-gateway (internal) RPC use

| Use | file:line | Default URL |
|---|---|---|
| app_factory | app_factory.mjs:153 | `POLYGON_RPC` or `https://polygon-rpc.com` |
| withdraw service | src/settlement/withdraw_service.js:25 | `https://polygon-rpc.com` |
| settlement control | src/admin/jobs/settlement_control.js:39 | `POLYGON_RPC` or `https://polygon-rpc.com` |
| deposit smoke script | src/utils/scripts/smoke_deposit_e2e.mjs:19 | `https://polygon-rpc.com` |
| treasury settlement job | src/jobs/treasury_settlement_job.mjs:23 | `POLYGON_RPC_URL` or `https://polygon.drpc.org` |
| financial truth | src/services/financial/truth.js:77 | `RPC_URL` or `https://polygon.drpc.org` |
| API keys route | src/billing/api_keys_route.mjs:50 | hardcoded `https://polygon.drpc.org` |
| provider fallback | src/execution/providerFallback.js:10 | `RPC_POLYGON_FALLBACK` or `https://polygon.drpc.org` |
| deposit listener | src/services/deposit_listener.js:121-124 | `DEPOSIT_LISTENER_RPC_URL` (comment: "e.g. Ankr keyed"), then `POLYGON_RPC_URL`, then `RPC_URL` |
| legacy config | src/core/config/rpc_providers.js:26-28 | infura / alchemy / quiknode with the literal placeholder `SATELINK_INTERNAL` (non-functional) |

**Finding:** `polygon-rpc.com` **no longer serves keyless traffic**. Its landing page reads "A JSON-RPC endpoint for the Polygon network, operated by Ankr", says keyless public access is deprecated, and tells users to "create a free Ankr account" ([OFFICIAL] https://polygon-rpc.com/, accessed 2026-10-15). Four code paths, including withdraw_service and settlement_control, default to it. Unless `POLYGON_RPC` is set in prod (unverified), those paths are broken or rate-limited. This is a reliability finding, not a resale one.

### B3. Resale and terms matrix (RPC suppliers)

Classification key: CONFIRMED ALLOWED / CONFIRMED PROHIBITED / REQUIRES WRITTEN APPROVAL / NOT DOCUMENTED.
"Proxying paid calls to third parties" means Satelink selling per-call access whose bytes come from the supplier.

| Supplier | Used? | Key clause (verbatim where possible) | Source (accessed 2026-10-15) | Resale/proxy class | Markup | Automated machine purchase |
|---|---|---|---|---|---|---|
| **Alchemy** | keyed, optional (env); WS demo key | §2.1: use "solely for your internal business purposes … Licensed Volume". §2.2: must not "frame, mirror, sell, resell, rent or lease use of the Services to any other Third Party" without written permission; must not "multiplex or spread usage across multiple accounts or otherwise circumvent usage or capacity limits". §2.2(viii): no access via "any engine, software, tool, agent, device or mechanism (including spiders, robots, crawlers" except as authorized. Effective 2025-06-27. | [OFFICIAL] https://legal.alchemy.com/ (redirect from alchemy.com/policies/terms) | **REQUIRES WRITTEN APPROVAL** (resale is prohibited without it) | n/a unless approved | Unclear: (viii) restricts bots "except Alchemy-authorized purposes"; API use with an issued key is the authorized purpose. Using the shared `demo` key in production is not a licensed use. |
| **QuickNode** | not used (placeholder only) | §7(v): "not sublicense, lease, sell, resell, rent, loan, distribute, transfer or otherwise allow the use of the Quicknode Products". §6: no third-party access via your credentials. Updated 2025-12-01. | [OFFICIAL] https://www.quicknode.com/terms | **CONFIRMED PROHIBITED** (default ToS; an enterprise or partner contract could change this) | n/a | QuickNode may impose rate limits (§11(b)) |
| **Infura (MetaMask Developer)** | not used (placeholder only) | §7.3: may not "resell or sublicense the Offerings unless otherwise agreed in writing". §3.3: credentials may not be sold or sublicensed, with an exception: "you may disclose your Credentials to your authorized AI Agents or subcontractors". §1.2 says Infura is covered. Updated June 2026. | [OFFICIAL] https://metamask.io/terms-of-use (redirect from consensys.io) | **REQUIRES WRITTEN APPROVAL** | n/a | **Explicitly contemplates AI agents** using credentials (§3.3) |
| **Ankr** (also operates polygon-rpc.com) | keyed for deposit listener (per code comment); gateway Ankr disabled | §5.2(a): must not, "without Ankr's prior written consent, cause or permit the: (a) use, copying, modification, rental, lease, sublicense, transfer, or other commercial exploitation of, or other third party access to, any element of the Service". Effective 2026-07-15. | [OFFICIAL] https://www.ankr.com/terms/ | **REQUIRES WRITTEN APPROVAL** | n/a | not addressed |
| **dRPC** | **keyless public `polygon.drpc.org`: primary pool member and emergency fallback** | §1.1: the licence is "non-transferable, non-exclusive, non-sublicensable". §1.3: "Account registration is required to use the Services". §1.8 restricts automated collection from the *Website*. §7: no "sell … sublicense, or otherwise transfer any rights in the software". **No explicit resale-of-access clause.** Terms last updated 2025-01-14; Cayman law. | [OFFICIAL] https://drpc.org/terms-of-use (JS page, text extracted with curl) | **NOT DOCUMENTED** for resale of RPC responses. Keyless use without an account conflicts with §1.3, so a paid account is needed at minimum. The non-sublicensable licence makes resale legally risky, so get written confirmation. | not addressed | not addressed |
| **PublicNode (Allnodes Inc.)** | **keyless public, `enabled:true`** | The ToS covers the "www.publicnode.com website (the 'Service')". It prohibits: "Rent, lease, loan, resell, sublicense, or otherwise transfer the You account"; "other than as specifically approved in writing, any copying, distributing or disclosing any part of the Service in any medium"; "data mining, robots, scraping"; and circumventing blocks "using a proxy IP address". It also bars offering to sell goods or services "for any business purpose that is not specifically authorized". No date stated. | [OFFICIAL] https://www.publicnode.com/terms | **REQUIRES WRITTEN APPROVAL** (distribution of "any part of the Service" needs written approval; whether the ToS covers the RPC endpoints or only the website is ambiguous) | n/a | "robots" clause, ambiguous scope |
| **1RPC (Automata)** | excluded from node dispatcher; not in pool | The Terms of Use (March 2023) say nothing on resale, commercial use or rate limits. Free tiers are 200 req/day (public) and 1,000/day (starter). Paid tiers: Personal 40k/day, Developer 100k/day; prices not published in the docs. | [OFFICIAL] https://www.1rpc.io/tou; https://docs.1rpc.io/using-the-web3-api/payment | **NOT DOCUMENTED** | n/a | n/a |
| **Polygon public RPC (`polygon-rpc.com`)** | default in 4 internal paths | Now Ankr-operated and requires an Ankr account and key, so Ankr's terms apply. | [OFFICIAL] https://polygon-rpc.com/ | **REQUIRES WRITTEN APPROVAL** (Ankr §5.2) | n/a | n/a |
| **Chainstack** | not used | Must not "license, sublicense, sell, resell, rent, lease, transfer, assign, distribute, time share or otherwise commercially exploit" the service to third parties. Contractor use only, and contractors must not be competitors. Sharing keys to bypass limits is forbidden. Updated June 2026; Singapore law. | [OFFICIAL] https://chainstack.com/tos/ | **CONFIRMED PROHIBITED** (default ToS) | n/a | abuse or "excessively frequent requests" can lead to suspension |
| **Blast API (Bware Labs)** | not used | "Blast products are no longer available … continues with Alchemy". Acquired by Alchemy. | [OFFICIAL] https://blastapi.io/terms-of-service | **N/A: discontinued** | — | — |
| Arbitrum public `arb1.arbitrum.io/rpc` | used for the arbitrum chain | "No uptime, latency, or rate-limit guarantees. Any application that depends on availability should use a third-party node provider or run its own node." | [OFFICIAL] https://docs.arbitrum.io/build-decentralized-apps/reference/node-providers | **NOT DOCUMENTED** (resale); not suitable for production | | |
| Base public `mainnet.base.org` | used for the base chain | No terms found on the pages fetched. | docs.base.org (two pages checked) | **NOT DOCUMENTED** | | |
| llamarpc | disabled in code | Not researched further: disabled, and circuit-broken 2,550+ times per the code comment. | — | — | | |

**Bottom line (RPC):** none of the providers Satelink touches **confirms** that reselling or proxying is allowed. The two keyless endpoints actually serving paid /rpc traffic (publicnode, dRPC public) have:
- PublicNode: a written-approval requirement.
- dRPC: an account requirement plus a non-sublicensable licence.

QuickNode and Chainstack prohibit resale outright. Alchemy, Infura and Ankr require written approval. A compliant resale model needs a **written reseller or partner agreement with at least one provider**. Candidates are dRPC (no explicit prohibition), Infura (explicitly allows AI agents to hold credentials) and Ankr. The other routes are to run Satelink's own Polygon nodes or to use the registered-node network that Satelink operates.

### B4. Non-RPC APIs a founder might "procure for machines" (resale terms only)

| API | Clause | Source | Class |
|---|---|---|---|
| OpenAI API | §2.2 grants the right "to integrate the Services into Customer Applications and to make Customer Applications available to End Users". §3.1: "Customer may not resell or lease access to its Account or any End User Account". §3.3(g): will not "buy, sell, or transfer API keys from, to, or with a third party". §3.3(h)/(i): no circumventing rate or Usage Limits. Version "ONLINE v.010126". | [OFFICIAL] https://cdn.openai.com/osa/openai-services-agreement.pdf (the HTML page https://openai.com/policies/services-agreement/ returned 403) | Building a **value-added app is ALLOWED**. Raw access or key resale (a pass-through proxy) is **CONFIRMED PROHIBITED**. |
| Anthropic API | §A.1: use "to power products and services Customer makes available to its own customers and end users". §D.4: may not "resell the Services except as expressly approved by Anthropic" or build competing products or models. Effective 2025-06-17. | [OFFICIAL] https://www.anthropic.com/legal/commercial-terms | Value-added product ALLOWED; raw resale **REQUIRES WRITTEN APPROVAL**. |
| CoinGecko API | §4.1.6: cannot "sell, rent, lease, sub-license, re-distribute or syndicate access to the CoinGecko API or part thereof" without a separate written agreement, but may charge for your own products that incorporate the API. §4.4 requires "Powered by CoinGecko" attribution. Latest version 2025-09-05. | [OFFICIAL] https://www.coingecko.com/en/api_terms | Raw re-syndication **REQUIRES WRITTEN APPROVAL**; embedded use allowed depending on plan. |
| Firecrawl | §5.d.1: no "commercial purposes except as expressly authorized by Firecrawl". §5.d.3: no "sell, distribute, or create derivative works based on the Services". §3: no credential sharing. Order Forms can override (§6.c). | [OFFICIAL] https://www.firecrawl.dev/terms-of-service | **CONFIRMED PROHIBITED** (default); enterprise Order Form needed |

Pattern: AI and data APIs allow **value-added integration** but not raw pass-through resale. A "procurement fee" model in which Satelink buys on behalf of machines and passes calls through is the riskiest shape under every ToS reviewed.

---

## Part C — Unit economics per 1M calls

### C1. Supplier cost per 1M eth_call / eth_getBalance-style calls

All figures are from [OFFICIAL] pricing pages accessed 2026-10-15 unless marked otherwise.

| Supplier / plan | Pricing fact | Units per call | $ per 1M calls (arithmetic) |
|---|---|---|---|
| Alchemy PAYG | "$0.525/1M CUs"; free tier 30M CU/mo at 15 rps; PAYG starts at 300 rps ([alchemy.com/pricing](https://www.alchemy.com/pricing)) | eth_call 26 CU, eth_getBalance 20 CU ([CU cost table](https://www.alchemy.com/docs/reference/compute-unit-costs)) | eth_call: 26 × 0.525 = **$13.65**; getBalance: 20 × 0.525 = **$10.50**; 50/50 blend **$12.08** |
| QuickNode Build | $49/mo, 80M credits, 50 rps, overage $0.62/1M credits ([quicknode.com/pricing](https://www.quicknode.com/pricing)) | Polygon "All methods 20" ([api-credits](https://www.quicknode.com/api-credits)) | in quota: 49 / (80M / 20) = 49 / 4M = **$12.25**; overage: 0.62 × 20 = **$12.40** |
| QuickNode Business | $999/mo, 2B credits, overage $0.50/1M | 20 | in quota: 999 / 100M = **$9.99**; overage: **$10.00** |
| Infura Developer | 15M credits/day at 4,000 credits/s ([docs.infura.io/get-started/pricing](https://docs.infura.io/get-started/pricing/)); $50/mo [SECONDARY, Dwellir and others] | 80 credits for eth_call, getBalance and blockNumber ([credit-cost](https://docs.infura.io/get-started/pricing/credit-cost)) | 15M × 30 / 80 = 5.625M calls/mo, so 50 / 5.625 = **$8.89** (hard daily cap, no overage) |
| Infura Team | 75M credits/day; $225/mo [SECONDARY] | 80 | 75M × 30 / 80 = 28.1M calls, so 225 / 28.1 = **$8.00** |
| Ankr PAYG | "0.10 USD = 1M API Credits"; EVM HTTP = 200 credits; min top-up $10; free 200M credits/mo ([ankr.com/docs/rpc-service/service-plans](https://www.ankr.com/docs/rpc-service/service-plans/)) | 200 | 200 × $0.10 / 1M = $0.00002/call, so **$20.00** (the free tier covers 1M calls/mo) |
| dRPC PAYG | "$6 per 1,000,000 requests", "All supported methods cost just 20 CUs", from 2025-06-02, volume discounts available ([blog.drpc.org flat pricing](https://blog.drpc.org/announcing-flat-pricing-simple-transparent-fair/)); free tier 210M CU/mo at 100 rps [SECONDARY] | 20 CU | **$6.00** (the free tier covers ≈10.5M calls/mo) |
| Chainstack Growth | $49/mo, 20M RU, 250 rps, overage $15/1M ([chainstack.com/pricing](https://chainstack.com/pricing/)) | "1 RU per API request, regardless of method" (archive 2 RU) | in quota: 49 / 20 = **$2.45**; overage **$15.00** |
| Chainstack Enterprise / custom | $990+/mo, 400M RU, overage $5/1M; custom PAYG "from $2.5 per 1M RU" above $1k/mo | 1 | **$2.48 to $2.50**; overage $5 |
| PublicNode / dRPC public (keyless) | $0 | — | **$0.00**, but see the ToS risk in B3 |
| 1RPC paid | prices not published in docs | — | unknown |

**Checking docs/PRICING_INTELLIGENCE.md and `src/economics/pricing_intelligence/schema.js` seed data (researched 2026-07-10). The repo claims are wrong or out of date:**

| Repo claim | Current official figure | Verdict |
|---|---|---|
| Alchemy "Growth: $49/mo, 400M CU … ≈$3.18/M; free tier 300M CU" | The pricing page now shows Free (30M CU) / PAYG $0.525 per M CU / Enterprise. No $49 Growth plan. | **STALE.** Real ≈ $10.50–13.65/M; free tier is 30M CU, not 300M. |
| QuickNode "2 credits per eth_call → ≈$1.23/M" | 20 credits per call on Polygon | **WRONG by 10×.** Real ≈ $12.25/M. |
| Infura "$8.93/M" | $8.89 (same arithmetic) | **OK** (the monthly price is secondary-sourced) |
| Chainstack "$2.45/M" | $2.45 in quota | **OK** |
| Ankr "unverified" | $20/M | now verifiable |
| dRPC "unverified" | $6/M | now verifiable |

The claim in PRICING_INTELLIGENCE.md that $30/M is "roughly 10× the per-million rate of bulk subscription plans ($1.2–8.9/M est.)" is therefore partly wrong. Against **pay-as-you-go** rates, $30/M is **1.5× Ankr, 2.2–2.9× Alchemy/QuickNode, 3.4–3.75× Infura, 5× dRPC and 12× Chainstack in-quota**. The x402 bundle at $100/M is **5× to 40×** those rates. The zero-signup, zero-commitment argument still holds.

### C2. Payment-rail cost

| Rail | Fee fact | Source | Cost per 1M calls |
|---|---|---|---|
| x402 bundle via CDP ($0.10 = 1,000 calls) | first 1,000 settlements/mo free, then $0.001 each; buyer signs, facilitator submits | CDP facilitator page / FAQ | 1M calls = 1,000 settlements, so **$1.00** worst case beyond the free tier (1.0% of $100). $0 if within the monthly free 1,000. |
| x402 single-call ($0.00003 exact) | — | — | Infeasible: a $0.001 settlement fee is 33× the price. Bundles or `upto`/`batch-settlement` are mandatory. |
| USDT deposit (RevenueVaultV2, Polygon) | buyer pays gas; no processor | code / CLAUDE.md | **≈ $0** to Satelink |
| Card via Dodo Payments (MoR) | "4% + 40c per domestic US transaction"; international +1.5%; "subscriptions, addons, and usage-based billing add +0.5%"; India INR cards/UPI 4% + 15c; payouts under $1,000 cost $5 | [OFFICIAL] https://dodopayments.com/pricing | One $30 top-up (intl): 0.055 × 30 + 0.40 = **$2.05** (6.8%). Three $10 top-ups (intl): 3 × (0.55 + 0.40) = **$2.85** (9.5%). |
| Card via Paddle (MoR) | "5% + 50¢ per Checkout transaction"; bespoke pricing under $10 | [OFFICIAL] https://www.paddle.com/pricing | One $30: 1.50 + 0.50 = **$2.00** (6.7%). Three $10: **$3.00** (10%). |
| Card via MoR for a $0.10 x402-sized bundle | Dodo 4% + $0.40 | — | **Fee exceeds revenue ($0.404 > $0.10)**: card rails cannot sell sub-dollar bundles. |
| Stripe stablecoin | 1.5% [SECONDARY]; India not eligible | — | n/a for an India entity |

### C3. Infrastructure (Railway)

Source:
- Usage: `/Users/pradeepjakuraa/satelink/INFRASTRUCTURE_COST_REDUCTION_REPORT.md` §1, Railway MTD 2026-10-01 to 10-14 (14.8 days).
- Rates: [OFFICIAL] https://docs.railway.com/reference/pricing/plans gives RAM $10/GB-mo, CPU $20/vCPU-mo, egress $0.05/GB, volume $0.15/GB-mo. Converted at 730 h/month: RAM $0.013699/GB-h, CPU $0.027397/vCPU-h, volume $0.000205/GB-h. **Assumption:** backups are billed at the volume rate.

| Service | Memory | CPU | Egress | Disk + backup | 14.8 d | ×30/14.8 = per month |
|---|---|---|---|---|---|---|
| Postgres-iQeW | 5,917.76 × .013699 = 81.07 | 418.01 × .027397 = 11.45 | 0.00 | 5.31 + 4.46 | 102.29 | **$207.34** |
| satelink-reconciler | 26.81 | 12.50 | 0.00 | — | 39.30 | **$79.67** (pre-optimization; the report cut its cycle count by 75%) |
| Satelink-api | 20.03 | 10.71 | 14.80 × .05 = 0.74 | — | 31.48 | **$63.82** |
| Paperclip-DB | 4.92 | 0.05 | 0 | 1.92 + 0.05 | 6.94 | **$14.07** |
| Redis | 1.22 | 0.73 | 0 | 0.83 + 0.29 | 3.07 | **$6.22** |
| **Total** | | | | | 183.09 | **≈ $371/month** (plus the plan fee; Pro $20 includes $20 of usage) |

Inconsistencies in the source report, flagged and not resolved:
- Postgres at 5,917.76 GB-h over 355 h means about 16.7 GB average memory. The same row says "703MB RSS".
- Paperclip-DB computes to about $14/month; the report says "~$3.00/month".

Railway may bill provisioned rather than RSS memory. Treat the totals as ±50%.

Infra allocation per 1M calls:
- Traffic was 496k req/day on 2026-07-16 (CLAUDE.md), so **assume ≈15M req/month**. October volume was not re-measured.
- **Marginal (API service only):** $63.82 / 15M = **$4.25 per 1M**. This is an upper bound, since most of today's requests are 402 responses and much of the cost is fixed.
- **Fully loaded (all services):** $371 / 15M = **$24.74 per 1M** at today's volume. At 100M calls/month it falls to $3.71 per 1M.
- Fixed-cost break-even at $30/M with dRPC PAYG (contribution about $18.55/M after the $4.25 marginal infra; adding that back, the margin before any infra is $22.80/M): 371 / 22.80 ≈ **16.3M paid calls/month**. On the x402 bundle (contribution before infra ≈ $95/M): about **3.9M paid calls/month**.

### C4. Assumptions (stated)

- **Failure/refund allowance: 2% of revenue.** This covers upstream errors that are billed and then credited back, and manual on-chain x402 refunds, which have no native mechanism.
- **Support: 2% of revenue.** Machine buyers need little support. This is an allocation, not a measurement.
- **Infra: $4.25/M marginal**, as computed in C3.
- **Payment:** per C2. USDT = $0. x402 = $1.00/M (worst case). Dodo intl single $30 = $2.05. Paddle single $30 = $2.00.

### C5. Contribution margin per 1M calls

Formula: revenue − supplier − payment − infra 4.25 − failure 2% − support 2%.

**Credits rail, $30/M, USDT deposit (payment $0; failure $0.60; support $0.60):**

| Upstream | Supplier $ | Margin $ | Margin % |
|---|---|---|---|
| Public keyless (current default) | 0.00 | 30 − 0 − 0 − 4.25 − 0.6 − 0.6 = **24.55** | 81.8% |
| Chainstack Growth (in quota) | 2.45 | **22.10** | 73.7% |
| Chainstack custom PAYG floor | 2.50 | **22.05** | 73.5% |
| dRPC PAYG | 6.00 | **18.55** | 61.8% |
| Infura Team (in quota) | 8.00 | **16.55** | 55.2% |
| Infura Developer (in quota) | 8.89 | **15.66** | 52.2% |
| QuickNode Business overage | 10.00 | **14.55** | 48.5% |
| Alchemy PAYG getBalance | 10.50 | **14.05** | 46.8% |
| Alchemy PAYG blend | 12.08 | **12.48** | 41.6% |
| QuickNode Build | 12.25 | **12.30** | 41.0% |
| Alchemy PAYG eth_call | 13.65 | **10.90** | 36.3% |
| Chainstack Growth overage | 15.00 | **9.55** | 31.8% |
| Ankr PAYG | 20.00 | **4.55** | 15.2% |

**Credits rail, $30/M, card via MoR:** subtract a further $2.05 (Dodo, single $30 intl) or $2.00 (Paddle). For example, dRPC gives **$16.50** (55.0%) with Dodo and $16.55 with Paddle, and Ankr gives **$2.50** (8.3%). With three $10 Dodo top-ups (fee $2.85), dRPC gives $15.70 and Ankr $1.70.

**x402 bundle, $100/M (payment $1.00; failure $2; support $2):**

| Upstream | Margin $ | % |
|---|---|---|
| Public keyless | 100 − 0 − 1 − 4.25 − 2 − 2 = **90.75** | 90.8% |
| Chainstack Growth | **88.30** | 88.3% |
| dRPC PAYG | **84.75** | 84.8% |
| Infura Developer | **81.86** | 81.9% |
| QuickNode Business overage | **80.75** | 80.8% |
| Alchemy blend | **78.67** | 78.7% |
| QuickNode Build | **78.50** | 78.5% |
| Chainstack overage | **75.75** | 75.8% |
| Ankr PAYG | **70.75** | 70.8% |

Caveats:
- The "public keyless" row has the highest margin and the weakest legal footing (B3). It is not a sustainable basis.
- Chainstack's best rate needs a $49+/month commitment and its ToS prohibits resale. QuickNode's ToS also prohibits resale. Neither is usable for resale without a contract.
- Of the suppliers whose default ToS do not outright prohibit resale, dRPC PAYG ($6/M) is the cheapest keyed option.

### C6. Business-model comparison

| Model | How Satelink earns | Fits supplier ToS? | Notes |
|---|---|---|---|
| Subscription (monthly plan) | fixed $/mo | Same resale problem as all proxying | Competitors already offer $49 plans at $2.45–12/M. Satelink would compete on price, which is weak. |
| Usage billing (current credits) | $30/M | proxying needs written approval or a partner agreement | Contribution of $15–22/M on keyed suppliers. Needs about 16M paid calls/month to cover the ~$371 fixed infra. |
| Machine-metered x402 | $100/M bundle | same | Highest margin; the CDP fee is only 1%. Price is 5–40× the market, so demand is the constraint. |
| Procurement fee (buy on behalf of agents) | % on pass-through spend | **Worst fit**: OpenAI §3.1/3.3(g), Firecrawl and QuickNode all bar key or access resale | Avoid without signed reseller agreements. |
| Reseller markup (contracted) | margin on wholesale | Works **only** with a reseller or partner agreement (QuickNode Preferred Partner Network, Alchemy/Infura/Ankr written approval) | This is the compliant version of the current product. |
| Referral / affiliate | commission | Fully compliant | **Chainstack:** 20% of the referred customer's subscription spend for 12 months, paid as account credit or withdrawable via support ([OFFICIAL] https://chainstack.com/referral/), plus $100 USDC per referred paying Dedicated Node customer ([OFFICIAL-SNIPPET] https://chainstack.com/affiliate/). **QuickNode:** 50% of the referral's first month, as account credit ([OFFICIAL] https://www.quicknode.com/referrals); separate Preferred Partner Network with revenue share ([OFFICIAL-SNIPPET] https://blog.quicknode.com/join-quicknodes-preferred-partner-network/). **dRPC:** 10% of referred deposits, as credits ([OFFICIAL-SNIPPET] https://drpc.org/blog/drpc-referral-program). **Alchemy:** no affiliate program found (search returned only unrelated "Alchemy" brands). Revenue is small and largely paid in credits. |
| Marketplace fee | take-rate on third-party providers listed via Satelink (e.g. registered nodes) | Compliant if the providers are Satelink's own node operators, as in the existing 50/30/20 economic model | Needs real operator supply; today the only node is the self-heartbeat. |
| Enterprise orchestration | fee for routing, failover and billing across the customer's own provider keys (BYO-key) | **Compliant**: the customer holds the supplier contract, and Satelink sells software, not access | Likely the cleanest model ToS-wise. Infura even contemplates sharing credentials with "authorized AI Agents" (§3.3). |

---

## 7. Open items and gaps (not verified)

1. **Production env**: whether `ALCHEMY_*`, `DRPC_POLYGON_URL`, `PUBLICNODE_POLYGON_URL`, `POLYGON_RPC`, `DEPOSIT_LISTENER_RPC_URL` and `WS_POLYGON` are set in prod is unknown. The Railway variable-name listing was denied by the permission classifier, so the founder must check it.
2. **CDP ToS and India eligibility**: the official page is bot-blocked (403). It needs a human browser read.
3. **Stripe stablecoin fee (1.5%)** and **Infura monthly prices ($50 / $225)** are secondary-sourced.
4. **Visa and Mastercard pages** were 403. Their status comes from search snippets of the official URLs.
5. The **dRPC free-tier figure** (210M CU/mo) is secondary. The $6/M PAYG figure is official (blog).
6. The Railway report's memory figures are internally inconsistent (see C3).
7. **polygon-rpc.com is no longer keyless.** Four code paths default to it, so check that prod overrides `POLYGON_RPC`.
