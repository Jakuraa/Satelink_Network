# Satelink Trading AI — canonical architecture map

Verified 2026-10-07 against `trading-agent/integration` @ `443ad62f` (read-only: `git grep`, file reads, test counts).
> **Re-run 2026-10-11 after Phase 6 (items 1–14): see §5b.** Sections 2–5 below are the 2026-10-07 baseline, kept unchanged as the "before" picture.

Status vocabulary: **EXISTS** (code + tests present) · **PARTIAL** (some of it exists, or it exists but nothing runs it) · **MISSING** · **WRONG** (contradicts the locked definition) · **DUPLICATE**.

> Everything that EXISTS is **unwired**: `mountTradingRoutes` is never called from `apps/api/app_factory.mjs` or `apps/api/server.js` (0 matches for `trading_agent`), and this is enforced by `apps/api/test/trading_blocker_register.test.js` while B-03, B-06 or B-10 is unresolved. Nothing in production code schedules a trading job.

## 1. Locked definition (summary)

AI reasoning (orchestration) → specialized agents (workers) → deterministic engines (compute + verify) → scorecard (GO/WAIT/REJECT) → risk (safety) → portfolio (capital context) → authorization/mandates (control) → OMS (execution control) → broker → automation bots → memory + feedback (learning) → API/MCP (machine interface) → metering (commercial). One core, three clients: humans (web/chat), external AI agents (API/MCP), machines/bots (API/MCP).

Execution chain (nothing bypasses it):
`AI proposal → Strategy DSL → validation → deterministic strategy engine → scorecard + hard gates → risk engine → portfolio check → authorization (mandate) → OMS → broker adapter → broker → reconciliation → P&L → memory/feedback`.

## 2. Subsystem map

All paths are under `apps/api/src/trading_agent/` unless shown otherwise. Test counts are `it(` occurrences.

