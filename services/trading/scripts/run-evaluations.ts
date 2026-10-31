/**
 * Run the walk-forward StrategyEvaluation for every candidate on the demo symbols.
 *
 *   npx tsx services/trading/scripts/run-evaluations.ts [--out <file>] [--db <postgres-url>]
 *
 * Data: Binance public spot klines (1d, closed bars only) and live exchangeInfo filters.
 * Must run from a host Binance serves (Railway us-west2 gets HTTP 451).
 * --db appends each record to trading_strategy_evaluations (local/test DB only; production
 * needs migration 040 applied by the founder first).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import { BinanceSpotDataProvider } from '../src/market/binance-data-provider.js';
import { PAPER_INSTRUMENTS } from '../src/market/instrument.js';
import { compileFilters, type SymbolFilterSpec } from '../src/backtest/exchange-filters.js';
import { DEFAULT_COSTS } from '../src/backtest/engine.js';
import { evaluateStrategy, canonicalJson, type StrategyEvaluation } from '../src/backtest/evaluation.js';
import { SMA_FAMILY, DONCHIAN_FAMILY } from '../src/backtest/strategies.js';
import { PgEvaluationStore } from '../src/backtest/evaluation-store.js';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const OUT = arg('--out') ?? 'docs/build/evidence/trading/STRATEGY_EVALUATIONS.json';
const DB = arg('--db');
const START = Date.UTC(2021, 0, 1);
const SEED = 20261031;

async function filtersFor(symbol: string): Promise<SymbolFilterSpec> {
  const r = await fetch(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}`);
  if (!r.ok) throw new Error(`exchangeInfo ${symbol}: HTTP ${r.status}`);
  const s = ((await r.json()) as { symbols: Array<{ filters: Array<Record<string, string>> }> }).symbols[0]!;
  const f = Object.fromEntries(s.filters.map((x) => [x['filterType'], x]));
  return { symbol, tickSize: f['PRICE_FILTER']!['tickSize']!, stepSize: f['LOT_SIZE']!['stepSize']!, minQty: f['LOT_SIZE']!['minQty']!, maxQty: f['LOT_SIZE']!['maxQty']!, minNotional: (f['NOTIONAL'] ?? f['MIN_NOTIONAL'])!['minNotional']! };
}

const provider = new BinanceSpotDataProvider();
const results: StrategyEvaluation[] = [];
const store = DB ? new PgEvaluationStore((t, p) => pool!.query(t, p)) : null;
const pool = DB ? new pg.Pool({ connectionString: DB }) : null;
const filterEvidence: Record<string, SymbolFilterSpec> = {};

for (const inst of [PAPER_INSTRUMENTS.BTC_USDT, PAPER_INSTRUMENTS.ETH_USDT]) {
  const spec = await filtersFor(inst.symbol);
  filterEvidence[inst.symbol] = spec;
  const candles = await provider.historicalCandles(inst, '1d', START, Date.now());
  console.error(`${inst.symbol}: ${candles.length} closed daily bars ${candles[0]!.eventTs} → ${candles.at(-1)!.eventTs}`);
  for (const family of [SMA_FAMILY, DONCHIAN_FAMILY] as const) {
    const e = evaluateStrategy({
      family: family as never, candles,
      dataset: { source: 'binance-spot-klines', instrumentId: inst.id, period: '1d' },
      costs: DEFAULT_COSTS, filters: compileFilters(spec, inst.pricePrecision),
      initialCashMinor: 1_000_00n, allocationBps: 10_000n,
      trainBars: 365, testBars: 182, windows: 4, seed: SEED, periodsPerYear: 365,
    });
    results.push(e);
    if (store) await store.append(e);
    const pct = (b: bigint) => `${(Number(b) / 100).toFixed(2)}%`;
    console.error(`  ${e.strategyId}@${e.strategyVersion} ${e.verdict} ${e.evaluationId} beat ${e.summary.windowsBeaten}/4 ` +
      e.windows.map((w) => `[OOS${w.index} cand ${pct(w.candidate.netReturnBps)} best ${w.bestBaselineId} ${pct(w.baselines[w.bestBaselineId]!.netReturnBps)} DD ${pct(w.candidate.maxDrawdownBps)} vs B&H ${pct(w.baselines['buy-and-hold']!.maxDrawdownBps)}]`).join(' '));
  }
}
await pool?.end();
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), seed: SEED, costs: 'fee 10 bps (Binance spot default tier; account tier unknown — demo API blocked from Railway), half-spread 1 bp, slippage 2 bps + 0..3 bps seeded jitter', exchangeInfo: filterEvidence, evaluations: JSON.parse(canonicalJson(results)) }, null, 2)}\n`);
console.error(`wrote ${OUT}`);
