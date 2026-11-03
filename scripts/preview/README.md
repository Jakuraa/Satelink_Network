# Local customer preview — workflows beta

Navigate Satelink as a customer: Strategy Lab, Agent Marketplace, Workflows, API & MCP.
Runs, receipts and saved strategies are stored in a **local Postgres database** and survive restarts.

```bash
# prerequisites: npm install (once) and a local PostgreSQL on 127.0.0.1:5432
bash scripts/preview/beta-preview.sh
# then open:
open http://localhost:4400/preview/login      # signs you in and lands on /strategy-lab
```

What runs:
- `apps/api/scripts/preview_workflows_beta.mjs` on `127.0.0.1:4400` — only the workflows router, backed by the local
  database `satelink_beta_preview` (created on first run; migrations 040 + 041 applied once). Refuses
  `NODE_ENV=production` and any non-local database host. No schedulers, no settlement, nothing charged. The only
  production request it makes is the public `GET /v1/pricing` (shown on the API & MCP page).
- The real console (`apps/console`, `next dev -p 3400`) with `WORKFLOWS_BETA_ENABLED=true`.

What is real: Binance public daily klines (backtests), a public Polygon RPC (wallet balance — override with
`WORKFLOWS_POLYGON_RPC_URL`), supplier statuses from `apps/api/config/supplier_catalog.v1.json`, the RoutingKernel,
its hash-chained journal and idempotency, Postgres persistence and restart recovery. External suppliers are never paid.

Not in the preview: billing, keys and usage pages show their designed empty/error states (the preview API serves only
the workflows routes). Use `http://localhost:3400`, not `127.0.0.1` (the console's CSRF check allows that origin).

Try:
1. Strategy Lab → "Buy bitcoin when the 20-day moving average crosses above the 50-day" → Build → Run backtest → Saved strategy → Run backtest again.
2. Strategy Lab → "A trend-following strategy for crypto" → answer the questions.
3. Marketplace → Wallet balance check → polygon + any 0x address → Compare suppliers & quote → Create capped purchase → Approve & run → receipt.
4. Marketplace → Token risk signal → base → quote (blocked: suppliers under evaluation).
5. API & MCP → live RPC price, REST endpoints, MCP tools and client config.
6. Stop the preview (Ctrl-C), start it again → Workflows still lists every run with its receipt and trace.

Browser E2E against the running preview:
```bash
cd apps/console
WORKFLOWS_E2E=1 PW_BASE_URL=http://localhost:3400 npx playwright test e2e/workflows-beta.spec.ts
# restart the preview, then:
WORKFLOWS_E2E=1 E2E_PHASE=after-restart PW_BASE_URL=http://localhost:3400 npx playwright test e2e/workflows-beta.spec.ts
```

Reset the preview data: `dropdb -h 127.0.0.1 satelink_beta_preview` (local only).
