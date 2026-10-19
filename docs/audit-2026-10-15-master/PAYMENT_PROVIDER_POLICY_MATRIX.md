# Payment provider policy matrix: Jakuraa Commercial Pvt Ltd / Satelink

**Inspection date:** 2026-10-15 (every URL below was accessed that day unless marked otherwise).
**Method:** Read-only desk research on official provider pages: terms, acceptable-use and prohibited lists, docs, pricing. Tools used were WebFetch, WebSearch restricted to provider domains, and a headless browser for JavaScript-rendered terms (Razorpay, PayU, PayPal). No account was created, no provider was contacted and nothing was submitted.
**What this is not:** It is not legal advice and not a provider's decision. A capability that exists (an API, a feature, a blog post, another merchant using it) is **never** read as permission here. Only explicit policy text counts.
**Caveat on quoting:** Some quotes came through a summarising fetch tool. Where exact wording matters (marked ⚑), re-read the live page before relying on it.

**Classification keys used throughout**
| Code | Meaning |
|---|---|
| **A**: CONFIRMED ALLOWED | Official text explicitly permits it or lists it as supported |
| **P**: CONFIRMED PROHIBITED | Official text explicitly prohibits it |
| **W**: REQUIRES WRITTEN APPROVAL | Official text lists it as restricted, pre-approval or enhanced-review |
| **U**: NOT DOCUMENTED / UNKNOWN | Nothing explicit found, so do not assume either way |

**Role types:** **PA** = payment aggregator / processor; the merchant (Jakuraa) stays seller of record and owns GST/export compliance. **MoR** = merchant of record; the provider is the legal seller to the buyer and Jakuraa is paid as a supplier. **Orch** = orchestration. **Crypto** = crypto payment processing / facilitation. **Recv** = export receivables / collection account. **Payout** = payout only.

---

## 1. Summary shortlist

### The core problem: entity-level and product-level conflicts
As currently presented on satelink.network, Satelink combines four things that providers' policies treat differently:

1. **(a) Blockchain RPC / API infrastructure.** This is a developer API.
2. **(b) Crypto rails.** These are x402 USDC on Base and USDT deposits on Polygon.
3. **(c) "Trading Intelligence" / "Satelink Trading AI".** This is crypto-derivatives analytics, backtesting and paper trading, with broker adapters present in code.
4. **(d) Prepaid credits plus planned resale of third-party APIs with markup.**

No provider inspected clearly allows all four. Most MoRs ban (c) and some ban (a) or (b) outright. Razorpay's ban on (b) is an **entity-level covenant**, not just a product rule, which is consistent with Razorpay's existing suspension of Jakuraa recorded in `docs/platform/CHECKOUT_UNBLOCK_PREP.md`.

### Recommended primary (fiat, for the RPC/API developer product only): **Paddle (MoR)**
- **India:** Supported as a seller country; India is not on Paddle's unsupported list.
- **No explicit ban on blockchain infrastructure software:** Paddle's AUP prohibits crypto *exchanges/dealers/trading platforms*, not developer infrastructure.
- **MoR fit:** As MoR, Paddle removes Jakuraa's per-country VAT/sales-tax burden on foreign B2C sales.
- **Conditions:**
  - Trading AI must be off the Paddle-sold product and out of the Paddle-reviewed storefront. Paddle prohibits "Investment or financial advice, including trading signals and strategies".
  - Credits must not be structured as "stored value". Paddle prohibits "Virtual currency or stored value, including … store credit".
  - Get written confirmation first on: blockchain RPC, the prepaid usage model, and the crypto rails living on the same site.
- **Confidence:** Medium-low. Approval is not documented either way for blockchain RPC.

### Backup
- **Polar.sh (MoR):** India payouts via Stripe Connect Express are documented. Polar prohibits "NFTs and Crypto assets" and "trading bots … investment advisory services (including insights platforms)". RPC is not a crypto asset, but this needs written confirmation. Usage billing is a listed feature. Fees are higher on the free tier.
- **Creem (MoR):** India local-bank payouts are documented. "NFT & crypto asset products" are prohibited, and "API resellers" are *restricted* (strict due diligence).
- **Cashfree Payments (PA, PA-CB):** This is the direct-acquiring fallback if Jakuraa wants to stay seller of record.
  - Crypto *exchanges* are a negative category.
  - **SaaS, Forex and Stock market are "Risky Categories"** (enhanced scrutiny).
  - No entity-wide crypto covenant was found, but the application is already pending (per repo).
- **Stripe India (PA, direct):** This has the **most permissive policy text** for blockchain infrastructure software. Nothing on the list covers RPC/APIs, and crypto *exchanges/wallets* are restricted, not banned. But it is **invite-only** and has already declined Jakuraa "for now". Re-apply once there is documented cross-border volume (see §5).

