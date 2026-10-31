/**
 * @satelink/trading — Decision API go/no-go: one failing case per GO condition,
 * schema-invalid output, model outage, credential isolation, append-only storage.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { PAPER_INSTRUMENTS } from '../market/instrument.js';
import { Signal, type SignalResult, type StrategyInput } from '../strategy/types.js';
import {
  GoNoGoEngine, InMemoryDecisionStore, aiModelProposer, validateModelOutput,
  type AIProviderWithMeta, type DecisionInput, type ModelProposer, type ModelProposalOutcome,
} from '../decision/go-no-go.js';
import { mandateSigningPayload, verifyDemoMandate, type DemoMandate } from '../decision/demo-mandate.js';
import type { ChatMessage } from '../decision/decision-api.js';
import type { StrategyEvaluation } from '../backtest/evaluation.js';
import type { LicensingMetadata } from '../market/market-data.js';

const NOW = new Date('2026-11-02T12:00:00Z');
const BTC = PAPER_INSTRUMENTS.BTC_USDT;
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const KEYS = new Map<string, KeyObject>([['founder-2026', publicKey]]);
const BINANCE_LIC: LicensingMetadata = { source: 'binance', strategyDerivationPermitted: true, displayPermitted: true, redistributionPermitted: false, commercialLicense: false, licenseEvidence: null };

function signMandate(over: Partial<Omit<DemoMandate, 'signature'>> = {}, key = privateKey): DemoMandate {
  const body: Omit<DemoMandate, 'signature'> = {
    mandateId: 'mdt-demo-1', principalId: 'staff:founder',
    scope: { venue: 'BINANCE_SPOT_DEMO', spotOnly: true, currency: 'USDT', instrumentIds: ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT'], maxOrderNotionalMinor: 100_00n, maxOpenPositions: 3, maxDailyLossMinor: 50_00n },
    validFrom: '2026-11-01T00:00:00Z', expiresAt: '2026-11-15T00:00:00Z', revoked: false, signedBy: 'founder', keyId: 'founder-2026',
    ...over,
  };
  return { ...body, signature: sign(null, Buffer.from(mandateSigningPayload(body)), key).toString('base64') };
}

const PASS_EVAL = { evaluationId: 'eval_x', strategyId: 'sma-crossover', strategyVersion: '1.0.0', verdict: 'PASS', expiresAt: '2026-11-20T00:00:00Z' } as unknown as StrategyEvaluation;
const baseline = (signal: Signal = Signal.BUY): SignalResult => ({ signal, confidence: 0.6, rationale: 'fast above slow', strategyVersion: '1.0.0', generatedAt: NOW.toISOString() });
const proposer = (o: ModelProposalOutcome): ModelProposer => ({ propose: async () => o });
const agreeing = (signal: Signal = Signal.BUY) => proposer({ status: 'OK', output: { signal, confidence: 0.7, rationale: 'trend', risks: ['volatility'], servedModelId: 'anthropic/claude-haiku-5-5', generationId: 'gen-123' } });

function input(over: Partial<DecisionInput> = {}): DecisionInput {
  const strategyInput: StrategyInput = { instrument: BTC, latestQuote: null, recentCandles: [] };
  return {
    instrument: BTC,
    strategy: { id: 'sma-crossover', version: '1.0.0' },
    strategyInput,
    baseline: baseline(),
    evaluation: PASS_EVAL,
    provenance: [{ source: 'binance', retrievedAt: new Date(NOW.getTime() - 30_000).toISOString(), maxAgeS: 1800, licence: BINANCE_LIC }],
    referencePriceMinor: 68_000_00n,
    portfolio: {
      principal: { id: 'staff:founder', authenticated: true, tradingAuthorized: true },
      account: { id: 'demo', balanceMinor: 5_000_00n, currency: 'USDT', eligible: true, eligibleMarkets: ['BINANCE'] },
      openPositions: 0, exposureMinor: 0n, todaysLossMinor: 0n, holdingAtoms: 0n, seenIdempotencyKeys: new Set(),
    },
    mandate: signMandate(),
    killSwitchEngaged: false,
    intervalKey: '2026-11-02T12:00:00Z',
    ...over,
  };
}

function engine(p: ModelProposer | null = agreeing(), store = new InMemoryDecisionStore()) {
  return { e: new GoNoGoEngine({ proposer: p, trustedMandateKeys: KEYS, store, clock: () => NOW }), store };
}

describe('go/no-go — GO path', () => {
  it('GO when every condition holds; order sized within the 100 USDT demo cap; record stored', async () => {
    const { e, store } = engine();
    const d = await e.decide(input());
    expect(d.reasons).toEqual([]);
    expect(d.verdict).toBe('GO');
    expect(d.mode).toBe('MODEL_AND_BASELINE');
    expect(d.risk_gates).toHaveLength(10);
    expect(d.risk_gates.every((g) => g.status === 'PASS')).toBe(true);
    expect(BigInt(d.order_intent!.notional_minor)).toBeLessThanOrEqual(100_00n);
    expect(d.order_intent!.idempotency_key).toMatch(/^[A-Za-z0-9_-]{1,36}$/);
    expect(d.model_output).toMatchObject({ served_model_id: 'anthropic/claude-haiku-5-5', generation_id: 'gen-123' });
    expect(d.data_provenance[0]).toMatchObject({ source: 'binance', age_s: 30 });
    expect(d.is_test).toBe(true);
    expect(store.all).toHaveLength(1);
    expect(Object.isFrozen(d)).toBe(true);
  });
});

describe('go/no-go — one failing case per condition', () => {
  const expectNoGo = async (inp: DecisionInput, pattern: RegExp, p?: ModelProposer | null) => {
    const { e, store } = engine(p === undefined ? agreeing() : p);
    const d = await e.decide(inp);
    expect(d.verdict).toBe('NO_GO');
    expect(d.reasons.join(' | ')).toMatch(pattern);
    expect(store.all).toHaveLength(1); // NO_GO is stored too
    return d;
  };

  it('(a) no PASS evaluation / FAIL / expired / other version', async () => {
    await expectNoGo(input({ evaluation: null }), /\(a\) no evaluation on record/);
    await expectNoGo(input({ evaluation: { ...PASS_EVAL, verdict: 'FAIL' } as StrategyEvaluation }), /\(a\) .*verdict FAIL/);
    await expectNoGo(input({ evaluation: { ...PASS_EVAL, expiresAt: '2026-11-01T00:00:00Z' } as StrategyEvaluation }), /\(a\) .*expired/);
    await expectNoGo(input({ evaluation: { ...PASS_EVAL, strategyVersion: '0.9.0' } as StrategyEvaluation }), /\(a\) evaluation is for sma-crossover@0.9.0/);
  });

  it('(b) stale data / licence without strategy derivation', async () => {
    await expectNoGo(input({ provenance: [{ source: 'binance', retrievedAt: '2026-11-02T10:00:00Z', maxAgeS: 1800, licence: BINANCE_LIC }] }), /\(b\) binance data is stale/);
    await expectNoGo(input({ provenance: [{ source: 'eulerpool', retrievedAt: NOW.toISOString(), maxAgeS: 1800, licence: { ...BINANCE_LIC, source: 'eulerpool', strategyDerivationPermitted: false } }] }), /\(b\) eulerpool licence does not permit/);
    await expectNoGo(input({ provenance: [] }), /\(b\) no data provenance/);
  });

  it('(c) model disagrees and model-only is not allowed (default)', async () => {
    await expectNoGo(input(), /\(c\) model SELL disagrees with baseline BUY/, agreeing(Signal.SELL));
  });

  it('(c) model-only allowed by explicit policy → GO on the model signal', async () => {
    const { e } = engine(agreeing(Signal.BUY));
    const d = await e.decide(input({ baseline: baseline(Signal.HOLD), policy: { allowModelOnly: true, allowBaselineOnly: false } }));
    expect(d.verdict).toBe('GO');
    expect(d.policy_result.basis).toMatch(/model-only signal permitted/);
  });

  it('(d) a risk gate fails (daily loss limit, duplicate, funds, open positions)', async () => {
    const p = input().portfolio;
    await expectNoGo(input({ portfolio: { ...p, todaysLossMinor: 50_00n } }), /\(d\) G8_DAILY_LOSS/);
    await expectNoGo(input({ portfolio: { ...p, openPositions: 3 } }), /\(d\) G7_POSITION_LIMIT/);
    await expectNoGo(input({ portfolio: { ...p, account: { ...p.account, balanceMinor: 10_00n } } }), /\(d\) G6_FUNDS/);
    const { e } = engine();
    const first = await e.decide(input());
    await expectNoGo(input({ portfolio: { ...p, seenIdempotencyKeys: new Set([first.order_intent!.idempotency_key]) } }), /\(d\) G9_DUPLICATE/);
  });

  it('(d) spot only: SELL with no holding is NO_GO (no shorting)', async () => {
    await expectNoGo(input({ baseline: baseline(Signal.SELL) }), /no position to sell/, agreeing(Signal.SELL));
  });

  it('(e) mandate missing / forged / expired / revoked / over the demo ceiling / wrong instrument', async () => {
    await expectNoGo(input({ mandate: null }), /\(e\) no demo mandate/);
    const forger = generateKeyPairSync('ed25519').privateKey;
    await expectNoGo(input({ mandate: signMandate({}, forger) }), /\(e\) mandate signature invalid/);
    const tampered = { ...signMandate(), scope: { ...signMandate().scope, maxOrderNotionalMinor: 99_00n } };
    await expectNoGo(input({ mandate: tampered }), /\(e\) mandate signature invalid/);
    await expectNoGo(input({ mandate: signMandate({ expiresAt: '2026-11-02T00:00:00Z' }) }), /\(e\) mandate expired/);
    await expectNoGo(input({ mandate: signMandate({ revoked: true }) }), /\(e\) mandate revoked/);
    await expectNoGo(input({ mandate: signMandate({ scope: { ...signMandate().scope, maxOrderNotionalMinor: 1_000_00n } }) }), /\(e\) mandate per-order notional outside/);
    await expectNoGo(input({ mandate: signMandate({ scope: { ...signMandate().scope, instrumentIds: ['BINANCE:ETHUSDT'] } }) }), /\(e\) mandate does not cover BINANCE:BTCUSDT/);
  });

  it('(f) kill switch engaged', async () => {
    const d = await expectNoGo(input({ killSwitchEngaged: true }), /\(f\) kill switch engaged/);
    expect(d.risk_gates.find((g) => g.gate === 'G10_KILL_SWITCH')!.status).toBe('FAIL');
  });

  it('HOLD is never GO', async () => {
    await expectNoGo(input({ baseline: baseline(Signal.HOLD) }), /signal HOLD/, agreeing(Signal.HOLD));
  });
});

describe('go/no-go — model failures', () => {
  it('schema-invalid model output → NO_GO, no model_output recorded', async () => {
    const bad: AIProviderWithMeta = {
      id: 'stub', structuredOutput: async () => { throw new Error('unused'); },
      structuredOutputWithMeta: async () => ({ output: { signal: 'STRONG_BUY', confidence: 2, rationale: 'x', risks: [] }, servedModelId: 'm', generationId: 'g' }),
    };
    const { e } = engine(aiModelProposer(bad, 'm'));
    const d = await e.decide(input());
    expect(d.verdict).toBe('NO_GO');
    expect(d.model_status).toBe('INVALID');
    expect(d.model_output).toBeNull();
    expect(d.reasons.join(' ')).toMatch(/schema-invalid model output/);
    expect(validateModelOutput({ signal: 'BUY', confidence: 0.5, rationale: 'r', risks: [], extra: 1 }).ok).toBe(false);
  });

  it('a provider that does not report the served model is INVALID (no relabelling)', async () => {
    const p: AIProviderWithMeta = { id: 's', structuredOutput: async () => ({}) as never, structuredOutputWithMeta: async () => ({ output: { signal: 'BUY', confidence: 0.5, rationale: 'r', risks: [] }, servedModelId: null, generationId: null }) };
    const d = await engine(aiModelProposer(p, 'requested/model')).e.decide(input());
    expect(d.model_status).toBe('INVALID');
    expect(d.verdict).toBe('NO_GO');
  });

  it('model outage → BASELINE_ONLY with no fabricated proposal (NO_GO by default, GO only if policy allows)', async () => {
    const down: AIProviderWithMeta = { id: 'openrouter', structuredOutput: async () => { throw new Error('x'); }, structuredOutputWithMeta: async () => { throw new Error('HTTP 503'); } };
    const a = await engine(aiModelProposer(down, 'm')).e.decide(input());
    expect(a.mode).toBe('BASELINE_ONLY');
    expect(a.model_output).toBeNull();
    expect(a.model_status).toBe('OUTAGE');
    expect(a.verdict).toBe('NO_GO');
    const b = await engine(aiModelProposer(down, 'm')).e.decide(input({ policy: { allowModelOnly: false, allowBaselineOnly: true } }));
    expect(b.mode).toBe('BASELINE_ONLY');
    expect(b.model_output).toBeNull();
    expect(b.verdict).toBe('GO');
    const c = await engine(null).e.decide(input());
    expect(c).toMatchObject({ mode: 'BASELINE_ONLY', model_status: 'NOT_CONFIGURED', verdict: 'NO_GO' });
  });
});

describe('go/no-go — the model never sees credentials or tools', () => {
  const SENTINELS = { BINANCE_DEMO_API_KEY: 'SENTINEL-BINANCE-KEY-123', BINANCE_DEMO_API_SECRET: 'SENTINEL-BINANCE-SECRET-456', EULERPOOL_API_KEY: 'SENTINEL-EULER-789' };
  beforeEach(() => { Object.assign(process.env, SENTINELS); });
  afterEach(() => { for (const k of Object.keys(SENTINELS)) delete process.env[k]; });

  it('the provider receives market data only: no key material, no tools parameter', async () => {
    const seen: Array<{ messages: readonly ChatMessage[]; schema: unknown; opts: unknown }> = [];
    const spy: AIProviderWithMeta = {
      id: 'spy', structuredOutput: async () => ({}) as never,
      structuredOutputWithMeta: async (messages, schema, opts) => { seen.push({ messages, schema, opts }); return { output: { signal: 'BUY', confidence: 0.6, rationale: 'r', risks: [] }, servedModelId: 'spy/model', generationId: 'g' }; },
    };
    await engine(aiModelProposer(spy, 'spy/model')).e.decide(input());
    expect(seen).toHaveLength(1);
    const wire = JSON.stringify(seen[0]);
    for (const v of Object.values(SENTINELS)) expect(wire).not.toContain(v);
    expect(wire).not.toMatch(/apiKey|secret|signature|tools/i);
    expect(Object.keys(seen[0]!.opts as object)).toEqual(['model']);
  });
});

describe('demo mandate', () => {
  it('verifies signature, window and ceiling', () => {
    expect(verifyDemoMandate(signMandate(), KEYS, NOW).ok).toBe(true);
    expect(verifyDemoMandate(signMandate({ keyId: 'unknown' }), KEYS, NOW).reason).toMatch(/not trusted/);
    expect(verifyDemoMandate(signMandate({ validFrom: '2026-11-03T00:00:00Z' }), KEYS, NOW).reason).toMatch(/not yet valid/);
    expect(verifyDemoMandate(signMandate({ scope: { ...signMandate().scope, maxOpenPositions: 4 } }), KEYS, NOW).ok).toBe(false);
    expect(verifyDemoMandate(signMandate({ scope: { ...signMandate().scope, maxDailyLossMinor: 51_00n } }), KEYS, NOW).ok).toBe(false);
    expect(verifyDemoMandate(signMandate({ scope: { ...signMandate().scope, instrumentIds: ['BINANCE:SOLUSDT'] } }), KEYS, NOW).ok).toBe(false);
  });
});
