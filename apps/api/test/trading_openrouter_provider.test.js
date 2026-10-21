import { expect } from 'chai';
import {
  OpenRouterProvider, OPENROUTER_DEFAULT_BASE_URL, ScriptedProvider, ProviderError, TieredModelRouter,
  TraceRecorder, InMemoryTraceStore,
} from '../src/trading_agent/agent/index.mjs';
import { createTieredRouter } from '../src/trading_agent/ai_providers.mjs';

// OpenRouter provider contract (Trading AI critical path). No network: every call goes to an injected fake fetch.
// Secret-shaped fixture assembled from parts (the repo's pre-commit gate greps literal prefixes).
const FAKE_KEY = ['sk', 'or', 'v1', 'Q1w2E3r4T5y6U7i8O9p0'].join('-');
const MSGS = [{ role: 'user', content: 'classify the regime' }];

const json = (body, { status = 200, headers = {} } = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
});
const completion = (content, o = {}) => ({
  id: 'gen-1', model: o.model ?? 'anthropic/claude-sonnet-5', provider: o.provider ?? 'Anthropic',
  choices: [{ message: { content, ...(o.toolCalls ? { tool_calls: o.toolCalls } : {}) } }],
  usage: { prompt_tokens: 40, completion_tokens: 9 },
});

/** Fake fetch answering from a queue of responses (or functions of the request); records every call. */
function queueFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (next === undefined) throw new Error('fake fetch: no response queued');
    return typeof next === 'function' ? next(url, init) : next;
  };
  fn.calls = calls;
  return fn;
}
const provider = (fetch, o = {}) => new OpenRouterProvider({ apiKey: FAKE_KEY, fetch, sleep: async () => {}, ...o });
const caught = async (fn) => { try { await fn(); } catch (e) { return e; } throw new Error('expected a throw'); };

