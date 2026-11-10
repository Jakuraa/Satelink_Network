---
name: satelink-trading-ai
description: Use when building or changing Satelink's Trading AI workflow (strategy evaluation, risk decision, paper orders, broker adapters, trading copy) — the safety rules, labels and where the code lives.
---
# Satelink Trading AI (Release A)

Trading AI is ONE workflow on the shared task engine — not a trading platform. Education and simulation only.

**Code:** `apps/api/src/workflows/connectors/trading_connector.js` (evaluate + paper order on the engine),
`alpaca_paper_adapter.js` (optional, host-pinned), #609 engine `apps/api/src/trading/engine/` (walk-forward
`evaluateStrategy`, `detectLookahead`, paper broker), compiler `workflows/strategy_compiler.js`.

**Hard rules**
- Label every surface `SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS` (API objects, UI, receipts, CSV, MCP) + "not investment advice".
- Data: `createRecordedCandleSource()` — synthetic recorded dataset, labelled; never live market data in the preview.
- The model explains; `decide()` decides (pure, deterministic, rule trace L1/L2 blocking → REJECT; R1–R3 → WAIT).
- Paper orders only for a GO evaluation, re-checked at execution; fills deterministic and re-verified (canonical JSON — JSONB reorders keys).
- Brokers: InternalPaperBroker by default. Alpaca only with `ALPACA_PAPER_*` keys and only `https://paper-api.alpaca.markets`;
  `api.alpaca.markets` → `LIVE_HOST_FORBIDDEN`. No Indian broker order placement; Zerodha/IBKR adapters are never constructed here.
- Never real money, never live orders, never store live broker keys.

**Tests:** `database/__tests__/trading_s3.integration.test.ts` (look-ahead injection, costs, determinism, GO→paper, live host refusal),
`tests/e2e/s3-trading.spec.ts` (GO → paper fill → labelled receipt + CSV; WAIT → no paper action).
