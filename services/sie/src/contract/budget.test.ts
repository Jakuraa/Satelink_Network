import { describe, expect, it } from 'vitest';
import { AgentError, ScriptedProvider, BudgetExceededError, withBudget, priceEstimator, upperBoundInputTokens, type ChatMessage } from './index.js';

const MSGS: ChatMessage[] = [{ role: 'user', content: 'x'.repeat(184) }]; // (184 + 16) / 2 = 100 tokens
const PRICE = { inputPerMTokMicroUsd: 3_000_000n, outputPerMTokMicroUsd: 15_000_000n }; // $3 / $15 per 1M
// estimate = ceil((100 × 3,000,000 + 1,000 × 15,000,000) / 1,000,000) = ceil(15,300,000,000 / 1e6) = 15,300 micro
const EST_1000 = 15_300n;

describe('SIE budget check — refuse before the provider call', () => {
  it('the estimator is an integer upper bound (ceil), pricing output at the full max_tokens', () => {
    expect(upperBoundInputTokens(MSGS)).toBe(100n);
    expect(priceEstimator(PRICE)(MSGS, { maxTokens: 1000 })).toBe(EST_1000);
    expect(priceEstimator({ inputPerMTokMicroUsd: 1n, outputPerMTokMicroUsd: 0n })([{ role: 'user', content: '' }], { maxTokens: 1 })).toBe(1n); // ceil, never 0
  });

  it('over the hold: typed BUDGET_EXCEEDED and the provider is never called', async () => {
    const inner = new ScriptedProvider({ script: [{ content: 'never' }] });
    const p = withBudget(inner, { holdMicroUsd: EST_1000 - 1n, estimate: priceEstimator(PRICE) });
    const e = await p.chat(MSGS, { maxTokens: 1000 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(BudgetExceededError);
    expect([(e as BudgetExceededError).code, (e as BudgetExceededError).estimateMicroUsd, (e as BudgetExceededError).holdMicroUsd]).toEqual(['BUDGET_EXCEEDED', EST_1000, EST_1000 - 1n]);
    await expect(p.reason(MSGS, { maxTokens: 1000 })).rejects.toBeInstanceOf(BudgetExceededError);
    await expect(p.structuredOutput(MSGS, { type: 'object' }, { maxTokens: 1000 })).rejects.toBeInstanceOf(BudgetExceededError);
    const s = (async () => { for await (const _c of p.stream(MSGS, { maxTokens: 1000 })); })();
    await expect(s).rejects.toBeInstanceOf(BudgetExceededError);
    expect(inner.calls).toHaveLength(0);
  });

  it('at or under the hold: the call goes through unchanged', async () => {
    const inner = new ScriptedProvider({ script: [{ content: 'ok', model: 'm/served' }] });
    const r = await withBudget(inner, { holdMicroUsd: EST_1000, estimate: priceEstimator(PRICE) }).chat(MSGS, { maxTokens: 1000, model: 'm' });
    expect([r.content, r.model, inner.calls.length]).toEqual(['ok', 'm/served', 1]);
  });

  it('structuredOutput is checked with the schema instruction included (a bigger prompt)', async () => {
    const inner = new ScriptedProvider({ script: [{ content: '{}' }] });
    const est = priceEstimator(PRICE);
    const bare = est(MSGS, { maxTokens: 10 });
    // enough for the bare prompt, not for the prompt + schema instruction
    const p = withBudget(inner, { holdMicroUsd: bare, estimate: est });
    await expect(p.structuredOutput(MSGS, { type: 'object' }, { maxTokens: 10 })).rejects.toBeInstanceOf(BudgetExceededError);
    expect(inner.calls).toHaveLength(0);
  });

  it('rejects a bad hold or estimator as CONFIG, never as a pass', async () => {
    const inner = new ScriptedProvider({ script: [{ content: 'never' }] });
    expect(() => withBudget(inner, { holdMicroUsd: -1n, estimate: () => 0n })).toThrow(AgentError);
    expect(() => withBudget(inner, { holdMicroUsd: 5 as unknown as bigint, estimate: () => 0n })).toThrow(/bigint/);
    const bad = withBudget(inner, { holdMicroUsd: 10n, estimate: () => -1n });
    await expect(bad.chat(MSGS)).rejects.toMatchObject({ code: 'CONFIG' });
    expect(inner.calls).toHaveLength(0);
  });
});
