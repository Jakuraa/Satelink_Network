// OpenRouter adapter: an OpenAI-compatible gateway behind @satelink/sie's AIProvider, so one key
// reaches many upstream models. Ported from #579 (trading-agent/integration,
// apps/api/src/trading_agent/agent/providers/openrouter.mjs) onto the promoted contract, plus:
//
//   served model     → `model` is what OpenRouter says served the call; `generationId` its `id`.
//   cost             → `usage.cost` (USD credits) → integer micro-USD, rounded up; null if absent.
//   typed errors     → timeout, connection_reset, rate_limited, server_error, stream_truncated,
//                      malformed, rejected, deadline_exceeded (see @satelink/sie errors).
//   bounded retries  → at most `maxRetries` extra attempts, only for retryable failures; Retry-After
//                      (seconds or HTTP-date) honoured, capped at 5 s.
//   total deadline   → `deadlineMs` bounds every chat attempt plus every backoff, and a stream's wait
//                      for response headers; each attempt's timeout is min(timeoutMs, time left). One
//                      attempt's timeout covers the request AND the body read. Once a stream is open
//                      only the idle timeout applies (silence longer than timeoutMs; keep-alive
//                      comments count as activity), as in #579.
//   malformed output → non-JSON body, missing choices, an in-body error or a stream without [DONE]
//                      throw; never a fabricated or truncated answer.
//
// No SDK: fetch, the API key, the clock and sleep are INJECTED by the composition root. This module
// never reads process.env and never logs or returns the key.
import {
  AIProvider, ProviderConnectionResetError, ProviderError, ProviderMalformedResponseError, ProviderStreamTruncatedError,
  ProviderTimeoutError, assertRetryPolicy, providerErrorForStatus, usdToMicroUsd, withRetries,
  type ChatMessage, type ChatOptions, type ChatResult, type StreamChunk, type StreamFinal, type ToolCall,
} from '../contract/index.js';

export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const PROVIDER = 'openrouter';
const MAX_RETRY_AFTER_MS = 5_000;

export interface HttpResponseLike {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
  readonly body?: AsyncIterable<Uint8Array> | null;
}
export interface HttpRequestInit {
  readonly method: 'POST';
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly signal: AbortSignal;
}
export type FetchLike = (url: string, init: HttpRequestInit) => Promise<HttpResponseLike>;

export interface OpenRouterOptions {
  readonly apiKey: string;
  readonly fetch: FetchLike;
  readonly baseUrl?: string;
  /** Per-attempt timeout (request + body read; stream silence). */
  readonly timeoutMs?: number;
  /** Total budget across all attempts and backoff. */
  readonly deadlineMs?: number;
  readonly maxRetries?: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  /** Optional OpenRouter attribution headers (HTTP-Referer / X-Title). */
  readonly appUrl?: string;
  readonly appTitle?: string;
}

interface WireUsage { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown }
interface WireToolCall { id?: unknown; function?: { name?: unknown; arguments?: unknown } }
interface WireCompletion {
  id?: unknown; model?: unknown; provider?: unknown; usage?: WireUsage; error?: unknown;
  choices?: { message?: { content?: unknown; tool_calls?: WireToolCall[] }; delta?: { content?: unknown } }[];
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const tokens = (v: unknown): number => (Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : 0);

export class OpenRouterProvider extends AIProvider {
  readonly #apiKey: string;
  readonly #fetch: FetchLike;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #deadlineMs: number;
  readonly #maxRetries: number;
  readonly #now: () => number;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #headers: Record<string, string>;

  constructor(o: OpenRouterOptions) {
    super();
    if (typeof o.apiKey !== 'string' || o.apiKey.length < 8) throw new ProviderError('config', 'OpenRouterProvider requires an injected apiKey', { provider: PROVIDER });
    if (typeof o.fetch !== 'function') throw new ProviderError('config', 'OpenRouterProvider requires an injected fetch', { provider: PROVIDER });
    const timeoutMs = o.timeoutMs ?? 30_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new ProviderError('config', 'timeoutMs must be a positive number', { provider: PROVIDER });
    const maxRetries = o.maxRetries ?? 1;
    const deadlineMs = o.deadlineMs ?? 60_000;
    assertRetryPolicy({ maxRetries, deadlineMs }, PROVIDER);
    this.#apiKey = o.apiKey;
    this.#fetch = o.fetch;
    this.#baseUrl = (o.baseUrl ?? OPENROUTER_DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.#timeoutMs = timeoutMs;
    this.#deadlineMs = deadlineMs;
    this.#maxRetries = maxRetries;
    this.#now = o.now ?? Date.now;
    this.#sleep = o.sleep ?? defaultSleep;
    this.#headers = { ...(o.appUrl ? { 'http-referer': o.appUrl } : {}), ...(o.appTitle ? { 'x-title': o.appTitle } : {}) };
  }

