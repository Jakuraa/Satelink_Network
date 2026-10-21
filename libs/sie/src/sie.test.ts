import { describe, expect, it } from 'vitest';
import {
  AIProvider, AgentError, ProviderDeadlineExceededError, ProviderError, ProviderRateLimitError, ProviderRejectedError,
  ProviderServerError, ScriptedProvider, assertRetryPolicy, isFallbackEligible, providerErrorForStatus, usdToMicroUsd,
  withRetries, type ChatMessage,
} from './index.js';

const MSGS: ChatMessage[] = [{ role: 'user', content: 'hi' }];

describe('usdToMicroUsd — provider cost to integer micro-USD, no float math', () => {
  it('converts exact decimals', () => {
    expect(usdToMicroUsd(0)).toBe(0n);
    expect(usdToMicroUsd(1)).toBe(1_000_000n);
    expect(usdToMicroUsd(0.000123)).toBe(123n);
    expect(usdToMicroUsd('12.5')).toBe(12_500_000n);
    expect(usdToMicroUsd(0.1 + 0.2)).toBe(300_001n); // 0.30000000000000004 is above 0.3 → rounds up, never down
  });
  it('handles exponent forms JSON numbers stringify to', () => {
    expect(String(1.5e-7)).toBe('1.5e-7');
    expect(usdToMicroUsd(1.5e-7)).toBe(1n); // 0.15 micro → 1 (round up)
    expect(usdToMicroUsd(2e-6)).toBe(2n);
    expect(usdToMicroUsd('3E2')).toBe(300_000_000n);
  });
  it('rounds a fractional micro UP (never under-records a cost)', () => {
    expect(usdToMicroUsd(0.0000004)).toBe(1n);
    expect(usdToMicroUsd('0.0000010000001')).toBe(2n);
    expect(usdToMicroUsd('0.000001')).toBe(1n);
  });
  it('returns null for anything that is not a reported non-negative cost', () => {
    for (const v of [undefined, null, -0.01, Number.NaN, Number.POSITIVE_INFINITY, '', 'abc', '1.2.3', '-1', {}, [], '1e999999']) {
      expect(usdToMicroUsd(v), String(v)).toBeNull();
    }
  });
});

describe('typed provider errors', () => {
  it('HTTP status → kind and retryability', () => {
    const cases: [number, string, boolean, Function][] = [
      [429, 'rate_limited', true, ProviderRateLimitError], [500, 'server_error', true, ProviderServerError], [503, 'server_error', true, ProviderServerError],
      [400, 'rejected', false, ProviderRejectedError], [401, 'rejected', false, ProviderRejectedError], [402, 'rejected', false, ProviderRejectedError],
    ];
    for (const [s, kind, retryable, cls] of cases) {
      const e = providerErrorForStatus(s, `HTTP ${s}`, { provider: 'p' });
      expect([e.kind, e.retryable, e.status, e.code, e instanceof cls, isFallbackEligible(e)], String(s)).toEqual([kind, retryable, s, 'PROVIDER_ERROR', true, retryable]);
    }
  });
  it('only transient kinds are fallback-eligible', () => {
    for (const k of ['timeout', 'connection_reset', 'rate_limited', 'server_error'] as const) expect(isFallbackEligible(new ProviderError(k, k, { provider: 'p' }))).toBe(true);
    for (const k of ['stream_truncated', 'malformed', 'rejected', 'deadline_exceeded', 'config'] as const) expect(isFallbackEligible(new ProviderError(k, k, { provider: 'p' }))).toBe(false);
    expect(isFallbackEligible(new Error('x'))).toBe(false);
  });
});

/** Fake clock: sleep advances time instead of waiting. */
function fakeEnv(start = 1_000) {
  let t = start;
  const sleeps: number[] = [];
  return { sleeps, now: () => t, sleep: async (ms: number) => { sleeps.push(ms); t += ms; }, advance: (ms: number) => { t += ms; } };
}
const transient = (kind: 'timeout' | 'rate_limited' = 'timeout', retryAfterMs?: number) =>
  new ProviderError(kind, kind, { provider: 'p', ...(retryAfterMs === undefined ? {} : { retryAfterMs }) });

