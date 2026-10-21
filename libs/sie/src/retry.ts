// Bounded retries under one total deadline. Pure: the clock and the sleep are injected, so the
// policy is tested without timers and adapters cannot hide extra attempts or unbounded waits.
//
//   attempts  ≤ 1 + maxRetries, and only for retryable ProviderErrors
//   backoff   = Retry-After when the provider sent one (adapter caps it), else base × 2^attempt
//   deadline  = one budget for every attempt AND every backoff; each attempt receives the time left
//               so it can bound its own timeout. A retry whose wait would cross the deadline is not
//               made: the caller gets ProviderDeadlineExceededError with the last failure as cause.
import { ProviderDeadlineExceededError, ProviderError } from './errors.js';

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly deadlineMs: number;
  readonly baseBackoffMs?: number;
}

export interface RetryEnv {
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
}

export const MAX_RETRIES_LIMIT = 3;

export function assertRetryPolicy(p: RetryPolicy, provider: string): void {
  if (!Number.isInteger(p.maxRetries) || p.maxRetries < 0 || p.maxRetries > MAX_RETRIES_LIMIT) {
    throw new ProviderError('config', `maxRetries must be an integer 0..${MAX_RETRIES_LIMIT}`, { provider });
  }
  if (!Number.isFinite(p.deadlineMs) || p.deadlineMs <= 0) {
    throw new ProviderError('config', 'deadlineMs must be a positive number', { provider });
  }
}

/**
 * Runs `attempt(remainingMs, attemptIndex)` until it succeeds, fails non-retryably, exhausts
 * maxRetries, or the deadline leaves no room for the next try.
 */
export async function withRetries<T>(
  policy: RetryPolicy,
  env: RetryEnv,
  provider: string,
  attempt: (remainingMs: number, attemptIndex: number) => Promise<T>,
): Promise<T> {
  const base = policy.baseBackoffMs ?? 250;
  const deadline = env.now() + policy.deadlineMs;
  for (let i = 0; ; i += 1) {
    const remaining = deadline - env.now();
    if (remaining <= 0) {
      throw new ProviderDeadlineExceededError(`${provider} total deadline of ${policy.deadlineMs} ms exceeded`, { provider });
    }
    try {
      return await attempt(remaining, i);
    } catch (e) {
      if (!(e instanceof ProviderError) || !e.retryable || i >= policy.maxRetries) throw e;
      const wait = e.retryAfterMs ?? base * 2 ** i;
      if (env.now() + wait >= deadline) {
        throw new ProviderDeadlineExceededError(
          `${provider} total deadline of ${policy.deadlineMs} ms leaves no room to retry after ${e.kind}`,
          { provider, status: e.status, cause: e },
        );
      }
      await env.sleep(wait);
    }
  }
}
