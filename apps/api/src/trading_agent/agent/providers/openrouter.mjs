// OpenRouter adapter (Trading AI critical path, 2026-10-21): an OpenAI-compatible gateway behind
// AIProvider, so one key reaches many upstream models. Same contract as groq.mjs, plus:
//
//   bounded retries   → at most `maxRetries` extra attempts, ONLY for retryable failures
//                       (429 / 5xx / network / timeout, incl. a retryable in-body error);
//                       Retry-After (seconds or HTTP-date) honoured, capped at 5 s.
//   timeouts          → one deadline covers the request AND the body read; streams time out on
//                       silence longer than timeoutMs.
//   malformed output  → non-JSON body, missing choices, an in-body error or a stream without [DONE]
//                       → ProviderError; never a fabricated or truncated answer.
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

  /**
   * One attempt: the request AND reading the response share one deadline (a 200 whose body stalls
   * still times out). A body read failure is network/timeout (retryable); `consume(text)` parses, and
   * only an unparsable body is malformed.
   */
  async #attempt(body, consume) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.#timeoutMs);
    try {
      const res = await this.#request(body, ctrl.signal);
      let text;
      try { text = await withAbort(res.text(), ctrl.signal); } catch (e) { throw transportError(e, ctrl.signal); }
      return consume(text);
    } finally {
      clearTimeout(timer);
    }
  }

  /** At most 1 + #maxRetries attempts; only retryable failures (incl. retryable in-body errors) are retried. */
  async #withRetries(fn) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (e) {
        if (!(e instanceof ProviderError) || !e.retryable || attempt >= this.#maxRetries) throw e;
        await this.#sleep(e.retryAfterMs ?? 250 * 2 ** attempt);
      }
    }
  }

  async chat(messages, opts = {}) {
    const body = this.#body(messages, opts);
    const data = await this.#withRetries(() => this.#attempt(body, (text) => {
      let d;
      try { d = JSON.parse(text); } catch { throw malformed('response body is not JSON'); }
      if (d?.error) throw inBodyError(d.error);
      return d;
    }));
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

  /**
   * Server-sent events stream. Retries happen only until the response headers arrive; after that
   * every failure throws a ProviderError: a read error or a silence longer than timeoutMs (retryable,
   * so the router may fall back), an in-body error event, or a stream that ends without [DONE]
   * (a truncated answer is never returned as complete).
   */
  async *stream(messages, opts = {}) {
    const body = this.#body(messages, { ...opts, tools: undefined, stream: true });
    const { res, ctrl } = await this.#withRetries(() => this.#openStream(body));
    const decoder = new TextDecoder();
    const it = res.body[Symbol.asyncIterator]();
    let buffer = '';
    try {
      for (;;) {
        let step;
        const idle = setTimeout(() => ctrl.abort(), this.#timeoutMs);
        try { step = await withAbort(it.next(), ctrl.signal); }
        catch { throw new ProviderError(`openrouter stream failed: ${ctrl.signal.aborted ? 'timeout' : 'network'}`, { retryable: true, provider: 'openrouter' }); }
        finally { clearTimeout(idle); }
        if (step.done) throw malformed('stream ended before [DONE]');
        buffer += decoder.decode(step.value, { stream: true });
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
    } finally {
      ctrl.abort(); // release the connection on early exit (consumer break, error)
    }
  }

  /** Opens the stream; the deadline covers only the wait for response headers. */
  async #openStream(body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.#timeoutMs);
    try {
      return { res: await this.#request(body, ctrl.signal), ctrl };
    } finally {
      clearTimeout(timer);
    }
  }

  /** POST + status classification. Retry-After is kept only on retryable errors. */
  async #request(body, signal) {
    let res;
    try {
      res = await this.#fetch(`${this.#baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.#apiKey}`, ...this.#headers },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) { throw transportError(e, signal); }
    if (!res.ok) {
      const retryable = isRetryableStatus(res.status);
      const err = new ProviderError(`openrouter HTTP ${res.status}`, { retryable, status: res.status, provider: 'openrouter' });
      if (retryable) err.retryAfterMs = retryAfterMs(res);
      throw err;
    }
    return res;
  }
}

function transportError(e, signal) {
  const why = signal.aborted || e?.name === 'AbortError' ? 'timeout' : 'network';
  return new ProviderError(`openrouter request failed: ${why}`, { retryable: true, provider: 'openrouter' });
}

/** Rejects when `signal` aborts, even if `promise` (a body read) never settles on its own. */
function withAbort(promise, signal) {
  if (signal.aborted) return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then((v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); });
  });
}

function retryAfterMs(res) {
  const raw = res.headers?.get?.('retry-after');
  if (raw == null || raw === '') return undefined;
  const secs = Number(raw);
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(raw) - Date.now(); // delta-seconds or HTTP-date
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS) : undefined;
}

function malformed(why) {
  return new ProviderError(`openrouter malformed response: ${why}`, { retryable: false, provider: 'openrouter' });
}

/** OpenRouter can answer 200 with { error: { code, message } } (e.g. an upstream failure). */
function inBodyError(error) {
  const status = Number.isInteger(error?.code) ? error.code : null;
  return new ProviderError(`openrouter error${status ? ` ${status}` : ''}`, { retryable: status != null && isRetryableStatus(status), status, provider: 'openrouter' });
}
