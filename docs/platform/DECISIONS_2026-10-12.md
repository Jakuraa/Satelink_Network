# Satelink — Payments + Financial OS + Platform Alignment: Decisions (2026-10-12)

> Part A of the 2026-10-12 founder directive, committed verbatim as the decision record.
> Evidence classes: **VERIFIED** (read from the provider's own docs on 2026-10-12),
> **PROVIDER CLAIM** (marketing page, not yet checked against docs), **CODEBASE FINDING**.

## A1. Payment provider evidence register

Each row gives the evidence class, the source and its implication.

1. **PayRam is self-hosted and non-custodial.** VERIFIED. Source: docs.payram.com.
   - It deploys via DigitalOcean 1-click, a setup script or Docker.
   - The docs list a Payments API (create payment, status, deposit address), a Payouts API, webhooks and a TypeScript SDK.
   - **Implication:** it is software Satelink runs and operates itself, not a merchant account.
2. **PayRam chains (USDT/USDC on Tron, Base, Ethereum, Polygon).** PROVIDER CLAIM. Source: payram.com/stablecoin-payment-gateway.
   - The claim includes "no signup, no KYB" and "deposit keys never touch the server".
   - **Implication:** verify against docs.payram.com/support/supported-networks-and-coins before relying on it. The page itself says merchant KYC/AML obligations stay with the merchant.
3. **PayRam webhook.** VERIFIED. Source: docs.payram.com/api-integration/payments-api/webhook.md.
   - Signature: HMAC-SHA256 of the raw body in `X-Payram-Signature` (`sha256=<hex>`).
   - Statuses: OPEN, PARTIALLY_FILLED, FILLED, OVER_FILLED, CANCELLED.
   - Retries go out to 48h; `reference_id` is the idempotency key.
   - **Implication:** it maps cleanly to a canonical payment-event contract. Underpayment and overpayment are native states.
4. **PayRam subscriptions.** VERIFIED ABSENT from the docs index. No recurring/subscription API appears.
   - **Implication:** crypto subscriptions must be prepaid credits or an explicit renewal invoice. Never fake auto-renewal.
5. **PayRam install.** The docs show `curl | bash` installs.
   - **Implication:** do not run that unreviewed. Pin a version and run it on a dedicated VPS, never on the API host.
6. **Transacty (transacty.ai).** VERIFIED. Source: docs.transacty.ai/get-started.
   - HMAC-signed `/v1` API with an Idempotency-Key required on money writes.
   - Each market is a **separate KYB approval**; unapproved markets return 403 `market_not_enabled`.
   - Test and live share one base URL; the key decides the environment.
   - **Implication:** nothing works until KYC plus India market approval.
7. **Transacty India UPI.** VERIFIED. Source: docs.transacty.ai/india/payin.
   - The customer pays INR by UPI and the merchant wallet is credited in **USDT**.
   - It is host-to-host only: Satelink must build the UPI QR/VPA screen and collect the bank UTR itself. There is no hosted checkout.
   - Events: `payin.completed` / `payin.failed`. No subscription API.
   - **Implication:** high UX friction and manual UTR entry.
   - **Regulatory flag:** an Indian company receiving domestic customers' INR as USDT in an offshore wallet needs professional FEMA/tax/GST review before any live use. Not a first choice.
8. **transactapay.com is a different product.** VERIFIED. Source: docs.transactapay.com.
   - Its canonical docs are on akurateco.com, a white-label card/APM orchestration platform. It supports cards, APMs, tokenized recurring and multi-acquirer routing.
   - Credentials come from an account manager, and acquirers must accept the merchant.
   - **Implication:** it is not Transacty. It is an orchestration layer, not an acquirer, so eligibility is decided by the underlying acquirers.
9. **Dodo Payments (already integrated).** VERIFIED. Source: docs.dodopayments.com merchant acceptance policy.
   - "Virtual asset services – crypto-related offerings… crypto exchanges… aren't permitted"; "Unlicensed Financial Services" is prohibited.
   - **Implication:** an accurate description of Satelink Trading AI (it trades crypto via users' brokers) puts it at high risk of rejection. Dodo already raised crypto concerns.
10. **Cashfree.** VERIFIED. Source: cashfree.com/docs onboarding FAQ.
    - Prohibits "Cryptocurrency exchanges and trading platforms" and requires the business to be registered in India.
    - **Implication:** high risk for a crypto-trading product. Lower risk if the product sold is software for Indian equity brokers (Upstox copilot).
11. **Stripe.** VERIFIED. Source: support.stripe.com restricted-business FAQ.
    - "Investment… services… cryptocurrency-related business" is restricted and needs prior approval.
    - **Implication:** possible only with explicit approval, and Indian-entity availability is limited. Not a near-term path.
12. **Razorpay (Stage 27 adapter, test mode).** UNVERIFIED: the prohibited-business page could not be fetched.
    - **Implication:** apply honestly and expect enhanced review. Treat approval as unknown.
13. **The repo already has an on-chain USDT rail.** CODEBASE FINDING (earlier audits).
    - Polygon USDT deposit vault plus deposit listener, crediting `api_credits` / the Financial OS shadow ledger.
    - x402 USDC on Base also exists.
    - **Implication:** the fastest compliant crypto collection path already exists and is already wired to the ledger.

## A2. Decisions

**Merchant identity.** Jakuraa Commercial Private Limited is the legal merchant, with its verified CIN/GSTIN on every checkout and invoice. Describe the product accurately to every provider: "non-custodial AI trading software subscription; Satelink never holds customer funds or executes on its own account." Never mis-categorise it.

**Crypto collection, in order:**
1. **Primary, now:** wrap the EXISTING in-house Polygon USDT vault (and Base USDC/x402) as the first `PaymentAdapter` ("onchain-native"). No new provider, no approval wait, already reconciled into the ledger.
2. **Secondary, after the first paying customer:** PayRam on a dedicated VPS, for USDT-TRC20 (Tron) and multi-chain coverage, behind the same adapter interface.
3. **Not now:** Transacty (KYB plus FEMA review), BTCPay (adds nothing over 1 and 2 for stablecoins).

**Crypto subscriptions.** Use prepaid credits plus explicit renewal invoices with expiry reminders. No fake auto-renew.

**Fiat collection, in order:**
1. **Primary:** Razorpay (adapter already built, test mode). Apply live with the accurate description. UPI AutoPay up to ₹15,000 covers domestic recurring.
2. **Parallel fallback:** Cashfree, application only.
3. **Global cards:** Dodo only if it accepts after full disclosure. Otherwise defer international cards and serve international users with USDT/USDC.

None of these is guaranteed, and every one is written as a replaceable adapter.

**Financial OS.** It stays the only ledger. Every provider event follows one path:

`verified webhook → payment_events (idempotent on provider+event id) → Financial OS posting in the SAME transaction → entitlement change`

Provider dashboards are external records only.

**Domains:**

| Domain | Owns |
|---|---|
| jakuraa.com | Company, legal, merchant disclosures |
| satelink.network | Product, pricing, beta/signup |
| console.satelink.network | Checkout, subscriptions, credits, invoices, receipts, agents and machine keys, trading controls |
| developer.satelink.network | Keys, MCP, SDK, logs, webhooks, sandbox |
| admin.satelink.network | Internal only, behind staff auth + MFA (B-02) |
| docs.satelink.network | Docs (Mintlify) |
| api.satelink.network | Public API + `/webhooks/<provider>` (no admin routes) |

**Scope sequencing.** All scope stays in, but in this order because revenue comes first:

| Wave | Contents |
|---|---|
| Wave 1 | Payments + Financial OS + checkout + #492 merge readiness |
| Wave 2 | One service registry + developer/admin/docs alignment |
| Wave 3 | Connector contract + model BYOK |
| Wave 4 | Non-trading connectors (shopping/booking/email), started only after the first paying trading customer |

**DOTS / MUSE / GROKBOT.** The names are ambiguous and the intended projects were not identified. Nothing depends on them. Ask the founder for repo URLs before evaluating.

## Founder inputs recorded with this directive (2026-10-12)

- Railway API is active. CIN/GSTIN are correct.
- Phase-2 rotations are deferred until before launch; B-01..B-04 stay OPEN.
- APPROVED: an additive extension of the ledger transaction-kind CHECK constraint (migration-019 pattern) for `payment`, `subscription`, `commission`, `rebate`, `provider_fee`. Nothing else in existing Financial OS tables may change without asking.
