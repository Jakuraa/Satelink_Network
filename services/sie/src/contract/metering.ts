// SIE metering (ACCEPTANCE_TESTS SIE "Metering"; decision S-5): exactly ONE usage_event per request,
// keyed by the request's idempotency key, carrying what the PROVIDER reported — served model,
// generation id, tokens and cost in integer micro-USD (S-4). A retried request (same key) is never
// metered twice. Failures are metered too (status "error", the typed failure kind, no cost unless
// the provider reported one), so every request leaves exactly one record.
//
// Pure contract: the sink is a port. The Financial OS consumes usage_events to capture or release
// the request's reservation (S-5); this module never moves money itself.
import { AgentError, ProviderError } from './errors.js';
import { AIProvider } from './provider.js';
import type { ChatMessage, ChatOptions, ChatResult, StreamChunk, StreamFinal } from './provider.js';

export interface UsageEvent {
  readonly idempotencyKey: string;
  readonly provider: string;
  /** Served model as reported by the provider; null when the call failed before a response. */
  readonly servedModel: string | null;
  readonly generationId: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Provider-reported cost in micro-USD; null when not reported (never estimated). */
  readonly costMicroUsd: bigint | null;
  readonly status: 'ok' | 'error';
  /** Typed failure class for status "error" (ProviderError.kind or AgentError.code). */
  readonly errorKind: string | null;
  readonly startedAt: number;
  readonly finishedAt: number;
}

export interface UsageSink {
  /**
   * Store the event unless one with the same idempotencyKey exists. Returns `recorded: false` for a
   * duplicate (first write wins) — the caller never meters a key twice.
   */
  record(event: UsageEvent): Promise<{ recorded: boolean }>;
}

/** In-memory UsageSink (tests and local runs): first write per key wins. */
export class InMemoryUsageSink implements UsageSink {
  readonly events: UsageEvent[] = [];
  private readonly keys = new Set<string>();
  record(event: UsageEvent): Promise<{ recorded: boolean }> {
    if (this.keys.has(event.idempotencyKey)) return Promise.resolve({ recorded: false });
    this.keys.add(event.idempotencyKey);
    this.events.push(event);
    return Promise.resolve({ recorded: true });
  }
}

export interface MeteringOptions {
  readonly sink: UsageSink;
  readonly idempotencyKey: string;
  readonly now?: () => number;
}

/**
 * Wrap a provider for ONE request: the first call through it is metered under `idempotencyKey`.
 * A second call through the same wrapper is refused (CONFIG) — one request, one event.
 */
export function withMetering(inner: AIProvider, opts: MeteringOptions): AIProvider {
  if (typeof opts.idempotencyKey !== 'string' || opts.idempotencyKey.trim() === '' || opts.idempotencyKey.length > 200) {
    throw new AgentError('CONFIG', 'idempotencyKey must be a non-empty string <= 200 characters');
  }
  return new MeteredProvider(inner, opts.sink, opts.idempotencyKey, opts.now ?? Date.now);
}

function failureKind(e: unknown): string {
  if (e instanceof ProviderError) return e.kind;
  if (e instanceof AgentError) return e.code;
  return 'unknown';
}

class MeteredProvider extends AIProvider {
  private used = false;
  constructor(private readonly inner: AIProvider, private readonly sink: UsageSink, private readonly key: string, private readonly now: () => number) {
    super();
  }

  get id(): string { return this.inner.id; }

  private claim(): void {
    if (this.used) throw new AgentError('CONFIG', 'a metered provider serves exactly one request; create a new wrapper per idempotency key');
    this.used = true;
  }

  private async ok(startedAt: number, r: StreamFinal): Promise<void> {
    await this.sink.record({
      idempotencyKey: this.key, provider: r.provider, servedModel: r.model, generationId: r.generationId,
      inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, costMicroUsd: r.usage.costMicroUsd,
      status: 'ok', errorKind: null, startedAt, finishedAt: this.now(),
    });
  }

  private async fail(startedAt: number, e: unknown): Promise<void> {
    await this.sink.record({
      idempotencyKey: this.key, provider: this.inner.id, servedModel: null, generationId: null,
      inputTokens: 0, outputTokens: 0, costMicroUsd: null, status: 'error', errorKind: failureKind(e), startedAt, finishedAt: this.now(),
    });
  }

  async chat(messages: readonly ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    this.claim();
    const startedAt = this.now();
    let r: ChatResult;
    try { r = await this.inner.chat(messages, opts); } catch (e) { await this.fail(startedAt, e); throw e; }
    await this.ok(startedAt, r);
    return r;
  }

  override async reason(messages: readonly ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    this.claim();
    const startedAt = this.now();
    let r: ChatResult;
    try { r = await this.inner.reason(messages, opts); } catch (e) { await this.fail(startedAt, e); throw e; }
    await this.ok(startedAt, r);
    return r;
  }

  override async *stream(messages: readonly ChatMessage[], opts: ChatOptions = {}): AsyncGenerator<StreamChunk, void, void> {
    this.claim();
    const startedAt = this.now();
    let final: StreamFinal | undefined;
    let metered = false;
    try {
      for await (const c of this.inner.stream(messages, opts)) {
        if (c.final) final = c.final;
        yield c;
      }
      if (!final) throw new AgentError('PROVIDER_ERROR', 'stream completed without a final usage chunk');
      metered = true;
      await this.ok(startedAt, final);
    } catch (e) {
      if (!metered) { metered = true; await this.fail(startedAt, e); }
      throw e;
    } finally {
      // consumer stopped early (break / return): still exactly one event for the request
      if (!metered) await this.fail(startedAt, new AgentError('PROVIDER_ERROR', 'stream abandoned by the consumer'));
    }
  }
}
