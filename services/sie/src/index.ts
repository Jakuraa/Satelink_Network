/**
 * @satelink/sie-providers — SIE provider adapters (infrastructure layer).
 * The contract lives in @satelink/sie; adapters receive transport and keys from a composition root.
 */
export { OpenRouterProvider, OPENROUTER_DEFAULT_BASE_URL } from './infrastructure/openrouter.js';
export type { FetchLike, HttpRequestInit, HttpResponseLike, OpenRouterOptions } from './infrastructure/openrouter.js';
export { createOpenRouterProvider } from './composition.js';
export type { SieEnv } from './composition.js';
