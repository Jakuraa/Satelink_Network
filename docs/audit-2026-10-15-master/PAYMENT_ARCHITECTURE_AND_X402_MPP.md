# Payment Architecture, x402 & MPP

**Inspection:** 2026-10-15 · code on `main` @ `94161ef7`, draft PR #520, live endpoints, official protocol docs (research §A).

## 1. What exists (as-built)

| Rail | Code | Live state | Ledger write | Idempotency | Refund |
|---|---|---|---|---|---|
| **x402 (USDC, Base)** | `src/payments/x402/{middleware,settlement,config,funnel,key_recovery_router}.js` | **LIVE**, v2 402 + `PAYMENT-REQUIRED` header, `exact` scheme, 100000 (0.10 USDC), payTo `0x966E…7Ad4`, CDP facilitator | One txn: `payment_sources` + `revenue_events_v2` + `api_deposits` + `api_credits` + hashed session key | `tx_hash` UNIQUE → 409; test-network guard; per-IP verify rate limit | None (protocol is irreversible; manual transfer only) |
| **USDT deposit (Polygon)** | `RevenueVaultV2 0x577D…BaCEF`; `services/deposit_listener.js`; `/api/keys/deposit`; `/api/deposit/notify` | LIVE (advertised) | `credit_deposits` / `api_deposits` → `api_credits` | 25 confirmations; `tx_hash` idempotent across both tables | None |
| **Card via Dodo (MoR)** | `apps/web/src/app/api/dodo-{checkout,webhook,claim,balance}`; `apps/api /internal/dodo/credit`; `pricing_v2/*` | **TEST mode, not purchasable** (`/v2/plans` `checkoutAvailable:false`) | `api_credits`, `payment_sources`, `revenue_events_v2`, ledger | Standard-Webhooks HMAC; tx-keyed dedupe; reversal handler idempotent on refund/dispute id | Dodo refunds + disputes handled |
| **PaymentAdapter / Financial OS v1** | PR #520 (draft): adapters Dodo, Cashfree (`application_pending`), Razorpay (`provider_suspended`), Transacty (`not_applied`) | Not deployed (`/v1/payments/*` 404) | Canonical single-transaction ingest | 266/266 integration tests on branch | Designed |
| **Shadow ledger** | `src/ledger/shadow_*` | Partial: 3 txns vs 4 revenue events (75 %), draws 0 % | — | — | — |
| **MPP** | **none** (no code references) | — | — | — | — |
| **Settlement / payouts** | epoch scheduler + anchor | `SETTLEMENT_DRY_RUN=1` | — | — | — |

## 2. Protocol facts (official, accessed 2026-10-15)

| Topic | Fact | Source |
|---|---|---|
| x402 version | v2 current. Headers `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE`; v1 `X-PAYMENT` is legacy but still supported | docs.x402.org migration guide |
| Schemes | `exact`, `upto` (usage-based, signs a max and settles actual), `batch-settlement` | docs.x402.org/schemes |
| Facilitator | Non-custodial; may return `settlement_pending`, which the server must reconcile | docs.x402.org/core-concepts/facilitator |
| CDP facilitator | Base, Polygon, Arbitrum, Solana…; 1,000 settlements/mo free then $0.001; OFAC + KYT screening on every payment | docs.cdp.coinbase.com/x402 |
| Refunds | None native ("irreversible once settled… send a transfer back") | CDP x402 FAQ |
| CDP eligibility for an India seller | **NOT VERIFIED** (ToS bot-blocked); founder must read the "eligibility / restricted jurisdictions" clauses | research §A1 |
| Stripe MPP / x402 / stablecoins | x402 on Stripe is **preview**, settling via CDP. Stablecoin acceptance: US (excl. NY) plus private preview in EU/EEA, CH, HK, MX…; **India not listed**. Agentic card tokens (SPT): US/CA/EU sellers only | docs.stripe.com/payments/machine, /stablecoin-payments |
| Stripe India | New accounts invite-only | support.stripe.com |
| ACP / AP2 / Visa / Mastercard | ACP depends on SPT (not available to India sellers) and doesn't fit sub-cent metering. AP2 is v0.2 under FIDO. Visa Intelligent Commerce: pilot. Mastercard Agent Pay: rolling out via PSPs | research §A3–A4 |

