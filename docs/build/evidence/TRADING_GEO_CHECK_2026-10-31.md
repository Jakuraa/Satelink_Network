# Trading geo check — Binance Spot Demo from the Railway runtime (2026-10-31)

## Result: BLOCKED (stop condition) — Phases 4–5 not started

Probe run inside the production API container via `railway ssh --service Satelink-api`
(read-only, unauthenticated public GETs; no key used), ~15:50 IST:

| Request | Status | Latency | Body (truncated) |
|---|---|---|---|
| `GET https://demo-api.binance.com/api/v3/ping` | **451** | — | `"Service unavailable from a restricted location according to 'b. Eligibility' in https://www.binance.com/en/terms…"` |
| `GET …/api/v3/time` | **451** | 345 ms | same |
| `GET …/api/v3/ticker/price?symbol=BTCUSDT` | **451** | 125 ms | same |

Runtime: service `Satelink-api`, `RAILWAY_REPLICA_REGION=us-west2`, commit `88ef1dca8f85`,
Node v20.19.5. Control from the build machine (India): `/api/v3/ping` → 200.

Implications:
- Binance demo **and** public market data (`api.binance.com`, used by `BinanceSpotDataProvider`)
  are unavailable to the API runtime. Backtest datasets were therefore fetched from the build
  machine (`services/trading/scripts/run-evaluations.ts`).
- Eulerpool is also unreachable from us-west2 today (HTTP 502 at its edge; see
  `EULERPOOL_CONTRACT.md`), while the build machine gets the documented 401.

## Proposal (founder decision — dashboard action, not done by the agent)
Run the trading worker as a **separate Railway service** outside the US, holding only the
variables it needs:
1. Create service `trading-worker` in the same project, region **`europe-west4`
   (Amsterdam)** or **`asia-southeast1` (Singapore)**. Recommended default: `europe-west4`
   (closer to Binance's EU edge; no extra data-residency concern for public market data).
2. Move/copy only `BINANCE_DEMO_API_KEY`, `BINANCE_DEMO_API_SECRET`, `EULERPOOL_API_KEY`,
   `OPENROUTER_API_KEY`, plus a read/write `DATABASE_URL` scoped to the trading tables.
   Do **not** give it settlement, payment or admin secrets.
3. Before any Phase 4 code ships, re-run the same probe from that service: `/api/v3/ping`,
   `/api/v3/time` must return 200, and Eulerpool must return 401 for an invalid token.
4. Check Binance's eligibility terms for the account holder's own location (F13) — a
   non-restricted server region does not change who is eligible.
