/**
 * Decision API go/no-go. Models propose; deterministic policy decides.
 *
 * GO only if ALL hold, otherwise NO_GO with every failing reason:
 *   (a) the strategy version has a PASS evaluation that has not expired (≤ 30 days);
 *   (b) every data input is fresh and its licence permits strategy derivation;
 *   (c) model and baseline agree — or policy explicitly allows a model-only signal
 *       (default: not allowed). With no usable model the decision is BASELINE_ONLY and
 *       needs policy.allowBaselineOnly (default: not allowed);
 *   (d) all ten risk gates (G1–G10) pass under the demo limits;
 *   (e) a founder-signed demo mandate is active and covers the instrument;
 *   (f) the kill switch is off.
 * A HOLD signal is always NO_GO (nothing to execute).
 *
 * The model never sees credentials and is never given a tool: the proposer receives
 * market data and the baseline only, and returns a typed proposal. A model outage gives
 * BASELINE_ONLY — a proposal is never fabricated. Every decision, GO or NO_GO, is
 * appended to the decision store.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { Instrument } from '../market/instrument.js';
import type { LicensingMetadata } from '../market/market-data.js';
import { Signal, type SignalResult, type StrategyInput } from '../strategy/types.js';
import { RiskAuthorizationEngine, OrderSide, OrderType, type AuthorizationGate, type Principal, type TradingAccount } from '../risk/authorization.js';
import { isUsablePass, type StrategyEvaluation } from '../backtest/evaluation.js';
import { QTY_SCALE } from '../backtest/exchange-filters.js';
import type { SqlQuery } from '../backtest/evaluation-store.js';
import { DEMO_CEILING, verifyDemoMandate, type DemoMandate, type TrustedMandateKeys } from './demo-mandate.js';
import { DECISION_SCHEMA, TradingDecisionAPI, type AIProvider, type ChatMessage } from './decision-api.js';

// ── model proposals ────────────────────────────────────────────────────────

export interface ModelOutput {
  readonly signal: Signal;
  readonly confidence: number;
  readonly rationale: string;
  readonly risks: readonly string[];
  /** Model id as reported by the provider (never the requested id). */
  readonly servedModelId: string;
  readonly generationId: string | null;
}

export type ModelProposalOutcome =
  | { readonly status: 'OK'; readonly output: ModelOutput }
  | { readonly status: 'OUTAGE'; readonly reason: string }
  | { readonly status: 'INVALID'; readonly reason: string };

export interface ModelProposer {
  propose(input: StrategyInput, baseline: SignalResult): Promise<ModelProposalOutcome>;
}

/** An AIProvider that also reports the served model and generation ids. */
export interface AIProviderWithMeta extends AIProvider {
  structuredOutputWithMeta(
    messages: readonly ChatMessage[],
    schema: unknown,
    opts?: { model?: string },
  ): Promise<{ readonly output: unknown; readonly servedModelId: string | null; readonly generationId: string | null }>;
}

/** Strict validation of untrusted model output against DECISION_SCHEMA. */
export function validateModelOutput(raw: unknown): { ok: true; value: Omit<ModelOutput, 'servedModelId' | 'generationId'> } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'model output is not an object' };
  const r = raw as Record<string, unknown>;
  const allowed = new Set(Object.keys(DECISION_SCHEMA.properties));
  const extra = Object.keys(r).filter((k) => !allowed.has(k));
  if (extra.length) return { ok: false, reason: `unexpected fields: ${extra.join(', ')}` };
  if (r['signal'] !== 'BUY' && r['signal'] !== 'SELL' && r['signal'] !== 'HOLD') return { ok: false, reason: 'signal must be BUY, SELL or HOLD' };
  const c = r['confidence'];
  if (typeof c !== 'number' || !Number.isFinite(c) || c < 0 || c > 1) return { ok: false, reason: 'confidence must be a number in [0,1]' };
  if (typeof r['rationale'] !== 'string' || r['rationale'].length > 500) return { ok: false, reason: 'rationale must be a string ≤ 500 chars' };
  const risks = r['risks'];
  if (!Array.isArray(risks) || risks.length > 5 || !risks.every((x) => typeof x === 'string')) return { ok: false, reason: 'risks must be ≤ 5 strings' };
  return { ok: true, value: { signal: r['signal'] as Signal, confidence: c, rationale: r['rationale'], risks: risks as string[] } };
}

