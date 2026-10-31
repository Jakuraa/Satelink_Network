/**
 * Append-only storage for StrategyEvaluation records.
 *
 * Table: trading_strategy_evaluations (database/migrations/040_trading_strategy_evaluations.sql).
 * The table rejects UPDATE and DELETE with a trigger; this module only ever INSERTs.
 * Records are stored whole as JSONB (bigints as decimal strings) plus indexed columns.
 */
import { canonicalJson } from './evaluation.js';
export class DuplicateEvaluationError extends Error {
    constructor(id) {
        super(`evaluation ${id} already recorded (append-only)`);
        this.name = 'DuplicateEvaluationError';
    }
}
export class InMemoryEvaluationStore {
    #rows = [];
    async append(e) {
        if (this.#rows.some((r) => r.evaluationId === e.evaluationId))
            throw new DuplicateEvaluationError(e.evaluationId);
        this.#rows.push(Object.isFrozen(e) ? e : Object.freeze({ ...e }));
    }
    async get(id) { return this.#rows.find((r) => r.evaluationId === id) ?? null; }
    async latest(strategyId, strategyVersion, instrumentId) {
        const rows = this.#rows.filter((r) => r.strategyId === strategyId && r.strategyVersion === strategyVersion && r.instrumentId === instrumentId);
        return rows.reduce((a, b) => (!a || b.createdAt > a.createdAt ? b : a), null);
    }
    get size() { return this.#rows.length; }
}
export class PgEvaluationStore {
    query;
    constructor(query) {
        this.query = query;
    }
    async append(e) {
        try {
            await this.query(`INSERT INTO trading_strategy_evaluations
           (evaluation_id, result_hash, strategy_id, strategy_version, instrument_id, verdict, flags, record, created_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`, [e.evaluationId, e.resultHash, e.strategyId, e.strategyVersion, e.instrumentId, e.verdict, [...e.flags], canonicalJson(e), e.createdAt, e.expiresAt]);
        }
        catch (err) {
            if (err?.code === '23505')
                throw new DuplicateEvaluationError(e.evaluationId);
            throw err;
        }
    }
    async get(id) {
        const r = await this.query('SELECT record FROM trading_strategy_evaluations WHERE evaluation_id = $1', [id]);
        return r.rows[0] ? reviveEvaluation(r.rows[0]['record']) : null;
    }
    async latest(strategyId, strategyVersion, instrumentId) {
        const r = await this.query(`SELECT record FROM trading_strategy_evaluations
        WHERE strategy_id = $1 AND strategy_version = $2 AND instrument_id = $3
        ORDER BY created_at DESC LIMIT 1`, [strategyId, strategyVersion, instrumentId]);
        return r.rows[0] ? reviveEvaluation(r.rows[0]['record']) : null;
    }
}
const BIGINT_KEYS = new Set([
    'netReturnBps', 'maxDrawdownBps', 'feesPaidMinor', 'finalEquityMinor', 'initialCashMinor', 'allocationBps',
    'feeBps', 'halfSpreadBps', 'slippageBps', 'candidateWorstDrawdownBps', 'buyAndHoldWorstDrawdownBps',
    'candidateTotalReturnBps', 'bestBaselineTotalReturnBps',
]);
/** Restore bigints from a stored JSON record. */
export function reviveEvaluation(raw) {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const walk = (v, key) => {
        if (Array.isArray(v))
            return v.map((x) => walk(x));
        if (v && typeof v === 'object')
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
        if (key && BIGINT_KEYS.has(key) && typeof v === 'string' && /^-?\d+$/.test(v))
            return BigInt(v);
        return v;
    };
    return walk(obj);
}
//# sourceMappingURL=evaluation-store.js.map