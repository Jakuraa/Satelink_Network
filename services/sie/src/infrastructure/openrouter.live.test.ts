// OPT-IN live contract test against the real OpenRouter API. Never runs in CI: the default projects
// exclude *.live.test.ts, and the suite also skips unless BOTH SIE_LIVE_CONTRACT=1 and
// OPENROUTER_API_KEY are set. Costs real money (one short call; max_tokens 16).
//
//   SIE_LIVE_CONTRACT=1 OPENROUTER_API_KEY=… SIE_LIVE_MODEL=<provider/model> \
//     npx vitest run --project sie-live
//
// Prints served model, generation id, tokens and cost (micro-USD) for docs/build/evidence/.
// The key is read here (a test composition root) and handed to the adapter; it is never printed.
import { describe, expect, it } from 'vitest';
import { createOpenRouterProvider } from '../composition.js';

const enabled = process.env.SIE_LIVE_CONTRACT === '1' && Boolean(process.env.OPENROUTER_API_KEY);
const model = process.env.SIE_LIVE_MODEL ?? 'openai/gpt-4o-mini';

describe.skipIf(!enabled)('OpenRouter live contract (opt-in)', () => {
  it('chat: served model, generation id, token usage and integer micro-USD cost are reported', async () => {
    const p = createOpenRouterProvider(
      { SIE_OPENROUTER_ENABLED: '1', OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY },
      { fetch: globalThis.fetch as never, timeoutMs: 30_000, deadlineMs: 60_000, maxRetries: 1, appTitle: 'Satelink SIE live contract' },
    );
    expect(p).not.toBeNull();
    const r = await p!.chat([{ role: 'user', content: 'Reply with the single word: ok' }], { model, maxTokens: 16 });
    const evidence = {
      at: new Date().toISOString(), requested_model: model, served_model: r.model, generation_id: r.generationId,
      upstream_provider: r.upstreamProvider, input_tokens: r.usage.inputTokens, output_tokens: r.usage.outputTokens,
      cost_micro_usd: r.usage.costMicroUsd === null ? null : r.usage.costMicroUsd.toString(),
    };
    console.log(`SIE_LIVE_EVIDENCE ${JSON.stringify(evidence)}`);
    expect(r.generationId).toMatch(/\S/);
    expect(r.model).toMatch(/\S/);
    expect(r.usage.inputTokens).toBeGreaterThan(0);
    expect(r.usage.outputTokens).toBeGreaterThan(0);
    expect(typeof r.usage.costMicroUsd).toBe('bigint');
  }, 90_000);
});