/** Wrap an AIProviderWithMeta (e.g. OpenRouter) as a ModelProposer. */
export function aiModelProposer(provider: AIProviderWithMeta, model: string): ModelProposer {
  return {
    async propose(input, baseline) {
      const messages = TradingDecisionAPI.buildMessages(input, baseline);
      let res: Awaited<ReturnType<AIProviderWithMeta['structuredOutputWithMeta']>>;
      try {
        res = await provider.structuredOutputWithMeta(messages, DECISION_SCHEMA, { model });
      } catch (e) {
        return { status: 'OUTAGE', reason: `model provider ${provider.id} failed: ${e instanceof Error ? e.message.slice(0, 200) : 'error'}` };
      }
      const v = validateModelOutput(res.output);
      if (!v.ok) return { status: 'INVALID', reason: `schema-invalid model output: ${v.reason}` };
      if (!res.servedModelId) return { status: 'INVALID', reason: 'provider did not report the served model id' };
      return { status: 'OK', output: { ...v.value, servedModelId: res.servedModelId, generationId: res.generationId } };
    },
  };
}

// ── decision record ────────────────────────────────────────────────────────

export interface DataProvenance {
  readonly source: string;
  readonly retrievedAt: string;
  /** Freshness limit for this input, seconds. */
  readonly maxAgeS: number;
  readonly licence: LicensingMetadata;
}

export interface DecisionPolicy {
  readonly allowModelOnly: boolean;
  readonly allowBaselineOnly: boolean;
}
export const DEFAULT_POLICY: DecisionPolicy = Object.freeze({ allowModelOnly: false, allowBaselineOnly: false });

export interface PortfolioState {
  readonly principal: Principal;
  readonly account: TradingAccount;
  /** Open positions across all demo instruments. */
  readonly openPositions: number;
  readonly exposureMinor: bigint;
  /** Today's (UTC) realized + unrealized loss, positive = loss. */
  readonly todaysLossMinor: bigint;
  /** Base-asset quantity currently held in this instrument (atoms, 10^-8). */
  readonly holdingAtoms: bigint;
  /** Idempotency keys already used. */
  readonly seenIdempotencyKeys: ReadonlySet<string>;
}

export interface DecisionInput {
  readonly instrument: Instrument;
  readonly strategy: { readonly id: string; readonly version: string };
  readonly strategyInput: StrategyInput;
  readonly baseline: SignalResult;
  readonly evaluation: StrategyEvaluation | null;
  readonly provenance: readonly DataProvenance[];
  /** Reference price for sizing (last close or ask), minor units. */
  readonly referencePriceMinor: bigint;
  readonly portfolio: PortfolioState;
  readonly mandate: DemoMandate | null;
  readonly killSwitchEngaged: boolean;
  readonly policy?: DecisionPolicy;
  /** Interval key for the idempotency key (e.g. the bar timestamp). */
  readonly intervalKey: string;
}

export type GateStatus = 'PASS' | 'FAIL' | 'NOT_EVALUATED';

export interface DecisionRecord {
  readonly decision_id: string;
  readonly instrument: string;
  readonly timestamp: string;
  readonly mode: 'MODEL_AND_BASELINE' | 'BASELINE_ONLY';
  readonly data_provenance: ReadonlyArray<{ readonly source: string; readonly retrieved_at: string; readonly age_s: number; readonly max_age_s: number; readonly licence: LicensingMetadata }>;
  readonly strategy_id: string;
  readonly strategy_version: string;
  readonly evaluation_id: string | null;
  readonly model_output: (Omit<ModelOutput, 'servedModelId' | 'generationId'> & { readonly served_model_id: string; readonly generation_id: string | null }) | null;
  readonly model_status: 'OK' | 'OUTAGE' | 'INVALID' | 'NOT_CONFIGURED';
  readonly model_status_reason: string | null;
  readonly baseline_signal: { readonly signal: Signal; readonly confidence: number; readonly rationale: string; readonly strategy_version: string };
  readonly policy_result: { readonly allow_model_only: boolean; readonly allow_baseline_only: boolean; readonly final_signal: Signal | null; readonly basis: string };
  readonly risk_gates: ReadonlyArray<{ readonly gate: AuthorizationGate; readonly status: GateStatus; readonly reason: string | null }>;
  readonly order_intent: { readonly side: 'BUY' | 'SELL'; readonly order_type: 'MARKET'; readonly quantity_atoms: string; readonly notional_minor: string; readonly idempotency_key: string } | null;
  readonly mandate_id: string | null;
  readonly kill_switch_engaged: boolean;
  readonly verdict: 'GO' | 'NO_GO';
  readonly reasons: readonly string[];
  /** Demo/test activity. Never revenue. */
  readonly is_test: true;
}

