# Satelink Trading AI — go-live founder checklist

Prepared 2026-10-11 at the end of the Phase 1–9 execution order. **No live action has been taken.** `LIVE_TRADING`, `AUTONOMOUS_MODE` and `UPSTOX_AUTOMATED` are locked in code. `MANDATE_MODE_B` exists, default OFF. No trading route is mounted in production. **Gate 0: NOT PASSED** (`BLOCKERS.md`).

## 1. Founder actions, in order

Each action unblocks the next. Claude Code cannot do any of them: each needs credentials, a paid account, a legal signature or a settings change outside the repo.

| # | Action | Unblocks | Where | Done? |
|---|---|---|---|---|
| 1 | **Phase 2 rotations** (`SECURITY_HOTFIX.md` §Founder actions): (a) remove `ADMIN_TOKEN` from the Vercel web project; (b) rotate `ADMIN_SECRET_TOKEN` on Railway `Satelink-api`; (c) delete and recreate the leaked Discord webhook (B-01); (d) delete the Paperclip Railway service and rotate `ANTHROPIC_API_KEY` (B-04); (e) switch the API `DATABASE_URL` to the `satelink_app` role (B-07(b)) | B-01, B-02, B-03, B-04 → RESOLVED | Vercel / Railway / Discord / Anthropic consoles | ☐ |
| 2 | **Decide the held `main` merges.** The API deployments were found REMOVED after the 2026-10-07 merges; restore the API first, then approve merges one at a time with the health check (rule 5). Held: #493 cleanup, #458, #510 (jakuraa.com source reconcile — **live site is a CLI deploy not in git**), #511 satelink.network, #512 jakuraa.com, #513 README, #492 integration→main tracking | websites live; B-05 → RESOLVED | GitHub | ☐ |
| 3 | **Confirm jakuraa.com statutory IDs** (CIN / GSTIN mismatch, see PR #512) against the certificates | factual site | — | ☐ |
| 4 | **Create a Railway staging environment** (B-06) with its own Postgres; apply migrations 021–037 there only via `npx tsx database/runner.ts migrate` | B-06; mounting trading routes anywhere | Railway | ☐ |
| 5 | **Enable branch protection on `main`** with required checks (B-10) | B-10 | GitHub settings | ☐ |
| 6 | **Create the execution service** in a Binance-permitted, **non-US** Railway region with a **static outbound IP** (us-west2 is geo-blocked by Binance); allow-list that IP on broker keys | B-08 (egress part) | Railway | ☐ |
| 7 | **Provision the KMS account** (the AWS KMS provider is written, OFF) — or explicitly accept the local key provider for a capped beta and record it | B-08 (keys part); Gate 7 | AWS | ☐ |
| 8 | **Binance testnet keys → GitHub environment `trading-testnet`** (trade-only, no withdrawal) | Gate 6 nightly runs | GitHub environments | ☐ |
| 9 | **Legal (RPrC):** Terms of Service, risk disclosure and privacy notice for the trading product; broker and market-data terms review (B-09); decide the licence conflict (B-11: MIT `LICENSE` vs `LICENSE.BSL`) | B-09, B-11; RPrC placeholders on the site | counsel | ☐ |
| 10 | **Payment-provider compliance** for a trading product (Dodo / Razorpay). Do not describe the business to a provider in a way that contradicts the product; get written acceptance first | subscriptions (Stage 27, test mode only today) | providers | ☐ |
| 11 | **Pricing decisions:** machine pricing (`access/pricing.mjs` is a DRAFT; usage goes to the simulated book only), Groq model pricing, Trading AI pricing ("pricing at launch") | real revenue book | — | ☐ |
| 12 | **Trading Intelligence as a product** (architecture Q27, WRONG vs the locked definition): unmount `/v1/intelligence` or keep it as legacy, given live billing (#429) | Q27 | — | ☐ |
| 13 | **Sign REAL MONEY GATE 1** (`gates/real-money-gate-1.md`) — two approvers; if solo, name an external reviewer | unlocking the `LIVE_TRADING` PR | — | ☐ |
| 14 | **Create the org profile repo** `Satelink-Protocol/.github` with `profile/README.md` (Phase 8 step 4; repo creation was not permitted to Claude Code in this session — content is in the final report) | GitHub org profile | GitHub | ☐ |

## 2. What Claude Code does after each founder action

| After | Claude Code |
|---|---|
| 1 | Re-run the B-01…B-04 checks; mark RESOLVED only with evidence (`trading_blocker_register.test.js` enforces it). |
| 2 | For each approved merge: curl health on `api.satelink.network`, `satelink.network`, `console.satelink.network` and `jakuraa.com` before and after; on a regression, revert immediately and stop. Retarget #511/#512 to `main` in order so the claims-lint CI steps run there. |
| 4 + 5 | Register `mountTradingRoutes` on **staging** only, once B-03, B-06 and B-10 are RESOLVED. Run the full-loop E2E against staging Postgres. Wire the bots worker (`workers/trading-bots`) and the Mode B context loader (proposer + scorecard lookups, shape in `trading-full-loop.integration.test.ts`). |
| 6 + 7 + 8 | Run the opt-in Binance testnet suite nightly for 5 consecutive nights (Gate 6); record each run in `gates/evidence/`. Turn on the KMS provider (or record the local-provider acceptance). |
| 9–12 | Replace RPrC placeholders with the reviewed text only; publish pricing only once decided. |
| 13 | Open, but do not merge, the PR that unlocks `LIVE_TRADING`. It needs the signed gate, B-06, B-08 and B-09 RESOLVED, and a capped LIVE_SMALL allow-list. Never place a real order without an explicit founder instruction for that order. |

## 3. Final status

Evidence: stage docs in `stages/`, `ARCHITECTURE.md` §5b, `EXECUTION_LOG.md`.

### Per broker

| Broker | IMPLEMENTED | TESTED | PAPER-VALIDATED | PARTNER-APPROVED | PRODUCTION-ENABLED | REAL-REVENUE-VERIFIED |
|---|---|---|---|---|---|---|
| Binance (spot) | YES — `brokers/binance/` (Stage 21) | PARTIAL — unit/contract tests with recorded responses; the live **testnet** suite is opt-in and waits for founder testnet keys (action 8) | NO — the full paper loop is proven on `MockBroker`, not on the Binance testnet | NO | NO (`LIVE_TRADING` locked) | NO |
| Upstox (India) | YES — `brokers/upstox/` copilot only (Stage 22) | PARTIAL — unit/contract tests; sandbox suite opt-in | NO | NO | NO (`UPSTOX_AUTOMATED` locked; copilot only) | NO |
| Alpaca (US) | YES — `brokers/alpaca/` (Stage 23) | PARTIAL — unit/contract tests; sandbox suite opt-in | NO | NO | NO | NO |
| MockBroker (paper venue) | YES (Stage 10) | YES | YES — full-loop E2E, three legs, one trace each (Stage 47) | n/a | n/a | n/a |

### Per interface

| Interface | Paper-ready? | Live-ready? |
|---|---|---|
| Human (web / console "Talk to Satelink Trading AI") | **In code, not deployed.** Assistant → scorecard → proposal → step-up approval → paper fill is proven end to end (Stage 47 leg A). Trading routes are unmounted (B-03/B-06/B-10). | NO |
| External AI agent (API / MCP) | **In code, not deployed.** Keys, scopes, budgets and metering to the simulated book are proven (Stage 47 leg B). Not public. | NO |
| Machine / bot (API, Mode B) | **In code, flag OFF.** Mode B executor proven on paper with the flag on in tests (Stage 47 leg C); `MANDATE_MODE_B` stays OFF until staging. | NO |

## 4. Never

- Never enable `LIVE_TRADING`, `AUTONOMOUS_MODE` or `UPSTOX_AUTOMATED` outside the signed gate.
- Never use production broker keys before the execution service, KMS and gate exist.
- Never set `SETTLEMENT_DRY_RUN=0` without the CLAUDE.md conditions.
- Never mark a blocker RESOLVED without evidence.