| # | Subsystem | Status | Code | Tests | Gap |
|---|---|---|---|---|---|
| 1 | Strategy DSL + evaluator (Stage 13) | **EXISTS** | `strategies/dsl.mjs` (`parseStrategyDsl`, `hashDefinition`), `dsl_schema_v1.mjs`, `compiler.mjs` (`compileStrategy`), `indicators.mjs` (sma, ema, rsi, atr, highest, lowest), `lifecycle.mjs`, `service.mjs` (`StrategyService`) | `trading_strategy_dsl.test.js` 31; integration 3 | no VWAP; indicators only reachable through the DSL |
| 2 | Backtest + paper (Stage 14) | **EXISTS** — one shared simulator | `backtest/engine.mjs:37` `SimulationEngine` with `SimMode {BACKTEST, PAPER}` (:29); `backtest/run.mjs:19`, `paper/runner.mjs:15,43`; `fill_model.mjs`, `result.mjs` (`sealResult`, `parityView`), `job.mjs` | `trading_backtest_paper.test.js` 24; integration 4 | nothing schedules paper runs; no walk-forward / stress |
| 3 | Risk engine (Stage 15) | **EXISTS** | `risk/checks.mjs:268-287` — **20 checks**: kill_switch, circuit_breakers, trading_flags, order_schema, idempotency, broker_account, mandate, strategy_state, instrument_allowed, market_hours, market_data, price_collar, quantity_filters, min_notional, max_order_notional, daily_notional, daily_loss, position_limits, leverage, order_rate. `kill_switch.mjs:10` — 7 scopes (global, principal, broker_account, mandate, strategy, venue, instrument); `policy.mjs` `HARD_CAPS` | `trading_risk_engine.test.js` 19; integration 4 | Mode B path not yet a reviewed risk-engine change |
| 4 | Mandates (Stage 16) | **EXISTS** in `authorization/`; `mandates/` is a **DUPLICATE** stub | `authorization/terms.mjs:20` `MandateMode {A,B,C}`; `signing.mjs` (`signMandate`, `verifyMandateSignature`); `step_up.mjs` (Better Auth TOTP); `service.mjs:27` `MandateService` (propose/sign/revoke/emergencyShutdown/expireDue/verifyForOrder) | `trading_mandates.test.js` 17; integration 5 | Mode A usable; Mode B terms validated (`terms.mjs:80`) but **no executor**; Mode C refused while `AUTONOMOUS_MODE` locked |
| 5 | OMS + reconciler (Stage 17) | **PARTIAL** (library complete, unscheduled) | `oms/states.mjs:12` — NEW, SENT, ACK, PARTIAL, FILLED, CANCELLED, REJECTED, UNKNOWN, CANCEL_REQUESTED; `acceptance.mjs`, `dispatcher.mjs:44` `runOnce`, `reconciler.mjs:27` `runOnce`, `transitions.mjs`, `store.mjs` | `trading_oms.test.js` 29; integration 6 | no worker calls dispatcher / reconciler `runOnce` |
| 6 | Portfolio / P&L (Stage 18) | **PARTIAL** (library, unscheduled) | `portfolio/ingest.mjs:18` `FillConsumer`, `pnl.mjs`, `snapshots.mjs`, `reconcile.mjs:46`, `service.mjs` | `trading_portfolio.test.js` 14; integration 3 | no fill consumer / snapshotter schedule; no portfolio-fit |
| 7 | Audit trail / "why" receipt (Stage 19) | **EXISTS** | `audit/receipt.mjs:22` `TradeReceiptAssembler`; `trace_context.mjs` (W3C), `traced_pool.mjs`, `source.mjs`; migration 029 append-only | `trading_audit.test.js` 13; integration 3 | receipt route unmounted |
| 8 | Agent tool layer (Stage 12) | **PARTIAL** | `agent/tools.mjs` — 13 tools: READ ×9 (get_quote, get_candles, get_intelligence, list_positions, list_orders, get_risk_policy, get_mandate, get_strategy, get_account_summary), CONTROLLED ×4 (propose_order, propose_cancel, propose_alert, record_note). `tool_registry.mjs:23` `FORBIDDEN_TOOL_PATTERNS` blocks place/submit/cancel order, execute, withdraw/transfer, credentials, set_risk, shell/sql. `runtime.mjs` `AgentRunner`, `router.mjs` `ModelRouter`, `trace.mjs` | `trading_agent_tools.test.js` 27; integration 3 | **no placeOrder / withdraw tool (confirmed)**; proposals go to `ctx.proposals.create` but **no proposals table/store exists** |
| 9 | Broker adapters (Stages 10, 21–23) | **EXISTS** (testnet / sandbox / copilot only) | `brokers/adapter.mjs`, `mock_broker.mjs`; `binance/` (signing, rest_client, exchange_info, key_validation, rebates); `upstox/` (oauth, token_vault, copilot, placement, kill_switch, portfolio_stream, static_ip); `alpaca/` (rest_client, sse, sim_book, commission) | binance 25+1, upstox 30+1, alpaca 14+1, normalization 22, mock 17 | production refused while `LIVE_TRADING` locked; Upstox copilot only |
| 10 | REST + MCP API (Stage 24) | **PARTIAL** (unmounted; 501s) | `api/router.mjs:16-25` `ROUTES`; `api/ports.mjs` → **501** for `GET /orders` (:59) and `GET /proposals`, `POST …/approve`, `POST …/reject` (:85-87); `api/mcp.mjs` tools/list + tools/call, READ + CONTROLLED only | `trading_api.test.js` 23 | not registered (B-03/B-06/B-10); no `evaluate_opportunity` |
| 11 | Console agent-first IA (Stage 25) | **EXISTS** (flag `CONSOLE_AGENT_IA`, off ⇒ 404) | `apps/console/src/app/(console)/trading/` — 12 pages (home, agent, activity, brokers, executions, orders, orders/[orderId], pnl, positions, revenue, risk, strategies); `apps/console/src/lib/trading/guard.ts` | console E2E harness | backend unmounted ⇒ "not available" states |
| 12 | Website pages (Stage 26) | **EXISTS** (flag `SITE_TRADING_AGENT`, off ⇒ 404) | `apps/web/src/app/(marketing)/trading-agent/` — 11 pages; `apps/web/src/lib/trading-agent/flag.ts`; claims lint `apps/web/scripts/claims-lint.mjs` | claims-lint test | not public (Phase 7) |
| 13 | Subscriptions — Razorpay test (Stage 27) | **EXISTS** (test mode, unmounted) | `billing/razorpay.mjs`, `plans.mjs`, `lifecycle.mjs`, `invoices.mjs`, `proration.mjs`, `service.mjs`, `router.mjs`; migration 030 | `trading_billing.test.js` 26+1; integration 5 | `SUBSCRIPTIONS` off; live refused |
| 14 | Observability (Stage 29) | **PARTIAL** | `observability/tracer.mjs` (OTLP JSON), `metrics.mjs`, `instrument.mjs`, `alerts.mjs` (9 rules), `dashboards.mjs` | `trading_observability.test.js` 14 | no exporter / scrape endpoint wired; no backend |
| 15 | Market data engine (Stage 11 + `intelligence/`) | **PARTIAL** + **DUPLICATE** | trading: `market_data/` (`MarketDataProvider`, `BinancePublicDataProvider`, cache, staleness, entitlements mig 022). Separate live stack: `apps/api/src/intelligence/{connectors,compute,engine}.js` (funding, OI, liquidation clusters, microstructure) | `trading_market_data.test.js` 26; integration 3 | two market-data stacks; no candle store |
| 16 | Trading Intelligence as a product | **WRONG** | mounted publicly and billed: `apps/api/app_factory.mjs:33-34,419` (`/v1/intelligence`), console `(console)/trading-intelligence/`, billing PR #429 | — | locked definition: TI is an **internal engine**, never a standalone product. Repositioning in Phase 7; unmounting needs a founder decision (live customers/billing) |
| 17 | Stub modules | **DUPLICATE / PARTIAL** | `credentials/`, `execution/`, `mandates/`, `orders/`, `outbox/`, `positions/`, `signals/` contain constants only (`STATUS = 'skeleton'`) | — | `mandates/` duplicates `authorization/`; others are placeholders |