const ALL_GATES: readonly AuthorizationGate[] = ['G1_PRINCIPAL', 'G2_TRADING_AUTH', 'G3_ACCOUNT_ELIGIBLE', 'G4_DATA_FRESH', 'G5_INSTRUMENT_APPROVED', 'G6_FUNDS', 'G7_POSITION_LIMIT', 'G8_DAILY_LOSS', 'G9_DUPLICATE', 'G10_KILL_SWITCH'];

export class GoNoGoEngine {
  readonly #risk = new RiskAuthorizationEngine();

  constructor(
    private readonly deps: {
      readonly proposer: ModelProposer | null;
      readonly trustedMandateKeys: TrustedMandateKeys;
      readonly store: DecisionStore;
      readonly clock?: () => Date;
      readonly newId?: () => string;
    },
  ) {}

  async decide(inp: DecisionInput): Promise<DecisionRecord> {
    const now = (this.deps.clock ?? (() => new Date()))();
    const policy = inp.policy ?? DEFAULT_POLICY;
    const reasons: string[] = [];

    // (a) evaluation
    const ev = isUsablePass(inp.evaluation, inp.strategy.id, inp.strategy.version, inp.instrument.id, now);
    if (!ev.ok) reasons.push(`(a) ${ev.reason}`);

    // (b) freshness + licence
    const prov = inp.provenance.map((p) => ({ source: p.source, retrieved_at: p.retrievedAt, age_s: Math.max(0, Math.floor((now.getTime() - Date.parse(p.retrievedAt)) / 1000)), max_age_s: p.maxAgeS, licence: p.licence }));
    if (prov.length === 0) reasons.push('(b) no data provenance recorded');
    for (const [i, p] of prov.entries()) {
      const t = Date.parse(inp.provenance[i]!.retrievedAt);
      if (!Number.isFinite(t)) reasons.push(`(b) ${p.source} retrieval time is invalid`);
      else if (t > now.getTime() + 5_000) reasons.push(`(b) ${p.source} retrieval time is in the future`);
      if (!Number.isFinite(p.age_s) || p.age_s > p.max_age_s) reasons.push(`(b) ${p.source} data is stale (${p.age_s}s > ${p.max_age_s}s)`);
      if (!p.licence.strategyDerivationPermitted) reasons.push(`(b) ${p.source} licence does not permit strategy derivation`);
    }
    const maxAge = prov.reduce((a, p) => Math.max(a, p.age_s), 0);
    const maxAllowed = prov.reduce((a, p) => Math.min(a, p.max_age_s), Number.POSITIVE_INFINITY);

    // (c) model vs baseline
    let outcome: ModelProposalOutcome | null = null;
    if (this.deps.proposer) {
      try {
        outcome = await this.deps.proposer.propose(inp.strategyInput, inp.baseline);
      } catch (e) {
        outcome = { status: 'OUTAGE', reason: e instanceof Error ? e.message.slice(0, 200) : 'proposer failed' };
      }
    }
    const modelOk = outcome?.status === 'OK' ? outcome.output : null;
    const mode: DecisionRecord['mode'] = outcome === null || outcome.status === 'OUTAGE' ? 'BASELINE_ONLY' : 'MODEL_AND_BASELINE';
    let finalSignal: Signal | null = null;
    let basis: string;
    if (modelOk && modelOk.signal === inp.baseline.signal) {
      finalSignal = modelOk.signal;
      basis = 'model and baseline agree';
    } else if (modelOk && policy.allowModelOnly) {
      finalSignal = modelOk.signal;
      basis = 'model-only signal permitted by policy';
    } else if (modelOk) {
      basis = `model ${modelOk.signal} disagrees with baseline ${inp.baseline.signal}; model-only not permitted`;
      reasons.push(`(c) ${basis}`);
    } else if (outcome?.status === 'INVALID') {
      basis = outcome.reason;
      reasons.push(`(c) ${outcome.reason}`);
    } else if (policy.allowBaselineOnly) {
      finalSignal = inp.baseline.signal;
      basis = `BASELINE_ONLY (${outcome ? 'model outage' : 'no model configured'}); permitted by policy`;
    } else {
      basis = `BASELINE_ONLY (${outcome?.status === 'OUTAGE' ? outcome.reason : 'no model configured'}); baseline-only not permitted by policy`;
      reasons.push(`(c) ${basis}`);
    }
    if (finalSignal === Signal.HOLD) reasons.push('signal HOLD: nothing to execute');

    // (e) mandate
    const md = verifyDemoMandate(inp.mandate, this.deps.trustedMandateKeys, now);
    if (!md.ok) reasons.push(`(e) ${md.reason}`);
    else if (!inp.mandate!.scope.instrumentIds.includes(inp.instrument.id)) reasons.push(`(e) mandate does not cover ${inp.instrument.id}`);
    else if (inp.mandate!.principalId !== inp.portfolio.principal.id) reasons.push('(e) mandate principal does not match');

    // (f) kill switch
    if (inp.killSwitchEngaged) reasons.push('(f) kill switch engaged');

    // (d) risk gates — sized under the tighter of the mandate and the hard demo ceiling.
    let gates: DecisionRecord['risk_gates'] = ALL_GATES.map((gate) => ({ gate, status: 'NOT_EVALUATED' as GateStatus, reason: 'no actionable order' }));
    let orderIntent: DecisionRecord['order_intent'] = null;
    const side = finalSignal === Signal.BUY ? OrderSide.BUY : finalSignal === Signal.SELL ? OrderSide.SELL : null;
    const scope = inp.mandate?.scope;
    const perOrder = scope && scope.maxOrderNotionalMinor < DEMO_CEILING.maxOrderNotionalMinor ? scope.maxOrderNotionalMinor : DEMO_CEILING.maxOrderNotionalMinor;
    const maxPositions = Math.min(scope?.maxOpenPositions ?? DEMO_CEILING.maxOpenPositions, DEMO_CEILING.maxOpenPositions);
    const maxLoss = scope && scope.maxDailyLossMinor < DEMO_CEILING.maxDailyLossMinor ? scope.maxDailyLossMinor : DEMO_CEILING.maxDailyLossMinor;
    if (side === OrderSide.SELL && inp.portfolio.holdingAtoms <= 0n) {
      reasons.push('(d) spot only: no position to sell (no shorting)');
    } else if (side !== null) {
      if (inp.referencePriceMinor <= 0n) reasons.push('(d) no reference price');
      const px = inp.referencePriceMinor > 0n ? inp.referencePriceMinor : 1n;
      const qtyAtoms = side === OrderSide.BUY ? (perOrder * QTY_SCALE) / px : inp.portfolio.holdingAtoms;
      const notional = (qtyAtoms * px) / QTY_SCALE;
      const idem = idempotencyKey(inp.instrument.id, inp.strategy, inp.intervalKey, side);
      const reducing = side === OrderSide.SELL;
      const res = this.#risk.evaluateAll({
        principal: inp.portfolio.principal,
        // For a reducing SELL the "funds" are the base asset being sold.
        account: reducing ? { ...inp.portfolio.account, balanceMinor: notional } : inp.portfolio.account,
        orderIntent: { idempotencyKey: idem, instrumentId: inp.instrument.id, exchange: inp.instrument.exchange, side, orderType: OrderType.MARKET, quantity: 0, quantityAtoms: qtyAtoms },
        limits: { maxPositionCount: maxPositions, maxExposureMinor: perOrder * BigInt(maxPositions), maxDailyLossMinor: maxLoss, maxOrderNotionalMinor: reducing ? undefined : perOrder },
        dataAgeSeconds: prov.length ? maxAge : Number.POSITIVE_INFINITY,
        maxDataAgeSeconds: Number.isFinite(maxAllowed) ? maxAllowed : 0,
        approvedInstruments: new Set((scope?.instrumentIds ?? []).filter((i) => DEMO_CEILING.instrumentIds.includes(i))),
        // Closing a position never counts as opening another one.
        currentPositionCount: reducing ? Math.max(0, inp.portfolio.openPositions - 1) : inp.portfolio.openPositions,
        currentExposureMinor: reducing ? (inp.portfolio.exposureMinor > notional ? inp.portfolio.exposureMinor - notional : 0n) : inp.portfolio.exposureMinor,
        todaysLossMinor: inp.portfolio.todaysLossMinor,
        isDuplicate: inp.portfolio.seenIdempotencyKeys.has(idem),
        killSwitchEngaged: inp.killSwitchEngaged,
        orderValueMinor: notional,
      });
      gates = res.gates.map((g) => ({ gate: g.gate, status: g.passed ? 'PASS' : 'FAIL', reason: g.reason }));
      for (const g of res.gates) if (!g.passed) reasons.push(`(d) ${g.gate}: ${g.reason}`);
      if (qtyAtoms <= 0n) reasons.push('(d) order size rounds to zero');
      orderIntent = { side, order_type: 'MARKET', quantity_atoms: qtyAtoms.toString(), notional_minor: notional.toString(), idempotency_key: idem };
    }

    const verdict: 'GO' | 'NO_GO' = reasons.length === 0 && side !== null ? 'GO' : 'NO_GO';
    if (verdict === 'NO_GO' && reasons.length === 0) reasons.push('no actionable signal');
    const record: DecisionRecord = deepFreeze({
      decision_id: (this.deps.newId ?? (() => `dec_${randomUUID()}`))(),
      instrument: inp.instrument.id,
      timestamp: now.toISOString(),
      mode,
      data_provenance: prov,
      strategy_id: inp.strategy.id,
      strategy_version: inp.strategy.version,
      evaluation_id: inp.evaluation?.evaluationId ?? null,
      model_output: modelOk ? { signal: modelOk.signal, confidence: modelOk.confidence, rationale: modelOk.rationale, risks: modelOk.risks, served_model_id: modelOk.servedModelId, generation_id: modelOk.generationId } : null,
      model_status: outcome === null ? 'NOT_CONFIGURED' : outcome.status,
      model_status_reason: outcome && outcome.status !== 'OK' ? outcome.reason : null,
      baseline_signal: { signal: inp.baseline.signal, confidence: inp.baseline.confidence, rationale: inp.baseline.rationale, strategy_version: inp.baseline.strategyVersion },
      policy_result: { allow_model_only: policy.allowModelOnly, allow_baseline_only: policy.allowBaselineOnly, final_signal: finalSignal, basis },
      risk_gates: gates,
      order_intent: orderIntent,
      mandate_id: inp.mandate?.mandateId ?? null,
      kill_switch_engaged: inp.killSwitchEngaged,
      verdict,
      reasons,
      is_test: true,
    });
    await this.deps.store.append(record);
    return record;
  }
}

