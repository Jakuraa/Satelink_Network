# Local customer preview — workflows beta

Navigate Satelink as a customer: Strategy Lab, Agent Marketplace, Workflows.

```bash
# from the repo root (needs npm install done once)
bash scripts/preview/beta-preview.sh
# then open:
open http://localhost:4400/preview/login      # signs you in and lands on /strategy-lab
```

What runs:
- `apps/api/scripts/preview_workflows_beta.mjs` on `127.0.0.1:4400` — **only** the workflows router, in-memory
  kernel store. No database, no Redis, no schedulers, no settlement. Refuses `NODE_ENV=production`.
- The real console (`apps/console`, `next dev -p 3400`) pointed at it, with `WORKFLOWS_BETA_ENABLED=true`.

What is real: Binance public daily klines (backtests), a public Polygon RPC (wallet balance —
override with `WORKFLOWS_POLYGON_RPC_URL`), supplier statuses from `apps/api/config/supplier_catalog.v1.json`,
the vNext RoutingKernel, journal and idempotency. Nothing is charged; external suppliers are never paid.

What is not: pages outside the beta (billing, keys, usage) show their designed empty/error states because the
preview API serves only the workflows routes. Runs disappear when the preview stops. Use `http://localhost:3400`
(not `127.0.0.1`) — the console's CSRF check allows that origin.

Try:
1. Strategy Lab → "Buy bitcoin when the 20-day moving average crosses above the 50-day" → Build → Run backtest.
2. Strategy Lab → "A trend-following strategy for crypto" → answer the questions.
3. Marketplace → Wallet balance check → polygon + any 0x address → quote → Create capped purchase → Approve.
4. Marketplace → Token risk signal → base → quote (blocked: supplier under evaluation).
5. Workflows → open a run → step graph, receipt, hash-chained trace.
