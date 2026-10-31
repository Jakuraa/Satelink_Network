/**
 * Append-only storage for StrategyEvaluation records.
 *
 * Table: trading_strategy_evaluations (database/migrations/040_trading_strategy_evaluations.sql).
 * The table rejects UPDATE and DELETE with a trigger; this module only ever INSERTs.
 * Records are stored whole as JSONB (bigints as decimal strings) plus indexed columns.
 */
import { canonicalJson, type StrategyEvaluation } from './evaluation.js';

export interface EvaluationStore {
  append(e: StrategyEvaluation): Promise<void>;
  get(evaluationId: string): Promise<StrategyEvaluation | null>;
  /** Newest evaluation for this strategy version on this instrument. */
  latest(strategyId: string, strategyVersion: string, instrumentId: string): Promise<StrategyEvaluation | null>;
}

export class DuplicateEvaluationError extends Error {
  constructor(id: string) {
    super(`evaluation ${id} already recorded (append-only)`);
    this.name = 'DuplicateEvaluationError';
  }
}

export class InMemoryEvaluationStore implements EvaluationStore {
  readonly #rows: StrategyEvaluation[] = [];
  async append(e: StrategyEvaluation): Promise<void> {
    if (this.#rows.some((r) => r.evaluationId === e.evaluationId)) throw new DuplicateEvaluationError(e.evaluationId);
    this.#rows.push(Object.isFrozen(e) ? e : Object.freeze({ ...e }));
  }
  async get(id: string) { return this.#rows.find((r) => r.evaluationId === id) ?? null; }
  async latest(strategyId: string, strategyVersion: string, instrumentId: string) {
    const rows = this.#rows.filter((r) => r.strategyId === strategyId && r.strategyVersion === strategyVersion && r.instrumentId === instrumentId);
    return rows.reduce<StrategyEvaluation | null>((a, b) => (!a || b.createdAt > a.createdAt ? b : a), null);
  }
  get size(): number { return this.#rows.length; }
}

/** Minimal pg-compatible query function (pg.Pool#query / pg.Client#query). */
export type SqlQuery = (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export class PgEvaluationStore implements EvaluationStore {
  constructor(private readonly query: SqlQuery) {}

  async append(e: StrategyEvaluation): Promise<void> {
    try {
      await this.query(
        `INSERT INTO trading_strategy_evaluations
           (evaluation_id, result_hash, strategy_id, strategy_version, instrument_id, verdict, flags, record, created_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
        [e.evaluationId, e.resultHash, e.strategyId, e.strategyVersion, e.instrumentId, e.verdict, [...e.flags], canonicalJson(e), e.createdAt, e.expiresAt],
      );
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') throw new DuplicateEvaluationError(e.evaluationId);
      throw err;
    }
  }

  async get(id: string): Promise<StrategyEvaluation | null> {
    const r = await this.query('SELECT record FROM trading_strategy_evaluations WHERE evaluation_id = $1', [id]);
    return r.rows[0] ? reviveEvaluation(r.rows[0]['record']) : null;
  }

  async latest(strategyId: string, strategyVersion: string, instrumentId: string): Promise<StrategyEvaluation | null> {
    const r = await this.query(
      `SELECT record FROM trading_strategy_evaluations
        WHERE strategy_id = $1 AND strategy_version = $2 AND instrument_id = $3
        ORDER BY created_at DESC LIMIT 1`,
      [strategyId, strategyVersion, instrumentId],
    );
    return r.rows[0] ? reviveEvaluation(r.rows[0]['record']) : null;
  }
}

const BIGINT_KEYS = new Set([
  'netReturnBps', 'maxDrawdownBps', 'feesPaidMinor', 'finalEquityMinor', 'initialCashMinor', 'allocationBps',
  'feeBps', 'halfSpreadBps', 'slippageBps', 'candidateWorstDrawdownBps', 'buyAndHoldWorstDrawdownBps',
  'candidateTotalReturnBps', 'bestBaselineTotalReturnBps',
]);

/** Restore bigints from a stored JSON record. */
export function reviveEvaluation(raw: unknown): StrategyEvaluation {
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const walk = (v: unknown, key?: string): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, k)]));
    if (key && BIGINT_KEYS.has(key) && typeof v === 'string' && /^-?\d+$/.test(v)) return BigInt(v);
    return v;
  };
  return walk(obj) as StrategyEvaluation;
}
