/**
 * @satelink/sie — the one shared model-provider interface (decision S-1, amended 2026-10-22:
 * services/sie, not libs/sie, so libs/ stays free of network calls). Trading AI and the
 * Response/Decision API both use it; no second abstraction. No `ai` SDK (S-2). Flag-off: the
 * OpenRouter provider is only built when SIE_OPENROUTER_ENABLED=1 and OPENROUTER_API_KEY are set.
 */
export * from './contract/index.js';
export { OpenRouterProvider, OPENROUTER_DEFAULT_BASE_URL } from './infrastructure/openrouter.js';
export type { FetchLike, HttpRequestInit, HttpResponseLike, OpenRouterOptions } from './infrastructure/openrouter.js';
export { createOpenRouterProvider } from './composition.js';
export type { SieEnv } from './composition.js';
