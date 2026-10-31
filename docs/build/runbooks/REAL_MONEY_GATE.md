# REAL MONEY GATE — checklist (Trading AI, Binance Spot)

Checklist only. Nothing in the codebase enables real-money trading: `api.binance.com` order
endpoints are refused unless the LOCKED `LIVE_TRADING` flag is enabled, and that flag is not
changed by this document. Every item needs evidence (file, run id, signed artifact) recorded
in `docs/build/BUILD_LEDGER.md`. All items must be PASS before anyone proposes enabling.

| # | Item | Evidence required | State |
|---|---|---|---|
| 1 | **14-day demo forward test**: PnL after fees above the best baseline (no-trade, buy-and-hold, SMA 10/30) over the same 14 days, with **zero control failures** (no unreconciled UNKNOWN order, no limit breach, no stale-data trade, no kill-switch miss) | daily reports + decision/order ids from `trading_decisions` | NOT STARTED — demo runner blocked (geo, see `evidence/TRADING_GEO_CHECK_2026-10-31.md`); no strategy has a PASS evaluation |
| 2 | **Strategy evaluation PASS** not older than 30 days for the exact strategy version traded | `trading_strategy_evaluations` row | FAIL — all 4 evaluations 2026-10-31 FAIL |
| 3 | **Legal opinion** on third-party VDA execution (FIU-IND registration / PMLA) and client terms, from Indian counsel / CA | signed opinion on file | OPEN (F5) |
| 4 | **Tax treatment noted**: 30% tax on VDA gains (no loss set-off), 1% TDS on transfers (s.194S); who deducts/deposits; books treatment | CA note | OPEN |
| 5 | **KMS-held key**: exchange secret held in a managed KMS / isolated signer, never in app env or logs | KMS key id + access policy | OPEN (F4) |
| 6 | **IP-whitelisted, trade-only key**: `GET /sapi/v1/account/apiRestrictions` shows `ipRestrict=true`, `enableSpotAndMarginTrading=true`, `enableReading=true`, `enableWithdrawals=false`, `enableInternalTransfer=false`, `permitsUniversalTransfer=false`; margin/futures disabled | redacted response + static egress IP | OPEN (F4) |
| 7 | **Real-money limits** set and enforced in BOTH the risk engine and the runner: per-order notional, max open positions, daily loss (kill switch for the rest of the UTC day), symbol allowlist, spot only | tests + config record | OPEN |
| 8 | **Kill switch tested**: game-day drill — engage mid-session, verify no new orders, open orders cancelled per policy, alert delivered | drill log | OPEN |
| 9 | **Signed founder enable**: a founder-signed gate artifact (Ed25519, same scheme as the demo mandate) naming the strategy version, limits, expiry; two-person procedure | signed artifact committed | OPEN |
| 10 | **Eligibility**: Binance programme/eligibility for the account holder and the execution region | provider confirmation | OPEN (F13) |

Hard rules that stay true regardless of this checklist: no withdrawal capability anywhere
(R17); models never hold credentials or call a broker (R15); test/demo activity is never
counted as revenue (R3).