describe('withRetries — bounded attempts under one total deadline', () => {
  it('retries only retryable failures, at most 1 + maxRetries times, with exponential backoff', async () => {
    const env = fakeEnv();
    let n = 0;
    await expect(withRetries({ maxRetries: 2, deadlineMs: 60_000 }, env, 'p', async () => { n += 1; throw transient(); })).rejects.toMatchObject({ kind: 'timeout' });
    expect([n, env.sleeps]).toEqual([3, [250, 500]]);
    n = 0;
    await expect(withRetries({ maxRetries: 3, deadlineMs: 60_000 }, env, 'p', async () => { n += 1; throw new ProviderRejectedError('400', { provider: 'p', status: 400 }); })).rejects.toBeInstanceOf(ProviderRejectedError);
    expect(n).toBe(1);
    n = 0;
    await expect(withRetries({ maxRetries: 3, deadlineMs: 60_000 }, env, 'p', async () => { n += 1; throw new TypeError('bug'); })).rejects.toBeInstanceOf(TypeError);
    expect(n).toBe(1);
  });
  it('honours Retry-After and returns the first success', async () => {
    const env = fakeEnv();
    let n = 0;
    const r = await withRetries({ maxRetries: 1, deadlineMs: 60_000 }, env, 'p', async () => { n += 1; if (n === 1) throw transient('rate_limited', 2_000); return 'ok'; });
    expect([r, env.sleeps]).toEqual(['ok', [2_000]]);
  });
  it('each attempt gets the time remaining; a wait that would cross the deadline is not taken', async () => {
    const env = fakeEnv();
    const seen: number[] = [];
    const e = await withRetries({ maxRetries: 3, deadlineMs: 1_000 }, env, 'p', async (remaining) => { seen.push(remaining); env.advance(400); throw transient('rate_limited', 300); }).catch((x: unknown) => x);
    // attempt 1 at t0 (1000 left) → +400 → wait 300 → attempt 2 (300 left) → +400 → past deadline
    expect(seen).toEqual([1_000, 300]);
    expect(e).toBeInstanceOf(ProviderDeadlineExceededError);
    expect((e as ProviderError).retryable).toBe(false);
    expect((e as Error & { cause?: unknown }).cause).toMatchObject({ kind: 'rate_limited' });
  });
  it('rejects invalid policies', () => {
    expect(() => assertRetryPolicy({ maxRetries: 4, deadlineMs: 1 }, 'p')).toThrow(/0\.\.3/);
    expect(() => assertRetryPolicy({ maxRetries: 1.5, deadlineMs: 1 }, 'p')).toThrow(/0\.\.3/);
    expect(() => assertRetryPolicy({ maxRetries: 1, deadlineMs: 0 }, 'p')).toThrow(/deadlineMs/);
  });
});

describe('AIProvider contract', () => {
  const schema = { type: 'object', properties: { regime: { enum: ['trend', 'range'] } }, required: ['regime'] } as const;

  it('structuredOutput re-validates; invalid JSON or schema violations are SCHEMA_INVALID, never a default', async () => {
    const ok = await new ScriptedProvider({ script: [{ content: '```json\n{"regime":"range"}\n```' }] }).structuredOutput(MSGS, schema);
    expect(ok).toEqual({ regime: 'range' });
    for (const bad of ['nope', '{"regime":"moon"}', '{"regime":"trend","placeOrder":true}']) {
      const e = await new ScriptedProvider({ script: [{ content: bad }] }).structuredOutput(MSGS, schema).catch((x: unknown) => x);
      expect((e as AgentError).code, bad).toBe('SCHEMA_INVALID');
    }
    await expect(new ScriptedProvider({ script: [] }).structuredOutput(MSGS, { type: 'object', oneOf: [] } as never)).rejects.toMatchObject({ code: 'CONFIG' });
  });

  it('structuredOutput asks for JSON mode, drops tools and meters usage before validation', async () => {
    const p = new ScriptedProvider({ script: [{ content: '{"regime":"trend"}', usage: { inputTokens: 3, outputTokens: 4, costMicroUsd: 7n } }] });
    const metered: bigint[] = [];
    await p.structuredOutput(MSGS, schema, { tools: [{}], onUsage: (r) => { metered.push(r.usage.costMicroUsd ?? -1n); } });
    expect(p.calls[0]?.opts).toMatchObject({ jsonMode: true, tools: undefined });
    expect(metered).toEqual([7n]);
  });

  it('default stream yields one chunk whose final carries model, generation id and usage', async () => {
    const p = new ScriptedProvider({ script: [{ content: 'abc', model: 'm/served', generationId: 'gen-9', usage: { inputTokens: 1, outputTokens: 2, costMicroUsd: 5n } }] });
    const chunks = [];
    for await (const c of p.stream(MSGS)) chunks.push(c);
    expect(chunks).toEqual([{ delta: 'abc', final: { usage: { inputTokens: 1, outputTokens: 2, costMicroUsd: 5n }, model: 'm/served', generationId: 'gen-9', provider: 'scripted', upstreamProvider: null } }]);
  });

  it('reason() is chat flagged as reasoning; an exhausted script is a typed provider error', async () => {
    const p = new ScriptedProvider({ script: [{ content: 'x' }] });
    await p.reason(MSGS, { model: 'm' });
    expect(p.calls[0]?.opts).toMatchObject({ reasoning: true, model: 'm' });
    await expect(p.chat(MSGS)).rejects.toBeInstanceOf(ProviderError);
    expect(new ScriptedProvider()).toBeInstanceOf(AIProvider);
  });
});