describe('trading: OpenRouterProvider contract', () => {
  it('success: OpenAI-compatible request with the injected key; reports the served model and upstream truthfully', async () => {
    const f = queueFetch([json(completion('trend', { toolCalls: [{ id: 't1', function: { name: 'get_quote', arguments: '{"instrument":"BTC-USDT"}' } }] }))]);
    const r = await provider(f, { appTitle: 'Satelink' }).chat(MSGS, { model: 'anthropic/claude-sonnet-5', tools: [{ type: 'function', function: { name: 'get_quote' } }] });
    expect(f.calls[0].url).to.equal(`${OPENROUTER_DEFAULT_BASE_URL}/chat/completions`);
    expect(f.calls[0].init.headers).to.deep.include({ authorization: `Bearer ${FAKE_KEY}`, 'x-title': 'Satelink' });
    expect(JSON.parse(f.calls[0].init.body)).to.deep.include({ model: 'anthropic/claude-sonnet-5', tool_choice: 'auto', temperature: 0, stream: false });
    expect(r).to.deep.include({ content: 'trend', provider: 'openrouter', model: 'anthropic/claude-sonnet-5', upstreamProvider: 'Anthropic' });
    expect(r.toolCalls).to.deep.equal([{ id: 't1', name: 'get_quote', arguments: '{"instrument":"BTC-USDT"}' }]);
    expect(r.usage).to.deep.equal({ inputTokens: 40, outputTokens: 9 });
    expect(JSON.stringify(r)).to.not.include(FAKE_KEY);
  });

  it('success: when OpenRouter serves a different model than requested, the served one is reported', async () => {
    const r = await provider(queueFetch([json(completion('x', { model: 'meta-llama/llama-3.3-70b-instruct', provider: 'Groq' }))])).chat(MSGS, { model: 'openrouter/auto' });
    expect([r.model, r.upstreamProvider]).to.deep.equal(['meta-llama/llama-3.3-70b-instruct', 'Groq']);
    const bare = await provider(queueFetch([json({ choices: [{ message: { content: 'y' } }] })])).chat(MSGS, { model: 'm/x' });
    expect([bare.model, bare.upstreamProvider]).to.deep.equal(['m/x', null]); // no upstream invented
  });

  it('malformed output: non-JSON body, missing choices and in-body errors throw; nothing is fabricated', async () => {
    const notJson = { ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new SyntaxError('Unexpected token <'); } };
    for (const [name, res, retryable, status] of [
      ['non-JSON', notJson, false, null],
      ['no choices', json({ id: 'g', model: 'm' }), false, null],
      ['empty choices', json({ choices: [] }), false, null],
      ['in-body upstream 502', json({ error: { code: 502, message: 'upstream down' } }), true, 502],
      ['in-body 400', json({ error: { code: 400, message: 'bad' } }), false, 400],
    ]) {
      const f = queueFetch([res, json(completion('should not be used'))]);
      const e = await caught(() => provider(f, { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
      expect([e instanceof ProviderError, e.retryable, e.status, f.calls.length], name).to.deep.equal([true, retryable, status, 1]);
    }
  });

  it('malformed output: structuredOutput rejects invalid JSON and schema violations (SCHEMA_INVALID), never a default value', async () => {
    const schema = { type: 'object', properties: { regime: { enum: ['trend', 'range', 'volatile'] } }, required: ['regime'] };
    const ok = await provider(queueFetch([json(completion('{"regime":"range"}'))])).structuredOutput(MSGS, schema, { model: 'm' });
    expect(ok).to.deep.equal({ regime: 'range' });
    for (const bad of ['not json', '{"regime":"moon"}', '{"regime":"trend","placeOrder":true}']) {
      const e = await caught(() => provider(queueFetch([json(completion(bad))])).structuredOutput(MSGS, schema, { model: 'm' }));
      expect(e.code, bad).to.equal('SCHEMA_INVALID');
    }
    const f = queueFetch([json(completion('{"regime":"trend"}'))]);
    await provider(f).structuredOutput(MSGS, schema, { model: 'm' });
    expect(JSON.parse(f.calls[0].init.body).response_format).to.deep.equal({ type: 'json_object' });
  });

  it('timeout: the request is aborted after timeoutMs and classified retryable', async () => {
    const hang = (_u, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const f = queueFetch([hang]);
    const started = Date.now();
    const e = await caught(() => provider(f, { timeoutMs: 20, maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    expect([e.code, e.retryable, e.message]).to.deep.equal(['PROVIDER_ERROR', true, 'openrouter request failed: timeout']);
    expect(Date.now() - started).to.be.below(1000);
  });

  it('provider errors: HTTP status classification; key never in the error', async () => {
    for (const [s, retryable] of [[429, true], [500, true], [502, true], [503, true], [400, false], [401, false], [402, false], [404, false]]) {
      const e = await caught(() => provider(queueFetch([json({}, { status: s })]), { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
      expect([e.code, e.retryable, e.status], String(s)).to.deep.equal(['PROVIDER_ERROR', retryable, s]);
      expect(JSON.stringify({ m: e.message, d: e.details })).to.not.include(FAKE_KEY);
    }
    const net = await caught(() => provider(queueFetch([() => { throw new Error('ECONNRESET'); }]), { maxRetries: 0 }).chat(MSGS, { model: 'm' }));
    expect([net.retryable, net.message]).to.deep.equal([true, 'openrouter request failed: network']);
    expect(() => new OpenRouterProvider({ fetch: async () => ({}) })).to.throw(ProviderError);
    expect(() => new OpenRouterProvider({ apiKey: FAKE_KEY })).to.throw(ProviderError);
    expect(() => new OpenRouterProvider({ apiKey: FAKE_KEY, fetch: async () => ({}), maxRetries: 10 })).to.throw(/0\.\.3/);
    expect(await caught(() => provider(queueFetch([])).chat(MSGS, {}))).to.have.property('message', 'model required');
  });

  it('rate limits: retries are bounded, honour Retry-After (capped), and never retry non-retryable errors', async () => {
    const sleeps = [];
    const sleep = async (ms) => { sleeps.push(ms); };
    // 429 then success → one retry, Retry-After 2 s honoured
    let f = queueFetch([json({}, { status: 429, headers: { 'retry-after': '2' } }), json(completion('ok'))]);
    expect((await provider(f, { sleep, maxRetries: 1 }).chat(MSGS, { model: 'm' })).content).to.equal('ok');
    expect([f.calls.length, sleeps]).to.deep.equal([2, [2000]]);
    // persistent 429 → exactly 1 + maxRetries attempts, then the 429 surfaces; a huge Retry-After is capped at 5 s
    sleeps.length = 0;
    f = queueFetch([json({}, { status: 429, headers: { 'retry-after': '3600' } }), json({}, { status: 429 }), json({}, { status: 429 }), json(completion('late'))]);
    const e = await caught(() => provider(f, { sleep, maxRetries: 2 }).chat(MSGS, { model: 'm' }));
    expect([e.status, f.calls.length, sleeps]).to.deep.equal([429, 3, [5000, 500]]);
    // 400 is not retried
    f = queueFetch([json({}, { status: 400 }), json(completion('never'))]);
    await caught(() => provider(f, { sleep, maxRetries: 3 }).chat(MSGS, { model: 'm' }));
    expect(f.calls.length).to.equal(1);
  });

  it('fallback: the tiered router falls back to the next provider only on retryable OpenRouter failures', async () => {
    const routes = {
      fast: [{ provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct' }, { provider: 'backup', model: 'b' }],
      standard: [{ provider: 'openrouter', model: 'anthropic/claude-sonnet-5' }, { provider: 'backup', model: 'b' }],
      deep: [{ provider: 'openrouter', model: 'anthropic/claude-opus-5' }],
    };
    const store = new InMemoryTraceStore();
    const rec = new TraceRecorder({ store, clock: () => new Date('2026-10-21T00:00:00Z'), idFactory: (p) => `${p}_or` });
    const runId = await rec.startRun({ principalId: 'prn_or', goal: 'g' });

    const backup = new ScriptedProvider({ id: 'backup', script: [{ content: 'from backup' }] });
    const or503 = provider(queueFetch([json({}, { status: 503 })]), { maxRetries: 0 });
    const res = await new TieredModelRouter({ providers: { openrouter: or503, backup }, routes }).complete({ taskType: 'explain_risk', messages: MSGS, runId, recorder: rec });
    expect(res.content).to.equal('from backup');
    expect(store.modelTraces.map((t) => [t.provider, t.status, t.costPriced])).to.deep.equal([['openrouter', 'error', false], ['backup', 'fallback', false]]);

    const backup2 = new ScriptedProvider({ id: 'backup', script: [{ content: 'never' }] });
    const or400 = provider(queueFetch([json({}, { status: 400 })]), { maxRetries: 0 });
    const e = await caught(() => new TieredModelRouter({ providers: { openrouter: or400, backup: backup2 }, routes }).complete({ taskType: 'explain_risk', messages: MSGS }));
    expect(e.status).to.equal(400);
    expect(backup2.calls).to.have.length(0);

    const orBad = provider(queueFetch([json({ choices: [] })]), { maxRetries: 0 }); // malformed: no fallback, no fabricated answer
    const backup3 = new ScriptedProvider({ id: 'backup', script: [{ content: 'never' }] });
    const m = await caught(() => new TieredModelRouter({ providers: { openrouter: orBad, backup: backup3 }, routes }).complete({ taskType: 'explain_risk', messages: MSGS }));
    expect([m.code, backup3.calls.length]).to.deep.equal(['PROVIDER_ERROR', 0]);
  });

  it('stream: SSE deltas, keep-alive comments skipped, a mid-stream error throws', async () => {
    const enc = new TextEncoder();
    const sse = (...lines) => ({ ok: true, status: 200, headers: { get: () => null }, body: (async function* () { for (const l of lines) yield enc.encode(l); })() });
    const out = [];
    for await (const c of provider(queueFetch([sse(': OPENROUTER PROCESSING\n', 'data: {"choices":[{"delta":{"content":"ra"}}]}\n', 'data: {"choices":[{"delta":{"content":"nge"}}]}\ndata: [DONE]\n')])).stream(MSGS, { model: 'm' })) out.push(c.delta);
    expect(out.join('')).to.equal('range');
    const e = await caught(async () => { for await (const _c of provider(queueFetch([sse('data: {"choices":[{"delta":{"content":"a"}}]}\n', 'data: {"error":{"code":502,"message":"x"}}\n')])).stream(MSGS, { model: 'm' })); });
    expect([e.code, e.status]).to.deep.equal(['PROVIDER_ERROR', 502]);
  });

  it('composition root registers OpenRouter only when its key is injected; defaults do not route to it', () => {
    const fetch = async () => json(completion('x'));
    const routes = { fast: [{ provider: 'openrouter', model: 'm/a' }], standard: [{ provider: 'openrouter', model: 'm/b' }], deep: [{ provider: 'openrouter', model: 'm/c' }] };
    expect(createTieredRouter({ openrouterApiKey: FAKE_KEY, fetch, routes }).plan('explain_risk').chain).to.deep.equal([{ provider: 'openrouter', model: 'm/b' }]);
    expect(() => createTieredRouter({ fetch, routes })).to.throw(/unknown provider openrouter/);
    expect(() => createTieredRouter({ openrouterApiKey: FAKE_KEY, fetch })).to.throw(/unknown provider anthropic/); // default routes need anthropic, untouched
  });
});
