// AIProvider — the single SIE provider abstraction. Promoted from trading-agent/integration
// (apps/api/src/trading_agent/agent/provider.mjs, Stage 12); that branch must rebase onto this
// package rather than keep its own copy.
//
//   chat(messages, opts)                     → ChatResult
//   reason(messages, opts)                   → same shape; providers may use a reasoning model/setting
//   structuredOutput(messages, schema, opts) → parsed object, ALWAYS re-validated against `schema`
//   stream(messages, opts)                   → async iterable of { delta }; the last chunk carries
//                                              `final` (served model, generation id, usage)
//
// Providers only transform text. They never receive tool handlers, ports, credentials of any
// broker, or the ability to execute anything. Provider API keys are injected by the composition
// root; nothing in this package reads env.
import { AgentError, ProviderError } from './errors.js';
import { assertSchema, assertValid, type JsonSchema } from './schema.js';

export const Task = Object.freeze({ CHAT: 'chat', REASON: 'reason', STRUCTURED: 'structured', STREAM: 'stream' } as const);

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly [extra: string]: unknown;
}

export interface ToolCall {
  readonly id: string | undefined;
  readonly name: string | undefined;
  readonly arguments: string;
}

export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** What the provider charged, in integer micro-USD; null when the provider did not report it. */
  readonly costMicroUsd: bigint | null;
}

export interface ChatResult {
  readonly content: string;
  readonly toolCalls: readonly ToolCall[];
  readonly usage: Usage;
  /** The model the provider says served the call (may differ from the requested id). */
  readonly model: string;
  /** Provider generation id, for cost lookup and audit; null when the provider sent none. */
  readonly generationId: string | null;
  readonly provider: string;
  /** Upstream named by a gateway provider (e.g. OpenRouter's `provider`); never invented. */
  readonly upstreamProvider: string | null;
}

export interface ChatOptions {
  readonly model?: string;
  readonly tools?: readonly unknown[] | undefined;
  readonly jsonMode?: boolean;
  readonly reasoning?: boolean;
  readonly maxTokens?: number;
  readonly temperature?: number;
  /** Called with the raw result before structured re-validation (metering). */
  readonly onUsage?: (r: ChatResult) => void;
}

export type StreamFinal = Omit<ChatResult, 'content' | 'toolCalls'>;

export interface StreamChunk {
  readonly delta: string;
  /** Present only on the last chunk of a complete stream. */
  readonly final?: StreamFinal;
}

export abstract class AIProvider {
  /** Provider id, e.g. 'openrouter'. */
  abstract get id(): string;

  abstract chat(messages: readonly ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;

  /** Default: a chat call flagged as reasoning; adapters may override (e.g. a reasoning model). */
  reason(messages: readonly ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    return this.chat(messages, { ...opts, reasoning: true });
  }

  /**
   * Structured output with mandatory re-validation. Even if an adapter uses a provider's native
   * JSON mode, the result is parsed and validated here; invalid output is SCHEMA_INVALID, never a
   * default value.
   */
  async structuredOutput<T = unknown>(messages: readonly ChatMessage[], schema: JsonSchema, opts: ChatOptions = {}): Promise<T> {
    assertSchema(schema, 'structuredOutput');
    const instruction: ChatMessage = { role: 'system', content: `Respond with a single JSON value matching this JSON schema, and nothing else:\n${JSON.stringify(schema)}` };
    const res = await this.chat([instruction, ...messages], { ...opts, jsonMode: true, tools: undefined });
    opts.onUsage?.(res);
    let parsed: unknown;
    try { parsed = JSON.parse(stripFences(res.content)); } catch { throw new AgentError('SCHEMA_INVALID', 'model output is not valid JSON'); }
    return assertValid<T>(schema, parsed, 'structured output');
  }

  /** Default stream: a single chunk from chat(). Adapters with real streaming override. */
  async *stream(messages: readonly ChatMessage[], opts: ChatOptions = {}): AsyncGenerator<StreamChunk, void, void> {
    const { content, toolCalls: _t, ...final } = await this.chat(messages, { ...opts, tools: undefined });
    yield { delta: content, final };
  }
}

function stripFences(s: string): string {
  const m = s.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m?.[1] ?? s.trim();
}

export interface ScriptedReply {
  readonly content?: string;
  readonly toolCalls?: readonly ToolCall[];
  readonly usage?: Partial<Usage>;
  readonly model?: string;
  readonly generationId?: string | null;
}
export type ScriptStep = ScriptedReply | Error | ((messages: readonly ChatMessage[], opts: ChatOptions) => ScriptedReply);

/** Deterministic scripted provider for tests: returns queued responses in order. */
export class ScriptedProvider extends AIProvider {
  readonly #id: string;
  readonly #script: ScriptStep[];
  readonly calls: { messages: readonly ChatMessage[]; opts: ChatOptions }[] = [];

  constructor({ id = 'scripted', script = [] }: { id?: string; script?: readonly ScriptStep[] } = {}) {
    super();
    this.#id = id;
    this.#script = [...script];
  }

  get id(): string { return this.#id; }

  chat(messages: readonly ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    this.calls.push({ messages, opts });
    const next = this.#script.shift();
    if (next === undefined) return Promise.reject(new ProviderError('malformed', 'script exhausted', { provider: this.#id }));
    if (next instanceof Error) return Promise.reject(next);
    const r = typeof next === 'function' ? next(messages, opts) : next;
    return Promise.resolve({
      content: r.content ?? '',
      toolCalls: r.toolCalls ?? [],
      usage: { inputTokens: r.usage?.inputTokens ?? 0, outputTokens: r.usage?.outputTokens ?? 0, costMicroUsd: r.usage?.costMicroUsd ?? null },
      model: r.model ?? 'scripted-1',
      generationId: r.generationId ?? null,
      provider: this.#id,
      upstreamProvider: null,
    });
  }
}
