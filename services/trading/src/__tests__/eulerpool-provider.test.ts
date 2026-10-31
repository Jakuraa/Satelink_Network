/**
 * @satelink/trading — EulerpoolResearchProvider contract tests (fixtures: documented schemas).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EulerpoolResearchProvider,
  EulerpoolError,
  InMemoryQuotaStore,
  eulerpoolEquityInstrument,
  type EulerpoolFetch,
  type EulerpoolResponse,
  type QuotaAlert,
  type ResponseCache,
} from '../market/eulerpool-provider.js';
import { validateLicenceEvidence, assertCustomerDisplayable, LicenceViolationError, LicenceEvidenceError } from '../market/licensing.js';

const fx = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/eulerpool/${name}`, import.meta.url)), 'utf8');
const EVIDENCE = validateLicenceEvidence(
  JSON.parse(readFileSync(fileURLToPath(new URL('../../../../docs/build/evidence/licences/eulerpool.json', import.meta.url)), 'utf8')),
  'eulerpool',
);
const FAKE_KEY = 'ep-test-key-0123456789';
const AAPL = eulerpoolEquityInstrument('AAPL');
const R = { use: 'INTERNAL_RESEARCH' as const };

interface Call { url: string; headers: Record<string, string> }
function scripted(replies: Array<{ status: number; body: string; headers?: Record<string, string> } | Error>): { fetch: EulerpoolFetch; calls: Call[] } {
  const calls: Call[] = [];
  let i = 0;
  const fetch: EulerpoolFetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const r = replies[Math.min(i++, replies.length - 1)]!;
    if (r instanceof Error) throw r;
    const h = new Map(Object.entries(r.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const res: EulerpoolResponse = { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: (n) => h.get(n.toLowerCase()) ?? null }, text: async () => r.body };
    return res;
  };
  return { fetch, calls };
}
const provider = (fetch: EulerpoolFetch, extra: Partial<ConstructorParameters<typeof EulerpoolResearchProvider>[0]> = {}) =>
  new EulerpoolResearchProvider({ apiKey: FAKE_KEY, fetch, licenceEvidence: EVIDENCE, sleep: async () => {}, clock: () => new Date('2026-10-31T10:00:00Z'), ...extra });
const range = { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-01-04T00:00:00Z') };

async function codeOf(p: Promise<unknown>): Promise<string> {
  try { await p; return 'NO_ERROR'; } catch (e) { return e instanceof EulerpoolError ? e.code : `OTHER:${(e as Error).message}`; }
}

describe('EulerpoolResearchProvider — licensing from evidence', () => {
  it('FREE evidence: strategy derivation for internal R&D only; no display, redistribution or commercial use', () => {
    const p = provider(scripted([]).fetch);
    expect(p.licensingFor('INTERNAL_RESEARCH')).toMatchObject({ strategyDerivationPermitted: true, displayPermitted: false, redistributionPermitted: false, commercialLicense: false });
    expect(p.licensingFor('CUSTOMER_FACING').strategyDerivationPermitted).toBe(false);
    expect(p.isCommerciallyApproved()).toBe(false);
    expect(p.licensing.licenseEvidence).toMatch(/FREE plan, verified 2026-10-31/);
  });

  it('no evidence loaded → every permission false and internal requests refused before any network call', async () => {
    const s = scripted([{ status: 200, body: fx('ratios_ok.json') }]);
    const p = new EulerpoolResearchProvider({ apiKey: FAKE_KEY, fetch: s.fetch });
    expect(p.licensing.strategyDerivationPermitted).toBe(false);
    expect(await codeOf(p.ratios('AAPL', R))).toBe('LICENCE_BLOCKED');
    expect(s.calls).toHaveLength(0);
  });

  it('customer-facing use fails closed before any network call', async () => {
    const s = scripted([{ status: 200, body: fx('ratios_ok.json') }]);
    const p = provider(s.fetch);
    expect(await codeOf(p.ratios('AAPL', { use: 'CUSTOMER_FACING' }))).toBe('LICENCE_BLOCKED');
    expect(await codeOf(p.getFundamentals('AAPL'))).toBe('LICENCE_BLOCKED'); // legacy default = customer-facing
    expect(s.calls).toHaveLength(0);
  });

  it('a missing use declaration is refused', async () => {
    const s = scripted([{ status: 200, body: fx('ratios_ok.json') }]);
    expect(await codeOf(provider(s.fetch).ratios('AAPL', undefined as never))).toBe('LICENCE_BLOCKED');
    expect(s.calls).toHaveLength(0);
  });

  it('evidence claiming commercial rights without a written confirmation is rejected', () => {
    const forged = { ...JSON.parse(JSON.stringify(EVIDENCE)), permissions: { strategyDerivation: 'COMMERCIAL', display: true, redistribution: false, commercialUse: true } };
    expect(() => validateLicenceEvidence(forged, 'eulerpool')).toThrow(LicenceEvidenceError);
  });

  it('assertCustomerDisplayable throws when any contributing source lacks display rights', () => {
    const p = provider(scripted([]).fetch);
    expect(() => assertCustomerDisplayable([{ source: 'binance', displayPermitted: true }, p.licensing])).toThrow(LicenceViolationError);
    expect(() => assertCustomerDisplayable([{ source: 'binance', displayPermitted: true }])).not.toThrow();
  });
});

describe('EulerpoolResearchProvider — contract (success)', () => {
  it('daily bars: Bearer header only, no token in URL, exact bigint prices from decimal text', async () => {
    const s = scripted([{ status: 200, body: fx('ohlcv_ok.json') }]);
    const bars = await provider(s.fetch).dailyBars(AAPL, range, R);
    expect(s.calls).toHaveLength(1);
    const call = s.calls[0]!;
    expect(call.url).toBe('https://api.eulerpool.com/api/1/charting/ohlcv/AAPL?resolution=D&from=1704067200&to=1704326400');
    expect(call.url).not.toMatch(/token|ep-test-key/);
    expect(call.headers['Authorization']).toBe(`Bearer ${FAKE_KEY}`);
    expect(bars).toHaveLength(3);
    expect(bars[0]!.eventTs).toBe('2024-01-01T00:00:00.000Z');
    expect(bars[0]!.openMinor).toBe(1856400n); // 185.64 at 4dp
    expect(bars[2]!.highMinor).toBe(1830897n); // 183.0897 — would drift through a float ×10^4 path
    expect(bars[1]!.closeMinor).toBe(1856400n);
    expect(bars[0]!.volume).toBe('82488700');
    expect(bars.every((b) => b.isClosed && b.period === '1d' && b.licensing.source === 'eulerpool')).toBe(true);
  });

  it('ratios, insider sentiment, insider trades, earnings dates and FRED series keep numbers as decimal strings', async () => {
    const s = scripted([
      { status: 200, body: fx('ratios_ok.json') },
      { status: 200, body: fx('insider_sentiment_ok.json') },
      { status: 200, body: fx('insider_trades_ok.json') },
      { status: 200, body: fx('earnings_ok.json') },
      { status: 200, body: fx('fred_ok.json') },
    ]);
    const p = provider(s.fetch);
    const r = await p.ratios('AAPL', R);
    expect(r).toMatchObject({ ticker: 'AAPL', fiscalYear: 2025, peRatio: '29.87', debtToEquity: '1.8734' });
    const ins = await p.insiderSentiment('AAPL', R);
    expect(ins[0]).toEqual({ year: 2026, month: 8, change: '-5540', mspr: '-12.21' });
    const trades = await p.insiderTrades('AAPL', R);
    expect(trades[0]).toMatchObject({ transactionPrice: '226.45', transactionCode: 'S' });
    expect(trades[0]).not.toHaveProperty('nested');
    const earn = await p.earningsDates('AAPL', R);
    expect(earn[1]).toMatchObject({ epsEstimate: '1.77', epsActual: null });
    const fred = await p.fredObservations('DGS10', 2, R);
    expect(fred.observations.map((o) => o.value)).toEqual(['4.12', '4.087']);
    expect(s.calls.map((c) => new URL(c.url).pathname)).toEqual([
      '/api/1/fundamentals/financials/AAPL/ratios',
      '/api/1/sentiment/insider-sentiment/AAPL',
      '/api/1/equity/insider-trades/AAPL',
      '/api/1/calendar/earnings-by-symbol/AAPL',
      '/api/1/macro/fred/observations/DGS10',
    ]);
  });
});

describe('EulerpoolResearchProvider — contract (errors)', () => {
  it('401 → UNAUTHORIZED, not retried', async () => {
    const s = scripted([{ status: 401, body: fx('error_401.json') }]);
    expect(await codeOf(provider(s.fetch).ratios('AAPL', R))).toBe('UNAUTHORIZED');
    expect(s.calls).toHaveLength(1);
  });

  it('429 → RATE_LIMITED with reset time, not retried (Free plan hard limit)', async () => {
    const s = scripted([{ status: 429, body: '{}', headers: { 'X-RateLimit-Reset': '2026-11-01T00:00:00Z' } }]);
    const err = (await provider(s.fetch).ratios('AAPL', R).catch((e: unknown) => e)) as EulerpoolError;
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.details.resetAt).toBe('2026-11-01T00:00:00Z');
    expect(s.calls).toHaveLength(1);
  });

  it('5xx is retried a bounded number of times, then UPSTREAM', async () => {
    const s = scripted([{ status: 502, body: '{"title":"Bad gateway"}' }]);
    expect(await codeOf(provider(s.fetch, { maxRetries: 2 }).ratios('AAPL', R))).toBe('UPSTREAM');
    expect(s.calls).toHaveLength(3);
  });

  it('5xx then success recovers', async () => {
    const s = scripted([{ status: 503, body: '' }, { status: 200, body: fx('ratios_ok.json') }]);
    expect((await provider(s.fetch).ratios('AAPL', R)).peRatio).toBe('29.87');
    expect(s.calls).toHaveLength(2);
  });

  it('network failure and timeout are typed and retried', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const s = scripted([new TypeError('fetch failed'), abort, abort]);
    expect(await codeOf(provider(s.fetch, { maxRetries: 2 }).ratios('AAPL', R))).toBe('TIMEOUT');
    expect(s.calls).toHaveLength(3);
  });

  it('malformed bodies → SCHEMA_MISMATCH (truncated JSON, unequal columns, non-numeric price)', async () => {
    expect(await codeOf(provider(scripted([{ status: 200, body: fx('ohlcv_truncated.json') }]).fetch).dailyBars(AAPL, range, R))).toBe('SCHEMA_MISMATCH');
    expect(await codeOf(provider(scripted([{ status: 200, body: fx('ohlcv_malformed_lengths.json') }]).fetch).dailyBars(AAPL, range, R))).toBe('SCHEMA_MISMATCH');
    const bad = '{"t":[1704067200],"o":["abc"],"h":[1],"l":[1],"c":[1]}';
    expect(await codeOf(provider(scripted([{ status: 200, body: bad }]).fetch).dailyBars(AAPL, range, R))).toBe('SCHEMA_MISMATCH');
    const inconsistent = '{"t":[1704067200],"o":[10],"h":[9],"l":[8],"c":[9]}';
    expect(await codeOf(provider(scripted([{ status: 200, body: inconsistent }]).fetch).dailyBars(AAPL, range, R))).toBe('SCHEMA_MISMATCH');
    expect(await codeOf(provider(scripted([{ status: 200, body: '{"a":1}' }]).fetch).insiderSentiment('AAPL', R))).toBe('SCHEMA_MISMATCH');
  });

  it('no API key → NO_API_KEY without a request', async () => {
    const s = scripted([{ status: 200, body: '{}' }]);
    const p = new EulerpoolResearchProvider({ fetch: s.fetch, licenceEvidence: EVIDENCE });
    expect(await codeOf(p.ratios('AAPL', R))).toBe('NO_API_KEY');
    expect(s.calls).toHaveLength(0);
  });

  it('error messages never contain the API key', async () => {
    const s = scripted([{ status: 401, body: fx('error_401.json') }]);
    const err = (await provider(s.fetch).ratios('AAPL', R).catch((e: unknown) => e)) as EulerpoolError;
    expect(JSON.stringify({ m: err.message, d: (err as EulerpoolError).details })).not.toContain(FAKE_KEY);
  });
});

describe('EulerpoolResearchProvider — quota guard and cache', () => {
  it('stops at 90% of the monthly quota, alerts once, and makes no further requests', async () => {
    const store = new InMemoryQuotaStore();
    await store.raiseTo('2026-10', 89_999);
    const alerts: QuotaAlert[] = [];
    const s = scripted([{ status: 200, body: fx('ratios_ok.json') }]);
    const p = provider(s.fetch, { quotaStore: store, onQuotaAlert: (a) => alerts.push(a) });
    expect(p.quotaStopAt).toBe(90_000);
    await p.ratios('AAPL', R); // request 90,000 is sent and crosses the threshold
    expect(alerts).toEqual([{ kind: 'EULERPOOL_QUOTA_90', period: '2026-10', used: 90_000, limit: 100_000 }]);
    expect(await codeOf(p.ratios('AAPL', R))).toBe('QUOTA_GUARD');
    expect(await codeOf(p.ratios('AAPL', R))).toBe('QUOTA_GUARD');
    expect(s.calls).toHaveLength(1);
    expect(alerts).toHaveLength(1);
  });

  it('provider-reported usage (X-RateLimit-Remaining) raises the local counter', async () => {
    const store = new InMemoryQuotaStore();
    const s = scripted([{ status: 200, body: fx('ratios_ok.json'), headers: { 'X-RateLimit-Limit': '100000', 'X-RateLimit-Remaining': '9000' } }, { status: 200, body: fx('ratios_ok.json') }]);
    const p = provider(s.fetch, { quotaStore: store });
    await p.ratios('AAPL', R);
    expect(await p.quotaUsed()).toBe(91_000);
    expect(await codeOf(p.ratios('AAPL', R))).toBe('QUOTA_GUARD');
    expect(s.calls).toHaveLength(1);
  });

  it('backtest cache serves repeat requests without network or quota use; cache keys hold no key', async () => {
    const mem = new Map<string, string>();
    const cache: ResponseCache = { get: async (k) => mem.get(k) ?? null, set: async (k, v) => { mem.set(k, v); } };
    const store = new InMemoryQuotaStore();
    const s = scripted([{ status: 200, body: fx('ohlcv_ok.json') }]);
    const p = provider(s.fetch, { cache, quotaStore: store });
    const a = await p.dailyBars(AAPL, range, { ...R, cache: true });
    const b = await p.dailyBars(AAPL, range, { ...R, cache: true });
    expect(b.map((x) => x.closeMinor)).toEqual(a.map((x) => x.closeMinor));
    expect(s.calls).toHaveLength(1);
    expect(await store.used('2026-10')).toBe(1);
    expect([...mem.keys()].every((k) => /^[a-f0-9]{64}$/.test(k))).toBe(true);
  });
});
