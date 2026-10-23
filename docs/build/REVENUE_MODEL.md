> **Verified / changed (Session A, 2026-10-22).** The document below is committed verbatim as the founder supplied
> it. Repo state as of this commit:
> - §1 row 3 (x402 / prepaid RPC, "Live"): still live. Production probe 2026-10-22 04:16 UTC: anonymous
>   `/rpc/polygon` → 402. The catalog prices ($0.00003/call; $0.10 = 1,000 calls) are unchanged.
> - §2 reservation flows: the `Reservation` aggregate and the reserve/capture/release service are in draft
>   #583 (library only). The ledger postings in the table (holds, capture to revenue, COGS) are not built yet.
> - §3 pricing rule shape: the Capability Registry v3 skeleton (draft #582) uses this `pricing` field shape.
>   `amount_micro: null` means withheld (F8).
> - Verified external revenue is still **$0.00**. No price in this file has been decided.

# Satelink AI Assistance — Revenue Model

Status: PROPOSED. **No prices in this file are decided.** Prices come only from founder decision F8 and live
in the Capability Registry. Verified external revenue to date: **$0.00**.

**In plain English:** customers pay in three ways. They pay a monthly plan, they pay for what they use, or a
machine pays per call. Money a customer deposits is not revenue until they use it. Every charge has to point
at the work that was done and at what that work cost us, so margin is measured, not guessed.

## 1. Streams, in launch order

| # | Stream | Who pays | Unit | Status | Gate |
|---|---|---|---|---|---|
| 1 | **Developer prepaid credits** for `/v1/responses`, `/v1/decisions` | Developers, agents | Per request = provider cost + margin, in micro-USD | Not built | SIE + metering (Session B), F8 |
| 2 | **Human subscriptions** (Entry / Pro / Premium; Enterprise by contract) with included usage + overage | Humans | Monthly / annual | Partially built (Dodo, broken webhook) | F8, payment rail (Dodo fix or Transacty), Trading AI paper mode |
| 3 | **x402 / prepaid RPC** | Machines | $0.00003/call; $0.10 = 1,000 calls | **Live** | Keep; F20 (paid traffic must not hit free upstreams) |
| 4 | **Agent budgets** (prepaid per principal, caps, receipts) | AI agents | Same as #1 | Not built | Delegated auth + budget caps |
| 5 | **Procurement / service fee** (Satelink buys a third-party service for the customer) | Agents, developers | Supplier cost + disclosed platform fee | Not built | Supplier terms, legal, disclosure |
| — | Fees on trading volume or outcomes | — | — | **Not permitted** without legal/regulatory review | F6 |

Recommendation: the first real revenue should come from #1 and #2 together. Developers can pay through
USDT/x402 today. Human subscriptions need a working fiat rail, which is the commercial bottleneck.

## 2. Ledger flows (Financial OS, double-entry, micro-units, explicit currency)

| Event | Debit | Credit | Revenue? |
|---|---|---|---|
| Customer deposits / x402 bundle settles | Cash/settlement asset | Customer balance (liability) | No |
| Subscription payment confirmed (final) | Cash | Deferred revenue | No (recognised over period) |
| Reservation (HOLD) | Customer balance | Customer holds | No |
| Capture on success | Customer holds | Revenue (by capability) | **Yes** |
| Release on failure / remainder | Customer holds | Customer balance | No |
| Provider cost booked from evidence | COGS (by capability, provider) | Provider payable | — |
| Refund after capture | Revenue (reversal) | Customer balance | Negative |
| Founder / test account activity | same entries, account flagged `internal` | | **Excluded** from external revenue |

Invariants: balanced per transaction and currency; append-only; idempotency key on every payment, usage,
refund and settlement event; no cross-currency sums without an FX entry carrying rate provenance;
entitlements only after final payment confirmation.

## 3. Pricing rule shape (registry field `pricing`)
```
{ unit: "request" | "1k_tokens" | "call" | "month",
  currency: "USD", amount_micro: <int> | null,      // null = not published (F8)
  basis: "fixed" | "cost_plus",
  cost_plus: { markup_bps: <int>, floor_micro: <int> },   // for model inference
  included_in: ["pro", ...], overage: {...},
  on_failure: "release_all", refund_rule: "reversal",
  effective_from: <date>, version: <int>, status: "live"|"test"|"withheld" }
```
Cost-plus fits model inference because provider cost varies per request. A margin floor stops cheap calls
from losing money after payment fees.

## 4. Margin measurement
Per capability per day: captured revenue − provider COGS − payment fees (from rail evidence) = gross margin.
Report it in the admin financial metrics alongside `consumed_usage` (#555 predicate). Alert when any live
capability's 7-day margin turns negative.

## 5. Founder decisions this model needs
1. **F8 prices:** plan prices, annual discount and markup/floor for inference. Today four price sets
   conflict (Pro yearly $120 vs $190).
2. **Fiat rail:** fix the Dodo webhook, or start Transacty KYB. Without one, Indian humans can't pay
   easily.
3. **Free tier:** whether one exists, and its hard budget (it must have an abuse cap).