/** Deterministic idempotency key (also the Binance newClientOrderId): ≤ 36 chars, [A-Za-z0-9_-]. */
export function idempotencyKey(instrumentId: string, strategy: { id: string; version: string }, intervalKey: string, side: string): string {
  return `sl-${createHash('sha256').update(`${instrumentId}|${strategy.id}@${strategy.version}|${intervalKey}|${side}`).digest('hex').slice(0, 32)}`;
}

// ── storage ────────────────────────────────────────────────────────────────

export interface DecisionStore {
  append(d: DecisionRecord): Promise<void>;
  list(instrumentId: string, limit: number): Promise<DecisionRecord[]>;
}

export class InMemoryDecisionStore implements DecisionStore {
  readonly #rows: DecisionRecord[] = [];
  async append(d: DecisionRecord) {
    if (this.#rows.some((r) => r.decision_id === d.decision_id)) throw new Error(`decision ${d.decision_id} already recorded (append-only)`);
    this.#rows.push(d);
  }
  async list(instrumentId: string, limit: number) { return this.#rows.filter((r) => r.instrument === instrumentId).slice(-limit).reverse(); }
  get all(): readonly DecisionRecord[] { return this.#rows; }
}


/** INSERT-only store over trading_decisions (migration 040). */
export class PgDecisionStore implements DecisionStore {
  constructor(private readonly query: SqlQuery) {}
  async append(d: DecisionRecord) {
    await this.query(
      `INSERT INTO trading_decisions (decision_id, instrument_id, decided_at, strategy_id, strategy_version, evaluation_id, mode, verdict, is_test, record)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9::jsonb)`,
      [d.decision_id, d.instrument, d.timestamp, d.strategy_id, d.strategy_version, d.evaluation_id, d.mode, d.verdict, JSON.stringify(d)],
    );
  }
  async list(instrumentId: string, limit: number) {
    const r = await this.query('SELECT record FROM trading_decisions WHERE instrument_id = $1 ORDER BY decided_at DESC LIMIT $2', [instrumentId, Math.min(Math.max(1, limit), 500)]);
    return r.rows.map((x) => (typeof x['record'] === 'string' ? JSON.parse(x['record']) : x['record']) as DecisionRecord);
  }
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
