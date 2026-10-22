// SIE errors. Promoted from trading-agent/integration (apps/api/src/trading_agent/agent/errors.mjs,
// Stage 12) and extended with typed provider failures so routers and metering can branch on the
// failure class instead of parsing messages.

export type AgentErrorCode =
  | 'UNKNOWN_TOOL'
  | 'FORBIDDEN_TOOL'
  | 'SCHEMA_INVALID'
  | 'TOOL_FAILED'
  | 'PROVIDER_ERROR'
  | 'ROUTE_NOT_FOUND'
  | 'CONFIG'
  | 'BOUNDARY_VIOLATION'
  | 'MAX_STEPS';

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: AgentErrorCode, message?: string, details: Record<string, unknown> = {}) {
    super(message || code);
    this.name = 'AgentError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Why a provider call failed. `retryable` follows from the kind (see RETRYABLE_KINDS), so a
 * router can fall back on transient failures and never on a request the provider rejected.
 */
export type ProviderFailureKind =
  | 'timeout' //            one attempt exceeded its timeout (request, body read or stream silence)
  | 'connection_reset' //   transport failed: reset, DNS, refused, terminated body
  | 'rate_limited' //       HTTP 429 (or an in-body 429)
  | 'server_error' //       HTTP 5xx (or an in-body 5xx)
  | 'stream_truncated' //   a stream ended before its terminator; the partial answer is discarded
  | 'malformed' //          the provider answered, but not with a usable response
  | 'rejected' //           HTTP 4xx other than 429: the request itself is wrong (auth, credit, model)
  | 'deadline_exceeded' //  the total deadline across attempts and backoff ran out
  | 'config'; //            the adapter was built or called wrongly

const RETRYABLE_KINDS: ReadonlySet<ProviderFailureKind> = new Set(['timeout', 'connection_reset', 'rate_limited', 'server_error']);

export interface ProviderErrorOptions {
  readonly provider: string;
  readonly status?: number | null;
  readonly retryAfterMs?: number;
  readonly cause?: unknown;
}

/** Provider failures carry their kind and retryability so the router can decide on fallback. */
export class ProviderError extends AgentError {
  readonly kind: ProviderFailureKind;
  readonly retryable: boolean;
  readonly status: number | null;
  readonly provider: string;
  /** Server-requested wait before retrying (Retry-After), already capped by the adapter. */
  readonly retryAfterMs: number | undefined;

  constructor(kind: ProviderFailureKind, message: string, opts: ProviderErrorOptions) {
    const retryable = RETRYABLE_KINDS.has(kind);
    const status = opts.status ?? null;
    super('PROVIDER_ERROR', message, { kind, retryable, status, provider: opts.provider });
    this.name = 'ProviderError';
    this.kind = kind;
    this.retryable = retryable;
    this.status = status;
    this.provider = opts.provider;
    this.retryAfterMs = opts.retryAfterMs;
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions) { super('timeout', message, opts); this.name = 'ProviderTimeoutError'; }
}
export class ProviderConnectionResetError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions) { super('connection_reset', message, opts); this.name = 'ProviderConnectionResetError'; }
}
export class ProviderRateLimitError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions) { super('rate_limited', message, opts); this.name = 'ProviderRateLimitError'; }
}
export class ProviderServerError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions) { super('server_error', message, opts); this.name = 'ProviderServerError'; }
}
export class ProviderStreamTruncatedError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions) { super('stream_truncated', message, opts); this.name = 'ProviderStreamTruncatedError'; }
}
export class ProviderMalformedResponseError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions) { super('malformed', message, opts); this.name = 'ProviderMalformedResponseError'; }
}
export class ProviderRejectedError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions) { super('rejected', message, opts); this.name = 'ProviderRejectedError'; }
}
export class ProviderDeadlineExceededError extends ProviderError {
  constructor(message: string, opts: ProviderErrorOptions) { super('deadline_exceeded', message, opts); this.name = 'ProviderDeadlineExceededError'; }
}

/** HTTP status → typed error. 429 rate_limited, 5xx server_error, any other non-2xx rejected. */
export function providerErrorForStatus(status: number, message: string, opts: Omit<ProviderErrorOptions, 'status'>): ProviderError {
  const o = { ...opts, status };
  if (status === 429) return new ProviderRateLimitError(message, o);
  if (status >= 500) return new ProviderServerError(message, o);
  return new ProviderRejectedError(message, o);
}

/**
 * A router may try the next provider in the chain only for transient failures. A deadline cut-off
 * whose last failure was transient (429, 5xx, timeout, reset) is eligible too: it is the same
 * outage, merely stopped by the budget instead of by maxRetries, so the outcome must not depend on
 * which limit was hit first. It stays non-retryable against the SAME provider.
 */
export function isFallbackEligible(e: unknown): boolean {
  if (!(e instanceof ProviderError)) return false;
  if (e.retryable) return true;
  const cause = (e as { cause?: unknown }).cause;
  return e.kind === 'deadline_exceeded' && cause instanceof ProviderError && cause.retryable;
}
