// apps/api/test/model_router.test.js — Release A P2.3. Fixture mode + OpenRouter request/response contract
// with an injected fetch (no network, no key). Live routing is NOT proven here (→ VERIFIED (FIXTURE)).
import { expect } from 'chai';
import { createModelRouter, classify, usdToMinorCeil, OpenRouterProvider, FIXTURE_BADGE, loadRouting } from '../src/workflows/model_router.js';

const routing = loadRouting();
const KEY = 'sk-or-test-not-a-real-key-000';
function fakeFetch(reply, { status = 200, delayMs = 0 } = {}) {
  const f = async (url, init) => {
    f.calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    if (delayMs) await new Promise((r, j) => { const t = setTimeout(r, delayMs); init.signal.addEventListener('abort', () => { clearTimeout(t); const e = new Error('aborted'); e.name = 'AbortError'; j(e); }); });
    return { ok: status < 400, status, json: async () => reply };
  };
  f.calls = [];
  return f;
}
const ok = (over = {}) => ({ id: 'gen-1', model: 'openai/gpt-4o-mini', provider: 'OpenAI', choices: [{ message: { content: 'hello' } }], usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.000123 }, ...over });

describe('model router (P2.3)', () => {
  it('classifies task requests vs conversation', () => {
    expect(classify('Buy me a $10 e-book gift code')).to.equal('plan');
    expect(classify('please backtest a moving average strategy')).to.equal('plan');
    expect(classify('what can you do?')).to.equal('conversation');
  });

  it('without a key it uses the fixture: served_by fixture/<model>, cost 0, badge shown', async () => {
    const r = createModelRouter({ env: {} });
    expect(r.fixture).to.equal(true);
    expect(r.badge).to.equal(FIXTURE_BADGE);
    const out = await r.complete({ policy: 'conversation', messages: [{ role: 'user', content: 'hello' }] });
    expect(out.served_by).to.match(/^fixture\//);
    expect(out.cost_minor).to.equal(0n);
    expect(out.fixture).to.equal(true);
  });

  it('fixture plan fills inputs generically from the candidate schema (no supplier names in code)', async () => {
    const r = createModelRouter({ env: {} });
    const cand = { id: 'shop.digital_goods.purchase', name: 'Buy a digital product', input_schema: { properties: {
      product_query: { type: 'string', minLength: 2, maxLength: 120 }, max_price_usd_minor: { type: 'integer' }, recipient_email: { type: 'string' } } } };
    const out = await r.complete({ policy: 'plan', messages: [{ role: 'user', content: 'Buy a sci-fi e-book gift code under $12.50 and send it to ana@example.com' }], context: { candidates: [cand] } });
    expect(out.json.steps[0]).to.deep.equal({ capability_id: 'shop.digital_goods.purchase', inputs: { product_query: 'sci-fi e-book gift code', max_price_usd_minor: 12_500_000, recipient_email: 'ana@example.com' } });
  });

  it('builds the OpenRouter request per policy: auto + allowlist plugin, pinned structured model, privacy prefs', async () => {
    const f = fakeFetch(ok());
    const p = new OpenRouterProvider({ routing, apiKey: KEY, fetchImpl: f });
    await p.complete({ policy: 'conversation', messages: [{ role: 'user', content: 'hi' }] });
    const b = f.calls[0].body;
    expect(b.model).to.equal('openrouter/auto');
    expect(b.plugins[0]).to.deep.include({ id: 'auto-router', cost_tier: 'low' });
    expect(b.plugins[0].allowed_models).to.deep.equal(routing.allowlist);
    expect(b.models).to.deep.equal(routing.allowlist);
    expect(b.provider).to.deep.include({ data_collection: 'deny', allow_fallbacks: true });
    expect(b.provider.max_price).to.deep.equal(routing.max_price_usd_per_million_tokens);
    expect(f.calls[0].headers.authorization).to.equal(`Bearer ${KEY}`);
    const f2 = fakeFetch(ok({ choices: [{ message: { content: '{"steps":[]}' } }] }));
    const out = await new OpenRouterProvider({ routing, apiKey: KEY, fetchImpl: f2 }).complete({ policy: 'plan', messages: [] });
    expect(f2.calls[0].body.model).to.equal(routing.policies.plan.model);
    expect(f2.calls[0].body.response_format).to.deep.equal({ type: 'json_object' });
    expect(out.json).to.deep.equal({ steps: [] });
  });

  it('served_by is the responding model, never the alias; cost metered in micro-USD (rounded up)', async () => {
    const out = await new OpenRouterProvider({ routing, apiKey: KEY, fetchImpl: fakeFetch(ok({ model: 'anthropic/claude-3.5-haiku' })) })
      .complete({ policy: 'conversation', messages: [] });
    expect(out.served_by).to.equal('anthropic/claude-3.5-haiku');
    expect(out.generation_id).to.equal('gen-1');
    expect(out.cost_minor).to.equal(123n);
  });

  it('typed errors: not allowlisted, budget exceeded, timeout, upstream error', async () => {
    const run = (reply, opts, args = {}) => new OpenRouterProvider({ routing: { ...routing, timeout_ms: opts?.timeout ?? routing.timeout_ms }, apiKey: KEY, fetchImpl: fakeFetch(reply, opts) })
      .complete({ policy: 'conversation', messages: [], ...args }).then(() => null, (e) => e.code);
    expect(await run(ok({ model: 'some/unlisted-model' }))).to.equal('MODEL_NOT_ALLOWLISTED');
    expect(await run(ok({ usage: { cost: 1 } }))).to.equal('BUDGET_EXCEEDED');
    expect(await run(ok(), { delayMs: 200, timeout: 20 })).to.equal('UPSTREAM_TIMEOUT');
    expect(await run({ error: { message: 'x' } }, { status: 500 })).to.equal('MODEL_UNAVAILABLE');
  });

  it('usdToMinorCeil converts exactly, including exponents, never rounding down', () => {
    expect(usdToMinorCeil('0.000123')).to.equal(123n);
    expect(usdToMinorCeil('1.2e-7')).to.equal(1n);
    expect(usdToMinorCeil(0)).to.equal(0n);
    expect(usdToMinorCeil('2')).to.equal(2_000_000n);
    expect(usdToMinorCeil(0.0000015)).to.equal(2n);
    expect(() => usdToMinorCeil('-1')).to.throw();
  });
});
