// Strategy compiler — natural language -> validated, versioned strategy spec.
//
// Output is DATA (satelink.strategy/v1), never executable code. Only building
// blocks the backtest engine actually implements are accepted:
//   - sma-crossover@1.0.0      (fast/slow simple moving averages, long only)
//   - donchian-breakout@1.0.0  (entry/exit channel breakout, long only)
// on Binance spot BTCUSDT / ETHUSDT daily bars.
//
// The interpreter is rule-based (deterministic, testable). A model-backed drafter
// can be placed in front of it later (no model provider is merged on main), but
// whatever drafts the request, validateSpec() is the gate: nothing reaches the
// backtest engine without passing it.
//
// Three outcomes:
//   compiled             a spec (plus any assumptions made)
//   needs_clarification  questions the user must answer
//   unsupported          reasons the request cannot be evaluated

import { hashObject } from '../utils/canonical_json.js';

export const SPEC_SCHEMA = 'satelink.strategy/v1';
export const INTERPRETER = Object.freeze({ kind: 'rule-based', version: '1' });

export const MARKETS = Object.freeze({
  BTCUSDT: { instrument_id: 'BINANCE:BTCUSDT', symbol: 'BTCUSDT', venue: 'BINANCE', asset_class: 'crypto_spot', name: 'Bitcoin / USDT' },
  ETHUSDT: { instrument_id: 'BINANCE:ETHUSDT', symbol: 'ETHUSDT', venue: 'BINANCE', asset_class: 'crypto_spot', name: 'Ether / USDT' },
});

export const FAMILIES = Object.freeze({
  'sma-crossover': { version: '1.0.0', name: 'Moving-average crossover', defaults: { fastPeriod: 10, slowPeriod: 30 } },
  'donchian-breakout': { version: '1.0.0', name: 'Donchian channel breakout', defaults: { entry: 20, exit: 10 } },
});

// Fixed by the engine (DEFAULT_COSTS) — stated on every spec, not user-tunable.
export const COSTS = Object.freeze({ fee_bps: 10, half_spread_bps: 1, slippage_bps: 2 });
export const EVALUATION = Object.freeze({ timeframe: '1d', train_bars: 365, test_bars: 182, windows: 4, start: '2021-01-01' });

const MAX_PROMPT = 2000;

const MARKET_WORDS = [
  [/\b(btc|bitcoin|xbt)\b/, 'BTCUSDT'],
  [/\b(eth|ether|ethereum)\b/, 'ETHUSDT'],
];

