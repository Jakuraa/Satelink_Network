/**
 * @satelink/trading — TradingDecisionAPI unit tests
 */
import { describe, it, expect } from 'vitest';
import { TradingDecisionAPI, type AIProvider } from '../decision/decision-api.js';
import { PAPER_INSTRUMENTS } from '../market/instrument.js';
import { Signal, type SignalResult, type StrategyInput } from '../strategy/types.js';

class MockAIProvider implements AIProvider {
  readonly id = 'mock-provider';
  public lastMessages: readonly unknown[] = [];
  public replyPayload: { signal: string; confidence: number; rationale: string; risks: string[] } = {
    signal: 'BUY',
    confidence: 0.85,
    rationale: 'Bullish divergence and strong volume momentum',
    risks: ['Market volatility', 'Fed announcement'],
  };

  async structuredOutput<T = unknown>(
    messages: readonly unknown[],
    _schema: unknown,
    _opts?: { model?: string },
  ): Promise<T> {
    this.lastMessages = messages;
    return this.replyPayload as unknown as T;
  }
}

describe('TradingDecisionAPI', () => {
  const BTC = PAPER_INSTRUMENTS.BTC_USDT;
  const mockBaseline: SignalResult = {
    signal: Signal.BUY,
    confidence: 0.75,
    rationale: 'Fast SMA crossed above Slow SMA',
    strategyVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
  };

  const input: StrategyInput = {
    instrument: BTC,
    latestQuote: null,
    recentCandles: [],
  };

  it('proposes decision that agrees with baseline when signals match', async () => {
    const provider = new MockAIProvider();
    provider.replyPayload = {
      signal: 'BUY',
      confidence: 0.9,
      rationale: 'Trend alignment',
      risks: ['Volatility'],
    };

    const api = new TradingDecisionAPI({ provider });
    const res = await api.propose({
      input,
      deterministicBaseline: mockBaseline,
    });

    expect(res.proposal.signal).toBe('BUY');
    expect(res.proposal.confidence).toBe(0.9);
    expect(res.proposal.rationale).toBe('Trend alignment');
    expect(res.proposal.risks).toEqual(['Volatility']);
    expect(res.agreesWithBaseline).toBe(true);
    expect(res.baseline).toEqual(mockBaseline);
  });

  it('marks agreesWithBaseline as false when signals diverge', async () => {
    const provider = new MockAIProvider();
    provider.replyPayload = {
      signal: 'HOLD',
      confidence: 0.4,
      rationale: 'Uncertain regime',
      risks: ['Breakdown risk'],
    };

    const api = new TradingDecisionAPI({ provider });
    const res = await api.propose({
      input,
      deterministicBaseline: mockBaseline,
    });

    expect(res.proposal.signal).toBe('HOLD');
    expect(res.agreesWithBaseline).toBe(false);
  });

  it('truncates rationale to 500 characters', async () => {
    const provider = new MockAIProvider();
    const longRationale = 'A'.repeat(700);
    provider.replyPayload = {
      signal: 'BUY',
      confidence: 0.8,
      rationale: longRationale,
      risks: [],
    };

    const api = new TradingDecisionAPI({ provider });
    const res = await api.propose({
      input,
      deterministicBaseline: mockBaseline,
    });

    expect(res.proposal.rationale.length).toBe(500);
  });

  it('caps risks to max 5 items', async () => {
    const provider = new MockAIProvider();
    provider.replyPayload = {
      signal: 'BUY',
      confidence: 0.8,
      rationale: 'Good setup',
      risks: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'],
    };

    const api = new TradingDecisionAPI({ provider });
    const res = await api.propose({
      input,
      deterministicBaseline: mockBaseline,
    });

    expect(res.proposal.risks).toHaveLength(5);
    expect(res.proposal.risks).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']);
  });
});
