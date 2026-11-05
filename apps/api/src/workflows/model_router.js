// Satelink model router (Release A, P2.3). One gateway in front of OpenRouter.
//
//   classify(text)      → route policy: 'plan' (the user wants something done) | 'conversation'
//   router.complete()   → { text | json, served_by, provider, generation_id, usage, cost_minor, fixture }
//
// - OpenRouterProvider: used only when OPENROUTER_API_KEY is set. Conversation → "openrouter/auto" with the
//   auto-router plugin restricted to the allowlist; plan → a pinned structured-output model. Provider prefs:
//   fallbacks only within the allowlist (`models`), data_collection "deny", max_price.
// - served_by is the model the RESPONSE says served the call — never the requested alias. A response from a
//   model outside the allowlist is refused (MODEL_NOT_ALLOWLISTED); there is no silent fallback (R11).
// - FixtureModelProvider (no key): deterministic, served_by "fixture/<model>", cost 0. Any status proven with
//   it is VERIFIED (FIXTURE), never VERIFIED.
// Model output is UNTRUSTED (R7): callers validate it against the registry; it can never approve or pay.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TaskError, ERR } from './errors.js';

const CONFIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'config', 'model_routing.preview.json');
export const FIXTURE_BADGE = 'Model: fixture (no live key)';

export function loadRouting(file = CONFIG) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

const PLAN_WORDS = /\b(buy|purchase|order|book|get me|find me|procure|backtest|evaluate|simulate|paper[- ]trade|send|pay for|subscribe|download|gift)\b/i;
/** Rule-based route classification (also the fixture intent classifier). */
export function classify(text) {
  return PLAN_WORDS.test(String(text || '')) ? 'plan' : 'conversation';
}

/** Exact decimal (number or string, incl. exponent) USD → BigInt micro-USD, rounded up. Upstream cost only. */
export function usdToMinorCeil(v) {
  if (v === null || v === undefined) return 0n;
  const s = typeof v === 'number' ? v.toExponential(12) : String(v).trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(s);
  if (!m || m[1]) throw new TaskError(ERR.VALIDATION, 'upstream cost must be a non-negative decimal');
  const digits = (m[2] + (m[3] || '')).replace(/^0+(?=\d)/, '');
  const scale = (m[3] || '').length - Number(m[4] || 0) - 6; // value = digits × 10^-(scale+6) → micro = digits × 10^-scale
  const d = BigInt(digits);
  if (scale <= 0) return d * 10n ** BigInt(-scale);
  const p = 10n ** BigInt(scale);
  return (d + p - 1n) / p;
}

export class FixtureModelProvider {
  constructor(routing) { this.routing = routing; this.fixture = true; }

  async complete({ policy, messages, context = {} }) {
    const model = policy === 'plan' ? this.routing.policies.plan.model : this.routing.allowlist[0];
    const last = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const base = { served_by: `fixture/${model}`, provider: 'fixture', generation_id: null, usage: { prompt_tokens: 0, completion_tokens: 0 }, cost_minor: 0n, fixture: true };
    if (policy === 'plan') return { ...base, json: fixturePlan(last, context.candidates || []) };
    return { ...base, text: fixtureReply(last, context) };
  }
}

