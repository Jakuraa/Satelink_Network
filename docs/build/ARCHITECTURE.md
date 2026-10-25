> **Verified / changed (Session A, 2026-10-22).** The document below is committed verbatim as the founder supplied
> it. Repo evidence gathered since it was written contradicts or updates these statements:
> - §1 "API deploy (Railway) … Cause UNKNOWN": **cause found**. A Railway platform incident (builds paused from
>   2026-10-21 07:24 UTC; Hobby workspaces re-enabled last). The trigger, GitHub App install and watch paths are
>   all intact; there is no code or config cause (`evidence/RAILWAY_DEPLOY_ROOT_CAUSE_2026-10-21.md`).
> - §1 "`/health` reports no commit SHA": `/health` now returns `commit` (#580 `52448b91`, merged). It becomes
>   visible in production with the next deploy.
> - §1 "`apps/api` lockfile … Verify": **verified**. #557's lockfile is used; the live build ran `npm ci`. The
>   #579 report is stale. It was not the Railway cause.
> - §1 "#571, #572 being merged by the current session": not merged. Merges wait for deploys to work again
>   (gate: deploy and probe after each merge).
> - §6/§7 S-1 "promote `AIProvider` into `libs/sie`": done as draft #581. The **contract** lives in `libs/sie`.
>   The OpenRouter **adapter** lives in `services/sie`, because `libs/` must stay free of I/O (`libs/CLAUDE.md`).
>   OPEN_QUESTIONS records this.
> - §1 "No provider key (live test)": still true. `OPENROUTER_API_KEY` is not among the Railway variable names.
> - §7 S-1…S-6 remain **PROPOSED**. They are not yet recorded in `docs/decisions/`.

# Satelink AI Assistance — Target Architecture

Status: PROPOSED (founder approval turns §7 decisions into binding records under `docs/decisions/`).
Written 2026-10-21 against `main` @ `6e34d3ba` (#570). Companion docs: `REVENUE_MODEL.md`, `ACCEPTANCE_TESTS.md`.
Binding inputs: D1–D14, AD-1…AD-9 (`docs/decisions/README.md`), `MASTER_BUILD_PROMPT.md`, `AUDIT_2026-10-20.md`.

**In plain English:** Satelink is one product with four front doors: people, developers, AI agents and machines.
Behind those doors sits one shared engine. It checks who is calling and what they may spend. It picks the
right AI model, runs the work under deterministic rules, records the cost and the charge in one ledger, and
issues a receipt. Trading AI is the first serious workload on that engine. It is not a separate system.

---

## 1. Current-state truth table (verified 2026-10-21 ~17:40 UTC)

| Area | Actual state | Evidence | Blocker | Next action |
|---|---|---|---|---|
| **API deploy (Railway)** | **STALE.** Production runs a build from about 2026-10-20 15:09 UTC. #569, #567 and #570 are merged but not live. | `GET api.satelink.network/health` shows uptime 95,409 s at 17:39 UTC. `/health` reports no commit SHA. | Railway is not building or deploying `main`. Cause UNKNOWN: possibly failing builds, a lost GitHub trigger after the repo moved to the `Jakuraa` org, or watch paths. | Diagnose from the Railway deployment list and build logs. Fix it, then deploy and probe. |
| Web/console deploy (Vercel) | Working. `web` is READY at `33bdf7f4` (#567). Console and corporate builds were cancelled by the ignored-build step (no changes). | Vercel production deployment list | — | — |
| Node payout-wallet leak (#569) | Merged, **not live**. The leak is live in production. | uptime + merge time | Railway | Fix deploy, then probe `GET /api/nodes/:id` anonymously |
| Claim double-sign (#567) | Merged, not live. No risk today: `SETTLEMENT_DRY_RUN=1`. | merge `33bdf7f4` | Railway | Deploy |
| Heartbeat auth (#570) | Merged, not live | merge `6e34d3ba` | Railway | Deploy, then check that an unsigned heartbeat gets 401 |
| DNS rebinding (#571), register proof (#572) | Open, CI running, stacked | PR list | Being merged by the current session | Merge, then deploy |
| Node agent signing (#574) | Open | — | After #572 | Merge |
| Debug route (#575), expiry job (#576), void (#577), test flake (#578), allocate (#568) | Open, CI green per report | PR list | Founder review requested | Merge through the gates |
| Refund on upstream failure (#565) | Open, **does not meet** the ledger requirement | session report | Rebuild needed | Rebuild on the Financial OS reversal path |
| DB role | API connects as `postgres` (superuser) | `evidence/SIGNER_AND_FOUNDER_ANSWERS_2026-10-20.md` | Runtime DDL in Pricing V2, console accounts, subscription grants and traffic analytics (#573 runbook D1–D4) | Move DDL into migrations first, then switch the role |
| Claims signer (F21) | **OPEN-CRITICAL.** The on-chain signer is the treasury key `0x966E…`. The contract holds 4.28 USDT. | same evidence file | Founder key ceremony | `runbooks/SIGNER_ROTATION.md` |
| `ADMIN_API_KEY` / `JWT_SECRET` | Unset / not rotated | same | Founder | Set and rotate |
| SIE (model routing) | Not on `main`. The `AIProvider` abstraction exists only on `trading-agent/integration`. OpenRouter adapter is in #579 (draft). | STATUS_MATRIX M3 | No provider key (live test) | Promote the abstraction to `libs/` (§7 decision S-1) |
| Response / Decision API | Not implemented | STATUS_MATRIX M4 | SIE | Build on SIE |
| Connector Gateway | Not implemented. Broker adapters exist on the integration branch. | M5 | KMS (F4) for third-party credentials | Contract first, then MCP client |
| Financial OS | Libs exist (`libs/kernel`, `services/financial`, reconciler) but are **not wired into live API paths**. Shadow ledger flag is on, unverified. | M8 | — | Wire metering through it (W4) |
| Pricing | Four live price sets that contradict each other. TI prices withheld (#563). | M2 | F8 | Registry v3 schema now, prices after F8 |
| Trading AI | Stages 09–35 tested on `trading-agent/integration` (#492). Not mounted on `main`. | M9 | Gate 0 (B-01…B-12), staging (F3), legal (FIU-IND) | Paper mode and eval harness on the shared SIE |
| External revenue | **$0.00** | ledger | Product + payment rail | §4 of REVENUE_MODEL |
| Product identity in repo metadata | GitHub description reads "AI-agent and machine-commerce infrastructure…", which contradicts D14 | repo metadata | Founder (repo settings) | Change it to the D14 one-liner |
| `apps/api` lockfile | Committed in #557. The #579 report says "apps/api installs without a lockfile". | contradiction | — | Verify; it may also be the Railway build cause |

Classification summary: **deployed and externally verified** covers the RPC gateway, x402 402 flow, staff-gated
money reads and claim-signing gate. **Tested but not deployed** covers #567/#569/#570, Trading AI and the
OpenRouter adapter. **Not implemented** covers SIE on `main`, the Response/Decision API, Connector Gateway,
procurement, tenants/RBAC and the A2A card. **Blocked by founder** covers F21, F8, F3, F4, the DB role, secrets
and provider keys.

---

## 2. Target architecture (one modular monolith, existing patterns)

No new services, queues or databases. One Express API, one worker, one reconciler, one Postgres. Redis is
for cache and rate limits only, never truth (AD-1…AD-9).

```
 HUMANS            DEVELOPERS            AI AGENTS                 MACHINES
 web/console       HTTPS + SDK           MCP server / A2A card     .well-known + x402 / API key
     │                  │                      │                           │
     └──────────────── Cloudflare (WAF, rate limit) ───────────────────────┘
                                   │
 apps/api (Express) ───────────────┼──────────────────────────────────────────────
  ACCESS        identity: Better Auth (human) · sk_ API keys (dev) · session keys / x402 (machine)
                · staff auth (one path) → account/tenant → scopes/RBAC → rate limit
  REGISTRY      Capability Registry v3 (one file + table): id, status, pricing rule,
                entitlement, limits, failure/refund rule → feeds UI, /v1/pricing, OpenAPI,
                MCP tool list, A2A card, llms.txt, JSON-LD
  BUDGET        quote → reservation (ledger HOLD) ────────────────┐
  PRODUCT       Assistant/Tasks · /v1/responses · /v1/decisions   │
                · Connector Gateway · Procurement · Trading AI    │
                · RPC gateway (existing)                          │
  SHARED        SIE: router → adapters [OpenRouter | direct | SystemOne(Jev/Laya)]
                Policy engine (deterministic, incl. 20 trading risk checks)
                Workflow engine (tasks table + Postgres outbox, approvals, resume)
  EVIDENCE      served model id, provider generation id, tokens, provider cost,
                connector response, risk outcome  → usage_event (idempotency key)
  MONEY         Financial OS (libs/kernel): capture | release + reversal → receipt
                ▲ payment adapters (x402, USDT vault, Dodo, PayRam*, Transacty*) = evidence only
 worker         outbox consumer, durable tasks, provider-cost backfill
 reconciler     provider/payment evidence vs ledger → alerts
 Postgres       single source of truth      Redis: cache, rate limits, replay guards
 (* not live: gated by F-items)
```

### One paid request, end to end
1. **Authenticate** the caller and resolve the account (human, developer, agent principal or machine).
2. **Look up the capability** in the registry. Unknown or `status != live` gets 404 or 403. No price means not billable.
3. **Quote.** The registry pricing rule plus the estimate from the SIE router gives a maximum charge.
4. **Reserve.** The ledger places a HOLD for the maximum charge on the prepaid balance or entitlement.
   If funds are insufficient, the call returns 402 with the x402 or top-up instructions.
5. **Execute** through SIE or a connector, with deadline, retry cap and budget.
6. **Collect evidence:** the served model as reported by the provider, provider generation id, tokens and provider cost.
7. **Settle.** Success means CAPTURE of the actual charge (at most the hold) and RELEASE of the remainder.
   Failure means RELEASE of the whole hold. Nothing is charged; a captured charge is never deleted, only reversed.
8. **Meter and write the receipt.** A `usage_event` (idempotency key) links to the ledger entries and the
   receipt id, and an outbox event is written.
9. **Reconcile.** The reconciler compares provider cost reports and payment evidence with ledger rows and
   alerts on drift.

Hard rules: a charge needs evidence, never an LLM's claim of success. The model id comes from the provider
response, never from the request. Founder and test accounts are flagged at account level and excluded from
external revenue.

---

## 3. Product capability map

| Experience | Front door | Auth | Pays how | Uses |
|---|---|---|---|---|
| **Human: assistant and tasks** | satelink.network → console | Better Auth session | Subscription entitlement + overage credits | SIE, Workflow, Connectors (consented), Trading AI views |
| **Human: Trading AI** | console → Trading | session + TOTP mandate for any order | Subscription tier | Decision API, Policy, OMS (paper/testnet) |
| **Developer** | `/v1/responses`, `/v1/decisions`, `/v1/tasks`, OpenAPI, SDK | `sk_` key + scopes | Prepaid credits (USD micro-units) | SIE, Registry, Financial OS |
| **AI agent** | MCP server (`satelink-mcp`), A2A card | API key or delegated token with budget cap | Prepaid budget per principal | Same endpoints, exposed as tools |
| **Machine** | `/.well-known/satelink.json`, `/v1/capabilities`, RPC, x402 | x402 payment or session key | Pay per call (x402) or prepaid | Registry, RPC gateway, Financial OS |

All five rows share one registry, one SIE, one policy engine and one ledger. A capability exists for a front
door only when the registry says `live` for that channel.

---

## 4. Revenue architecture (summary; detail in `REVENUE_MODEL.md`)
Revenue sequence: developer prepaid credits for Response/Decision API, then human subscriptions with
Trading AI paper/analysis, then agent budgets, then the procurement fee. x402 per-call RPC stays as it is.
Ledger: a deposit is a liability. It becomes revenue only on consumption. Provider cost is booked as COGS per
usage event, which gives margin per capability. No fees on trading volume or outcomes (legal).

---

## 5. Trading AI architecture

```
market data (timestamped, source-tagged) → validation (staleness, gaps)
  → features / research (SIE Response API; Jev/Laya for typed classifications)
  → strategy (DSL, versioned) → backtest (walk-forward, fees, spread, slippage, no look-ahead)
  → model proposal via Decision API  ──►  deterministic risk engine (20 checks, limits, kill switch)
  → mandate (TOTP-signed, scoped)    ──►  OMS (outbox, UNKNOWN state, reconcile by clientOrderId)
  → paper | Binance Spot testnet (live = disabled)
  → fills / positions / PnL after costs → receipt + usage_event → Financial OS
```

- **The model proposes and policy decides.** The executor holds no withdrawal-capable key. The adapter
  refuses keys whose `apiRestrictions` show withdrawals or transfers enabled.
- **Evaluation harness (first build target).** Candidates are compared with deterministic baselines
  (no-trade, buy-and-hold, SMA crossover). Comparisons are walk-forward and out-of-sample, after costs.
  Metrics: net return, max drawdown, Sharpe/Sortino, calibration (Brier), trade count, exposure, failure
  rate, latency, model cost. A model that does not beat the best baseline across the agreed windows is
  rejected and not shipped.
- **Live trading gates, all required:** Gate 0 B-01…B-12 closed; legal opinion (FIU-IND / CA, F6); KMS
  (F4); staging (F3); signed founder enable; per-account limits configured; kill switch tested in staging.

---

## 6. Provider and SDK decision

| Item | Decision | Why | Revisit when |
|---|---|---|---|
| **SIE provider interface** | **One** interface. Promote the `AIProvider` abstraction from `trading-agent/integration` into a shared `libs/sie`; Trading AI and the Response API both use it. | Avoids a second abstraction. Its tests already exist. | — |
| **Vercel AI SDK (`ai`)** | **Not** in `apps/api` or `libs/sie` now. Allowed later in the console UI only, consuming our own `/v1/responses` stream. | SIE must own served-model identity, provider cost, typed errors and deadlines; #579's fetch adapter already covers these with 14 contract tests. Trading-agent import rules forbid SDK imports. The money-path service shouldn't take a large dependency tree. | Console chat streaming UI work, or a provider we need that only ships through the SDK |
| **OpenRouter** | Primary general-LLM gateway. Key with a hard spend cap. | One key, many models, and the response `usage.cost` gives actual charged cost. | If its fee or latency costs more than a direct adapter on a top-3 model |
| OpenRouter caveats | Record the response `model` and generation `id`. Fetch `/generation` for the provider. Never echo the requested model as served. Check fallback (`models`) behaviour against live responses before relying on it. | Truthful identity rule | — |
| **Jev / Laya** | One `SystemOneAdapter` (POST `/v1/systemone`; `choice` / `score` / `noul` questions → probabilities). They are **decision classifiers, not chat models**. Use them for routing classification, regime/sentiment features and Decision API typed questions. **They never authorize a trade.** | Cheap, typed outputs (Runware lists Jev at $0.042 and Laya at $0.020 per 1M input tokens). Laya is Apache-2.0 open-weight with a 512-token default context. | Self-host Laya only when volume justifies a GPU |
| Jev/Laya access | Start hosted (TypeSafe or Runware; one key). Verify the contract against **official** docs (`docs.typesafe.ai/api`, Runware docs) before coding. Current knowledge comes from secondary write-ups. | Contract unverified | — |
| Direct provider adapters | Same interface. Add only when measured cost or latency justifies it. | No speculative adapters | — |

---

## 7. Decisions this document proposes (become binding on founder approval)
- **S-1** One SIE provider interface in `libs/sie`, promoted from the integration branch.
- **S-2** No Vercel AI SDK on the server. A UI-only exception is allowed later.
- **S-3** Jev/Laya serve as typed classifiers behind the Decision API, never as trade authorizers.
- **S-4** Money unit: integer **micro-units (scale 6)** for USD/USDT/USDC usage pricing and ledger amounts,
  with explicit currency. Existing REAL columns are migrated additively (B-07).
- **S-5** Reserve → capture/release is the only charging path for new capabilities. Refunds are reversals.
- **S-6** The Capability Registry v3 is the single source for every surface. Prices fill in after F8.

---

## 8. Session queue (ranked; paths to verify in repo)
**Session A (now):** fix the Railway deploy, deploy, then probe #569/#567/#570. Finish #571 → #572 → #574.
Merge the green follow-ups. Add a commit SHA to `/health`. Promote `AIProvider` to `libs/sie` with the
OpenRouter adapter (#579 ported to `main`, flag-off). Write the registry v3 schema and validator (no prices).
**Session B:** `/v1/decisions` + `/v1/responses` behind a staff-only flag on SIE, metered through Financial OS
reserve/capture. Rebuild #565 on reversals. Add the SystemOne adapter (contract-verified). Durable `tasks`
table + outbox. Trading eval harness in paper mode against baselines.
**Session C:** console assistant UI on `/v1/responses`. Quickstarts for both APIs. Receipts endpoint. MCP tool
list and A2A card generated from the registry. Trading paper flow mounted behind the flag. Open the developer
API publicly once F8 prices land.

Realistic outcome after three sessions: deploy pipeline trustworthy; P0 security closed; SIE + Decision/Response
API working with real inference and correct metering for staff and invited developers; Trading AI paper mode
plus evaluation evidence. Live trading, public paid launch and fiat rails remain gated by founder/legal items.
