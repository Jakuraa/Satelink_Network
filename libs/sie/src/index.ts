/**
 * @satelink/sie — Satelink Intelligence Engine contract (decision S-1, feature-flagged off).
 *
 * Pure: no I/O, no app code, no SDKs. Provider adapters live in services/sie and receive their
 * transport (fetch) and key from a composition root. Enforced by .dependency-cruiser.cjs
 * (domain-no-node-core, domain-no-io-packages, libs-not-to-services).
 */
export {
  AgentError,
  ProviderError,
  ProviderTimeoutError,
  ProviderConnectionResetError,
  ProviderRateLimitError,
  ProviderServerError,
  ProviderStreamTruncatedError,
  ProviderMalformedResponseError,
  ProviderRejectedError,
  ProviderDeadlineExceededError,
  providerErrorForStatus,
  isFallbackEligible,
} from './errors.js';
export type { AgentErrorCode, ProviderFailureKind, ProviderErrorOptions } from './errors.js';

export { assertSchema, assertValid, validate, DECIMAL_STRING } from './schema.js';
export type { JsonSchema, JsonType } from './schema.js';

export { AIProvider, ScriptedProvider, Task } from './provider.js';
export type { ChatMessage, ChatOptions, ChatResult, ToolCall, Usage, StreamChunk, StreamFinal, ScriptedReply, ScriptStep } from './provider.js';

export { usdToMicroUsd, MICRO_PER_USD } from './cost.js';

export { withRetries, assertRetryPolicy, MAX_RETRIES_LIMIT } from './retry.js';
export type { RetryPolicy, RetryEnv } from './retry.js';
