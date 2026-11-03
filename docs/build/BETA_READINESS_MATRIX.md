# Beta readiness matrix — Satelink customer product

Session B1 · 2026-11-03 · branch `feat/beta-unified-workflow` · base `origin/main` `dd279db4` (= production `/health.commit`).
Per-capability engineering status stays in `STATUS_MATRIX.md`; this file is the **customer-journey** view of the
same truth. Vocabulary: **Working+verified** · **Partial** · **Exists, disconnected** · **Broken** · **Missing** ·
**Mock only** · **Blocked externally** · **Not authorized**.

## 1. Gap map (Phase 0)

| # | Capability | Existing implementation | Integration | Tests | Customer usability | Blocker | Action (this session → next) |
|---|---|---|---|---|---|---|---|
| A | Auth & onboarding | Better Auth (`/api/identity`), console `/sign-in`, `/welcome` onboarding (accounts V1) | Live in prod (console 307 → sign-in) | console accounts suites (DB-backed) | Usable; four identity systems still coexist (STATUS_MATRIX M1) | W3 consolidation | Workflows accept API key **or** console session (reuses `betterAuthSession` + `csrfGuard`) |
| B | Customer dashboard | `apps/console` (19 pages, real-data, designed empty states) | Live | console vitest/e2e | Good for RPC/billing; no trading/procurement surfaces before this session | — | **Added** Strategy Lab, Marketplace, Workflows (flag-gated nav) |
| C | Trading AI (NL → strategy) | none on main (Strategy DSL only in #469/#492 draft stack; OpenRouter only in #579/#581) | — | — | Missing | No model provider merged (F11) | **Added** rule-based compiler → `satelink.strategy/v1` spec; clarify/reject; model drafter can sit in front later |
| D | Strategy DSL / compiler | see C | — | — | Missing → Partial | — | Spec + `validateSpec` gate (2 families, BTC/ETH 1d, long-only) |
| E | Market data | Binance public, Eulerpool, TrueData, paper providers in `services/trading` | Binance reachable from build machine; **Railway us-west2 → HTTP 451** | 19 Eulerpool contract tests | Partial | Railway still `us-west2` (verified 2026-11-03, not Europe); Eulerpool Free = non-commercial (F25); no Binance commercial licence | Data offers in supplier catalog with licence evidence; customer charge withheld |
| F | Backtesting & evaluation | `evaluateStrategy` walk-forward (t+1 fills, costs, leakage gate, baselines) | **Disconnected** before this session (no route) | 13 unit + 6 PG | Missing → **Working (preview)** | data licence for paid use | **Wired** as kernel workload `trading.strategy_evaluation`; scorecard UI |
| G | Paper trading | `PaperBroker`, `/v1/trading/paper/simulate` ($0.05, metered), console `/paper-trading` | Live | `trading_simulation.test.js` | Working (simulated single decision) | — | Linked from scorecard behind explicit confirmation; not duplicated |
| H | Broker / exchange adapters | Zerodha/IBKR stubs, Binance demo (T1) | Not mounted | adapter tests | Not authorized / Blocked (geo) | F13, F22 | None (no live trading this mission) |
| I | RPC gateway | `/rpc/polygon`, JSON-RPC 2.0 errors (#593) | Live | rpc suites | Working; refund-on-upstream-failure **#565 still open** | Upstream resale rights (F20, dRPC) | Unchanged |
| J | API keys & credits | `api_credits`, hashed keys, console keys | Live | billing suites | Working | — | Workflows resolve principal via canonical `resolveAccount` |
| K | x402 | inbound V2 on Base (CDP) live; vNext outbound purchase adapter + guard (off) | Inbound live, outbound off | x402 suites | Inbound working; outbound **not authorized** | funded wallet + spend authorization | x402 supplier connector refuses to pay (tested) |
| L | MCP server | `apps/mcp-server` (5 tools), `satelink-mcp` not on npm | Not published | 2/2 | Blocked (F12) | founder publish | Not changed (next: expose workflows as MCP tools) |
| M | Capability / service registry | Sell-side: Registry v3 **#582 open**; buy-side: vNext `SupplierRegistry` (main, unused) | — | vnext suites | Exists, disconnected | — | **Added** `supplier_catalog.v1.json` loaded into the vNext SupplierRegistry (no new registry) |
| N | Supplier integrations | none | — | — | Missing | supplier docs/rights | Space Command Kits catalogued as **evaluation** (live 402 + manifests probed; Polygon paused); FreeTier not listed; dRPC upstream candidate only |
| O | Agent procurement | vNext RoutingKernel (DISCOVER→SETTLE, saga, journal, idempotency), `VNEXT_KERNEL_ENABLED` off | Disconnected | ~10 vnext suites | Missing → **Working (preview)** | external suppliers need payment authorization | **Wired** workload `procurement:<capability>`; quote → approval → execute → verify → receipt |
| P | Financial OS | `libs/kernel`, `services/financial`; Reservation aggregate **#583 open** | Library only | 274 libs tests | Exists, disconnected | #583 merge, ledger postings | Budget hold is logical (no money); `WithheldSettlement` writes nothing to any ledger |
| Q | Metering & settlement | `authorizeAndMeter`, `revenue_events_v2`, `SETTLEMENT_DRY_RUN=1` | Live for RPC/paper sim | billing suites | Working for RPC | — | New meters **withheld** (pricing unapproved) |
| R | Pricing & subscription | plan_catalog v2, Dodo/fiat checkout (#600) | Live (test mode) | payments suites | Partial; price conflicts (F8) | F8 | No price changes |
| S | Customer docs | console `/docs`, satelink.network docs | Live | — | RPC-centric | — | Next: workflows API docs + OpenAPI |
| T | UI/UX & responsive | console design system (`sl-*` tokens) | Live | a11y e2e | Good | — | New pages verified desktop + 390 px |
| U | Security & permissions | staff auth hardened (#549/#553/#559) | Live | security suites | Partial (STATUS_MATRIX M12) | F21 signer rotation | Run ownership enforced; CSRF on session mutations; supplier URLs never from requests |
| V | Deploy & monitoring | Railway (`us-west2`), Vercel; `/health.commit` | Live | CI real gate | Working | Railway region ≠ brief | Verified region; no deploys made |

### Duplicates / drift found
- **Two registries by name, not by function:** Registry v3 (#582) is sell-side pricing; vNext `SupplierRegistry` is buy-side routing. Used the latter; documented the split in the catalog header.
- **Two trading-engine copies:** `services/trading` (TS) and its compiled bundle `apps/api/src/trading/engine` (drift-checked in CI since T1). Used the bundle; no third copy.
- **Strategy DSL / OpenRouter / Reservation / SIE** exist only in open PRs (#469/#492, #579/#581, #583, #588/#594). Not re-implemented; the compiler is the smallest gate that lets the merged engine be used.
- **Brief vs reality:** Railway is still `us-west2` (not Europe); the "100k req/month, $25" dRPC assumption is a third party's request (see SUPPLIER_INTEGRATION_STATUS.md).

## 2. Customer journeys

| Journey | Status | Evidence |
|---|---|---|
| **A — Trading** (sign in → Strategy Lab → NL request → clarification/spec → graph → data → backtest → scorecard → paper trading → history) | **Working in preview**, real data, nothing charged. Paper trading is the existing metered page (linked, not auto-started). | `evidence/beta-preview/01,06`; tests "Strategy Lab runs" (4) + compiler (11) |
| **B — Agent procurement** (marketplace → search → compare → detail → price/networks → quote → approve capped purchase → execute → verify → receipt → usage) | **Working in preview for wallet balance on Polygon** (first-party Satelink RPC, real on-chain read). External suppliers visible but **not purchasable** (evaluation / paused). | `evidence/beta-preview/02,03,04,05`; tests "agent procurement" (9) |
| **C — RPC** (pricing → key → example → request → usage/credits → errors) | **Working in production** (pre-existing). Commercial gate: upstream resale rights; #565 refund PR open. | prod probe 2026-11-03: `/v1/pricing` 200, anon `/rpc/polygon` → JSON-RPC `-32005` |
| **D — MCP** (settings → tools → config → test → usage) | **Blocked**: `satelink-mcp` unpublished (F12); workflows not yet exposed as MCP tools. | STATUS_MATRIX M10 |

**Beta verdict: NOT READY for external customers.** Journeys A and B work end to end in a local preview with
real data, but (1) the workflows API is not deployed (flag off, in-memory store in preview), (2) no new meter is
priced or licensed for charging, (3) MCP is unpublished. See `BETA_RELEASE_CHECKLIST.md`.
