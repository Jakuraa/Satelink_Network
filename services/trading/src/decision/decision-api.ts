/**
 * TradingDecisionAPI — LLM-based decision proposals.
 *
 * MODELS PROPOSE; DETERMINISTIC POLICY AUTHORIZES.
 *
 * This layer:
 *   1. Formats market data and strategy signals into a structured prompt.
 *   2. Calls an AIProvider (OpenRouter) to get a structured JSON proposal.
 *   3. Re-validates the JSON proposal against a schema.
 *   4. Returns the proposal alongside the deterministic baseline.
 *
 * It NEVER:
 *   - Executes an order.
 *   - Receives broker credentials.
 *   - Acts without subsequent risk authorization.
 */
export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
}

export interface AIProvider {
  readonly id: string;
  structuredOutput<T = unknown>(
    messages: readonly ChatMessage[],
    schema: unknown,
    opts?: { model?: string },
  ): Promise<T>;
}

import type { StrategyInput, SignalResult } from '../strategy/types.js';

export interface TradingDecisionRequest {
  readonly input: StrategyInput;
  readonly deterministicBaseline: SignalResult;
  readonly model?: string;
}

export interface TradingDecisionProposal {
  /** BUY, SELL, or HOLD */
  readonly signal: string;
  /** 0–1 */
  readonly confidence: number;
  /** Max 500 chars */
  readonly rationale: string;
  /** Key risks the LLM identified */
  readonly risks: readonly string[];
  /** The model that produced this proposal */
  readonly model: string;
  /** Provider generation id for cost audit */
  readonly generationId: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costMicroUsd: bigint | null;
}

export interface TradingDecisionResult {
  readonly proposal: TradingDecisionProposal;
  readonly baseline: SignalResult;
  readonly agreesWithBaseline: boolean;
  readonly requestedAt: string;
  readonly respondedAt: string;
}

const SYSTEM_PROMPT = [
  'You are a trading signal analyst. Your role is to propose a trading signal (BUY/SELL/HOLD) based on the provided market data.',
  'You are NOT executing any trade. Your proposal is one input to a deterministic risk system that makes the final decision.',
  'Be concise and factual. Do not invent data. Flag uncertainty as HOLD.',
  'Respond ONLY with valid JSON matching the provided schema.',
].join('\n');

export const DECISION_SCHEMA = {
  type: 'object',
  required: ['signal', 'confidence', 'rationale', 'risks'],
  additionalProperties: false,
  properties: {
    signal: { type: 'string', enum: ['BUY', 'SELL', 'HOLD'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string', maxLength: 500 },
    risks: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
} as const;

export class TradingDecisionAPI {
  readonly #provider: AIProvider;
  readonly #defaultModel: string;

  constructor(opts: { provider: AIProvider; defaultModel?: string }) {
    this.#provider = opts.provider;
    this.#defaultModel = opts.defaultModel ?? 'anthropic/claude-3.5-haiku';
  }

  /** The exact messages sent to the model. Contains market data only — never credentials. */
  static buildMessages(input: StrategyInput, baseline: SignalResult): readonly ChatMessage[] {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: formatDecisionPrompt(input, baseline) },
    ];
  }

  async propose(req: TradingDecisionRequest): Promise<TradingDecisionResult> {
    const requestedAt = new Date().toISOString();
    const { input, deterministicBaseline, model } = req;

    const messages = TradingDecisionAPI.buildMessages(input, deterministicBaseline);

    const raw = await this.#provider.structuredOutput<{
      signal: string;
      confidence: number;
      rationale: string;
      risks: string[];
    }>(messages, DECISION_SCHEMA, { model: model ?? this.#defaultModel });

    const respondedAt = new Date().toISOString();

    // structuredOutput already validated against schema; defensive normalize:
    const proposal: TradingDecisionProposal = {
      signal: raw.signal,
      confidence: Number(raw.confidence),
      rationale: String(raw.rationale).slice(0, 500),
      risks: (raw.risks ?? []).slice(0, 5).map(String),
      model: model ?? this.#defaultModel,
      generationId: null, // populated if we add onUsage callback
      inputTokens: 0,
      outputTokens: 0,
      costMicroUsd: null,
    };

    const agreesWithBaseline = proposal.signal === deterministicBaseline.signal;

    return { proposal, baseline: deterministicBaseline, agreesWithBaseline, requestedAt, respondedAt };
  }
}

export function formatDecisionPrompt(input: StrategyInput, baseline: SignalResult): string {
  const { instrument, latestQuote, recentCandles } = input;
  const lines: string[] = [
    `Instrument: ${instrument.symbol} (${instrument.assetClass}) on ${instrument.exchange}`,
    `Currency: ${instrument.currency}`,
  ];

  if (latestQuote) {
    const bid = latestQuote.bidMinor != null ? minorToDisplay(latestQuote.bidMinor, instrument.pricePrecision) : 'N/A';
    const ask = latestQuote.askMinor != null ? minorToDisplay(latestQuote.askMinor, instrument.pricePrecision) : 'N/A';
    lines.push(`Latest quote: bid=${bid}, ask=${ask}`);
    lines.push(`Data freshness: ${latestQuote.freshness}`);
  } else {
    lines.push('No live quote available.');
  }

  if (recentCandles.length > 0) {
    const last5 = recentCandles.slice(-5);
    lines.push(`Recent ${input.recentCandles[0]?.period ?? ''} candles (last ${last5.length}, OHLC in display units):`);
    for (const c of last5) {
      lines.push(`  O=${minorToDisplay(c.openMinor, instrument.pricePrecision)} H=${minorToDisplay(c.highMinor, instrument.pricePrecision)} L=${minorToDisplay(c.lowMinor, instrument.pricePrecision)} C=${minorToDisplay(c.closeMinor, instrument.pricePrecision)} V=${c.volume}`);
    }
  }

  lines.push('');
  lines.push(`Deterministic baseline signal: ${baseline.signal} (confidence: ${baseline.confidence.toFixed(2)})`);
  lines.push(`Baseline rationale: ${baseline.rationale}`);
  lines.push('');
  lines.push('Propose a signal. If uncertain, signal HOLD.');

  return lines.join('\n');
}

function minorToDisplay(minor: bigint, precision: number): string {
  const factor = 10n ** BigInt(precision);
  const intPart = minor / factor;
  const fracPart = minor % factor;
  return `${intPart}.${fracPart.toString().padStart(precision, '0')}`;
}
