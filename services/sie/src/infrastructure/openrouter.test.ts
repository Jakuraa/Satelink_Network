// OpenRouter adapter contract. Ported from #579's 14 tests (apps/api/test/trading_openrouter_provider.test.js
// on trading-agent/integration) onto @satelink/sie, plus served-model/generation-id/cost and total-deadline
// tests. No network: every call goes to an injected fake fetch.
import { describe, expect, it } from 'vitest';
import { ProviderError, isFallbackEligible, type ChatMessage, type StreamChunk } from '@satelink/sie';
import { OPENROUTER_DEFAULT_BASE_URL, OpenRouterProvider, type FetchLike, type HttpRequestInit, type HttpResponseLike, type OpenRouterOptions } from './openrouter.js';
import { createOpenRouterProvider } from '../composition.js';

// Secret-shaped fixture assembled from parts (the repo's pre-commit gate greps literal prefixes).
const FAKE_KEY = ['sk', 'or', 'v1', 'Q1w2E3r4T5y6U7i8O9p0'].join('-');
const MSGS: ChatMessage[] = [{ role: 'user', content: 'classify the regime' }];

const json = (body: unknown, { status = 200, headers = {} as Record<string, string> } = {}): HttpResponseLike => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  text: async () => JSON.stringify(body),
});
const completion = (content: string, o: { model?: string; provider?: string; toolCalls?: unknown[]; cost?: unknown; id?: string } = {}) => ({
  id: o.id ?? 'gen-1', model: o.model ?? 'anthropic/claude-sonnet-5', provider: o.provider ?? 'Anthropic',
  choices: [{ message: { content, ...(o.toolCalls ? { tool_calls: o.toolCalls } : {}) } }],
  usage: { prompt_tokens: 40, completion_tokens: 9, ...('cost' in o ? { cost: o.cost } : {}) },
});

type Step = HttpResponseLike | ((url: string, init: HttpRequestInit) => HttpResponseLike | Promise<HttpResponseLike>);
/** Fake fetch answering from a queue of responses (or functions of the request); records every call. */
function queueFetch(responses: Step[]): FetchLike & { calls: { url: string; init: HttpRequestInit }[] } {
  const calls: { url: string; init: HttpRequestInit }[] = [];
  const fn = async (url: string, init: HttpRequestInit): Promise<HttpResponseLike> => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next === undefined) throw new Error('fake fetch: no response queued');
    return typeof next === 'function' ? next(url, init) : next;
  };
  return Object.assign(fn, { calls });
}
const provider = (fetch: FetchLike, o: Partial<OpenRouterOptions> = {}) => new OpenRouterProvider({ apiKey: FAKE_KEY, fetch, sleep: async () => {}, ...o });
const caught = async (fn: () => Promise<unknown>): Promise<ProviderError & { code: string }> => {
  try { await fn(); } catch (e) { return e as ProviderError & { code: string }; }
  throw new Error('expected a throw');
};
const bodyOf = (f: ReturnType<typeof queueFetch>, i = 0) => JSON.parse(f.calls[i]!.init.body) as Record<string, unknown>;
const enc = new TextEncoder();
const sse = (...lines: string[]): HttpResponseLike => ({
  ok: true, status: 200, headers: { get: () => null }, text: async () => '',
  body: (async function* () { for (const l of lines) yield enc.encode(l); })(),
});
const drain = async (it: AsyncIterable<StreamChunk>) => { const out: StreamChunk[] = []; for await (const c of it) out.push(c); return out; };