// Requests the engine cannot evaluate. Order matters only for message clarity.
const UNSUPPORTED = [
  [/\b(short|shorting|short-sell|sell short)\b/, 'Short selling is not supported — strategies are long-only.'],
  [/\b(leverage|leveraged|margin|\d+x)\b/, 'Leverage and margin are not supported.'],
  [/\b(option|options|calls?|puts?|straddle)\b/, 'Options strategies are not supported.'],
  [/\b(futures?|perp|perpetual|funding rate)\b/, 'Futures and perpetuals are not supported.'],
  [/\b(rsi|macd|bollinger|stochastic|vwap|ichimoku|atr|ema)\b/, 'That indicator is not implemented yet. Supported: simple moving-average crossover and Donchian breakout.'],
  [/\b(stop[- ]?loss|take[- ]?profit|trailing stop)\b/, 'Stop-loss / take-profit orders are not modelled by the backtest engine yet.'],
  [/\b(nifty|sensex|nse|bse|banknifty)\b/, 'Indian markets are not available for backtesting (no licensed data source) and remain signal-only.'],
  [/\b(aapl|tsla|msft|nvda|spy|qqq|stock|stocks|equity|equities|forex|fx|eurusd)\b/, 'Only Binance spot BTC/USDT and ETH/USDT are available in this beta.'],
  [/\b(sol|solana|bnb|xrp|doge|ada|matic|pol)\b/, 'Only BTC/USDT and ETH/USDT are available in this beta.'],
  [/\b(arbitrage|market[- ]?making|hft|high[- ]frequency|grid bot)\b/, 'Arbitrage, market-making and high-frequency strategies are not supported.'],
  [/\b(guarantee|guaranteed|risk[- ]?free|can'?t lose)\b/, 'No strategy can guarantee returns; Satelink will not evaluate a request framed that way.'],
];

const INTRADAY = /\b(\d+\s*(m|min|minute|minutes|h|hr|hour|hours))\b|\b(intraday|scalp|scalping|hourly|4h|1h|15m|5m)\b/;

// Period-like numbers: drop years and percentages (position sizes) first.
function nums(text) {
  const t = text.replace(/\b(19|20)\d{2}\b/g, ' ').replace(/\d+(\.\d+)?\s*%/g, ' ');
  return (t.match(/\d+/g) || []).map(Number);
}

function pickFamily(t) {
  const sma = /\b(moving average|moving-average|sma|ma crossover|crossover|golden cross|death cross)\b/.test(t);
  const don = /\b(donchian|breakout|break out|channel|turtle|new high|highs?)\b/.test(t);
  if (sma && !don) return 'sma-crossover';
  if (don && !sma) return 'donchian-breakout';
  if (sma && don) return 'ambiguous';
  if (/\b(trend|momentum|trend[- ]following)\b/.test(t)) return 'ambiguous';
  return null;
}

function parseParams(family, t) {
  const assumptions = [];
  const d = FAMILIES[family].defaults;
  if (family === 'sma-crossover') {
    // "10/30", "10 and 30 day", "fast 20 slow 100"
    const fast = t.match(/fast\D{0,12}(\d+)/);
    const slow = t.match(/slow\D{0,12}(\d+)/);
    let fastPeriod; let slowPeriod;
    if (fast && slow) { fastPeriod = Number(fast[1]); slowPeriod = Number(slow[1]); }
    else {
      // "10/30", "20 day ... 50 day": the first two distinct periods, shorter = fast.
      const n = [...new Set(nums(t))];
      if (n.length >= 2) { fastPeriod = Math.min(n[0], n[1]); slowPeriod = Math.max(n[0], n[1]); }
      else if (n.length === 1) { fastPeriod = n[0] < d.slowPeriod ? n[0] : d.fastPeriod; slowPeriod = n[0] < d.slowPeriod ? d.slowPeriod : n[0]; assumptions.push(`Only one period given — using ${fastPeriod}/${slowPeriod}.`); }
    }
    if (fastPeriod == null) { fastPeriod = d.fastPeriod; slowPeriod = d.slowPeriod; assumptions.push(`No periods given — using ${d.fastPeriod}/${d.slowPeriod}-day averages.`); }
    return { params: { fastPeriod, slowPeriod }, assumptions };
  }
  const entryM = t.match(/(?:entry|enter|buy)\D{0,16}(\d+)/);
  const exitM = t.match(/(?:exit|sell|leave)\D{0,16}(\d+)/);
  let entry = entryM ? Number(entryM[1]) : null;
  let exit = exitM ? Number(exitM[1]) : null;
  if (entry == null) {
    const n = nums(t);
    if (n.length >= 2) { entry = n[0]; exit = exit ?? n[1]; } else if (n.length === 1) entry = n[0];
  }
  if (entry == null) { entry = d.entry; assumptions.push(`No channel length given — using a ${d.entry}-day entry channel.`); }
  if (exit == null) { exit = Math.max(2, Math.round(entry / 2)); assumptions.push(`No exit channel given — using ${exit} days (half the entry).`); }
  return { params: { entry, exit }, assumptions };
}

function parseAllocation(t, assumptions) {
  const m = t.match(/(\d{1,3})\s*%/);
  if (m && /\b(alloc|allocate|allocation|risk|capital|portfolio|position|size|of my)\b/.test(t)) {
    const pct = Number(m[1]);
    return pct;
  }
  assumptions.push('No position size given — each trade uses 100% of the simulated account (no leverage).');
  return 100;
}

/** Validate a spec. Returns a list of problems (empty = valid). Used for compiled and client-supplied specs. */
export function validateSpec(spec) {
  const p = [];
  if (!spec || typeof spec !== 'object') return ['spec must be an object'];
  if (spec.schema !== SPEC_SCHEMA) p.push(`schema must be '${SPEC_SCHEMA}'`);
  const fam = FAMILIES[spec.family];
  if (!fam) p.push(`unsupported family '${spec.family}'`);
  else if (spec.family_version !== fam.version) p.push(`family_version must be '${fam.version}'`);
  const market = spec.market && MARKETS[spec.market.symbol];
  if (!market || spec.market.instrument_id !== market.instrument_id) p.push('market must be BINANCE:BTCUSDT or BINANCE:ETHUSDT');
  if (spec.timeframe !== EVALUATION.timeframe) p.push(`timeframe must be '${EVALUATION.timeframe}'`);
  if (spec.direction !== 'long_only') p.push("direction must be 'long_only'");
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const pr = spec.params || {};
  if (spec.family === 'sma-crossover') {
    if (!int(pr.fastPeriod, 2, 200)) p.push('fastPeriod must be an integer 2–200');
    if (!int(pr.slowPeriod, 3, 300)) p.push('slowPeriod must be an integer 3–300');
    if (int(pr.fastPeriod, 2, 200) && int(pr.slowPeriod, 3, 300) && pr.fastPeriod >= pr.slowPeriod) p.push('fastPeriod must be shorter than slowPeriod');
  }
  if (spec.family === 'donchian-breakout') {
    if (!int(pr.entry, 2, 200)) p.push('entry must be an integer 2–200');
    if (!int(pr.exit, 2, 200)) p.push('exit must be an integer 2–200');
  }
  const r = spec.risk || {};
  if (!int(r.allocation_pct, 1, 100)) p.push('risk.allocation_pct must be an integer 1–100 (no leverage)');
  return p;
}

function specId(spec) {
  return 'strat_' + hashObject({ family: spec.family, family_version: spec.family_version, params: spec.params, market: spec.market.instrument_id, timeframe: spec.timeframe, risk: spec.risk }).slice(0, 16);
}

/**
 * Compile a natural-language request.
 * @param {string} prompt
 * @param {{market?:string, family?:string}} [answers]  answers to earlier clarification questions
 */
export function compileStrategy(prompt, answers = {}) {
  if (typeof prompt !== 'string' || prompt.trim().length < 3) {
    return { status: 'needs_clarification', questions: [{ id: 'describe', text: 'Describe the strategy you want to test, e.g. "Buy BTC when the 20-day average crosses above the 50-day average."' }] };
  }
  if (prompt.length > MAX_PROMPT) return { status: 'unsupported', reasons: [`Request is longer than ${MAX_PROMPT} characters.`] };
  const t = prompt.toLowerCase();

  const reasons = [];
  for (const [re, msg] of UNSUPPORTED) if (re.test(t) && !reasons.includes(msg)) reasons.push(msg);
  if (reasons.length) return { status: 'unsupported', reasons, supported: describeSupported() };

  const questions = [];
  const assumptions = [];

  if (INTRADAY.test(t)) {
    assumptions.push('Intraday timeframes are not available in this beta — the strategy is evaluated on daily bars.');
  }

  let symbol = answers.market && MARKETS[answers.market] ? answers.market : null;
  if (!symbol) {
    const hits = MARKET_WORDS.filter(([re]) => re.test(t)).map(([, s]) => s);
    if (hits.length === 1) symbol = hits[0];
    else if (hits.length > 1) questions.push({ id: 'market', text: 'Which market should this run on? One strategy evaluates one market.', options: ['BTCUSDT', 'ETHUSDT'] });
    else questions.push({ id: 'market', text: 'Which market should this run on?', options: ['BTCUSDT', 'ETHUSDT'] });
  }

  let family = answers.family && FAMILIES[answers.family] ? answers.family : pickFamily(t);
  if (!family || family === 'ambiguous') {
    family = null;
    questions.push({
      id: 'family',
      text: 'Which entry rule do you mean?',
      options: [
        { value: 'sma-crossover', label: 'Moving-average crossover — buy when the fast average crosses above the slow one' },
        { value: 'donchian-breakout', label: 'Breakout — buy when price closes above its recent high' },
      ],
    });
  }

  if (questions.length) return { status: 'needs_clarification', questions, assumptions };

  const { params, assumptions: pa } = parseParams(family, t);
  assumptions.push(...pa);
  const allocation = parseAllocation(t, assumptions);

  const spec = {
    schema: SPEC_SCHEMA,
    version: 1,
    family,
    family_version: FAMILIES[family].version,
    name: `${FAMILIES[family].name} · ${symbol}`,
    source_prompt: prompt,
    params,
    market: { ...MARKETS[symbol] },
    timeframe: EVALUATION.timeframe,
    direction: 'long_only',
    risk: { allocation_pct: allocation },
    costs: { ...COSTS },
    evaluation: { ...EVALUATION },
    interpreter: { ...INTERPRETER },
  };
  const problems = validateSpec(spec);
  if (problems.length) return { status: 'unsupported', reasons: problems, supported: describeSupported() };
  spec.id = specId(spec);
  return { status: 'compiled', spec, assumptions };
}

export function describeSupported() {
  return {
    families: Object.entries(FAMILIES).map(([id, f]) => ({ id, version: f.version, name: f.name, defaults: f.defaults })),
    markets: Object.keys(MARKETS),
    timeframes: [EVALUATION.timeframe],
    direction: 'long_only',
    costs: COSTS,
    interpreter: INTERPRETER,
  };
}
