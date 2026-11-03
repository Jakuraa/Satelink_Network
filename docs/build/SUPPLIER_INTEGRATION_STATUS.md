# Supplier integration status

Updated Session B2 · 2026-11-03. Machine-readable source of truth: `apps/api/config/supplier_catalog.v1.json`
(loaded into the workflow kernel's SupplierRegistry; nothing executes unless status is live/preview **and** the
network is live). Supplier text is a claim until probed. **No paid call was made to any supplier, no contract
accepted, no message sent.** One draft email was prepared (dRPC, below) and left unsent.

## Summary

| Supplier | Capabilities | Status | Evidence (2026-11-03) | Next step |
|---|---|---|---|---|
| Satelink Polygon RPC (first-party) | wallet.balance (Polygon) | **preview** — executes, charge withheld | real `eth_getBalance` per run, verified result + receipt | founder price approval |
| Binance public klines | Strategy Lab data | **preview** (non-commercial) | 200 from build machine; Railway `us-west2` → 451 | licensed source (see data section) |
| Space Command Kits | token.risk, token.verdict, wallet.balance | **evaluation** (not purchasable) | manifests 200; 402 v2 correct; Polygon 503 paused; free previews failed 4/4 (their upstream) | free test keys (F27) → capped test |
| FreeTier Agent API | wallet-profile, token-risk (2 of 83 paths) | **evaluation** (not purchasable) | 2 free calls 200; balance matched on-chain | demo key; terms; do **not** accept 0.5% |
| dRPC | Polygon RPC upstream | **not authorized** | ToS restricts resale; reply misaddressed on 2 Nov | send prepared draft (F26) |
| Eulerpool | EOD data | **not authorized** | Free plan = internal R&D only | Builder plan decision (F25) |

## Space Command Kits (`*.restockalarm.workers.dev`)

| Item | Supplier claim (email 2026-10-30) | Verified |
|---|---|---|
| Services & prices | risk $0.01, risk-lite $0.005, verdict $0.01, balance $0.003, balance-lite $0.002 | risk-lite 402 = 5000 units USDC ✔ |
| Payment | x402 v2 `exact`, USDC Base + Polygon, payTo `0x7B97…F430`, facilitator `x402.dexter.cash` | v2 challenge lists `eip155:8453` + `eip155:137` ✔ |
| Payment timeout | 120 s | challenge says **`maxTimeoutSeconds: 300`** ✘ — ask which is binding |
| Networks | Base live; Polygon/Ethereum paused, 503 before payment | `chain=polygon` → 503 "paused", `charged:false` ✔ |
| Free preview | 3 calls/day/IP | token-risk **503 ×2**, bal-check **502 ×2** (all `charged:false`) |
| SLA / rate limit / status page | none | none |

**Diagnosis of the failed previews (not a Satelink defect):** their workers call the free public Base RPC
`mainnet.base.org`, which returned **429 on 5/5 attempts** from their Cloudflare egress. The same endpoint returned
**200 ×3 in ~0.29 s** from Satelink's network at the same time — i.e. the public RPC is rate-limiting the shared
Cloudflare egress. Their own email said they are "moving all data to our own on-chain reads". Until a keyed/own
Base RPC is in place, availability depends on a free endpoint they do not control. **Keep optional, Base first,
Polygon/Ethereum unavailable until they confirm restoration and a test passes.**

## FreeTier Agent API (`freetier-agent-api.pages.dev`)

- Same sending domain as Space Command Kits (`mail.grokbot.com`) and overlapping products (both sell token risk):
  treat as one operator (concentration risk; not independent supply).
- **Public catalogue, inspected read-only (claims):** OpenAPI 83 paths / 85 operations; MCP `tools/list` returns
  **74 tools** (the email said 64 routes). "1 free call per route per caller". Unpaid → 402 (x402 v2/v1).
- **Verified with two free calls (no payment):** `wallet-profile` (Base) → 200 in 1.4 s, and its USDC balance
  (0.502) **matched an independent on-chain `balanceOf`**; `token-risk` (Base, AERO) → 200 in 2.6 s with pool data.
- Demo key / 80 calls: requested 2026-11-02, **not received**. The 0.5% "profit" share is undefined → **not accepted**.

