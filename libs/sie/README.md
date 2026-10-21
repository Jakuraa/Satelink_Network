# @satelink/sie — Satelink Intelligence Engine contract

Feature-flagged off. No route uses it. Status: foundation for decision S-1.

| Piece | Where | Notes |
|---|---|---|
| `AIProvider` (chat / reason / structuredOutput / stream), `ScriptedProvider` | `src/provider.ts` | Promoted from `trading-agent/integration` (`apps/api/src/trading_agent/agent/provider.mjs`, Stage 12). The single provider abstraction; do not add a second one. |
| Typed provider errors | `src/errors.ts` | `timeout`, `connection_reset`, `rate_limited`, `server_error`, `stream_truncated`, `malformed`, `rejected`, `deadline_exceeded`, `config`. Only the first four are retryable / fallback-eligible. |
| Schema re-validation | `src/schema.ts` | Same JSON-Schema subset as Stage 12; every structured output is re-validated. |
| Cost | `src/cost.ts` | Provider `usage.cost` (USD) → `bigint` micro-USD, rounded **up**; `null` when not reported (never estimated). |
| Retries + deadline | `src/retry.ts` | ≤ 1 + `maxRetries` (0..3) attempts, retryable failures only, Retry-After honoured, one total deadline across attempts and backoff. Clock and sleep injected. |

Adapters live in **`services/sie`** (infrastructure layer, `@satelink/sie-providers`), not here: `libs/` is pure
(no I/O, no node builtins, no app code — `.dependency-cruiser.cjs`). The OpenRouter adapter receives `fetch` and
its key from `createOpenRouterProvider(env, deps)`, which returns `null` unless `SIE_OPENROUTER_ENABLED=1` and
`OPENROUTER_API_KEY` are both set.

**Integration branch:** `trading-agent/integration` must rebase onto this package — replace its
`agent/{provider,errors,schema}.mjs` with `@satelink/sie` and its OpenRouter adapter (#579) with
`@satelink/sie-providers`. `ChatResult` gains `generationId` and `usage.costMicroUsd`; provider errors gain `kind`.

Tests: `npm run test:libs` (libs + services projects). Live contract (opt-in, real cost, never in CI):
`SIE_LIVE_CONTRACT=1 OPENROUTER_API_KEY=… npx vitest run --project sie-live`.