  get id(): string { return PROVIDER; }

  #body(messages: readonly ChatMessage[], opts: ChatOptions & { stream?: boolean }): Record<string, unknown> {
    const { model, tools, jsonMode, maxTokens = 1024, temperature = 0, stream = false } = opts;
    if (typeof model !== 'string' || !model) throw new ProviderError('config', 'model required', { provider: PROVIDER });
    // usage.include asks OpenRouter to report token counts and cost (usage.cost) on the response.
    const body: Record<string, unknown> = { model, messages, max_tokens: maxTokens, temperature, stream, usage: { include: true } };
    if (tools && tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
    if (jsonMode) body.response_format = { type: 'json_object' };
    return body;
  }

  #retry<T>(fn: (remainingMs: number) => Promise<T>): Promise<T> {
    return withRetries({ maxRetries: this.#maxRetries, deadlineMs: this.#deadlineMs }, { now: this.#now, sleep: this.#sleep }, PROVIDER, fn);
  }

  async chat(messages: readonly ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const body = this.#body(messages, opts);
    const data = await this.#retry((remaining) => this.#attempt(body, remaining));
    const choice = data.choices?.[0]?.message;
    if (!choice || typeof choice !== 'object') throw malformed('response has no choices[0].message');
    const rawCalls: unknown = choice.tool_calls ?? [];
    if (!Array.isArray(rawCalls) || rawCalls.some((tc) => !tc || typeof tc !== 'object')) throw malformed('tool_calls is not an array of objects');
    const toolCalls: ToolCall[] = (rawCalls as WireToolCall[]).map((tc) => ({
      id: str(tc.id) ?? undefined, name: str(tc.function?.name) ?? undefined, arguments: str(tc.function?.arguments) ?? '{}',
    }));
    return {
      content: typeof choice.content === 'string' ? choice.content : '',
      toolCalls,
      ...summary(data, opts.model ?? ''),
    };
  }

  /** One attempt; its timeout covers the request AND reading the body. */
  async #attempt(body: Record<string, unknown>, remainingMs: number): Promise<WireCompletion> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); }, Math.min(this.#timeoutMs, remainingMs));
    try {
      const res = await this.#request(body, ctrl.signal);
      let text: string;
      try { text = await withAbort(res.text(), ctrl.signal); } catch (e) { throw transportError(e, ctrl.signal); }
      let d: WireCompletion;
      try { d = JSON.parse(text) as WireCompletion; } catch { throw malformed('response body is not JSON'); }
      if (!d || typeof d !== 'object') throw malformed('response body is not an object');
      if (d.error) throw inBodyError(d.error);
      return d;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Server-sent events. Retries happen only until the response headers arrive; after that every
   * failure throws: a read error or silence longer than timeoutMs (retryable, so a router may fall
   * back), an in-body error event, or a stream that ends without [DONE] (stream_truncated — a
   * partial answer is never returned as complete). The last chunk carries `final`.
   */
  override async *stream(messages: readonly ChatMessage[], opts: ChatOptions = {}): AsyncGenerator<StreamChunk, void, void> {
    const body = this.#body(messages, { ...opts, tools: undefined, stream: true });
    const { res, ctrl } = await this.#retry((remaining) => this.#openStream(body, remaining));
    if (!res.body) { ctrl.abort(); throw malformed('stream response has no body'); }
    const decoder = new TextDecoder();
    const it = res.body[Symbol.asyncIterator]();
    const seen: WireCompletion = {};
    let buffer = '';
    try {
      for (;;) {
        let step: IteratorResult<Uint8Array>;
        const idle = setTimeout(() => { ctrl.abort(); }, this.#timeoutMs);
        try { step = await withAbort(it.next(), ctrl.signal); } catch (e) { throw transportError(e, ctrl.signal, 'stream'); } finally { clearTimeout(idle); }
        if (step.done) throw new ProviderStreamTruncatedError('openrouter stream ended before [DONE]', { provider: PROVIDER });
        buffer += decoder.decode(step.value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue; // includes ": OPENROUTER PROCESSING" keep-alives
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            const final: StreamFinal = summary(seen, opts.model ?? '');
            yield { delta: '', final };
            return;
          }
          let event: WireCompletion;
          try { event = JSON.parse(payload) as WireCompletion; } catch { throw malformed('stream event is not JSON'); }
          if (!event || typeof event !== 'object') throw malformed('stream event is not an object');
          if (event.error) throw inBodyError(event.error);
          if (str(event.id)) seen.id = event.id;
          if (str(event.model)) seen.model = event.model;
          if (str(event.provider)) seen.provider = event.provider;
          if (event.usage) seen.usage = event.usage; // OpenRouter sends usage (incl. cost) on the last chunk
          const delta = event.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) yield { delta };
        }
      }
    } finally {
      ctrl.abort(); // release the connection on early exit (consumer break, error)
    }
  }

  /** Opens the stream; this timeout covers only the wait for response headers. */
  async #openStream(body: Record<string, unknown>, remainingMs: number): Promise<{ res: HttpResponseLike; ctrl: AbortController }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); }, Math.min(this.#timeoutMs, remainingMs));
    try {
      return { res: await this.#request(body, ctrl.signal), ctrl };
    } finally {
      clearTimeout(timer);
    }
  }

  /** POST + status classification. Retry-After is kept only on retryable errors. */
  async #request(body: Record<string, unknown>, signal: AbortSignal): Promise<HttpResponseLike> {
    let res: HttpResponseLike;
    try {
      res = await this.#fetch(`${this.#baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.#apiKey}`, ...this.#headers },
        body: JSON.stringify(body),
        signal,
      });
    } catch (e) { throw transportError(e, signal); }
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      const retryAfter = retryable ? retryAfterMs(res, this.#now) : undefined;
      throw providerErrorForStatus(res.status, `openrouter HTTP ${res.status}`, { provider: PROVIDER, ...(retryAfter === undefined ? {} : { retryAfterMs: retryAfter }) });
    }
    return res;
  }
}

