# Supplier integration status

Session B1 · 2026-11-03. Machine-readable source of truth: `apps/api/config/supplier_catalog.v1.json`
(loaded into the vNext SupplierRegistry; nothing executes unless status is live/preview **and** the network is live).
Supplier emails were read from the founder's mailbox (read-only); supplier text is treated as claims until probed.
No paid call was made to any supplier. No contract was accepted. No message was sent.

## Space Command Kits (`*.restockalarm.workers.dev`, sender `spacecommand@mail.grokbot.com`)

| Item | Supplier claim (email 2026-10-30) | Verified 2026-11-03 (zero-cost probes) |
|---|---|---|
| Services | token-risk, token-verdict, bal-check | OpenAPI + `/.well-known/x402.json` + `/llms.txt` → **HTTP 200** on all three |
| Prices | risk $0.01, risk-lite $0.005, verdict $0.01, balance $0.003, balance-lite $0.002 | risk-lite 402 challenge = **5000 units USDC ($0.005)** ✔ |
| Payment | x402 v2, `exact`, USDC Base + Polygon, payTo `0x7B97…F430`, facilitator `x402.dexter.cash` | v2 `payment-required` header: `eip155:8453` + `eip155:137` USDC ✔; facilitator not shown in challenge |
| Auth timeout | 120 s | challenge says **`maxTimeoutSeconds: 300`** ✘ (mismatch) |
| Networks | Base live; Polygon/Ethereum paused, 503 before payment | `chain=polygon` → **503 "chain polygon is paused"**, `charged:false` ✔ |
| Free preview | 3 calls/day/IP | token-risk preview → **503** (their Base RPC `mainnet.base.org` returned 429 ×3 + timeout), bal-check preview → **502 rpc_failed 429**; both `charged:false` |
| Failed calls | not charged | consistent with every error body (`charged:false`) |
| SLA / rate limit / status page | none | none |
| Resale, display, caching | permitted; present as risk signal, not advice | recorded in catalog `license`; disclaimer shown in UI |

**Status: evaluation (not purchasable).** Reasons: reliability today depends on a free public Base RPC (both
previews failed), no SLA, Polygon paused, and outbound x402 spend is not authorized (no funded wallet).
**Next:** accept the offered free test keys (founder reply), run a capped 40-call test via the key (no wallet
needed), record latency/accuracy against an independent Base read; only then propose `preview` status.

**Custom-build offer (3 items, 2026-11-02 reply already sent by founder):** reasonable as a free prototype.
Before relying on it: Satelink must own the MCP server's listing, keys, customer data and wallet; require source
handover or self-hosting rights; avoid a single-supplier dependency (catalog already supports multiple offers per capability).

## FreeTier Agent API (`freetier-agent-api.pages.dev`, sender `tec@mail.grokbot.com`)

- **Same sending domain as Space Command Kits** (`mail.grokbot.com`). Treat as one operator until shown otherwise
  (concentration risk; their two offers should not be counted as independent supply).
- Offers seen: 64 routes, 80 free demo calls, hosted MCP. Terms changed between emails (10% x402 revenue / $2,250
  fixed on 2026-10-29 → "0.5% of the profit" on 2026-10-30). "Profit" is undefined.
- Founder asked for catalogue, key and terms on 2026-11-02; **no reply yet** → route discovery table not possible.
- **Not listed.** Do not accept the profit share until: definition of attributable profit and how it is measured;
  scope (only traffic through their server?); ownership of server/listing/keys/customers; exit + self-hosting rights;
  security review of a third party running Satelink's paid MCP surface.

| Route | Function | Supplier cost | Use case | Demand evidence | Effort | Decision |
|---|---|---:|---|---|---|---|
| (catalogue not received) | — | — | — | — | — | Re-assess when the 64-route list and demo key arrive |

## dRPC (Polygon RPC upstream candidate)

- dRPC (Strategy Lead) replied 2026-11-02 asking for offering/customers/model/volumes/SLA.
- **The founder's detailed answer was sent only to `team@betamarkets.app`** (a different company copied on dRPC's
  email), **not to `craci@drpc.org`**. dRPC has therefore not received Satelink's answer. → Founder: resend to dRPC.
- The "~100k requests/month, ~$25/month" planning figures in the mission brief match that third party's own request.
  Satelink's real volume is ~100k–500k **free/anonymous** req/day (CLAUDE.md, 2026-07-16; re-measure before quoting).
- Public ToS restricts proxying/resale without agreement (Step T/U). **Paid routing stays off.** Not a customer
  capability, so not in the marketplace catalog; provider switching belongs in the RPC gateway upstream list (F20).

## First-party and data offers

| Offer | Status | Evidence |
|---|---|---|
| Satelink Polygon RPC — wallet balance | preview (charge withheld) | real `eth_getBalance` per run; receipt `verification: verified` |
| Binance public klines (Strategy Lab data) | preview | public data, no commercial licence; build machine 200, Railway us-west2 451 |
| Eulerpool EOD | not_authorized | Free plan internal R&D only (F25); 502 from Railway 2026-10-31 |