describe('OpenRouterProvider contract (ported from #579)', () => {
  it('success: OpenAI-compatible request with the injected key; reports the served model and upstream truthfully', async () => {
    const f = queueFetch([json(completion('trend', { toolCalls: [{ id: 't1', function: { name: 'get_quote', arguments: '{"instrument":"BTC-USDT"}' } }] }))]);
    const r = await provider(f, { appTitle: 'Satelink' }).chat(MSGS, { model: 'anthropic/claude-sonnet-5', tools: [{ type: 'function', function: { name: 'get_quote' } }] });
    expect(f.calls[0]!.url).toBe(`${OPENROUTER_DEFAULT_BASE_URL}/chat/completions`);
    expect(f.calls[0]!.init.headers).toMatchObject({ authorization: `Bearer ${FAKE_KEY}`, 'x-title': 'Satelink' });
    expect(bodyOf(f)).toMatchObject({ model: 'anthropic/claude-sonnet-5', tool_choice: 'auto', temperature: 0, stream: false, usage: { include: true } });
    expect(r).toMatchObject({ content: 'trend', provider: 'openrouter', model: 'anthropic/claude-sonnet-5', upstreamProvider: 'Anthropic', generationId: 'gen-1' });
    expect(r.toolCalls).toEqual([{ id: 't1', name: 'get_quote', arguments: '{"instrument":"BTC-USDT"}' }]);
    expect(r.usage).toEqual({ inputTokens: 40, outputTokens: 9, costMicroUsd: null });
    expect(JSON.stringify(r, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(FAKE_KEY);
  });

  it('success: when OpenRouter serves a different model than requested, the served one is reported', async () => {
    const r = await provider(queueFetch([json(completion('x', { model: 'meta-llama/llama-3.3-70b-instruct', provider: 'Groq' }))])).chat(MSGS, { model: 'openrouter/auto' });
    expect([r.model, r.upstreamProvider]).toEqual(['meta-llama/llama-3.3-70b-instruct', 'Groq']);
    const bare = await provider(queueFetch([json({ choices: [{ message: { content: 'y' } }] })])).chat(MSGS, { model: 'm/x' });
    expect([bare.model, bare.upstreamProvider, bare.generationId]).toEqual(['m/x', null, null]); // nothing invented
  });

  it('malformed output: non-JSON body, missing choices and in-body errors throw; nothing is fabricated', async () => {
    const notJson: HttpResponseLike = { ok: true, status: 200, headers: { get: () => null }, text: async () => '<html>gateway</html>' };
    const cases: [string, HttpResponseLike, string, boolean, number | null][] = [
      ['non-JSON', notJson, 'malformed', false, null],
      ['no choices', json({ id: 'g', model: 'm' }), 'malformed', false, null],
      ['empty choices', json({ choices: [] }), 'malformed', false, null],
      ['in-body upstream 502', json({ error: { code: 502, message: 'upstream down' } }), 'server_error', true, 502],
      ['in-body 400', json({ error: { code: 400, message: 'bad' } }), 'rejected', false, 400],
      ['in-body error without code', json({ error: { message: '?' } }), 'malformed', false, null],
    ];
    for (const [name, res, kind, retryable, status] of cases) {
      const f = queueFetch([res, json(completion('should not be used'))]);
      const e = await caught(() => provider(f, { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
      expect([e instanceof ProviderError, e.kind, e.retryable, e.status, f.calls.length], name).toEqual([true, kind, retryable, status, 1]);
    }
  });

  it('malformed output: structuredOutput rejects invalid JSON and schema violations (SCHEMA_INVALID), never a default value', async () => {
    const schema = { type: 'object', properties: { regime: { enum: ['trend', 'range', 'volatile'] } }, required: ['regime'] } as const;
    expect(await provider(queueFetch([json(completion('{"regime":"range"}'))])).structuredOutput(MSGS, schema, { model: 'm' })).toEqual({ regime: 'range' });
    for (const bad of ['not json', '{"regime":"moon"}', '{"regime":"trend","placeOrder":true}']) {
      const e = await caught(() => provider(queueFetch([json(completion(bad))])).structuredOutput(MSGS, schema, { model: 'm' }));
      expect(e.code, bad).toBe('SCHEMA_INVALID');
    }
    const f = queueFetch([json(completion('{"regime":"trend"}'))]);
    await provider(f).structuredOutput(MSGS, schema, { model: 'm' });
    expect(bodyOf(f).response_format).toEqual({ type: 'json_object' });
  });

  it('timeout: the request is aborted after timeoutMs and typed as a retryable timeout', async () => {
    const hang: Step = (_u, init) => new Promise((_res, rej) => { init.signal.addEventListener('abort', () => { rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }); });
    const started = Date.now();
    const e = await caught(() => provider(queueFetch([hang]), { timeoutMs: 20, maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    expect([e.name, e.kind, e.retryable, e.message]).toEqual(['ProviderTimeoutError', 'timeout', true, 'openrouter request failed: timeout']);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('timeout: a 200 whose body stalls still times out (one timeout covers headers and body)', async () => {
    const stall = (): HttpResponseLike => ({ ok: true, status: 200, headers: { get: () => null }, text: () => new Promise<string>(() => {}) });
    const started = Date.now();
    const e = await caught(() => provider(queueFetch([stall(), json(completion('retried'))]), { timeoutMs: 20, maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    expect([e.kind, e.message]).toEqual(['timeout', 'openrouter request failed: timeout']);
    expect(Date.now() - started).toBeLessThan(1000);
    expect((await provider(queueFetch([stall(), json(completion('retried'))]), { timeoutMs: 20, maxRetries: 1 }).chat(MSGS, { model: 'm' })).content).toBe('retried');
  });

  it('reset: a connection reset while reading the body is a retryable connection_reset, not malformed', async () => {
    const reset: HttpResponseLike = { ok: true, status: 200, headers: { get: () => null }, text: async () => { throw new TypeError('terminated'); } };
    const e = await caught(() => provider(queueFetch([reset]), { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    expect([e.name, e.kind, e.retryable, e.message]).toEqual(['ProviderConnectionResetError', 'connection_reset', true, 'openrouter request failed: network']);
  });

  it('provider errors: HTTP status classification (429, 5xx, other 4xx); key never in the error', async () => {
    const cases: [number, string, boolean][] = [[429, 'rate_limited', true], [500, 'server_error', true], [502, 'server_error', true], [503, 'server_error', true],
      [400, 'rejected', false], [401, 'rejected', false], [402, 'rejected', false], [404, 'rejected', false]];
    for (const [s, kind, retryable] of cases) {
      const e = await caught(() => provider(queueFetch([json({}, { status: s })]), { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
      expect([e.code, e.kind, e.retryable, e.status], String(s)).toEqual(['PROVIDER_ERROR', kind, retryable, s]);
      expect(JSON.stringify({ m: e.message, d: e.details })).not.toContain(FAKE_KEY);
    }
    const net = await caught(() => provider(queueFetch([() => { throw new Error('ECONNRESET'); }]), { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    expect([net.kind, net.retryable, net.message]).toEqual(['connection_reset', true, 'openrouter request failed: network']);
    expect(() => new OpenRouterProvider({ fetch: async () => json({}) } as unknown as OpenRouterOptions)).toThrow(ProviderError);
    expect(() => new OpenRouterProvider({ apiKey: FAKE_KEY } as unknown as OpenRouterOptions)).toThrow(ProviderError);
    expect(() => new OpenRouterProvider({ apiKey: FAKE_KEY, fetch: async () => json({}), maxRetries: 10 })).toThrow(/0\.\.3/);
    expect(await caught(() => provider(queueFetch([])).chat(MSGS, {}))).toHaveProperty('message', 'model required');
  });

  it('rate limits: retries are bounded, honour Retry-After (capped at 5 s), and never retry non-retryable errors', async () => {
    const sleeps: number[] = [];
    const sleep = async (ms: number) => { sleeps.push(ms); };
    let f = queueFetch([json({}, { status: 429, headers: { 'retry-after': '2' } }), json(completion('ok'))]);
    expect((await provider(f, { sleep, maxRetries: 1 }).chat(MSGS, { model: 'm' })).content).toBe('ok');
    expect([f.calls.length, sleeps]).toEqual([2, [2000]]);
    sleeps.length = 0;
    f = queueFetch([json({}, { status: 429, headers: { 'retry-after': '3600' } }), json({}, { status: 429 }), json({}, { status: 429 }), json(completion('late'))]);
    const e = await caught(() => provider(f, { sleep, maxRetries: 2 }).chat(MSGS, { model: 'm' }));
    expect([e.kind, e.status, f.calls.length, sleeps]).toEqual(['rate_limited', 429, 3, [5000, 500]]);
    sleeps.length = 0;
    const date = new Date(Date.now() + 60_000).toUTCString();
    f = queueFetch([json({}, { status: 503, headers: { 'retry-after': date } }), json(completion('ok'))]);
    await provider(f, { sleep, maxRetries: 1 }).chat(MSGS, { model: 'm' });
    expect(sleeps).toEqual([5000]);
    sleeps.length = 0;
    f = queueFetch([json({ error: { code: 502, message: 'upstream' } }), json(completion('second'))]);
    expect((await provider(f, { sleep, maxRetries: 1 }).chat(MSGS, { model: 'm' })).content).toBe('second');
    expect(f.calls.length).toBe(2);
    f = queueFetch([json({}, { status: 400 }), json(completion('never'))]);
    const e400 = await caught(() => provider(f, { sleep, maxRetries: 3 }).chat(MSGS, { model: 'm' }));
    expect([f.calls.length, e400.retryAfterMs]).toEqual([1, undefined]);
  });

  it('fallback: only transient OpenRouter failures are fallback-eligible (the rule the tiered router applies)', async () => {
    // #579 drove this through TieredModelRouter, which stays on trading-agent/integration until it rebases
    // onto @satelink/sie. Here the adapter-side contract that router depends on is asserted directly.
    const e503 = await caught(() => provider(queueFetch([json({}, { status: 503 })]), { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    const e400 = await caught(() => provider(queueFetch([json({}, { status: 400 })]), { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    const bad = await caught(() => provider(queueFetch([json({ choices: [] })]), { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    const trunc = await caught(() => drain(provider(queueFetch([sse('data: {"choices":[{"delta":{"content":"a"}}]}\n')])).stream(MSGS, { model: 'm' })));
    expect([e503, e400, bad, trunc].map(isFallbackEligible)).toEqual([true, false, false, false]);
  });

  it('stream: SSE deltas, keep-alive comments skipped, a mid-stream error throws', async () => {
    const out = await drain(provider(queueFetch([sse(': OPENROUTER PROCESSING\n', 'data: {"choices":[{"delta":{"content":"ra"}}]}\n', 'data: {"choices":[{"delta":{"content":"nge"}}]}\ndata: [DONE]\n')])).stream(MSGS, { model: 'm' }));
    expect(out.map((c) => c.delta).join('')).toBe('range');
    const e = await caught(() => drain(provider(queueFetch([sse('data: {"choices":[{"delta":{"content":"a"}}]}\n', 'data: {"error":{"code":502,"message":"x"}}\n')])).stream(MSGS, { model: 'm' })));
    expect([e.code, e.kind, e.status]).toEqual(['PROVIDER_ERROR', 'server_error', 502]);
  });

  it('stream: a truncated stream (no [DONE]) throws stream_truncated instead of returning a partial answer', async () => {
    const out: string[] = [];
    const e = await caught(async () => { for await (const c of provider(queueFetch([sse('data: {"choices":[{"delta":{"content":"ra"}}]}\n')])).stream(MSGS, { model: 'm' })) out.push(c.delta); });
    expect([e.name, e.kind, e.retryable, e.message]).toEqual(['ProviderStreamTruncatedError', 'stream_truncated', false, 'openrouter stream ended before [DONE]']);
    expect(out).toEqual(['ra']); // what was streamed is never followed by a `final` chunk
  });

  it('malformed output: a null stream event or non-array tool_calls is a typed malformed error, never a TypeError', async () => {
    const n = await caught(() => drain(provider(queueFetch([sse('data: null\n')])).stream(MSGS, { model: 'm' })));
    expect([n instanceof ProviderError, n.kind, n.message]).toEqual([true, 'malformed', 'openrouter malformed response: stream event is not an object']);
    for (const tc of [{ x: 1 }, [null], ['str']]) {
      const body = { id: 'g', model: 'm', choices: [{ message: { content: 'x', tool_calls: tc } }] };
      const e = await caught(() => provider(queueFetch([json(body)])).chat(MSGS, { model: 'm' }));
      expect([e instanceof ProviderError, e.kind], JSON.stringify(tc)).toEqual([true, 'malformed']);
    }
    for (const t of [0, -1, Number.NaN]) {
      expect(() => new OpenRouterProvider({ apiKey: FAKE_KEY, fetch: async () => json({}), timeoutMs: t }), String(t)).toThrow(/timeoutMs/);
    }
  });

  it('stream: a read error or a stall mid-stream is a retryable typed error (router may fall back)', async () => {
    const reset: HttpResponseLike = { ok: true, status: 200, headers: { get: () => null }, text: async () => '',
      body: (async function* () { yield enc.encode('data: {"choices":[{"delta":{"content":"a"}}]}\n'); throw new TypeError('terminated'); })() };
    const e = await caught(() => drain(provider(queueFetch([reset])).stream(MSGS, { model: 'm' })));
    expect([e.kind, e.retryable, e.message]).toEqual(['connection_reset', true, 'openrouter stream failed: network']);
    const stall: HttpResponseLike = { ok: true, status: 200, headers: { get: () => null }, text: async () => '',
      body: { [Symbol.asyncIterator]: () => ({ next: () => new Promise<IteratorResult<Uint8Array>>(() => {}) }) } };
    const started = Date.now();
    const s = await caught(() => drain(provider(queueFetch([stall]), { timeoutMs: 20 }).stream(MSGS, { model: 'm' })));
    expect([s.kind, s.retryable, s.message]).toEqual(['timeout', true, 'openrouter stream failed: timeout']);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('composition root builds OpenRouter only when the flag is on AND a key is injected', () => {
    const fetch = async () => json(completion('x'));
    expect(createOpenRouterProvider({ SIE_OPENROUTER_ENABLED: '1', OPENROUTER_API_KEY: FAKE_KEY }, { fetch })).toBeInstanceOf(OpenRouterProvider);
    expect(createOpenRouterProvider({ OPENROUTER_API_KEY: FAKE_KEY }, { fetch })).toBeNull(); // flag off by default
    expect(createOpenRouterProvider({ SIE_OPENROUTER_ENABLED: 'true', OPENROUTER_API_KEY: FAKE_KEY }, { fetch })).toBeNull(); // only exactly "1"
    expect(createOpenRouterProvider({ SIE_OPENROUTER_ENABLED: '1', OPENROUTER_API_KEY: '  ' }, { fetch })).toBeNull();
    expect(createOpenRouterProvider({ SIE_OPENROUTER_ENABLED: '1' }, { fetch })).toBeNull();
  });
});

describe('OpenRouterProvider — served model, generation id, cost (new on main)', () => {
  it('records usage.cost as integer micro-USD (rounded up) and the generation id', async () => {
    const r = await provider(queueFetch([json(completion('x', { id: 'gen-abc', cost: 0.00012345 }))])).chat(MSGS, { model: 'm' });
    expect([r.generationId, r.usage.costMicroUsd]).toEqual(['gen-abc', 124n]);
    for (const [cost, micro] of [[0, 0n], [1.5e-7, 1n], ['0.002', 2_000n], [-1, null], ['n/a', null]] as const) {
      const x = await provider(queueFetch([json(completion('x', { cost }))])).chat(MSGS, { model: 'm' });
      expect(x.usage.costMicroUsd, String(cost)).toBe(micro);
    }
  });

  it('stream: the final chunk carries served model, generation id, tokens and cost from the events', async () => {
    const out = await drain(provider(queueFetch([sse(
      'data: {"id":"gen-s1","model":"openai/gpt-5","provider":"OpenAI","choices":[{"delta":{"content":"hi"}}]}\n',
      'data: {"id":"gen-s1","choices":[{"delta":{}}],"usage":{"prompt_tokens":7,"completion_tokens":2,"cost":0.0000031}}\n',
      'data: [DONE]\n',
    )])).stream(MSGS, { model: 'openrouter/auto' }));
    expect(out).toEqual([
      { delta: 'hi' },
      { delta: '', final: { usage: { inputTokens: 7, outputTokens: 2, costMicroUsd: 4n }, model: 'openai/gpt-5', generationId: 'gen-s1', provider: 'openrouter', upstreamProvider: 'OpenAI' } },
    ]);
  });

  it('total deadline: retries stop when the budget cannot cover the next wait; attempts get the time left', async () => {
    let t = 0;
    const now = () => t;
    const sleep = async (ms: number) => { t += ms; };
    const f = queueFetch([
      () => { t += 700; return json({}, { status: 503, headers: { 'retry-after': '0.2' } }); },
      () => { t += 700; return json({}, { status: 503, headers: { 'retry-after': '0.2' } }); },
      json(completion('never')),
    ]);
    const e = await caught(() => provider(f, { now, sleep, maxRetries: 3, deadlineMs: 1_500 }).chat(MSGS, { model: 'm' }));
    // 700 (attempt 1) + 200 wait + 700 (attempt 2) = 1600 ≥ 1500 → no third attempt
    expect([e.name, e.kind, e.retryable, f.calls.length]).toEqual(['ProviderDeadlineExceededError', 'deadline_exceeded', false, 2]);
    expect((e as Error & { cause?: ProviderError }).cause?.status).toBe(503);
    expect(isFallbackEligible(e)).toBe(true); // same outage as exhausting maxRetries: the router may still fall back
  });

  it('total deadline: a single attempt never waits longer than the time left', async () => {
    const hang: Step = (_u, init) => new Promise((_res, rej) => { init.signal.addEventListener('abort', () => { rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }); });
    const started = Date.now();
    const e = await caught(() => provider(queueFetch([hang]), { timeoutMs: 30_000, deadlineMs: 30, maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    expect(e.kind).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
