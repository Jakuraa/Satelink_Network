# Swiggy production application — preparation pack (Release A, Slice S2)

**Status: BLOCKED (FOUNDER / EXTERNAL).** Satelink has **no relationship, agreement or API access with Swiggy** today.
Everything in Release A runs against a local mock ("Food Delivery (MOCK — not connected to Swiggy)"). This document is
what the founder would need to submit or decide before any real integration; it makes no claim that access exists or
will be granted. Swiggy's actual partner/MCP programme, terms and technical requirements must be verified first.

## What the preview proves (local only)
| Piece | Where | Evidence |
|---|---|---|
| MCP client driver (official SDK, Streamable HTTP, `tools/list` discovery) | `apps/api/src/workflows/connectors/mcp_client_driver.js` | `database/__tests__/food_mcp.integration.test.ts` |
| OAuth 2.1 authorization code + PKCE (S256 only), server-held verifier, single-use state, encrypted tokens, revoke | `apps/api/src/workflows/connectors/oauth_pkce.js`, migration 044 | same test (PKCE wrong-verifier / single-use / plain refused) |
| Untrusted supplier output: deterministic item selection from menu names; descriptions never read; injection test | `connectors/mcp_food_connector.js` | same test + `tests/e2e/s2-food.spec.ts` |
| User-facing consent, approval wording, receipt, revoke | console `/connections`, task pages | `tests/e2e/s2-food.spec.ts`, `artifacts/screenshots/s2/` |

## Exact redirect URIs to register (production — proposal)
- `https://api.satelink.network/v1/connections/swiggy/callback` (authorization-code redirect; HTTPS only)
- No wildcard, no `localhost` URIs in production. The preview uses `http://127.0.0.1:4500/v1/connections/food_delivery_mock/callback` against the mock only.

## Servers and flow (proposal)
1. Satelink API (`api.satelink.network`) acts as the OAuth **public client with PKCE (S256)**; the code verifier never
   leaves the server; `state` is single-use with a 10-minute expiry.
2. The user is sent to the provider's consent screen; scopes requested would be the minimum: read restaurants/menus and
   place orders. Exact scope names come from the provider's documentation (unknown today).
3. Tokens are stored encrypted (AES-256-GCM) with a key held outside the database; the user can revoke from Connections.
4. The MCP server URL would be the provider's official endpoint (allowlisted host; no user-supplied URLs — SSRF guard).
5. Ordering: Satelink quotes (merchant total + Satelink fee), the user approves, the order is placed with an idempotency
   key, verified via order status, and a receipt is issued. **The merchant is paid by the user directly at the
   provider's checkout; Satelink credits only ever pay Satelink's own fee.** Satelink never holds money for the merchant.
6. Prompt-injection posture: menu/restaurant text is untrusted data and never influences approvals, amounts or payees.

## Demo-video script (for an application, once access is real)
1. Sign up → onboarding (pay-per-use, no subscription; preview labels visible).
2. Ask: "Order 2 masala dosa and a filter coffee under ₹…" → assistant asks to connect the provider.
3. Provider consent screen (scopes listed) → back to the task automatically.
4. Plan + quote: merchant total paid by you at checkout, Satelink fee from credits, expiry timer.
5. Approval dialog → live timeline → verified order → receipt with order id.
6. Connections page: permissions listed → revoke → the assistant asks to reconnect.

## Founder actions (before any real integration)
- Confirm Swiggy offers a partner/MCP programme for third-party agents, and its terms (resale, automated ordering, data use).
- Obtain client credentials and the official scope list; register the redirect URI above.
- Legal review: consumer protection, refund/cancellation responsibility, data processing (DPDP Act) — Satelink must not
  appear as the merchant of record.
- Decide INR pricing display (an approved FX source) — preview quotes are USD only.

## Zomato
**BLOCKED (EXTERNAL).** No connector is built and none will be until Zomato's terms for automated/agent ordering are
verified. The console states this on the Connections page. No Zomato data, logo or claim appears anywhere.
