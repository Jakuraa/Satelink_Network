// SIE budget check (ACCEPTANCE_TESTS SIE "Budget"; decisions S-4, S-5): a request whose estimated
// maximum cost exceeds its hold is refused BEFORE the provider is called. The hold is what the
// Financial OS reserved for the request (reserve → capture/release), in integer micro-USD.
//
// The estimate is an upper bound, never a guess at the final bill: input tokens are over-estimated
// from the prompt text and output is priced at the full max_tokens. Pure: no I/O; the estimator
// and the hold are injected per request.
import { AgentError } from './errors.js';
import { AIProvider } from './provider.js';
import type { ChatMessage, ChatOptions, ChatResult, StreamChunk } from './provider.js';

export class BudgetExceededError extends AgentError {
  readonly estimateMicroUsd: bigint;
  readonly holdMicroUsd: bigint;
  constructor(estimateMicroUsd: bigint, holdMicroUsd: bigint) {
    super('BUDGET_EXCEEDED', `estimated max cost ${estimateMicroUsd} micro-USD exceeds the hold of ${holdMicroUsd} micro-USD`, {
      estimateMicroUsd: estimateMicroUsd.toString(), holdMicroUsd: holdMicroUsd.toString(),
    });
    this.name = 'BudgetExceededError';
    this.estimateMicroUsd = estimateMicroUsd;
    this.holdMicroUsd = holdMicroUsd;
  }
}

/** Per-million-token prices in integer micro-USD (e.g. $3.00 / 1M input → 3_000_000n). */
export interface ModelPrice {
  readonly inputPerMTokMicroUsd: bigint;
  readonly outputPerMTokMicroUsd: bigint;
}

export type CostEstimator = (messages: readonly ChatMessage[], opts: ChatOptions) => bigint;

const ceilDiv = (a: bigint, b: bigint): bigint => (a + b - 1n) / b;
const PER_MTOK = 1_000_000n;
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Upper-bound input tokens: one token per 2 UTF-16 code units of every message's text plus 8 per
 * message for framing. Tokenizers average ~4 characters per token on English text, so this
 * over-estimates by about 2× — a refusal may come early, never late.
 */
export function upperBoundInputTokens(messages: readonly ChatMessage[]): bigint {
  let units = 0n;
  for (const m of messages) units += BigInt(m.content.length) + 16n;
  return ceilDiv(units, 2n);
}

/** Max cost = input upper bound × input price + max_tokens × output price, rounded UP to a micro. */
export function priceEstimator(price: ModelPrice): CostEstimator {
  return (messages, opts) => {
    const maxOut = BigInt(opts.maxTokens ?? DEFAULT_MAX_TOKENS);
    const inMicro = upperBoundInputTokens(messages) * price.inputPerMTokMicroUsd;
    const outMicro = maxOut * price.outputPerMTokMicroUsd;
    return ceilDiv(inMicro + outMicro, PER_MTOK);
  };
}

/**
 * Wrap a provider so every call is checked against `holdMicroUsd` first. Refused calls never reach
 * the inner provider (no network, no cost). The inherited structuredOutput() goes through this
 * chat(), so it is checked with the JSON-schema instruction included.
 */
export function withBudget(inner: AIProvider, budget: { holdMicroUsd: bigint; estimate: CostEstimator }): AIProvider {
  if (typeof budget.holdMicroUsd !== 'bigint' || budget.holdMicroUsd < 0n) {
    throw new AgentError('CONFIG', 'holdMicroUsd must be a non-negative bigint (micro-USD)');
  }
  return new BudgetedProvider(inner, budget.holdMicroUsd, budget.estimate);
}

class BudgetedProvider extends AIProvider {
  constructor(private readonly inner: AIProvider, private readonly hold: bigint, private readonly estimate: CostEstimator) {
    super();
  }

  get id(): string { return this.inner.id; }

  private check(messages: readonly ChatMessage[], opts: ChatOptions): void {
    const est = this.estimate(messages, opts);
    if (typeof est !== 'bigint' || est < 0n) throw new AgentError('CONFIG', 'cost estimator must return a non-negative bigint');
    if (est > this.hold) throw new BudgetExceededError(est, this.hold);
  }

  chat(messages: readonly ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    try { this.check(messages, opts); } catch (e) { return Promise.reject(e); }
    return this.inner.chat(messages, opts);
  }

  override reason(messages: readonly ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    try { this.check(messages, { ...opts, reasoning: true }); } catch (e) { return Promise.reject(e); }
    return this.inner.reason(messages, opts);
  }

  override async *stream(messages: readonly ChatMessage[], opts: ChatOptions = {}): AsyncGenerator<StreamChunk, void, void> {
    this.check(messages, opts);
    yield* this.inner.stream(messages, opts);
  }
}
