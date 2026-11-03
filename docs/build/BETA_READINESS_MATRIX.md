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
| L | MCP server | `apps/mcp-server` (polygon_rpc) + **8 workflow tools (B2)**, `satelink-mcp` not on npm | Opt-in, unpublished | 8/8 incl. real MCP round trip | Built, not published | F12 publish decision | See §3 |
| M | Capability / service registry | Sell-side: Registry v3 **#582 open**; buy-side: vNext `SupplierRegistry` (main, unused) | — | vnext suites | Exists, disconnected | — | **Added** `supplier_catalog.v1.json` loaded into the vNext SupplierRegistry (no new registry) |
| N | Supplier integrations | none | — | — | Missing | supplier docs/rights | Space Command Kits catalogued as **evaluation** (live 402 + manifests probed; Polygon paused); FreeTier not listed; dRPC upstream candidate only |
| O | Agent procurement | vNext RoutingKernel (DISCOVER→SETTLE, saga, journal, idempotency), `VNEXT_KERNEL_ENABLED` off | Disconnected | ~10 vnext suites | Missing → **Working (preview)** | external suppliers need payment authorization | **Wired** workload `procurement:<capability>`; quote → approval → execute → verify → receipt |
| P | Financial OS | `libs/kernel`, `services/financial`; Reservation aggregate **#583 open** | Library only | 274 libs tests | Exists, disconnected | #583 merge, ledger postings | Budget hold is logical (no money); `WithheldSettlement` writes nothing to any ledger |
| Q | Metering & settlement | `authorizeAndMeter`, `revenue_events_v2`, `SETTLEMENT_DRY_RUN=1` | Live for RPC/paper sim | billing suites | Working for RPC | — | New meters **withheld** (pricing unapproved) |
| R | Pricing & subscription | plan_catalog v2, Dodo/fiat checkout (#600) | Live (test mode) | payments suites | Partial; price conflicts (F8) | F8 | No price changes |
| S | Customer docs | console `/docs`, satelink.network docs | Live | — | RPC-centric | — | Next: workflows API docs + OpenAPI |
| T | UI/UX & responsive | console design system (`sl-*` tokens) | Live | a11y e2e | Good | — | New pages verified desktop + 390 px |
| U | Security & permissions | staff auth hardened (#549/#553/#559) | Live | security suites | Partial (STATUS_MATRIX M12) | F21 signer rotation | Run ownership enforced; CSRF on session mutations; supplier URLs never from requests |
| V | Deploy & monitoring | Railway, Vercel; `/health.commit` | Live | CI real gate | Working | API/Postgres/Redis still `us-west2`; only `satelink-reconciler` moved to `europe-west4` (verified B2) | No deploys made |

### Duplicates / drift found
- **Two registries by name, not by function:** Registry v3 (#582) is sell-side pricing; vNext `SupplierRegistry` is buy-side routing. Used the latter; documented the split in the catalog header.
- **Two trading-engine copies:** `services/trading` (TS) and its compiled bundle `apps/api/src/trading/engine` (drift-checked in CI since T1). Used the bundle; no third copy.
- **Strategy DSL / OpenRouter / Reservation / SIE** exist only in open PRs (#469/#492, #579/#581, #583, #588/#594). Not re-implemented; the compiler is the smallest gate that lets the merged engine be used.
- **Brief vs reality:** Railway is still `us-west2` (not Europe); the "100k req/month, $25" dRPC assumption is a third party's request (see SUPPLIER_INTEGRATION_STATUS.md).

## 2. Customer journeys (updated Session B2, 2026-11-03)

| Journey | Status | Evidence |
|---|---|---|
| **A — Trading**: sign in → Strategy Lab → describe → clarification/spec → backtest → scorecard → saved strategy → revisit/re-run → paper trading (confirmation link) | **Working in preview, persistent** | E2E A1/A2; Postgres test "Strategy Lab run saves the strategy and records its evaluation"; `evidence/beta-preview/e2e-01,02` |
| **B — Agent procurement**: marketplace → search → compare → quote → capped purchase → approve → execute → verify → receipt | **Working in preview, persistent** for wallet balance on Polygon (first-party). External suppliers visible, **not purchasable** (evaluation) | E2E B; `e2e-03`; receipts hash-verified |
| **C — RPC**: pricing, endpoint, auth, example, test request, usage | **Production** (pre-existing). Preview shows live pricing (`/api-mcp`) and a real `eth_getBalance` via the marketplace; per-key usage needs a real account | E2E C/D; prod probe |
| **D — MCP**: discover tools, descriptions, config, test call | **Built, not published**: 8 workflow tools on the same API; console lists them | mcp-server 8/8 incl. real MCP client round trip; `e2e-04` |
| History after restart | **Verified**: API process killed and restarted on the same DB; runs, receipts, strategies intact | E2E phase 2; `e2e-05`; Postgres recovery tests |

## 3. MCP readiness

| Requirement | Status |
|---|---|
| Capability discovery | `list_capabilities`, `quote_capability` (read-only, show real supplier status) |
| Authenticated, customer-scoped calls | API key per customer; HTTP transport uses the **caller's** `X-API-Key`, never the operator key |
| Spending limits / approval | purchases always pause; agent approval only ≤ `SATELINK_MCP_AUTO_APPROVE_MAX_USD` (default 0), else console link |
| Idempotency | explicit `idempotency_key` or derived from tool + args; server replays same request, 409 on mismatch |
| Auditable execution | every call goes through the workflow API → hash-chained `wf_journal` + receipt |
| Only verified capabilities advertised | workflow tools opt-in (`SATELINK_MCP_WORKFLOW_TOOLS=1`); marketplace data carries per-supplier status |
| Publication | **not published** — see BETA_RELEASE_CHECKLIST "Before publishing MCP" |

## 4. PR #609 review summary (independent reviewer)

| Sev | Finding | Fix |
|---|---|---|
| HIGH | revoked/inactive API keys authenticated | only `active` (same as billing) |
| HIGH | `__proto__`/`constructor` bypassed spec validation; compile 500 | own-property lookups |
| HIGH | client controlled evaluation window/id/costs; unbounded candle cache; no rate limit | `normalizeSpec`, fixed window, bounded cache, 429 per customer |
| HIGH | production would run on an in-memory store | Postgres stores; 503 if migration missing |
| MED | runs stuck in `running` after a crash | boot `recover()` (both windows tested) |
| MED | kernel settled the customer price as supplier payment; re-routing; no budget re-check | supplier cost in `quote.cost`; offer pinned; `quote_expired` |
| MED | idempotency replayed different requests; console made a new key per click | 409 on mismatch; one key per intent |
| MED | session principal ≠ API-key principal; no status check for sessions | **open** — needs account linking |
| LOW | "short-term" false positive; internal error text leaked; failed boot cached; misleading body limit; keyed RPC URL logged; `init()` prefix caveat | fixed / documented |

Confirmed fine by the reviewer: no writes to `api_credits`/`revenue_events`/ledgers; clients cannot steer price,
supplier or URL; tenant isolation; console proxy allowlist; no conflict with #565's refund path.

**Beta verdict (B2): local beta is persistent and all supported journeys pass; NOT READY for external customers**
until the "Before an external beta" items in BETA_RELEASE_CHECKLIST are done (production migration, staging,
authorized RPC upstream, licensed data, account linking).