**Conclusion on MPP:**
- **Do not implement MPP.** It is reachable for an India-domiciled entity only via Stripe, and Stripe's machine-payments and stablecoin features are not offered to India businesses.
- Revisit only if a non-India entity with a Stripe account is created, which is a legal and tax decision (INDIA).

**Conclusion on x402:** the implementation is spec-current (v2) and sound. Its weaknesses are commercial and legal, not technical:
- zero external payers
- open questions on crypto-receipt GST and FEMA (INDIA §1, §4)
- no refund path
- the settle-before-record window (SECURITY F-06)

## 3. Gaps against the required properties

| Property | State | Gap |
|---|---|---|
| Never credit from client-side success | Met: x402 credits only after facilitator settle; Dodo only after HMAC-verified webhook; USDT only after 25 confirmations | — |
| Replay protection | Met (`tx_hash` UNIQUE; facilitator nonce) | — |
| Idempotency | Met on all three live rails | `settlement_pending` from the facilitator is not explicitly handled. Verify, else treat as F-06 |
| Single ledger | **Not met**: `api_credits` (balance), `revenue_events_v2` (revenue), shadow `ledger_txns` (75 % parity), #520 Financial OS (not deployed) | Pick one canonical ledger (the #520 Financial OS) before adding any provider |
| Spending limits for agents | Behind `CONSOLE_ACCOUNTS_V1` (state unverified); x402 `upto` scheme not used | Required before marketing "agent spending controls" |
| Refunds | Dodo only | Written policy + manual crypto credit-back SOP |
| Reconciliation | SQL Q1–Q8 (Q5 fixed, not re-run); no facilitator↔DB sweep | Nightly reconciliation job |
| Wrong-network payment | x402 pins network and asset; deposits only via vault events | Disclose that direct transfers outside the vault/x402 are not credited |

## 4. Minimum safe architecture for one real paying customer + one supplier

```
Customer (human or agent)
  ├─ Card top-up ≥ $10 ──► MoR (Dodo/Paddle-class, once approved) ──► signed webhook
  └─ x402 bundle (optional, crypto) ─► CDP facilitator settle ─────────► settlement.js
                                   ▼
            ONE canonical ledger (Financial OS from #520: single-transaction ingest,
            payment_sources UNIQUE, entitlement = api_credits derived from ledger)
                                   ▼
          authorizeAndMeter ──► contracted upstream (written resale OK) or own node
                                   ▼
            nightly reconciliation: provider payouts/settlements ⇄ ledger ⇄ credits
            refund SOP: MoR refund API (card) · manual transfer + ledger reversal (crypto)
```

**Build order:**
1. Unmount and remove misleading surfaces (F-01, F-02, F-04, F-10).
2. Contract the upstream.
3. Merge #520 behind its flag, so the ledger is canonical before money flows.
4. Get one MoR approval.
5. Publish the refund policy (#525 after CA review).
6. Run one non-founder paid test (`X402_PAID_TEST_RUNBOOK.md` / card) and reconcile it end to end.

**Do not:** add MPP; add Razorpay back (suspended); enable settlement payouts; or route card money into Trading Intelligence.

## 5. Recommended change to the card boundary

Today `/v2/plans` declares that card-funded value is spendable on **Trading Intelligence only**, and RPC is crypto-only. That is backwards for underwriting:
- the one fiat product is the crypto-derivatives analytics module, which carries trading and market-data risk;
- the clean infrastructure product cannot be bought with a card.

**Invert it:** card credits buy RPC/API infrastructure. Trading Intelligence stays off the card rail (and off public catalogues) until it has its own legal review and provider disclosure (BOUNDARY §C).
