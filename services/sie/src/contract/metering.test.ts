import { describe, expect, it } from 'vitest';
import { InMemoryUsageSink, ProviderError, ScriptedProvider, withMetering, type ChatMessage } from './index.js';

const MSGS: ChatMessage[] = [{ role: 'user', content: 'hi' }];
const clock = () => { let t = 1_000; return () => (t += 10); };
const ok = { content: 'x', model: 'anthropic/claude-sonnet-5', generationId: 'gen-1', usage: { inputTokens: 12, outputTokens: 3, costMicroUsd: 77n } };

describe('SIE metering — exactly one usage_event per request', () => {
  it('success: served model, generation id, tokens and cost come from the provider result', async () => {
    const sink = new InMemoryUsageSink();
    await withMetering(new ScriptedProvider({ id: 'openrouter', script: [ok] }), { sink, idempotencyKey: 'req-1', now: clock() }).chat(MSGS, { model: 'openrouter/auto' });
    expect(sink.events).toEqual([{
      idempotencyKey: 'req-1', provider: 'openrouter', servedModel: 'anthropic/claude-sonnet-5', generationId: 'gen-1',
      inputTokens: 12, outputTokens: 3, costMicroUsd: 77n, status: 'ok', errorKind: null, startedAt: 1_010, finishedAt: 1_020,
    }]);
  });

  it('failure: one error event with the typed kind, no invented cost or model; the error still propagates', async () => {
    const sink = new InMemoryUsageSink();
    const err = new ProviderError('rate_limited', '429', { provider: 'openrouter', status: 429 });
    await expect(withMetering(new ScriptedProvider({ id: 'openrouter', script: [err] }), { sink, idempotencyKey: 'req-2' }).chat(MSGS)).rejects.toBe(err);
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({ status: 'error', errorKind: 'rate_limited', servedModel: null, costMicroUsd: null, inputTokens: 0 });
  });

  it('a retried request (same idempotency key) is never metered twice', async () => {
    const sink = new InMemoryUsageSink();
    for (let i = 0; i < 3; i++) await withMetering(new ScriptedProvider({ script: [ok] }), { sink, idempotencyKey: 'req-3' }).chat(MSGS);
    expect(sink.events).toHaveLength(1);
  });

  it('one wrapper serves exactly one request', async () => {
    const sink = new InMemoryUsageSink();
    const p = withMetering(new ScriptedProvider({ script: [ok, ok] }), { sink, idempotencyKey: 'req-4' });
    await p.chat(MSGS);
    await expect(p.chat(MSGS)).rejects.toMatchObject({ code: 'CONFIG' });
    expect(sink.events).toHaveLength(1);
    expect(() => withMetering(new ScriptedProvider(), { sink, idempotencyKey: '' })).toThrow(/idempotencyKey/);
  });

  it('structuredOutput is metered once (it goes through chat)', async () => {
    const sink = new InMemoryUsageSink();
    await withMetering(new ScriptedProvider({ script: [{ ...ok, content: '{"a":1}' }] }), { sink, idempotencyKey: 'req-5' })
      .structuredOutput(MSGS, { type: 'object', properties: { a: { type: 'integer' } }, required: ['a'] });
    expect(sink.events.map((e) => [e.status, e.costMicroUsd])).toEqual([['ok', 77n]]);
  });

  it('stream: one ok event from the final chunk; an abandoned or failing stream is one error event', async () => {
    const sink = new InMemoryUsageSink();
    for await (const _c of withMetering(new ScriptedProvider({ script: [ok] }), { sink, idempotencyKey: 's-ok' }).stream(MSGS));
    const it = withMetering(new ScriptedProvider({ script: [ok] }), { sink, idempotencyKey: 's-break' }).stream(MSGS);
    for await (const _c of it) break; // consumer stops early
    await expect((async () => { for await (const _c of withMetering(new ScriptedProvider({ script: [new ProviderError('server_error', '503', { provider: 'p' })] }), { sink, idempotencyKey: 's-err' }).stream(MSGS)); })()).rejects.toBeInstanceOf(ProviderError);
    expect(sink.events.map((e) => [e.idempotencyKey, e.status, e.errorKind])).toEqual([
      ['s-ok', 'ok', null], ['s-break', 'error', 'PROVIDER_ERROR'], ['s-err', 'error', 'server_error'],
    ]);
  });
});
