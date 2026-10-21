// OpenRouter adapter (Trading AI critical path, 2026-10-21): an OpenAI-compatible gateway behind
// AIProvider, so one key reaches many upstream models. Same contract as groq.mjs, plus:
//
//   bounded retries   → at most `maxRetries` extra attempts, ONLY for retryable failures
//                       (429 / 5xx / network / timeout); Retry-After honoured, capped.
//   malformed output  → non-JSON body, missing choices or an in-body error → ProviderError; never a
//                       fabricated empty answer.
//   truthful report   → `model` is the model OpenRouter says served the call and `upstreamProvider`
//                       the upstream it names; nothing is filled in from the request when absent
//                       except `model` (the requested id, same as groq.mjs).
//
// No SDK dependency: the agent layer may not import SDKs (boundary.mjs) and apps/api installs without
// a lockfile, so a new package is a deploy risk. The API key and fetch are INJECTED by the composition
// root; this module never reads process.env and never logs or returns the key.
import { AIProvider } from '../provider.mjs';
import { ProviderError } from '../errors.mjs';

export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_RETRY_AFTER_MS = 5_000;

const isRetryableStatus = (s) => s === 429 || s >= 500;
const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class OpenRouterProvider extends AIProvider {
  #apiKey;
  #fetch;
  #baseUrl;
  #timeoutMs;
  #maxRetries;
  #sleep;
  #headers;

  /**
   * @param {{ apiKey: string, fetch: typeof fetch, baseUrl?: string, timeoutMs?: number, maxRetries?: number,
   *           sleep?: (ms: number) => Promise<void>, appUrl?: string, appTitle?: string }} opts
   *   appUrl / appTitle: optional OpenRouter attribution headers (HTTP-Referer / X-Title).
   */
  constructor({ apiKey, fetch, baseUrl = OPENROUTER_DEFAULT_BASE_URL, timeoutMs = 30_000, maxRetries = 1, sleep = defaultSleep, appUrl, appTitle }) {
    super();
    if (typeof apiKey !== 'string' || apiKey.length < 8) throw new ProviderError('OpenRouterProvider requires an injected apiKey', { provider: 'openrouter' });
    if (typeof fetch !== 'function') throw new ProviderError('OpenRouterProvider requires an injected fetch', { provider: 'openrouter' });
    if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3) throw new ProviderError('maxRetries must be an integer 0..3', { provider: 'openrouter' });
    this.#apiKey = apiKey;
    this.#fetch = fetch;
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#timeoutMs = timeoutMs;
    this.#maxRetries = maxRetries;
    this.#sleep = sleep;
    this.#headers = { ...(appUrl ? { 'http-referer': appUrl } : {}), ...(appTitle ? { 'x-title': appTitle } : {}) };
  }

  get id() { return 'openrouter'; }

  #body(messages, { model, tools, jsonMode, maxTokens = 1024, temperature = 0, stream = false }) {
    if (typeof model !== 'string' || !model) throw new ProviderError('model required', { provider: 'openrouter' });
    const body = { model, messages, max_tokens: maxTokens, temperature, stream };
    if (tools && tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
    if (jsonMode) body.response_format = { type: 'json_object' };
    return body;
  }

  async #once(body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.#timeoutMs);
    let res;
    try {
      res = await this.#fetch(`${this.#baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.#apiKey}`, ...this.#headers },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new ProviderError(`openrouter request failed: ${e?.name === 'AbortError' ? 'timeout' : 'network'}`, { retryable: true, provider: 'openrouter' });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const err = new ProviderError(`openrouter HTTP ${res.status}`, { retryable: isRetryableStatus(res.status), status: res.status, provider: 'openrouter' });
      err.retryAfterMs = retryAfterMs(res);
      throw err;
    }
    return res;
  }

  /** One request plus at most #maxRetries retries, for retryable failures only. */
  async #post(body) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.#once(body);
      } catch (e) {
        if (!e.retryable || attempt >= this.#maxRetries) throw e;
        await this.#sleep(e.retryAfterMs ?? 250 * 2 ** attempt);
      }
    }
  }

  async chat(messages, opts = {}) {
    const res = await this.#post(this.#body(messages, opts));
    let data;
    try { data = await res.json(); } catch { throw malformed('response body is not JSON'); }
    if (data?.error) throw inBodyError(data.error);
    const choice = data?.choices?.[0]?.message;
    if (!choice || typeof choice !== 'object') throw malformed('response has no choices[0].message');
    return {
      content: choice.content ?? '',
      toolCalls: (choice.tool_calls ?? []).map((tc) => ({ id: tc.id, name: tc.function?.name, arguments: tc.function?.arguments ?? '{}' })),
      usage: { inputTokens: data?.usage?.prompt_tokens ?? 0, outputTokens: data?.usage?.completion_tokens ?? 0 },
      model: data?.model ?? opts.model,
      provider: 'openrouter',
      upstreamProvider: typeof data?.provider === 'string' ? data.provider : null,
    };
  }

  /** Server-sent events stream. Retries happen only before the first byte; a mid-stream error throws. */
  async *stream(messages, opts = {}) {
    const res = await this.#post(this.#body(messages, { ...opts, tools: undefined, stream: true }));
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue; // includes OpenRouter ": OPENROUTER PROCESSING" keep-alives
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        let event;
        try { event = JSON.parse(payload); } catch { throw malformed('stream event is not JSON'); }
        if (event?.error) throw inBodyError(event.error);
        const delta = event?.choices?.[0]?.delta?.content;
        if (delta) yield { delta };
      }
    }
  }
}

function retryAfterMs(res) {
  const raw = res.headers?.get?.('retry-after');
  const secs = raw == null ? NaN : Number(raw);
  return Number.isFinite(secs) && secs >= 0 ? Math.min(secs * 1000, MAX_RETRY_AFTER_MS) : undefined;
}

function malformed(why) {
  return new ProviderError(`openrouter malformed response: ${why}`, { retryable: false, provider: 'openrouter' });
}

/** OpenRouter can answer 200 with { error: { code, message } } (e.g. an upstream failure). */
function inBodyError(error) {
  const status = Number.isInteger(error?.code) ? error.code : null;
  return new ProviderError(`openrouter error${status ? ` ${status}` : ''}`, { retryable: status != null && isRetryableStatus(status), status, provider: 'openrouter' });
}