/** Generic, supplier-agnostic extraction: picks the top registry candidate and fills inputs by schema. */
function fixturePlan(text, candidates) {
  const c = candidates[0];
  if (!c) return { steps: [], reply: 'I could not find a capability for that in the preview catalogue.' };
  const inputs = {};
  for (const [k, s] of Object.entries(c.input_schema?.properties || {})) {
    if (s.type === 'string' && /email/.test(k)) { const e = /[^\s@]+@[^\s@]+\.[^\s@]+/.exec(text); if (e) inputs[k] = e[0].replace(/[.,;]$/, ''); }
    else if (s.type === 'integer' && /usd_minor$/.test(k)) { const d = /\$\s?(\d{1,6})(?:\.(\d{1,2}))?/.exec(text); if (d) inputs[k] = Number(d[1]) * 1_000_000 + Number((d[2] || '').padEnd(2, '0').slice(0, 2)) * 10_000; }
    else if (s.type === 'string' && Array.isArray(s.enum)) { const hit = s.enum.find((v) => new RegExp(`\\b${v}\\b`, 'i').test(text)); if (hit) inputs[k] = hit; }
    else if (s.type === 'string' && s.pattern && !/query|description/.test(k)) { const m = new RegExp(s.pattern.replace(/^\^|\$$/g, '')).exec(text); if (m) inputs[k] = m[0]; }
    else if (s.type === 'string' && /description/.test(k)) { const t = text.trim(); if (t.length >= (s.minLength || 1)) inputs[k] = t.slice(0, s.maxLength || 300); }
    else if (s.type === 'string' && /query|text|prompt/.test(k)) {
      const q = text.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '').replace(/\$\s?\d+(?:\.\d+)?/g, '')
        .replace(/\b(please|can you|could you|i want to|i'd like to|buy|purchase|order|get me|find me|for me|under|below|max(imum)?|up to|to|and send it|send it|me|a|an)\b/gi, ' ')
        .replace(/\s+/g, ' ').trim();
      if (q.length >= (s.minLength || 1)) inputs[k] = q.slice(0, s.maxLength || 120);
    }
  }
  return { steps: [{ capability_id: c.id, inputs }], reply: `I can do that with "${c.name}".` };
}

function fixtureReply(text, { candidates = [] } = {}) {
  if (/\b(hi|hello|hey)\b/i.test(text)) return 'Hello — tell me what you want done (for example: "buy a $10 e-book gift code"). In this preview nothing is charged; every purchase is simulated.';
  if (candidates.length) return `In the preview I can help with: ${candidates.slice(0, 5).map((c) => c.name).join(', ')}. Describe the outcome you want.`;
  return 'Describe the outcome you want and I will look for a capability that can do it. In this preview nothing is charged.';
}

export class OpenRouterProvider {
  constructor({ routing, apiKey, fetchImpl = globalThis.fetch, clock = () => Date.now() }) {
    if (typeof apiKey !== 'string' || apiKey.length < 8) throw new TaskError(ERR.MODEL_UNAVAILABLE, 'OpenRouter key not configured.', { status: 503 });
    this.routing = routing; this.apiKey = apiKey; this.fetch = fetchImpl; this.clock = clock; this.fixture = false;
  }

  body(policy, messages) {
    const r = this.routing; const p = r.policies[policy];
    const body = {
      model: p.model, messages, max_tokens: p.max_tokens, temperature: p.temperature,
      models: r.allowlist,
      provider: { allow_fallbacks: r.provider_preferences.allow_fallbacks, data_collection: r.provider_preferences.data_collection, max_price: r.max_price_usd_per_million_tokens },
      usage: { include: true },
    };
    if (p.plugin) body.plugins = [{ ...p.plugin, allowed_models: r.allowlist }];
    if (p.structured_output) body.response_format = { type: 'json_object' };
    return body;
  }

  async complete({ policy, messages, budgetMinor = BigInt(this.routing.per_request_budget_minor) }) {
    if (!this.routing.policies[policy]) throw new TaskError(ERR.VALIDATION, `unknown route policy ${policy}`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.routing.timeout_ms);
    let res; let json;
    try {
      res = await this.fetch(`${this.routing.base_url}/chat/completions`, {
        method: 'POST', signal: ctrl.signal,
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json', 'x-title': 'Satelink AI Assistance (preview)' },
        body: JSON.stringify(this.body(policy, messages)),
      });
      json = await res.json();
    } catch (e) {
      if (e?.name === 'AbortError') throw new TaskError(ERR.UPSTREAM_TIMEOUT, 'The model did not answer in time.', { status: 504, retryable: true });
      throw new TaskError(ERR.MODEL_UNAVAILABLE, 'The model service is unavailable.', { status: 503, retryable: true });
    } finally { clearTimeout(timer); }
    if (!res.ok || json?.error) throw new TaskError(ERR.MODEL_UNAVAILABLE, 'The model service returned an error.', { status: 503, retryable: res.status === 429 || res.status >= 500 });
    const served = json.model;
    if (!this.routing.allowlist.includes(served)) throw new TaskError(ERR.MODEL_NOT_ALLOWLISTED, 'The answering model is not on the allowlist; the answer was discarded.', { status: 502 });
    const cost = usdToMinorCeil(json.usage?.cost ?? 0);
    if (cost > budgetMinor) throw new TaskError(ERR.BUDGET_EXCEEDED, 'The model call exceeded its budget.', { status: 402 });
    const content = json.choices?.[0]?.message?.content ?? '';
    const out = {
      served_by: served, provider: json.provider || null, generation_id: json.id || null,
      usage: { prompt_tokens: json.usage?.prompt_tokens ?? 0, completion_tokens: json.usage?.completion_tokens ?? 0 },
      cost_minor: cost, fixture: false,
    };
    if (policy === 'plan') {
      try { return { ...out, json: JSON.parse(content) }; } catch { throw new TaskError(ERR.MODEL_UNAVAILABLE, 'The model returned an invalid plan.', { status: 502, retryable: true }); }
    }
    return { ...out, text: String(content) };
  }
}

/** Choose the provider from the environment: live only with a key, otherwise the fixture. */
export function createModelRouter({ env = process.env, fetchImpl, routing = loadRouting() } = {}) {
  const provider = env.OPENROUTER_API_KEY
    ? new OpenRouterProvider({ routing, apiKey: env.OPENROUTER_API_KEY, fetchImpl })
    : new FixtureModelProvider(routing);
  return {
    routing, provider, fixture: provider.fixture,
    badge: provider.fixture ? FIXTURE_BADGE : null,
    classify,
    complete: (args) => provider.complete(args),
  };
}
