# Checkout unblock — preparation (2026-10-13)

Board items 4.1, 4.2, 4.3 and 4.5. Preparation only: nothing here is approved or published.
**#525 is not approved.** Approval needs the founder's "approved" comment **and** a qualified
Indian legal/CA review.

## 1. #525 `/legal/refunds`: questions for the CA

#525 is a draft (DO NOT MERGE), page `apps/corporate/app/legal/refunds/page.tsx`. The founder
set three numbers, still unconfirmed: unused-credit refund window **30 days**, investigation
**7 business days**, processing **7 business days**.

| # | question for the CA | policy text it affects |
|---|---|---|
| L1 | Does the policy meet Consumer Protection (E-Commerce) Rules, 2020 r.4/r.5 (refund and grievance disclosures for an e-commerce entity)? Is Jakuraa an "e-commerce entity" for RPC credits sold to businesses and machines? | whole page |
| L2 | Are 30 days (unused credits), 7 + 7 business days (decision + processing) acceptable, or do the rules or RBI/card-network rules require shorter timelines for card refunds? | "How long it takes" |
| L3 | Is "no refund of the current subscription period after cancellation" enforceable against consumers, or does it need a pro-rata carve-out? | "Subscriptions" |
| L4 | Can we deduct non-returned payment-provider fees from unused-credit refunds? Does that need to be shown at checkout? | "Unused prepaid credits" |
| L5 | **Crypto refunds** (same asset, same sending address, minus gas): is it lawful for an Indian company to receive and refund USDT/USDC to customers? What are the FEMA, PMLA (VDA service-provider registration with FIU-IND) and 1% TDS (s.194S) implications on refunds? | "Crypto payments" |
| L6 | GST: does a refund of prepaid credits need a credit note? Is it treated as advance or supply? Does the policy need to say so? | "Unused prepaid credits", invoices |
| L7 | Chargebacks: is "we may restrict your account while we investigate" acceptable, and must we commit to a time limit? | "Chargebacks" |
| L8 | Grievance officer: `jakuraa.com/legal/grievance` exists (200, 2026-10-13). Does it carry the name, contact and acknowledgement/resolution timelines (48h/1 month) the 2020 Rules require? | "If we decline" |
| L9 | "Service failures … for reasons within our control": does it need a defined SLA and a defined way to measure "affected calls"? | "Service failures" |
| L10 | Card refunds through providers that are suspended or pending (Razorpay suspended; Dodo and Cashfree pending): who refunds money already taken by a provider we no longer use? | general |

## 2. Invoice-address validator and listener separation (#520, re-verified on current main)

#520 head `687cc455` is 1 commit behind `main` (`8ee853cf`, docs only). In a scratch merge of
#520 + current `main`, all of these pass (**31/31**):

| test | result |
|---|---|
| v1–v4 refuses unset and every listener-credited address (vault V1/V2, treasury); accepts a dedicated one | ✔ |
| v5 on-chain-native checkout not offered until the invoice address is valid | ✔ |
| s1 "a payment to the invoice address never credits an RPC balance": claiming it via `POST /api/keys/deposit` is refused and writes nothing | ✔ |
| s2 DepositListener binds to the vault only, which a valid invoice address can never equal | ✔ |
| payments_adapters (Razorpay suspended, Cashfree/Dodo `application_pending`, PayRam, on-chain invoice) | ✔ 25 |

Still blocked on the founder: a dedicated Safe address for invoices (address only).

## 3. `/api/keys/deposit` on main: does #523 cover it?

**Atomicity: yes.** On `main`, the `api_deposits` insert and the `api_credits` credit run in one
transaction (`billing/api_keys_route.mjs:383-397`). A UNIQUE race (23505) returns
`tx_already_used` and credits once. d1/d2 pass.

**Ownership: no, and #523 was not meant to cover it.** `checkDepositOwnership` compares the
on-chain sender with the key's `wallet_address`. That field can be set **without any proof**
through `POST /api/keys {wallet_address}`. A squatter who binds a victim's wallet can claim the
victim's unclaimed treasury transfer. See `BURN_ADDRESS_ACCOUNT.md`: this is the open security
blocker S1.

## 4.5 Checkout E2E stays BLOCKED on

4.1 (refund policy approved and published) + 4.2 (invoice address) + S1 (wallet binding requires
a signature).
