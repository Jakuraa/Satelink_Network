# @satelink/sie — Satelink Intelligence Engine provider interface

This is the one shared model-provider interface (decision **S-1**, amended 2026-10-22). It lives in
`services/sie`, not `libs/sie`, so that `libs/` stays free of network calls. Trading AI and the
Response/Decision API both use it, and there is no second abstraction. The package uses no `ai` SDK
(**S-2**). It is feature-flagged off and no route uses it yet.

| Piece | Where | Notes |
|---|---|---|
| `AIProvider` (chat / reason / structuredOutput / stream), `ScriptedProvider` | `src/contract/provider.ts` | Promoted from `trading-agent/integration` (`apps/api/src/trading_agent/agent/provider.mjs`, Stage 12). |
| Typed provider errors | `src/contract/errors.ts` | `timeout`, `connection_reset`, `rate_limited`, `server_error`, `stream_truncated`, `malformed`, `rejected`, `deadline_exceeded`, `config`. Only the first four are retryable. A deadline cut-off whose cause was one of those four can still fall back to another provider. |
| Schema re-validation | `src/contract/schema.ts` | The same JSON Schema subset as Stage 12. Every structured output is re-validated. |
| Cost | `src/contract/cost.ts` | The provider's `usage.cost` (USD) becomes `bigint` micro-USD, rounded **up** (S-4). It is `null` when the provider does not report a cost; it is never estimated. |
| Retries + deadline | `src/contract/retry.ts` | At most 1 + `maxRetries` attempts (0..3), only for retryable failures. Retry-After is honoured, and one total deadline covers every attempt. The clock and sleep are injected. |
| OpenRouter adapter | `src/infrastructure/openrouter.ts` | Records the served `model` and generation `id` from the response, plus tokens and cost. `fetch` and the key are injected. |
| Composition | `src/composition.ts` | `createOpenRouterProvider(env, deps)` returns `null` unless `SIE_OPENROUTER_ENABLED=1` **and** `OPENROUTER_API_KEY` are set. |

**Not "integrated" yet.** Founder limit: no integration claim until a real OpenRouter request has verified
the returned model id, `usage.cost`, and the timeout and error behaviour. The opt-in live test is
`SIE_LIVE_CONTRACT=1 OPENROUTER_API_KEY=… npx vitest run --project sie-live`. It never runs in CI and never
logs the key.

**Integration branch:** `trading-agent/integration` must rebase onto this package. That means replacing its
`agent/{provider,errors,schema}.mjs` and its OpenRouter adapter (#579) with `@satelink/sie`. Two contract
changes come with the rebase: `ChatResult` gains `generationId` and `usage.costMicroUsd`, and provider errors
gain `kind`.

Tests run with `npm run test:libs` (the `services` project covers `services/sie/**`).
