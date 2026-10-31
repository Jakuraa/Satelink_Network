/**
 * Migration 040 — trading_strategy_evaluations + trading_decisions are append-only.
 * Real Postgres: a fresh database on TEST_DATABASE_URL's server (created and dropped here).
 *
 *   - 040 applies through the canonical runner, and re-running applies nothing;
 *   - the services/trading Pg stores INSERT and read back records losslessly;
 *   - UPDATE, DELETE and TRUNCATE are refused — even for the superuser the API
 *     connects as today (017 role switch not yet done);
 *   - the down script removes exactly what 040 created.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyMigrationsForTest } from './apply-migrations.js';
import { migrate } from '../runner.js';
import { PgEvaluationStore, DuplicateEvaluationError } from '../../services/trading/src/backtest/evaluation-store.js';
import { PgDecisionStore, type DecisionRecord } from '../../services/trading/src/decision/go-no-go.js';
import { evaluateStrategy, canonicalJson } from '../../services/trading/src/backtest/evaluation.js';
import { DONCHIAN_FAMILY } from '../../services/trading/src/backtest/strategies.js';
import { DEFAULT_COSTS } from '../../services/trading/src/backtest/engine.js';
import { compileFilters, DEFAULT_SPOT_FILTERS } from '../../services/trading/src/backtest/exchange-filters.js';
import { PAPER_INSTRUMENTS } from '../../services/trading/src/market/instrument.js';
import { DataFreshness, type Candle } from '../../services/trading/src/market/market-data.js';

const DIR = resolve(import.meta.dirname ?? new URL('.', import.meta.url).pathname, '..');
const BTC = PAPER_INSTRUMENTS.BTC_USDT;
let dbUrl = '';
let dbName = '';
let pool: Pool;

function candles(n: number): Candle[] {
  const lic = { source: 'test', strategyDerivationPermitted: true, displayPermitted: false, redistributionPermitted: false, commercialLicense: false, licenseEvidence: null };
  return Array.from({ length: n }, (_, t) => {
    const c = BigInt(3_000_000 + Math.round(400_000 * Math.sin(t / 25)));
    return { kind: 'CANDLE', instrument: BTC, period: '1d', eventTs: new Date(Date.UTC(2022, 0, 1) + t * 86_400_000).toISOString(), retrievalTs: '2026-10-31T00:00:00.000Z', freshness: DataFreshness.SNAPSHOT, freshnessWindowSec: 86_400, licensing: lic, openMinor: c, highMinor: c + 5_000n, lowMinor: c - 5_000n, closeMinor: c, volume: '1', isClosed: true } as Candle;
  });
}

beforeAll(async () => {
  const admin = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.connect();
  dbName = `trading040_${Date.now()}`;
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();
  const u = new URL(process.env.TEST_DATABASE_URL!);
  u.pathname = `/${dbName}`;
  dbUrl = u.toString();
  const r = await applyMigrationsForTest(dbUrl, resolve(DIR, 'migrations'));
  expect(r.errors).toEqual([]);
  expect(r.applied).toContain('040_trading_strategy_evaluations.sql');
  pool = new Pool({ connectionString: dbUrl });
});

afterAll(async () => {
  await pool?.end();
  const admin = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
  await admin.end();
});

describe('migration 040 — trading append-only tables', () => {
  it('is idempotent under the canonical runner', async () => {
    const again = await migrate(dbUrl, resolve(DIR, 'migrations'));
    expect(again.applied).toEqual([]);
    expect(again.errors).toEqual([]);
  });

  it('PgEvaluationStore appends, rejects duplicates and round-trips the record', async () => {
    const store = new PgEvaluationStore((t, p) => pool.query(t, p));
    const e = evaluateStrategy({ family: DONCHIAN_FAMILY, candles: candles(500), dataset: { source: 'synthetic', instrumentId: BTC.id, period: '1d' }, costs: DEFAULT_COSTS, filters: compileFilters(DEFAULT_SPOT_FILTERS['BTCUSDT']!, 2), initialCashMinor: 1_000_00n, trainBars: 120, testBars: 90, seed: 1, periodsPerYear: 365, now: () => new Date('2026-10-31T00:00:00Z') });
    await store.append(e);
    await expect(store.append(e)).rejects.toBeInstanceOf(DuplicateEvaluationError);
    const back = await store.latest('donchian-breakout', '1.0.0', BTC.id);
    expect(back && canonicalJson(back)).toBe(canonicalJson(e));
  });

  it('PgDecisionStore appends and lists decisions', async () => {
    const store = new PgDecisionStore((t, p) => pool.query(t, p));
    const d = { decision_id: 'dec_test_1', instrument: BTC.id, timestamp: '2026-11-02T12:00:00.000Z', mode: 'BASELINE_ONLY', strategy_id: 'sma-crossover', strategy_version: '1.0.0', evaluation_id: null, verdict: 'NO_GO', reasons: ['(e) no demo mandate'], is_test: true } as unknown as DecisionRecord;
    await store.append(d);
    expect((await store.list(BTC.id, 10)).map((x) => x.decision_id)).toEqual(['dec_test_1']);
  });

  it('refuses UPDATE, DELETE and TRUNCATE even for the superuser', async () => {
    for (const t of ['trading_strategy_evaluations', 'trading_decisions']) {
      await expect(pool.query(`UPDATE ${t} SET record = '{}'::jsonb`)).rejects.toThrow(/append-only: UPDATE/);
      await expect(pool.query(`DELETE FROM ${t}`)).rejects.toThrow(/append-only: DELETE/);
      await expect(pool.query(`TRUNCATE ${t}`)).rejects.toThrow(/append-only: TRUNCATE/);
    }
    const { rows } = await pool.query<{ n: string }>('SELECT (SELECT count(*) FROM trading_strategy_evaluations) + (SELECT count(*) FROM trading_decisions) AS n');
    expect(Number(rows[0]!.n)).toBe(2);
  });

  it('rejects malformed rows (verdict, mode, hash format)', async () => {
    await expect(pool.query(`INSERT INTO trading_decisions (decision_id, instrument_id, decided_at, strategy_id, strategy_version, mode, verdict, record) VALUES ('x','i',now(),'s','v','MODEL_AND_BASELINE','MAYBE','{}')`)).rejects.toThrow(/check constraint/);
    await expect(pool.query(`INSERT INTO trading_strategy_evaluations (evaluation_id, result_hash, strategy_id, strategy_version, instrument_id, verdict, record, created_at, expires_at) VALUES ('e','nothex','s','v','i','PASS','{}',now(),now()+interval '1 day')`)).rejects.toThrow(/check constraint/);
  });

  it('the down script removes exactly what 040 created', async () => {
    await pool.query(readFileSync(resolve(DIR, 'migrations-down/040_trading_strategy_evaluations.down.sql'), 'utf8'));
    const { rows } = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM information_schema.tables WHERE table_name IN ('trading_strategy_evaluations','trading_decisions')`);
    expect(Number(rows[0]!.n)).toBe(0);
    const ledger = await pool.query(`SELECT to_regclass('ledger_entries') AS t`);
    expect(ledger.rows[0]!.t).toBe('ledger_entries');
    const again = await migrate(dbUrl, resolve(DIR, 'migrations'));
    expect(again.applied).toEqual(['040_trading_strategy_evaluations.sql']);
  });
});