### Unsuitable now (documented reasons)
| Provider | Why |
|---|---|
| **Razorpay** | The merchant representations say "You do not, and shall not, engage in any activity related to virtual currency, cryptocurrency and other crypto products". That applies to the entity, not just one product. Prohibited list item: "credits that can be monetized, re-sold or converted…". Jakuraa is already suspended. |
| **Dodo Payments** | Triple conflict: (1) "Crypto-related offerings … aren't permitted"; (2) "Hosting, servers, and infrastructure services … cloud compute credits … any product that provides users with persistent infrastructure or server-level access"; (3) "unlicensed financial tools, investment strategies … anything involving stored value". The pending application describes crypto-derivatives analytics (see §7). |
| **PayU India** | Banned list #29 "Unlicensed money exchange (incl. bitcoin/crypto)…" and banned #32 "Any intangible goods or services; aggregation / consolidation business model". Read literally, #32 bans SaaS. |
| **Lemon Squeezy** | Prohibits "NFT & Crypto related products" and is being folded into Stripe Managed Payments (2026 update). |
| **Stripe Managed Payments** (Stripe's MoR) | India is not a supported business location. |
| **Stripe agentic stack** (ACS, SPTs, stablecoin acceptance, MPP stablecoins, Link) | India is not a supported business location for any of these (§5). |
| **Xflow** (receivables) | Prohibits "entities that directly service the crypto industry". A blockchain RPC gateway is at real risk of falling in that category. |
| **PayPal India** | Export-only. "Cryptocurrency" and "Investments" need **pre-approval**. It is usable only for plain-software invoices, with approval. |

### Bottom line for the founder
1. **Split the storefront before applying anywhere.** The fiat-sold product should be a plain "developer RPC/API SaaS". Trading AI should not be on that storefront at all, and the crypto rails should be clearly separated, disclosed and not sold through the card provider.
2. **Do not monetise Trading AI through any MoR inspected.** All of them prohibit or restrict it.
3. **API resale with markup** is allowed nowhere without upstream resale rights and real added value:
   - Stripe prohibits "resale of a service without added benefit".
   - Dodo prohibits "reselling AI APIs … without clear rights".
   - Creem restricts API resellers.
   - Paddle prohibits resale "without a valid reseller certificate".

---

## 2. Full matrix

Legend inside cells: **A / P / W / U** as defined above, with a short reason. Citations are in §3/§4 by provider.

### 2a. Direct payment acceptance (Jakuraa = seller of record)

| Question | Stripe India | Razorpay | Cashfree | PayU India | PayPal India |
|---|---|---|---|---|---|
| Role | PA | PA (RBI-authorised PA; PA-CB) | PA (PA-CB) | PA | Export receipts |
| Supports Indian legal entities | **A**: company, LLP or sole proprietorship (individuals domestic only) | **A** | **A**: "Your business must be registered in India" | **A** | **A**: export payments only; no domestic since 2021 |
| Invite / sales approval | **W**: invite-only; "focus on international expansion" | **W**: international is enabled per account | **W**: risk review | **W** | **W** for restricted categories |
| Recurring subscriptions | **A**: Stripe Billing for international customers (name and address required) | **A**: Subscriptions product, priced | **A**: mandates priced | **U** (not inspected) | **U** |
| Usage-based billing | **A**: Meters / Metronome (country restriction not stated ⚑) | **U** | **U** | **U** | **U** |
| API checkout | **A**: Checkout / PaymentIntents | **A** | **A** | **A** | **A** |
| Agent / machine-initiated payments | **P (for India)**: SPTs, ACS and stablecoin rails list no India (§5) | **U** | **U** | **U** | **U** |
| Third-party procurement (Jakuraa buys upstream APIs) | **U**: not addressed | **U** | **U** | **U** | **U** |
| Resale / markup | **P** if "no-value-added … resale of a service without added benefit"; otherwise **U** | **U**: the "shall not resell … the Services" clause is about Razorpay's own services | **U** | **P?**: banned #32 "aggregation / consolidation business model" ⚑ | **U** |
| Marketplace payments (collect for others) | **W**: "Payment facilitation and aggregation" restricted; India Connect is invite-only | **P**: "Unregulated … MSB/MVTS" | **W/P**: "Finance (… payments)" needs a PA/PG licence | **W**: "Payment aggregators and payment facilitator businesses" (Cautious #20) | **W**: "Payment Facilitator" needs pre-approval |
| Crypto-related activity | **W**: exchanges and wallets restricted; **P**: mining, staking, ICOs; RPC infrastructure **U** | **P (entity-wide)** | **P**: crypto exchanges / "Platforms dealing in cryptocurrency trading"; RPC **U** | **P**: "Unlicensed money exchange (incl. bitcoin/crypto)" | **W**: "Cryptocurrency" needs pre-approval |
| Trading-related software (research / backtest / paper) | **W**: "Investment and brokerage services" restricted; research software **U** | **U**; securities are **P** | **W**: "Stock market", "Forex" are risky categories | **W**: Cautious #7 "Stocks, bonds … Forex … investments" | **W**: "Investments" (brokering) needs pre-approval |
| Stablecoin payments | **P (for India)**: India not in the business-location list | **P** | **U / P** (crypto) | **P** | **U** |
| India settlement | **A**: INR payouts; international payouts labelled separately | **A**: INR; international settles at T+15 days | **A**: INR | **A** | **A**: withdraw to Indian bank |
| KYC / KYB | Required | Required (video KYC) | Required | Required | Required |
| Published fees | 3% international + 2% FX; 4.3% USD presentment; Billing 0.7% | 2% domestic; up to 3% international cards; subscriptions 0.9% + platform fee; +18% GST | 1.95% domestic; 2.99% international Visa/MC | not inspected | 4.40% + ₹3 fixed; 3.0% FX spread |
| Key contractual restriction | Restricted list; IEC needed only for goods or AMEX | Entity-wide crypto covenant; prohibited list cl. 17 | Attachment A negative / risky lists; Schedule G PA-CB | Banned #29, #32 | AUP pre-approval list |
| Written approval needed for Satelink? | **Yes**: invite, plus crypto-adjacency and trading | N/A (suspended) | **Yes** (SaaS / forex / stock-market risky) | Not recommended | **Yes** |
| Confidence | High (docs fetched directly) | High (terms text read in browser) | Medium (summarised fetch ⚑) | High (list read in browser) | High (AUP read in browser) |

### 2b. Merchant of record

| Question | Paddle | Dodo Payments | Polar.sh | Creem | Lemon Squeezy | Stripe Managed Payments |
|---|---|---|---|---|---|---|
| Role | MoR | MoR | MoR (payouts via Stripe Connect Express) | MoR | MoR | MoR |
| Supports Indian legal entities | **A**: India not in the unsupported list | **A**: India listed (#75) | **A**: India supported for payouts | **A**: India, local-bank payout | **U** | **P**: India not a supported business location |
| Invite / sales approval | **W**: domain and product review | **W**: KYC + KYB + product verification (1–3 business days) | **W**: account reviews | **W**: account reviews | **U**: transitioning | **W**: eligibility review |
| Recurring subscriptions | **A** | **A** (+0.5%) | **A** | **A** | **A** | **A** |
| Usage-based billing | **U** (not inspected) | **A**: Meters; credit-based billing | **A**: "Usage Billing" listed feature | **U** | **U** | **U** |
| API checkout | **A** | **A** | **A** | **A** | **A** | **A** |
| Agent / machine-initiated | **U** | **U** | **U** | **U** | **U** | **U** |
| Third-party procurement | **U** | **U** | **U** | **U** | **U** | **U** |
| Resale / markup | **P** without a "valid reseller certificate" | **P**: "reselling AI APIs, datasets, or tools without clear rights or authorisation" | **P**: "Reselling software licenses without authorization" | **W**: "API resellers" restricted | **P**: PLR/MRR products "you … do not hold the original IP rights" | **P** unless "You hold all necessary rights" |
| Marketplace | **P** | **P** | **P** | **P**: "facilitate third-party merchant-funded customer payouts" | **P** | **P**: "not through a platform or marketplace" |
| Crypto-related activity | **P**: exchanges/dealers/trading platforms; RPC **U** | **P**: "Crypto-related offerings, Digital wallets, NFTs, DeFi…" | **P**: "NFTs and Crypto assets"; RPC **U** | **P**: "NFT & crypto asset products"; RPC **U** | **P**: "NFT & Crypto related products" | **U** |
| Trading-related software | **P**: "trading signals and strategies" | **P**: "unlicensed financial tools, investment strategies" | **P**: "financial trading, trading bots … (including insights platforms)" | **P** if it enables execution or automation; **W** if educational / community | **P**: regulated financial services | **U** |
| Infrastructure / hosting | **W**: VPN/proxies restricted; otherwise **U** | **P**: "Hosting, servers, and infrastructure services" | **W**: VPN/VPS/VDS restricted | **U** | **U** | **A**: hosting / IaaS tax codes are eligible |
| Stored value / prepaid credits | **P**: "stored value, including … store credit" ⚑ (applies to API credits? **U**) | **P**: "anything involving stored value" ⚑ (applies to API credits? **U**) | **P**: "balances for customers" ⚑ | **U** | **U** | **U** |
| Stablecoin payments | **U** | **U** | **U** | Payouts in USDC offered (pricing page) | **U** | **U** |
| India settlement | **U** (payout mechanics not on the inspected page) | **A**: payouts; $25 SWIFT for non-US; $5 under $1,000 | **A**: via Stripe Connect Express; 0.25% + $0.25 per payout + FX up to 1% | **A**: local bank | **U** | **P** |
| KYC / KYB | Required | Required | Required | Required | Required | Required |
| Published fees | 5% + 50¢ | 4% + 40¢ (US) / 4% + 15¢ (India domestic), +1.5% international, +0.5% subscriptions | 5% + 50¢ (Starter) down to 3.4% + 30¢; +1.5% international | 3.9% + $0.40 | not inspected | not inspected |
| Written approval needed for Satelink? | **Yes** | Effectively blocked | **Yes** | **Yes** | Not recommended | Not available |
| Confidence | Medium (help-center AUP, updated 13 Apr 2026) | High | Medium | Medium | Medium | High |

### 2c. Crypto processing and export receivables

| Question | Coinbase CDP x402 facilitator | Coinbase Business / Commerce | Stripe x402 / MPP stablecoins | Skydo | Xflow |
|---|---|---|---|---|---|
| Role | Crypto (verify + settle; funds go straight to the merchant's own address) | Crypto acceptance | Crypto → fiat (settles to Stripe balance) | Recv (RBI in-principle PA-CB-E) | Recv |
| Indian entity | **U**: terms page 403; search snippet only lists sanctioned jurisdictions; "100+ countries" is a marketing snippet ⚑ | **U / P?**: search snippet says "US and Singapore"; page blocked (403) ⚑ | **P (now)**: US (excluding NY); outside the US, request access via email; India not in the listed countries | **A**: built for Indian exporters | **A**: Indian companies exporting |
| Crypto-related activity | **A** (that is the product) | **A** | **W**: access request | **U** | **P**: "entities that directly service the crypto industry" |
| Agent payments | **A**: x402 | **U** | **A** where available | n/a | n/a |
| Fees | First 1,000 settlements/month free, then $0.001 each | **U** | **U** | $19 / $29 / 0.3% by band | **U** |
| India settlement | None. On-chain USDC to the merchant's own wallet; off-ramp and VDA tax handled separately | **U** | INR not listed | **A**: INR + FIRA | **A** |
| Confidence | Medium-low (terms unreadable) | Low | High | Low-medium (marketing pages only) | Medium |

---

## 3. Per-provider detail and citations

### 3.1 Stripe (India)
- **Invite-only.** "Stripe services are invite-only in India. Businesses from India are not able to sign up for a new Stripe account through our website." Priority is "a focus on international expansion".
  - Sources: https://support.stripe.com/questions/stripe-accounts-are-invite-only-in-india; https://docs.stripe.com/india-accept-international-payments (callout at top).
- **Entities and exports** (docs.stripe.com/india-accept-international-payments, "Requirements" / "Onboarding"):
  - Must be a "registered Indian business (sole proprietorship, limited liability partnership, or company)".
  - "If you sell services, providing an IEC is optional, unless: You accept AMEX payments from international customers [or] take any benefits under India's Foreign Trade Policy." Jakuraa already holds an IEC.
  - Must opt in to exports and pick **one** RBI purpose code per account. Candidates in Stripe's list: **P0802** Software consultancy/implementation, **P0803** Database or data processing charges, **P0807** Off-site software exports.
  - Every export charge needs the customer's name, billing address and a service description.
  - Payouts are in INR, and SCB issues payment advice.
  - Recurring: "You can use Stripe Billing to bill your international customers using subscriptions and invoices."
- **Limits:** "export up to a maximum of 25 lakh INR per transaction".
  - Source: https://support.stripe.com/questions/export-(international)-transaction-limits-for-stripe-accounts-in-india
- **Export-restricted businesses (India):** "exports of gems and jewellery, money transfer business, drop-shipping, and exporters that ship from warehouses outside of India" plus the general restricted list.
  - Source: https://support.stripe.com/questions/restricted-businesses-to-accept-international-payments-from-stripe-accounts-in-india
- **Supported in India:** Company/LLP/sole proprietorship. UPI, netbanking, BNPL, EMI and domestic Amex are **not** supported.
  - Source: https://support.stripe.com/questions/supported-payment-methods-currencies-and-businesses-for-stripe-accounts-in-india
- **Restricted / prohibited list** (https://stripe.com/legal/restricted-businesses; India version https://stripe.com/en-in/legal/restricted-businesses; "Last updated 2026-09-22"):
  - **Prohibited:** "Cryptocurrency mining and staking", "Initial coin offerings (ICOs)", "Secondary NFT sales". Under Unfair, deceptive or abusive acts: "No-value-added services, including the sale or resale of a service without added benefit". Also "Peer-to-peer money transmission".
  - **Restricted (approval):** "Cryptocurrency … exchanges and wallets"; "Investment and brokerage services…"; "Money transmitters, remittances, currency exchange…". Under third-party agents: "Payment facilitation and aggregation (including receiving settlement proceeds for goods or services that you did not provide…)".
  - **India-specific list** includes "Currency exchange", "Unlicensed financial institutions", "Personal investment vehicles/companies" (⚑ summarised).
  - **Not listed anywhere:** blockchain RPC/node APIs, developer APIs, or research/backtesting software. Classification: **U**.
- **Fees:** India international cards "3%" + "2%" FX; USD presentment "4.3%"; Billing "0.7% of Billing volume". https://stripe.com/in/pricing. The cross-border seller note shows "4.3%" + "Additional 2% if required": https://support.stripe.com/questions/additional-pricing-information-for-indian-cross-border-sellers
- **Connect (India):** New connected accounts are invite-only. Non-India platforms generally cannot transfer to India accounts, but US platforms can pay out to India connected accounts (support-search summary ⚑): https://support.stripe.com/questions/support-for-money-transfers-from-international-platforms-to-india-based-stripe-accounts
- **Link:** "Link isn't available in India." https://docs.stripe.com/payments/link

### 3.2 Razorpay
- **Merchant payment terms:** https://razorpay.com/terms/ (rendered in browser; Razorpay Payments Pvt Ltd, RBI-authorised PA, "Effective January 01, 2026").
  - **Entity-level covenant (Part A, representations, after cl. 2.13):** "You do not, and shall not, engage in any activity related to virtual currency, cryptocurrency and other crypto products (like non-fungible tokens or NFTs), prohibited investments for commercial gain or credits that can be monetized, re-sold or converted to physical or digital goods or services or otherwise exit the virtual world. Any breach of this provision shall be subject to immediate suspension or termination…" → **P**, entity-wide.
  - **Prohibited Products and Services (Part A cl. 17):** includes the same crypto line; "Securities which include government bonds or related financial products"; "Wholesale currency…"; "Drop-shipped merchandise".
  - Also: "If You deal in intangible goods/ services (eg. software download…)… which in the sole opinion of either the partner bank or the acquiring bank, is detrimental to the image…" This is a bank-discretion clause.
  - "Unregulated/unlicensed money service business (MSB) or money and value transfer services (MVTS)…" → **P**.
  - **Settlement:** "International / PA - CB Inward Transaction 15 (fifteen) days from the date of receipt…"
- **International enablement** (docs): onboarding plus video KYC; "The final settlement is done in the bank accounts of Indian businesses in INR". https://razorpay.com/docs/payments/international-payments/
- **Fees:** "2% per successful transaction" domestic; international cards "Up to 3%"; subscriptions cards "0.9% + Platform fees"; 18% GST. https://razorpay.com/pricing/
- **Repo state:** Razorpay has suspended Jakuraa Commercial Pvt Ltd under its Terms of Use (`docs/platform/CHECKOUT_UNBLOCK_PREP.md` and the EXECUTION_BOARD provider table). The entity-wide crypto covenant above is the most likely documented basis. **Do not re-apply** while x402/USDT rails exist anywhere in the entity.

### 3.3 Cashfree Payments
- **Terms:** https://www.cashfree.com/tnc/ (summarised ⚑; "Last Updated: March 10, 2026").
  - **Attachment A §1 Negative:** "Cryptocurrency Exchanges – Platforms dealing in cryptocurrency trading"; "Securities – Stocks, bonds, or related financial products".
  - **§2 Risky Categories:** "Financial Services, Pharmacy, Tours and Travel, **Saas**, … **Forex**, … **Stock market**, Mutual funds…".
  - **§3 Restricted** (risk-team approval): "Online Gaming, Digital lending, Chit funds, DMT merchants".
  - **Schedule G** (PA-CB): no "import and/or export of any restricted/prohibited goods and services"; refers to the RBI PA-CB direction.
- **Onboarding FAQ:** "Finance (forex, stock brokerage, payments)" needs FEMA/SEBI/PA licence documentation. https://www.cashfree.com/docs/help/onboarding-related/onboarding-faqs
- **Fees:** domestic "1.95%"; international Visa/MC "2.99%", Amex "2.95%"; card mandate "₹7.5 + ₹7.5". https://www.cashfree.com/payment-gateway-charges/
- **Assessment:** No entity-wide crypto covenant was found in the summarised text ⚑. The RPC product is "SaaS" (risky, not prohibited). Trading AI touches "Stock market/Forex" (risky). This is a **W** candidate.

### 3.4 PayU India
- **Banned list:** https://payu.in/BannedRestrictedCategorylist (read in browser).
  - Banned #29 "Unlicensed money exchange (incl. bitcoin/crypto), forex brokers, financial institutions, debt recovery".
  - Banned #32 "Any intangible goods or services; aggregation / consolidation business model".
  - Banned #33 "Software downloads, health/beauty products; pyramid marketing or get-rich-quick schemes".
- **Cautious list:** #7 "Stocks, bonds and related financial products, Forex … or investments"; #20 "Payment aggregators and payment facilitator businesses".
- **Terms index:** https://payu.in/online-pa-tncs/ (PDFs dated Oct 2024; banned list Aug 2024 per index; not opened).
- **Assessment:** Read literally, #32 and #33 exclude a SaaS/API seller. **Unsuitable** unless PayU confirms in writing that #32 does not cover SaaS.

### 3.5 Dodo Payments (MoR)
- **Merchant Acceptance Policy:** https://docs.dodopayments.com/miscellaneous/merchant-acceptance (no date on page).
  - "We can't support unlicensed financial tools, investment strategies, wealth-building courses, tax calculators, banking services, escrow services or anything involving stored value, lending, or managing funds."
  - "Crypto-related offerings, Digital wallets, NFTs, DeFi, crypto exchanges, or token launches aren't permitted."
  - Software resale: "selling software licenses at a discount, or reselling AI APIs, datasets, or tools without clear rights or authorisation."
  - Hosting/infrastructure: "VPN, VPS or dedicated servers, hosting plans, cloud compute credits, bandwidth reselling, or any product that provides users with persistent infrastructure or server-level access."
  - Marketplaces: "selling on behalf of others … taking funds and forwarding them elsewhere."
  - Welcomed: "SaaS & AI products", "Digital goods", "Templates, Plugins & Apps".
- **Countries:** India is listed. https://docs.dodopayments.com/miscellaneous/accepted-countries-and-territories
- **Verification:** KYC (ID + selfie), KYB, and product verification against the **live site**: "Your live site must match what you enter in the form". 1–3 business days. https://docs.dodopayments.com/miscellaneous/verification-process
- **Fees:** "4% + 40c" US; India domestic "4% + 15c"; international "+1.5%"; subscriptions/usage "+0.5%"; "$25" SWIFT for non-US; "$5" under $1,000. https://dodopayments.com/pricing
- **Usage billing:** Meters (Count/Sum/Max/Last); credit-based deduction. https://docs.dodopayments.com/features/usage-based-billing/introduction ; https://docs.dodopayments.com/features/credit-based-billing
- **Assessment:** Satelink conflicts with three separate prohibitions. See §7 for repo conflicts.

### 3.6 Paddle (MoR)
- **AUP:** https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle ("Last Updated: 13 April 2026" ⚑). The direct /legal/acceptable-use-policy URL returned 404.
  - Prohibited: "Exchanges, dealers, or trading platforms that enable transactions in financial instruments, currencies, or cryptocurrencies / virtual currencies".
  - Prohibited: "Investment or financial advice, including trading signals and strategies".
  - Prohibited: "Virtual currency or stored value, including but not limited to store credit, gift cards, vouchers".
  - Prohibited: "Payment services, whether regulated or not…".
  - Prohibited: "Any product or service that enables non-Paddle Sellers to sell…"; "resale of any product without a valid reseller certificate".
  - Restricted: "VPN and Proxies".
  - Restricted categories get enhanced due diligence: "Paddle's team will reach out to you".
  - Blockchain/Web3 developer tooling: **not mentioned** → **U**.
- **Countries:** India is not in the unsupported list. https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle
- **Fees:** "5% + 50¢ per Checkout transaction". https://www.paddle.com/pricing

### 3.7 Polar.sh (MoR)
- **AUP:** https://polar.sh/docs/merchant-of-record/acceptable-use (also https://polar.sh/legal/acceptable-use-policy).
  - Prohibited: "Trading and Financial Services, including (a) services facilitating transactions, investments, or balances for customers; (b) financial trading, trading bots, brokerage, or investment advisory services (including insights platforms); (c) … trading signals, or investment strategies; and (d) NFTs and Crypto assets".
  - Prohibited: "Reselling software licenses without authorization"; marketplaces; "API and IP cloaking services".
  - Restricted: "VPN, VPS & VDS services".
- **India:** Payouts via Stripe Connect Express. "No direct sales are made directly to the Stripe Connect Express account. They're all made to Polar (US)". https://polar.sh/docs/merchant-of-record/supported-countries
- **Fees:** Starter "5% + 50¢", down to Scale "3.4% + 30¢"; "+1.5% for international cards". Payout: "$2 per month of active payout(s)", "0.25% + $0.25 per payout", FX "0.25% (EU) - 1%". https://polar.sh/docs/merchant-of-record/fees

### 3.8 Creem (MoR)
- **Account reviews:** https://docs.creem.io/merchant-of-record/account-reviews/account-reviews (via search result snippets from that page ⚑; the terms page only references the list).
  - Prohibited: "Trading and investment tools and services that enable or facilitate trade execution or automation"; "NFT & crypto asset products"; marketplaces / "third-party merchant-funded customer payouts".
  - Restricted (strict due diligence): "API resellers, generative AI products, and trading and investment communities, courses, and educational products that do not enable trade execution or automation". "An established and proven track record is required."
- **Terms §6.4.6:** no products "subject to licensing, authorization or registration requirements (including … financial services…)". https://www.creem.io/terms
- **India:** "Local Bank" payout ✓. https://docs.creem.io/merchant-of-record/supported-countries
- **Fees:** "3.9% + $0.40"; payouts on the 1st/15th "to either bank accounts or crypto wallets (USDC)". https://www.creem.io/pricing

### 3.9 Lemon Squeezy (MoR, Stripe-owned)
- **Prohibited** (https://docs.lemonsqueezy.com/help/getting-started/prohibited-products):
  - "NFT & Crypto related products";
  - regulated services including "banking/financing, currency exchange";
  - PLR/MRR resale;
  - marketplaces.
- **Status:** The 28 Jan 2026 post says Managed Payments "support merchants in 35+ countries" and that the goal is to migrate LS users to Stripe Managed Payments. India is not mentioned. https://www.lemonsqueezy.com/blog/2026-update
- **Stripe Managed Payments eligibility:** India is **not** a supported business location. Hosting/IaaS/SaaS tax codes are eligible; the product must have "all necessary rights", and platform/marketplace sales are excluded. https://docs.stripe.com/payments/managed-payments/eligibility

### 3.10 PayPal India
- **AUP:** https://www.paypal.com/in/legalhub/paypal/acceptableuse-full ("Last updated on 2 November 2022").
  - Pre-approval: §4 "Payment Facilitator" (including "stored value cards and escrow"); §5 "Investments – Buying, selling, or brokering stocks … contracts for difference/forex…"; §7 "Cryptocurrency – Any digital representation of value…".
- **Fees:** International commercial "4.40% + Fixed Fee" (₹3); conversion "3.0% above the base exchange rate"; withdrawal "No Fee". https://www.paypal.com/in/business/paypal-business-fees

### 3.11 FastSpring
- The AUP lives in the JavaScript Trust Center (https://trust.fastspring.com/) and **could not be read**. The legal index is https://fastspring.com/legal/.
- A search-engine summary (not verified) says the AUP prohibits crypto exchanges and CFD/forex/crypto options. Treat FastSpring as **U** throughout.

### 3.12 Export receivables
- **Skydo:** Marketing pages only. RBI in-principle PA-CB-E; FIRA per payment; fee $19 / $29 / 0.3%. https://www.skydo.com/receive-international-payments-in-india/saas-company. No prohibited list was found → **U**.
- **Xflow:** https://docs.xflowpay.com/prohibited-business.
  - Prohibited: "Virtual currency or stored value or other virtual asset service providers – … entities that directly service the crypto industry"; "Unregulated/unlicensed financial institutions…".
  - High-risk: "Forex trading platforms".

### 3.13 Crypto rails
- **CDP x402 facilitator:** https://docs.cdp.coinbase.com/x402/core-concepts/facilitator and https://docs.cdp.coinbase.com/x402/support/faq
  - "The first 1,000 onchain Facilitator transactions each month are free, then each additional onchain transaction costs $0.001."
  - "OFAC and Know Your Transaction (KYT) checks…"
  - FAQ: "There are no processor fees or chargeback fees".
  - **CDP Terms of Service** (https://www.coinbase.com/legal/developer-platform/terms-of-service) returned **403 / Cloudflare challenge** to both fetch and headless browser. The only text seen is a search-engine summary: sanctioned jurisdictions excluded; no "prohibited use or prohibited business"; New York virtual-currency carve-out. India eligibility is **U**.
- **Coinbase Business / Commerce:** All official pages returned 403. A search snippet claims availability in "the US and Singapore" → **U**, and likely unavailable to an Indian entity.
- **India VDA note (brief; legal is covered elsewhere):** Receiving USDC/USDT directly to a Jakuraa wallet raises questions that belong to the legal workstream (`INDIA_REGULATORY_QUESTIONS.md`), not to provider policy:
  - Is Jakuraa a VDA service provider? That determines PMLA / FIU-IND registration.
  - Does s.194S TDS or VDA income tax apply?
  - Does the FEMA export-realisation treatment fit?
- **Stripe's x402 is not an option for India.** Stripe can record x402/MPP stablecoin payments only for accounts with "Stablecoins and Cryptocurrency" access. That is available to US businesses (except NY), with outside-US access by email. India does **not** appear in the stablecoin business-location list. https://docs.stripe.com/payments/machine/x402 ; https://docs.stripe.com/payments/stablecoin-payments

---

## 4. Machine / agent payments landscape (relevant to the x402 positioning)

| Rail | Who can be the seller | Satelink status |
|---|---|---|
| x402 via CDP facilitator | Anyone with a CDP account and a wallet (terms unverified, see above) | **Live today**. This is the only agent rail available to Jakuraa. |
| Stripe MPP: cards via SPTs | SPT seller countries: US, CA, GB, CH, NO, LI, GI and EU members. **No IN.** https://docs.stripe.com/agentic-commerce/concepts/shared-payment-tokens?agent-seller=seller | Not available |
| Stripe MPP / x402: stablecoins | US (excluding NY); EU, HK, MX and CH in private preview; others by email. **No IN** listed. https://docs.stripe.com/payments/machine | Not available |
| Stripe Agentic Commerce Suite (ACP) | Same country list as SPTs; private preview. https://docs.stripe.com/agentic-commerce/for-sellers | Not available |
| MoR providers (Paddle, Polar, Creem, Dodo) | No agent-initiated payment product documented | **U** |

Note: Stripe machine payments put a "US$0.50" minimum on SPT card payments and a "0.01 USDC" minimum on stablecoins. Satelink's $0.00003/call pricing only works with prepaid bundles or sessions, on any rail.

---

## 5. Stripe deep dive

1. **Why the decline happened, in Stripe's own words.** India is invite-only with "a focus on international expansion". The decline "for now" matches that published criterion (cross-border volume). It does **not** point to a prohibited-business finding, since no Stripe page lists blockchain RPC as prohibited.
2. **What a re-application must show:**
   - a registered company (done);
   - the export opt-in and **one** purpose code (P0803 or P0807 fit an API product best; the founder and CA should choose);
   - IEC (held; only mandatory for AMEX);
   - name and address capture on every export charge;
   - evidence of foreign customers and volume.
3. **Restricted-list exposure for Satelink:**
   - **RPC/API:** not listed (**U**). Explain it as developer infrastructure, not custody or exchange.
   - **USDT deposits / x402:** Satelink operates no exchange and no wallet for customers. But if credits funded by crypto can be bought and spent alongside card-funded credits, Stripe may view it as crypto-adjacent. Disclose it and keep it off the Stripe-funded ledger.
   - **Trading AI:** "Investment and brokerage services" is restricted. Research, backtesting and paper-trading software is not named (**U**). Live broker adapters (Binance, Alpaca, Upstox) would push it toward restricted. **Keep Trading AI out of the Stripe application scope** until written approval.
   - **API resale:** prohibited only if "without added benefit". Document the value added (routing, caching, failover, unified billing, metering). Upstream licences must also allow resale. Stripe's restricted list does not cover that; the upstream providers' terms do.
4. **Products and their India availability:**
   - Checkout, PaymentIntents and Billing (subscriptions and invoices): documented for India exports.
   - Usage-based billing: Stripe now steers new integrations to Metronome. No India-specific exclusion was found ⚑.
   - Link: **not available** in India.
   - Managed Payments (MoR): **not available**.
   - Connect for India platforms: invite-only.
   - SPTs, ACS and stablecoins: **not available** to an Indian business location.
5. **Fees** if approved: 3% international + 2% FX (or 4.3% with USD presentment) + 0.7% Billing, before GST.
6. **Structural alternative (not recommended without legal advice):** A foreign subsidiary (for example a US company) could access Stripe US, MPP/SPTs, stablecoins and Managed Payments. That raises ODI/FEMA, transfer-pricing and substance questions, which belong in the legal workstream.

---

## 6. What must change before applying anywhere

- [ ] **One storefront, one product per application.** The fiat checkout domain should present only the developer RPC/API SaaS (plans, prepaid usage, docs, terms, refund policy). Move "Satelink Trading AI" to a separate domain or behind login, and leave it out of the product description.
- [ ] **Remove or neutralise trading language** ("Trading Intelligence", "liquidation-pressure", "funding-rate") from anything a fiat provider reviews. Every MoR inspected prohibits or restricts it.
- [ ] **Separate the crypto rails visibly.** Describe x402/USDT as an independent on-chain payment option settled directly to Jakuraa's wallet, outside the card provider. Never route crypto-funded and card-funded balances into one fungible ledger. The live Dodo webhook currently credits fungible USD into `api_credits.credits_usdt`, the same balance that pays for RPC (admitted in `01_PAYMENTS_BOUNDARY.md`). Fix this before any provider review.
- [ ] **Re-model "credits" so they cannot be read as stored value.** They should be non-refundable-to-cash (except the legal refund policy), non-transferable, and not withdrawable or convertible. Prefer naming such as "prepaid usage plan" or "included calls". Paddle, Dodo and Polar each prohibit stored value.
- [ ] **API resale:** Get written upstream resale/redistribution rights for every third-party API before selling it with markup, and document the added value. Without these, Dodo, Paddle, Lemon Squeezy, Polar and Stripe ("no-value-added") are all in conflict, and Creem requires due diligence.
- [ ] **Publish the policies** providers check: refund (#525 still not approved), terms, privacy, AUP and contact. Use a domain support email, not Gmail. The legal name must match on PAN/GST/IEC/bank (`docs/dodo/PRODUCT_INFORMATION_FORM.md` §1).
- [ ] **Do not re-approach Razorpay** while any crypto activity exists in the entity.
- [ ] **Have the CA/lawyer answer the VDA questions** (`CHECKOUT_UNBLOCK_PREP.md` L5) before stating anything about USDT/USDC receipts to a fiat provider.
- [ ] **Keep broker adapters disabled and out of marketing** until a regulated-activity assessment is done (SEBI / foreign-broker terms; outside this document).

---

## 7. Reconciliation with prior repo documents

| Repo doc | Claim / assumption | Conflict with current official policy |
|---|---|---|
| `docs/dodo/PRODUCT_INFORMATION_FORM.md` §3 | Sells "prepaid API credits for *Trading Intelligence*: derived market analytics (funding-rate heatmaps, open-interest shifts, market microstructure, a liquidation-pressure model)… not investment advice" | Dodo prohibits "unlicensed financial tools, investment strategies" and "Crypto-related offerings". Funding-rate, OI and liquidation analytics are crypto-derivatives market tools. A "not investment advice" disclaimer does not change the category. "Prepaid credits" may also hit "anything involving stored value" ⚑. **High risk of rejection or later termination.** |
| Same form §3 "Not sold through Dodo: the crypto rail…" | The assumption that Dodo assesses only what Dodo processes | Dodo product verification checks the **live website**, and satelink.network sells blockchain RPC (Dodo: "infrastructure services … cloud compute credits … persistent infrastructure", prohibited) and crypto rails ("Crypto-related offerings", prohibited). Ledger separation does not cure a merchant-level category mismatch. |
| `docs/pricing-v2/01_PAYMENTS_BOUNDARY.md` | "Dodo is reviewing Satelink as a SaaS analytics product and explicitly excluded infrastructure/crypto from that review" | That exclusion is not reflected in any published Dodo policy. Treat it as unverified unless it exists **in writing from Dodo**. The same doc admits the live webhook credits fungible USD that funds RPC, which contradicts the description given to Dodo. |
| `docs/pricing-v2/03_DODO_CAPABILITY_VERIFICATION.md` | Capability findings (trial_amount, mandate floor) | Not re-verified here. Capability is not permission: these features do not imply that Dodo accepts Satelink's category. Current Dodo pricing: subscriptions/usage "+0.5%", India domestic "4% + 15c". |
| `docs/platform/CHECKOUT_UNBLOCK_PREP.md` | Razorpay suspended; Dodo and Cashfree `application_pending` | Razorpay suspension is consistent with its entity-wide crypto covenant. Dodo pending: see above, likely to fail as described. Cashfree pending: SaaS, Forex and Stock market are "Risky" (enhanced review), crypto exchanges are negative. Viable only with full disclosure. |
| `CLAUDE.md` / x402 docs | x402 via CDP facilitator is "LIVE" and "mainnet-proven" | No conflict found in CDP docs, but the CDP **Terms of Service could not be read** (403). Confirm in writing that an Indian private limited company is an eligible CDP customer. |

---

## 8. Open questions requiring written provider confirmation (drafts only; NOT sent)

**Stripe (via Sales invite request)**
1. "We are an Indian private limited company (IEC holder) exporting a developer API that provides blockchain RPC access (read-only JSON-RPC to public Polygon nodes; no custody, no exchange, no wallets). Is this an eligible business for an India account with exports enabled, and which purpose code do you accept for it (P0803/P0807)?"
2. "We separately accept USDC via x402 directly to our own wallet, outside Stripe. Does operating that rail outside Stripe affect eligibility?"
3. "If we resell third-party API access with added routing/metering, under licence from the upstream provider, is that acceptable under the 'no-value-added resale' rule?"
4. "Is Metronome or Billing Meters usage-based billing available to India export accounts?"

**Paddle**
5. "Is a blockchain RPC/developer-infrastructure API (no custody, no trading, no tokens) acceptable under your AUP?"
6. "We sell prepaid usage plans (non-transferable, non-withdrawable call allowances). Do these count as 'stored value' under your AUP?"
7. "Our company separately operates an on-chain USDC/USDT payment option and a private-beta trading-research tool on a separate domain, neither sold via Paddle. Does that affect approval of the API product?"

**Polar.sh / Creem**
8. Same as 5–7. Plus, Polar: "Does 'NFTs and Crypto assets' cover blockchain RPC infrastructure?" Creem: "What evidence satisfies 'established and proven track record' for API resellers?"

**Cashfree**
9. "SaaS is listed as a Risky Category. What extra documents are required for PA-CB inward collection for a SaaS/API exporter?"
10. "Does the 'Cryptocurrency Exchanges' negative category extend to a company that receives stablecoin payments for its own services outside Cashfree?"

**PayU**
11. "Does banned item #32 'Any intangible goods or services' apply to B2B SaaS/API subscriptions?"

**Dodo (to resolve the pending application honestly)**
12. "Please confirm in writing whether the following are acceptable: (a) crypto-market analytics; (b) a blockchain RPC API; (c) prepaid API credits under your 'stored value' and 'infrastructure services' rules; (d) a website that also offers crypto payment options not processed by Dodo."

**Coinbase CDP**
13. "Is an Indian private limited company eligible to use the CDP x402 facilitator on mainnet under the CDP Terms of Service? Are there any prohibited-business categories applicable to an API seller?"

**Xflow / Skydo**
14. Xflow: "Does a company that provides RPC API access to public blockchains count as an entity that 'directly services the crypto industry'?" Skydo: "Please share your prohibited/restricted business list."

**PayPal India**
15. "Does a developer API product with no crypto sold via PayPal require pre-approval under AUP §7 because the company accepts crypto elsewhere?"

---

### Pages that could not be read (honest gaps)
- Coinbase CDP Terms of Service, Coinbase Business/Commerce FAQ, help.coinbase.com: **403 / Cloudflare**.
- FastSpring AUP: JavaScript Trust Center, not extracted.
- Paddle `/legal/acceptable-use-policy`: **404** (help-center version used instead).
- Stripe "recurring transactions for India" support article: **404**.
- PayU merchant-terms PDFs: not opened (only the index and banned list).
- Creem prohibited list: read via search-result excerpts of its official docs page, not a full fetch ⚑.