function summary(d: WireCompletion, requestedModel: string): StreamFinal {
  return {
    usage: { inputTokens: tokens(d.usage?.prompt_tokens), outputTokens: tokens(d.usage?.completion_tokens), costMicroUsd: usdToMicroUsd(d.usage?.cost) },
    model: str(d.model) ?? requestedModel,
    generationId: str(d.id),
    provider: PROVIDER,
    upstreamProvider: str(d.provider),
  };
}

function transportError(e: unknown, signal: AbortSignal, what: 'request' | 'stream' = 'request'): ProviderError {
  const timedOut = signal.aborted || (e as { name?: unknown } | null)?.name === 'AbortError';
  return timedOut
    ? new ProviderTimeoutError(`openrouter ${what} failed: timeout`, { provider: PROVIDER })
    : new ProviderConnectionResetError(`openrouter ${what} failed: network`, { provider: PROVIDER });
}

/** Rejects when `signal` aborts, even if `promise` (a body read) never settles on its own. */
function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  const aborted = (): Error => Object.assign(new Error('aborted'), { name: 'AbortError' });
  if (signal.aborted) return Promise.reject(aborted());
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => { reject(aborted()); };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e: unknown) => { signal.removeEventListener('abort', onAbort); reject(e instanceof Error ? e : new Error(String(e))); },
    );
  });
}

function retryAfterMs(res: HttpResponseLike, now: () => number): number | undefined {
  const raw = res.headers.get('retry-after');
  if (raw == null || raw === '') return undefined;
  const secs = Number(raw);
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(raw) - now(); // delta-seconds or HTTP-date
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS) : undefined;
}

function malformed(why: string): ProviderError {
  return new ProviderMalformedResponseError(`openrouter malformed response: ${why}`, { provider: PROVIDER });
}

/** OpenRouter can answer 200 with { error: { code, message } } (e.g. an upstream failure). */
function inBodyError(error: unknown): ProviderError {
  const code = (error as { code?: unknown } | null)?.code;
  if (Number.isInteger(code) && (code as number) >= 400) return providerErrorForStatus(code as number, `openrouter error ${code as number}`, { provider: PROVIDER });
  return malformed('in-body error without an HTTP status code');
}