### Known-MISSING items (each confirmed by search)

| Item | Status | Evidence (search → result) |
|---|---|---|
| AI orchestrator + specialized agents | **MISSING** | `orchestrator` → 0 trading hits; only one generic `AgentRunner` (`agent/runtime.mjs`) |
| Model router with Anthropic provider | **PARTIAL** | `AIProvider` `agent/provider.mjs:16`, `GroqProvider` `agent/providers/groq.mjs:14`, `ModelRouter` `agent/router.mjs:9`, `model_traces` table `023_agent_traces.sql:40`. **No Anthropic provider**; no deterministic/fast/standard/deep tiers; no per-call cost aggregation |
| Feature / indicator engine | **PARTIAL** | indicators only in `strategies/indicators.mjs`; `vwap` → 0 hits |
| Regime engine | **MISSING** | `regime` → 0 hits |
| Liquidity / spread engine | **MISSING** | 0 hits (nearest: risk `price_collar`, `intelligence/compute.js` `marketMicrostructure`) |
| Data-confidence engine | **MISSING** | 0 hits (nearest: `market_data/staleness.mjs`) |
| Walk-forward | **MISSING** | `walk.?forward` → 0 hits |
| Stress / Monte Carlo | **MISSING** | only unrelated infra stress testers |
| Scorecard + hard gates + GO/WAIT/REJECT | **MISSING** | `scorecard`, `hard.?gate` → 0 trading hits |
| Portfolio-fit / correlation | **MISSING** | 0 trading hits |
| Trading memory + feedback / calibration | **MISSING** | 0 hits |
| Automation bot runner | **MISSING** | `workers/` holds only `reconciler/` (non-trading); dispatcher/reconciler/fill-consumer/strategy runner only instantiated in tests |
| Machine API `evaluate_opportunity` + agent budgets + metering | **MISSING** | `evaluate_opportunity` → 0; metering exists only for non-trading APIs (`pricing_v2/metering.mjs`) |
| Mode B execution for agent/machine proposals | **MISSING** | terms only (`authorization/terms.mjs:80`); `execution/` is a stub |
| Proposal review queue + order list | **MISSING** | both return 501 (`api/ports.mjs:59,85-87`); no proposals table |
| Shadow revenue engine (Stage 20) | **MISSING** | no stage doc, `shadow.?revenue` → 0 hits |
| Security hardening (Stage 28) | **PARTIAL** | step-up exists (`authorization/step_up.mjs`), Binance key validation exists; **no** envelope-encryption provider / KMS (schema column `kms_key_ref` only, `021…sql:17,53`), no decrypt DB role, no egress config, no daily key re-check job, no CI secret/licence scans for trading |
| Execution service with static non-US egress | **MISSING** | only `upstox/static_ip.mjs` (reads the user's IPs) |

### Tally

| EXISTS | PARTIAL | MISSING | WRONG | DUPLICATE |
|---|---|---|---|---|
| 9 | 10 | 15 | 1 | 2 |

(EXISTS: 1, 2, 3, 4, 7, 9, 11, 12, 13. PARTIAL: 5, 6, 8, 10, 14, 15, model router, indicator engine, security hardening, stub modules. MISSING: the 15 MISSING rows above. WRONG: TI as a product. DUPLICATE: `mandates/` stub, two market-data stacks.)

## 3. Flags and migrations

Flags (`flags.mjs`, env `TRADING_FLAG_<NAME>`, enabled only by exact `'true'`): TRADING_AGENT, BINANCE, UPSTOX_COPILOT, UPSTOX_AUTOMATED, ALPACA, LIVE_TRADING, LIVE_SMALL, BYOK, MCP_TRADING, AUTONOMOUS_MODE, REVENUE_ENGINE, SUBSCRIPTIONS. **Locked in code:** LIVE_TRADING, AUTONOMOUS_MODE, UPSTOX_AUTOMATED. UI flags: `CONSOLE_AGENT_IA`, `SITE_TRADING_AGENT`.

Trading migrations (`database/migrations/`): 021 foundation, 022 market-data entitlements, 023 agent traces (`agent_runs`, `tool_calls`, `model_traces`), 024 backtests, 025 risk engine (`kill_switch_events`), 026 mandates, 027 OMS, 028 portfolio, 029 audit trail (append-only), 030 billing. **No proposals table.**

## 4. Dependency graph

```mermaid
flowchart TD
  subgraph Clients
    H[Human — web / console chat]
    A[External AI agent — API / MCP]
    M[Machine / bot — API / MCP]
  end
  H & A & M --> IF[API + MCP interface<br/>Stage 24 · PARTIAL]
  IF --> MET[Metering + agent budgets<br/>MISSING]
  IF --> ORC[AI orchestrator<br/>MISSING]
  ORC --> AG[Specialized agents<br/>MISSING]
  AG --> TOOLS[Agent tool layer — read + propose<br/>Stage 12 · PARTIAL]
  ORC --> MR[Model router + providers<br/>PARTIAL — Groq only]
  TOOLS --> MD[Market data<br/>Stage 11 · PARTIAL]
  AG --> DSL[Strategy DSL + validation<br/>Stage 13 · EXISTS]
  DSL --> ENG[Deterministic engines<br/>features / regime / liquidity / data-confidence · MISSING]
  DSL --> SIM[Simulator: backtest + paper<br/>Stage 14 · EXISTS]
  SIM --> VAL[Walk-forward + stress<br/>MISSING]
  ENG & VAL --> SC[Scorecard + hard gates → GO/WAIT/REJECT<br/>MISSING]
  PF[Portfolio / P&L<br/>Stage 18 · PARTIAL] --> FIT[Portfolio-fit + correlation<br/>MISSING]
  FIT --> SC
  SC --> RISK[Risk engine — 20 checks, kill switches<br/>Stage 15 · EXISTS]
  RISK --> AUTH[Mandates A/B/C — TOTP-signed<br/>Stage 16 · EXISTS (B/C no executor)]
  AUTH --> OMS[OMS + reconciler<br/>Stage 17 · PARTIAL]
  OMS --> BRK[Broker adapters<br/>Stages 21–23 · EXISTS (testnet)]
  BRK --> VEN[(Broker / venue)]
  VEN --> OMS
  OMS --> PF
  PF --> MEM[Trading memory + feedback<br/>MISSING]
  MEM -. calibration proposal, human-approved .-> SC
  OMS & RISK & AUTH --> AUD[Audit trail / why-receipt<br/>Stage 19 · EXISTS]
  BOT[Automation bot runner<br/>MISSING] -. schedules .-> OMS & PF & MD
  OMS --> REV[Shadow revenue engine<br/>Stage 20 · MISSING]
  MET --> REV
  OBS[Observability<br/>Stage 29 · PARTIAL] -. traces/metrics .-> OMS
```

## 5. Architecture test — 27 questions

> The founder's original 27-question list is **not in the repository**. These 27 were reconstructed one-to-one from the locked definition (section 0 of the 2026-10-07 order). Replace them if the original differs. Answers: YES / PARTIAL / NO, at `443ad62f`.

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Is there one AI orchestration backbone that routes tasks to agents? | **NO** | no orchestrator (0 hits); single `AgentRunner` |
| 2 | Do specialized agents (market, regime, strategy, risk-explainer, portfolio, review) exist? | **NO** | none |
| 3 | Do agents use only read/propose tools — never `placeOrder`, never withdraw? | **YES** | `agent/tools.mjs` 13 tools; `tool_registry.mjs:23` forbidden patterns; `trading_agent_tools.test.js` |
| 4 | Are deterministic engines (features, regime, liquidity, data-confidence) separate pure functions? | **PARTIAL** | indicators in `strategies/indicators.mjs`; the other three missing |
| 5 | Is there a strategy DSL with validation and a deterministic evaluator? | **YES** | `strategies/dsl.mjs`, `compiler.mjs`; 31 tests |
| 6 | Do backtest, paper and live share one engine? | **PARTIAL** | backtest + paper share `SimulationEngine` (`backtest/engine.mjs:37`); live path goes through OMS, not the simulator's signal logic |
| 7 | Are walk-forward and stress/Monte Carlo validation available? | **NO** | 0 hits |
| 8 | Does a scorecard produce GO / WAIT / REJECT with a separate confidence? | **NO** | 0 hits |
| 9 | Does a failed hard gate always override a high score? | **NO** | no scorecard to enforce it (risk checks are fail-closed on their own) |
| 10 | Is there a deterministic risk engine with hard caps and kill switches? | **YES** | 20 checks `risk/checks.mjs:268-287`; 7 kill-switch scopes |
| 11 | Is portfolio context (exposure, concentration, correlation) checked before execution? | **PARTIAL** | P&L/positions exist; no portfolio-fit/correlation |
| 12 | Are mandates human-signed (TOTP) before any order? | **YES** | `authorization/signing.mjs`, `step_up.mjs`, `MandateService.verifyForOrder`; risk check `mandate` |
| 13 | Can agent/machine proposals execute under a mandate without per-order clicks (Mode B)? | **NO** | terms only; no executor; `MANDATE_MODE_B` flag absent |
| 14 | Does the OMS control execution with an explicit state machine and reconciliation? | **PARTIAL** | 9 states + reconciler exist; nothing schedules them |
| 15 | Is every broker reached only through an adapter? | **YES** | `brokers/adapter.mjs`; Binance/Upstox/Alpaca adapters |
| 16 | Do automation bots run the operational loops (dispatcher, reconciler, fills, kill-switch watcher)? | **NO** | no bot runner; only tests instantiate them |
| 17 | Is there trading memory (strategy, decision, trade, error) with feedback/calibration? | **NO** | no tables, 0 hits |
| 18 | Can a strategy change itself while live? | **NO (correct)** | `strategy_versions` is append-only (021 revokes UPDATE/DELETE; 029 trigger) and integrity-checked on read (`strategies/service.mjs:73`); a change is a new version that restarts at DRAFT (`service.mjs:59-63`). No explicit "no silent live mutation" test yet (Phase 6 item 9) |
| 19 | Is there a machine API (`evaluate_opportunity`, proposals, receipts)? | **PARTIAL** | REST/MCP routes exist but unmounted; no `evaluate_opportunity` |
| 20 | Do agent/machine principals have scopes, budgets and rate limits? | **NO** | no agent budgets |
| 21 | Is usage metered into a revenue engine? | **NO** | Stage 20 missing |
| 22 | Do all three clients (human, AI agent, machine) use the same core? | **PARTIAL** | console + API/MCP call the same `trading_agent` services, but no machine interface or orchestrator yet |
| 23 | Does the LLM never see broker credentials? | **YES** | `agent/redaction.mjs`; no credential tool; `FORBIDDEN_TOOL_PATTERNS` |
| 24 | Can the LLM never change risk limits, mandates, billing, ledger or revenue rules? | **YES** | no write tools for these; `set_risk` forbidden |
| 25 | Is every decision explainable with an audit "why" receipt? | **PARTIAL** | `TradeReceiptAssembler` exists; no scorecard decision to include |
| 26 | Is live money locked behind flags + REAL MONEY GATE 1? | **YES** | `LOCKED_TRADING_FLAGS`; `docs/trading-agent/gates/real-money-gate-1.md` CLOSED |
| 27 | Is Trading Intelligence internal-only (never a standalone product)? | **NO** | `/v1/intelligence` mounted and billed (`app_factory.mjs:419`) — **WRONG** |

Score: YES 8 · PARTIAL 7 · NO 11 · plus Q18 = NO, the desired answer.

## 5b. Architecture test — re-run after Phase 6 (2026-10-11)

Same 27 questions, against `trading-agent/integration` + `trading-agent/full-loop-e2e` (item 14). The proof for the chain is `database/__tests__/trading-full-loop.integration.test.ts`: on real Postgres (migrations 001–037), three legs (human assistant, machine API key, Mode B executor) each run intent → orchestrator + agents → engines → scorecard → proposal → (human step-up approval | Mode B rule) → risk (20 checks) → mandate → OMS → paper venue → fills → portfolio → memory → post-trade review. Each leg runs under **one trace id**, asserted across 13 tables. Everything is still **unmounted** and flag-gated OFF; nothing here is live.

| # | Question | Before | Now | Evidence |
|---|---|---|---|---|
| 1 | One AI orchestration backbone routing tasks to agents? | NO | **YES** | `orchestrator/` `Orchestrator.run` (stage 41); `trading_orchestrator.test.js`; full-loop legs A–C |
| 2 | Specialized agents exist? | NO | **YES** | `orchestrator/agents.mjs`: Market, Regime-interpreter, Risk-explainer, Portfolio, Review (stage 41); a failing agent never changes the deterministic decision |
| 3 | Agents use only read/propose tools? | YES | **YES** | unchanged; `FORBIDDEN_TOOL_PATTERNS`; machine/MCP tools add only `evaluate_opportunity`, `propose_strategy`, `get_receipt` (stage 44) |
| 4 | Deterministic engines are separate pure functions? | PARTIAL | **YES** | `engines/` features (incl. VWAP), regime, liquidity, data-confidence (stage 37); `trading_engines.test.js` |
| 5 | Strategy DSL + validation + deterministic evaluator? | YES | **YES** | unchanged |
| 6 | Backtest, paper and live share one engine? | PARTIAL | **PARTIAL** | backtest + paper share `SimulationEngine`; live goes signal → proposal → OMS, not the simulator. No live venue exists to compare against (LIVE_TRADING locked) |
| 7 | Walk-forward and stress/Monte Carlo? | NO | **YES** | `validation/` (stage 38); `trading_validation.test.js` |
| 8 | Scorecard → GO/WAIT/REJECT with a separate confidence? | NO | **YES** | `decision/` + migration 033 (stage 39); `trading_scorecard.test.js` |
| 9 | A failed hard gate always overrides a high score? | NO | **YES** | `decision/gates.mjs`; DB CHECK `decision <> 'REJECT' OR cardinality(failed_gates) > 0` and the converse (033); mutation-tested (stage 39) |
| 10 | Deterministic risk engine with hard caps + kill switches? | YES | **YES** | 20 checks, now `risk-checks/1.1` (Mode B rule inside check 7) |
| 11 | Portfolio context (exposure, concentration, correlation) checked before execution? | PARTIAL | **YES** | `portfolio/fit.mjs` + concentration hard gate (stage 40) |
| 12 | Mandates human-signed (TOTP) before any order? | YES | **YES** | unchanged; full-loop signs both mandates with step-up (replay of a used code refused) |
| 13 | Agent/machine proposals execute under a mandate without per-order clicks (Mode B)? | NO | **YES — paper, flag OFF** | stage 45 + item 14: `mode_b_executor` bot (flag `MANDATE_MODE_B`, default OFF, kill switch honoured) → `ProposalService.executeModeB` → risk Mode B rule (Mode B mandate, EXECUTE key bound to it, current GO for the same instrument/side, bound strategy version, LIVE_SMALL caps). Full-loop leg C: flag off → `skipped_flag`; on → filled paper order |
| 14 | OMS with explicit state machine + reconciliation? | PARTIAL | **YES (library + bots)** | dispatcher / reconciler / fill consumer are scheduled by `workers/trading-bots` (stage 43); worker not deployed |
| 15 | Every broker reached only through an adapter? | YES | **YES** | unchanged |
| 16 | Automation bots run the operational loops? | NO | **YES — not deployed** | `bots/registry.mjs` 10 scheduled + 2 event bots; separate worker; acting bots flag- and kill-switch-gated |
| 17 | Trading memory with feedback/calibration? | NO | **YES** | `memory/` + migration 034 (stage 42); calibration produces a NEW pending config version, never edits the live one |
| 18 | Can a strategy change itself while live? | NO (correct) | **NO (correct), now tested** | `trading_memory.test.js`: a revision proposal is a new DRAFT version; the live version is unchanged |
| 19 | Machine API (`evaluate_opportunity`, proposals, receipts)? | PARTIAL | **YES — unmounted** | `access/interface.mjs` + REST `/agent/*` + MCP tools (stage 44); full-loop leg B |
| 20 | Agent/machine scopes, budgets, rate limits? | NO | **YES** | `access/` keys (READ / PROPOSE / EXECUTE_UNDER_MANDATE), call + USD budgets, per-minute limit, migration 035 |
| 21 | Usage metered into a revenue engine? | NO | **YES — simulated book only** | guard meters each billable call → `ShadowRevenueEngine` `sim` book; `real` book stays empty (leg B asserts both). Machine pricing is a DRAFT (founder decision) |
| 22 | All three clients use the same core? | PARTIAL | **YES** | human assistant, machine key and Mode B all call the same orchestrator, scorecard, proposal service, acceptance and risk (legs A–C) |
| 23 | LLM never sees broker credentials? | YES | **YES** | unchanged; stage 28 security scans in CI |
| 24 | LLM can never change risk/mandates/billing/ledger/revenue? | YES | **YES** | unchanged; Mode B executor is a deterministic bot, not an LLM tool |
| 25 | Every decision explainable with an audit "why" receipt? | PARTIAL | **PARTIAL** | decisions, proposals, memory and usage now carry the trace id (migration 037) and the decision is a persisted receipt (`GET /agent/receipts/:id`); `TradeReceiptAssembler` does **not yet** include the scorecard decision in the order receipt |
| 26 | Live money locked behind flags + REAL MONEY GATE 1? | YES | **YES** | unchanged; every full-loop order is `mode: paper` |
| 27 | Trading Intelligence internal-only? | NO | **NO** | `/v1/intelligence` still mounted and billed (`app_factory.mjs:419`); needs a founder decision (Phase 7 repositions the copy only) |

Score now: **YES 23 · PARTIAL 2 (Q6, Q25) · NO 1 (Q27)** · plus Q18 = NO, the desired answer. Before: YES 8 · PARTIAL 7 · NO 11.

Still true for every YES: **unmounted** (B-03/B-06/B-10 unresolved, enforced by `trading_blocker_register.test.js`), migrations applied only to local/ephemeral databases, flags OFF, paper only.

## 6. What Phase 6 builds (in order)

Stage 20 shadow revenue → Stage 28 security (no cloud KMS) → Anthropic provider + router tiers + cost metering → deterministic engines → walk-forward + stress → scorecard/decision engine → portfolio-fit → orchestrator + agents → memory + feedback → bot runner worker → machine/agent interface → Mode B → Stage 24 gaps → full-loop paper E2E. Each is one PR into `trading-agent/integration`, flag-gated OFF.