| Route (public claim) | Function | Supplier cost | Use case | Demand evidence | Effort | Decision |
|---|---|---:|---|---|---|---|
| /api/wallet-profile | address → type, ETH + major token balances (Base, Ethereum) | $0.005 | pre-trade wallet check | none yet | catalog entry only | **evaluation** (listed) |
| /api/token-risk | ERC-20 risk check (Base, Ethereum) | $0.005 | token screening before a trade | none yet | catalog entry only | **evaluation** (listed) |
| /api/token-score, /api/rug-check, /api/token-compare | AI verdict / rug check / comparison | $0.005–$0.0075 | same as token-risk | none | low | defer (duplicates token-risk) |
| /api/tx-explain, /api/tx-status, /api/contract-abi, /api/ens, /api/token-info, /api/gas | on-chain utilities | $0.0015–$0.0025 | agent tooling | none | low | defer |
| /api/token-price, /api/token-price-history | DEX prices / OHLCV ≤180 days | $0.0025–$0.005 | not suitable for walk-forward (needs years) | — | — | reject for Strategy Lab |
| /api/site-contacts, /api/company-contacts, /api/email-verify* | scraped contact data | $0.003–$0.01 | — | — | — | **reject** (personal-data / compliance risk) |
| remaining ~60 (web, docs, geo, datasets, packs) | general utilities | various | not aligned with the product | — | — | not listed |

**Custom MCP offer:** do not accept a revenue/profit share where Satelink cannot audit "profit", and do not let a
third party host Satelink's paid MCP surface. Satelink now has its own MCP workflow tools (PR #609, unpublished).

## dRPC

- dRPC's 2 Nov questions were answered to a different company copied on the thread, not to dRPC (detail in
  `evidence/private/`). **Corrected draft saved in the founder's Gmail (not sent)**, addressed to dRPC: honest
  offering description (live traffic, no material paid RPC revenue yet), resale/aggregation model, ~100k req/month
  pilot assumption, and requests for PAYG vs subscription pricing per compute unit, **written resale authorization**,
  rate limits/SLA and onboarding. States that paid traffic will not be routed until authorization is in writing.
- Paid routing to dRPC: **off**.

## Market data for Strategy Lab (Binance 451 is not bypassed)

Strategy Lab publishes **derived** results (returns, drawdowns, verdicts), not raw price feeds — the licence needed is
commercial **use/display of derived analytics**, not redistribution. Vendor statements below are from public pages
and must be confirmed in writing before any charge.

| Source | Commercial terms (public, unverified until written) | History | Fit | Next step |
|---|---|---|---|---|
| CoinGecko API (paid tiers) | paid tiers include a commercial licence; display with attribution; redistribution/resale only on Enterprise | daily OHLC back to 2013 (per vendor guide) | **best first candidate** (cheap; derived display) | confirm in writing that derived backtest metrics on a paid tier are permitted |
| Coinbase Exchange public market data | governed by Market Data Terms of Use (not retrieved); redistribution via partners | candles via public API | possible | read the terms; ask institutional team |
| Kaiko / CoinAPI / CoinDesk Data (CCData) | enterprise licences; Kaiko reported ≥ ~$1,000/mo (secondary source) | deep tick/OHLCV | over-sized for beta | revisit after demand |
| Eulerpool | Free plan internal R&D only; Builder ~$990/yr | equities/EOD | non-crypto | F25 |
| Binance public klines | no commercial data licence; geo-blocked from Railway us-west2 | 2017+ | internal R&D / preview only | keep, never charge on it |

Sources: [CoinGecko API plans](https://www.coingecko.com/en/api/pricing), [CoinGecko data license](https://www.coingecko.com/en/api/enterprise/data-license),
[CoinGecko historical-data guide](https://www.coingecko.com/learn/best-historical-crypto-data-apis), [Coinbase Exchange docs](https://docs.cdp.coinbase.com/exchange/docs/overview),
[Coinbase institutional market data](https://www.coinbase.com/institutional/market-data), [Kaiko OHLCV on Datarade](https://www.datarade.ai/data-products/kaiko-trade-aggregates-historical-open-high-low-close-volume-ohlcv-candlesticks-kaiko).

## Infrastructure region (verified 2026-11-03)

`satelink-reconciler` is in **europe-west4** (deployed 2026-11-03 00:40 UTC). **Satelink-api, Postgres-iQeW and Redis
are still `us-west2`.** The reported "move to Europe" changed only the reconciler. Moving the API alone would put
every DB query across the Atlantic; the safer option remains a separate EU `trading-worker` for market data (F22),
or a licensed data vendor (no geo issue). Do not bypass exchange geo-restrictions.
