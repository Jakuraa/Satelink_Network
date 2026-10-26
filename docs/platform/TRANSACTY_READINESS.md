# Transacty readiness — 2026-10-13

**State:** adapter is **code only** (`apps/api/src/payments/adapters/transacty.mjs`), flag
`PAYMENT_TRANSACTY` **OFF**, not registered in `buildAdapters` (never offered, never called).
The founder has **not applied**. No live API call has ever been made; no account exists.
Contract tests run on fixtures only: `apps/api/test/payments_transacty.test.js` (7/7).

## What the adapter implements (docs.transacty.ai, read 2026-10-13)
| Concern | Implementation |
|---|---|
| Request auth | `X-Transacty-Key`, `X-Transacty-Timestamp` (unix s), `X-Transacty-Signature` = HMAC-SHA256(`{timestamp}.{rawBody}`) |
| Idempotency | `Idempotency-Key` = our `canonicalRef` on create (retry never makes a second pay-in) |
| India UPI H2H | `POST /v1/h2h/payin-instances` → UPI intent (`paymentDetails.qr`) + VPA; `POST /v1/h2h/buyer-confirms-payment {transactionId, utr}`; `GET /v1/h2h/payin-instances/:id` |
| Status | `pending`→pending, `success`→succeeded, `failed`→failed; `tradeEventId 5` (disputed) stays **pending** |
| Webhooks | `payin.completed` / `payin.failed`; `X-Transacty-Webhook-Signature` = HMAC-SHA256(raw body), constant-time compare |
| Money | settlement recorded as **USDT** in the USDT pocket; the customer's INR is never posted or summed with USDT. A success that does not state the USDT amount is **held as pending** (no grant, no posting) |
| 403 | "India market not enabled (KYB)" → `NOT_CONFIGURED`, never retried as a transient error |

## Founder prerequisites (all required before the flag may be turned on)
| # | Prerequisite | Owner | Status |
|---|---|---|---|
| F1 | Transacty account + **KYC** of the signatory | founder | NOT STARTED |
| F2 | **India market KYB approval** for Jakuraa Commercial Pvt Ltd (endpoints return 403 until then) | founder | NOT STARTED |
| F3 | **Written confirmation from Transacty that AI trading software is an accepted merchant category** | founder | NOT STARTED |
| F4 | **CA opinion on GST and FEMA** for receiving domestic INR (UPI) as USDT settlement — incl. GST on the INR invoice value, FEMA/LRS characterisation, and books treatment of the USDT pocket | founder + CA | NOT STARTED |
| F5 | Keys provisioned to a secret store (API key, request secret, webhook secret) — never in git, never in chat | founder | NOT STARTED |

## Engineering items to close once sandbox access exists (docs gaps)
| # | Gap | Current assumption |
|---|---|---|
| R1 | Sandbox base URL / test mode | none used; `https://api.transacty.ai` is the only documented host |
| R2 | Timestamp tolerance for request signatures | not documented |
| R3 | Signature **encoding** (hex vs base64) for both request and webhook signatures | hex |
| R4 | Field carrying the **settled USDT amount** on an INR pay-in (webhook + status) | `settlementAmount` + `settlementCurrency`; otherwise held pending |
| R5 | Webhook timestamp / replay protection | none documented → idempotent on `transactionId:status:usdt` |
| R6 | Mapping of `platformOrderId` to our `canonicalRef` (does create accept a merchant reference?) | `platformOrderId` read as canonicalRef if present |
| R7 | Refund / reversal API | none documented → `refund()` unsupported |

## To enable (after F1–F5 and R1–R4)
1. Register the adapter in `apps/api/src/payments/mount.mjs` behind `PAYMENT_TRANSACTY` + secrets.
2. Record sandbox fixtures and replace the constructed ones in the test.
3. Part 11 acceptance (`database/__tests__/part11_acceptance.integration.test.ts`) re-run with a Transacty event stream.
