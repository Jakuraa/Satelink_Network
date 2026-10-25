> **Verified / changed (Session A, 2026-10-22).** The document below is committed verbatim as the founder supplied
> it. Status of each row against this session's work:
> - **Deploy / Deployed commit:** `/health.commit` was added in #580 (merged). It is not yet live, because Railway
>   Hobby builds are still paused by the platform incident (`evidence/RAILWAY_DEPLOY_ROOT_CAUSE_2026-10-21.md`).
> - **Deploy / Reproducible build:** passes. `npm ci` runs from `apps/api/package-lock.json` in CI (the "API deploy
>   install" job) and on Railway (the build log of `b90ff9e5`).
> - **Deploy / Exposure probe:** #569 is merged but not deployed, so the probe is pending.
> - **SIE (draft #581):**
>   - Covered by tests: schema, typed errors (timeout, reset, 429, 5xx, cut stream), bounded retries plus a total
>     deadline, and served identity.
>   - Not built yet (Session B): Budget (refuse before the provider call) and Metering (`usage_event`).
> - **Financial OS / Reserve-capture-release (draft #583):**
>   - Covered by tests: capture ≤ hold, failure releases 100%, and a stale or concurrent writer loses.
>   - Property tests run 1,000 sequences.
>   - Not built yet: the ledger postings, the float-math lint, and the reconciliation alert.
> - **Machine commerce / Discovery (draft #582):** the snapshot test checks the registry against `/v1/pricing`
>   and the MCP tool list. `.well-known` is checked by the flag-on/off equality test. The registry-derived surfaces
>   are still behind a flag that is off.

# Acceptance tests — objective pass criteria

Rule: a capability is **VERIFIED** only when every row in its section passes in CI, with the DB-backed
suite running and no unexplained skips. It is **RELEASED_VERIFIED** only after the production probe passes
on the deployed commit (`/health` must report the commit SHA). Never weaken a test or add an allowlist
entry to make CI green.

| Area | Test | Pass criterion |
|---|---|---|
| **Deploy** | Deployed commit | `/health.commit` equals the merge SHA within 15 min of merge |
| | Reproducible build | `npm ci` from the committed lockfile in CI and on Railway |
| | Skips | Skip count is no higher than `known-skips-baseline.txt`, and failures are no higher than the allowlist |
| | Exposure probe | Anonymous `GET /api/nodes/:id` has no wallet, endpoint or hardware. Money routes return 401. |
| **SIE** | Valid / invalid schema | A valid output passes; schema failure gives a typed error, never partial data |
| | Timeout, reset, 429, 5xx, cut stream | Typed error; at most N retries; fallback only to an allowed model; no canned answer |
| | Served identity | The recorded `served_model` equals the provider response `model`, never the requested id |
| | Budget | A request that would exceed the hold is refused before the provider call |
| | Metering | Exactly one `usage_event` per request (idempotency key), with tokens and provider cost |
| **Financial OS** | Balance | Every transaction balances per currency (property test, 1,000 random sequences) |
| | Idempotency | Duplicate webhook, usage or refund changes nothing the second time |
| | Reserve/capture/release | Success captures at most the hold; failure releases 100%; concurrent captures never exceed the hold |
| | Arithmetic | Integer micro-units only; a lint/test forbids float math in money modules |
| | Revenue truth | Internal/test accounts are excluded; deposits are not revenue; reversals are negative |
| | Reconciliation | An injected provider-vs-ledger mismatch raises an alert |
| **Decision / Response API** | Auth and scopes | Missing key 401, wrong scope 403, insufficient balance 402 |
| | Contract | Response matches the OpenAPI schema; Decision API separates `model_output` from `policy_result` |
| | Idempotency | Same `Idempotency-Key` returns the same result and is charged once |
| **Connectors / workflows** | Permission / revoked credential | Refused with an audit event; no secret in logs or model context |
| | Approval | A consequential action pauses at `awaiting_approval` and resumes after approval only |
| | Durability | A worker killed mid-task resumes without a double charge |
| **Machine commerce** | Discovery | Registry-derived `.well-known`, `/v1/pricing` and MCP tool list all agree (one snapshot test) |
| | x402 | 402 without payment; a paid request is served once; a replayed payment is refused |
| | Receipt | Every captured charge has a retrievable receipt matching the ledger |
| **Trading AI** | Risk | Each of the 20 checks rejects a crafted violating order; kill switch blocks all orders |
| | Leakage | A planted future-data feature makes the leakage test fail |
| | Costs | Backtest PnL includes fees, spread and slippage; a zero-cost run is flagged |
| | Data | Stale or gapped market data gives no proposal |
| | OMS | Timeout/5xx gives UNKNOWN, then reconcile by `clientOrderId`; never a blind retry |
| | Live gate | With the live flag unset, no code path reaches a live exchange endpoint (test with network deny) |
| | Model acceptance | The candidate beats the best baseline out of sample after costs on agreed windows, or is rejected |
