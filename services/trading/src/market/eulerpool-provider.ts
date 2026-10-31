/**
 * EulerpoolResearchProvider — research and backtest data (equities/ETFs, fundamentals,
 * insider activity, earnings dates, macro series).
 *
 * Contract: docs/build/evidence/EULERPOOL_CONTRACT.md (read from eulerpool.com/developers
 * on 2026-10-31). Base URL https://api.eulerpool.com/api/1.
 *
 * Rules enforced here:
 *   - Auth ONLY via `Authorization: Bearer`. The documented `?token=` query parameter is
 *     never used: it leaks into logs, proxies and URLs.
 *   - Prices are read from the raw JSON text as decimal strings and converted to bigint
 *     minor units. No float ever holds a price.
 *   - Bounded retries for 5xx / timeout / network only. 401/400/404 are terminal; 429 is
 *     terminal (the Free plan is hard-limited until the monthly reset).
 *   - A monthly quota guard stops at 90% of the plan quota (100,000 on Free) and alerts once.
 *   - Licensing comes from the evidence record (licensing.ts). Customer-facing use fails
 *     closed before any request is made.
 *   - Constructed with injected key/fetch — never reads env.
 */
import { createHash } from 'node:crypto';
import { DataFreshness, type Candle, type LicensingMetadata } from './market-data.js';
import { AssetClass, Exchange, type Instrument } from './instrument.js';
import { decimalToMinor } from './decimal.js';
import { parseLosslessJson, numericText, isObject, JsonNumber, type LosslessValue } from './lossless-json.js';
import { FAIL_CLOSED_LICENSING, licensingFromEvidence, type LicenceEvidenceRecord, type LicenceUse } from './licensing.js';

export const EULERPOOL_BASE_URL = 'https://api.eulerpool.com/api/1';
export const EULERPOOL_FREE_MONTHLY_QUOTA = 100_000;
export const EULERPOOL_QUOTA_STOP_RATIO_BPS = 9_000; // stop at 90%
export const EULERPOOL_ATTRIBUTION = 'Data by Eulerpool';

/** Legacy export: fail-closed licensing (no evidence loaded). Real licensing comes from evidence. */
export const EULERPOOL_LICENSING: LicensingMetadata = FAIL_CLOSED_LICENSING('eulerpool');

export const EulerpoolErrorCode = Object.freeze({
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_GUARD: 'QUOTA_GUARD',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  UPSTREAM: 'UPSTREAM',
  TIMEOUT: 'TIMEOUT',
  NETWORK: 'NETWORK',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  LICENCE_BLOCKED: 'LICENCE_BLOCKED',
  NO_API_KEY: 'NO_API_KEY',
} as const);
export type EulerpoolErrorCode = typeof EulerpoolErrorCode[keyof typeof EulerpoolErrorCode];

export class EulerpoolError extends Error {
  constructor(
    readonly code: EulerpoolErrorCode,
    message: string,
    readonly details: { readonly status?: number; readonly endpoint?: string; readonly retryable?: boolean; readonly resetAt?: string | null } = {},
  ) {
    super(`${code}: ${message}`);
    this.name = 'EulerpoolError';
  }
}

export interface EulerpoolResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly headers?: { get(name: string): string | null };
  text(): Promise<string>;
}
export type EulerpoolFetch = (
  url: string,
  init: { method: 'GET'; headers: Record<string, string>; signal?: AbortSignal },
) => Promise<EulerpoolResponse>;

/** Monthly request counter. Periods are UTC 'YYYY-MM'. */
export interface QuotaStore {
  used(period: string): Promise<number>;
  /** Record one request sent. Returns the new count. */
  increment(period: string): Promise<number>;
  /** Raise the stored count to at least `used` (provider-reported usage). */
  raiseTo(period: string, used: number): Promise<void>;
}

export class InMemoryQuotaStore implements QuotaStore {
  readonly #m = new Map<string, number>();
  async used(p: string) { return this.#m.get(p) ?? 0; }
  async increment(p: string) { const n = (this.#m.get(p) ?? 0) + 1; this.#m.set(p, n); return n; }
  async raiseTo(p: string, used: number) { if (used > (this.#m.get(p) ?? 0)) this.#m.set(p, used); }
}

/** Raw-response cache for internal backtest datasets. Keys never contain the key. */
export interface ResponseCache {
  get(key: string): Promise<string | null>;
  set(key: string, body: string): Promise<void>;
}

export interface QuotaAlert {
  readonly kind: 'EULERPOOL_QUOTA_90';
  readonly period: string;
  readonly used: number;
  readonly limit: number;
}

export interface EulerpoolProviderConfig {
  readonly apiKey?: string | undefined;
  readonly baseUrl?: string;
  readonly fetch?: EulerpoolFetch;
  /** Parsed licence evidence (licensing.ts). Absent → every permission false. */
  readonly licenceEvidence?: LicenceEvidenceRecord | null;
  readonly monthlyQuota?: number;
  readonly quotaStore?: QuotaStore;
  readonly onQuotaAlert?: (alert: QuotaAlert) => void;
  readonly cache?: ResponseCache | null;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly retryBaseMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly clock?: () => Date;
}

export interface RequestOptions {
  /** Why the data is needed. Required: there is no default use. */
  readonly use: LicenceUse;
  /** Serve/store from the backtest cache. */
  readonly cache?: boolean;
}

export interface FundamentalRatios {
  readonly ticker: string;
  readonly fiscalYear: number | null;
  /** Decimal strings (exact provider text) or null. */
  readonly peRatio: string | null;
  readonly pbRatio: string | null;
  readonly debtToEquity: string | null;
  readonly roe: string | null;
  readonly profitMargin: string | null;
  readonly retrievedAt: string;
}
/** @deprecated name kept for the public export; use FundamentalRatios. */
export type FundamentalMetrics = FundamentalRatios;

export interface InsiderSentimentPoint {
  readonly year: number;
  readonly month: number;
  readonly change: string | null;
  /** Monthly share purchase ratio, -100..100, decimal string. */
  readonly mspr: string | null;
}

export interface EarningsDate {
  readonly symbol: string;
  readonly date: string;
  readonly epsEstimate: string | null;
  readonly epsActual: string | null;
  readonly revenueEstimate: string | null;
  readonly revenueActual: string | null;
}

export interface MacroObservation {
  readonly date: string;
  readonly value: string | null;
}
export interface MacroSeries {
  readonly seriesId: string;
  readonly name: string | null;
  readonly frequency: string | null;
  readonly units: string | null;
  readonly observations: readonly MacroObservation[];
  readonly retrievedAt: string;
}

/** Scalar-only view of an insider trade row (schema is undocumented upstream; see contract). */
export type InsiderTradeRow = Readonly<Record<string, string | boolean | null>>;

const DAY_MS = 86_400_000;

export class EulerpoolResearchProvider {
  readonly #baseUrl: string;
  readonly #apiKey: string | undefined;
  readonly #fetch: EulerpoolFetch;
  readonly #evidence: LicenceEvidenceRecord | null;
  readonly #quota: QuotaStore;
  readonly #limit: number;
  readonly #onAlert: (a: QuotaAlert) => void;
  readonly #alerted = new Set<string>();
  readonly #cache: ResponseCache | null;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #retryBaseMs: number;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #clock: () => Date;

  constructor(config: EulerpoolProviderConfig = {}) {
    this.#baseUrl = (config.baseUrl ?? EULERPOOL_BASE_URL).replace(/\/$/, '');
    this.#apiKey = config.apiKey;
    this.#fetch = config.fetch ?? ((url, init) => globalThis.fetch(url, init) as unknown as Promise<EulerpoolResponse>);
    this.#evidence = config.licenceEvidence ?? null;
    this.#quota = config.quotaStore ?? new InMemoryQuotaStore();
    this.#limit = config.monthlyQuota ?? EULERPOOL_FREE_MONTHLY_QUOTA;
    this.#onAlert = config.onQuotaAlert ?? (() => {});
    this.#cache = config.cache ?? null;
    this.#timeoutMs = config.timeoutMs ?? 10_000;
    this.#maxRetries = Math.max(0, Math.min(config.maxRetries ?? 2, 5));
    this.#retryBaseMs = config.retryBaseMs ?? 500;
    this.#sleep = config.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.#clock = config.clock ?? (() => new Date());
  }

  get id(): string { return 'eulerpool'; }

  /** Licensing for internal research use (the strictest customer-facing view: licensingFor). */
  get licensing(): LicensingMetadata { return this.licensingFor('INTERNAL_RESEARCH'); }

  licensingFor(use: LicenceUse): LicensingMetadata {
    return licensingFromEvidence(this.#evidence, 'eulerpool', use);
  }

  /** True only with commercial rights backed by written confirmation. */
  isCommerciallyApproved(): boolean {
    const l = this.licensingFor('CUSTOMER_FACING');
    return l.commercialLicense && l.displayPermitted && l.licenseEvidence !== null;
  }

  /** Requests this UTC month (local counter, raised to provider-reported usage). */
  async quotaUsed(): Promise<number> { return this.#quota.used(this.#period()); }
  get quotaStopAt(): number { return Math.floor((this.#limit * EULERPOOL_QUOTA_STOP_RATIO_BPS) / 10_000); }

  // ── endpoints ────────────────────────────────────────────────────────────

  /**
   * End-of-day OHLCV bars, oldest first. GET /charting/ohlcv/{id}?resolution=D&from&to
   * (unix seconds). Adjustment for splits/dividends is NOT documented upstream — see contract.
   */
  async dailyBars(instrument: Instrument, range: { from: Date; to: Date }, opts: RequestOptions): Promise<Candle[]> {
    const id = instrument.brokerSymbols?.['eulerpool'] ?? instrument.symbol;
    const from = Math.floor(range.from.getTime() / 1000);
    const to = Math.floor(range.to.getTime() / 1000);
    const endpoint = `/charting/ohlcv/${encodeURIComponent(id)}`;
    const { body, retrievedAt } = await this.#get(endpoint, { resolution: 'D', from: String(from), to: String(to) }, opts);
    if (!isObject(body)) throw schema(endpoint, 'expected an object of arrays');
    const cols = ['t', 'o', 'h', 'l', 'c'] as const;
    const arrs: Record<string, LosslessValue[]> = {};
    for (const k of cols) {
      const a = body[k];
      if (!Array.isArray(a)) throw schema(endpoint, `field '${k}' must be an array`);
      arrs[k] = a;
    }
    const v = Array.isArray(body['v']) ? (body['v'] as LosslessValue[]) : null;
    const n = arrs['t']!.length;
    for (const k of cols) if (arrs[k]!.length !== n) throw schema(endpoint, 'column lengths differ');
    if (v && v.length !== n) throw schema(endpoint, 'volume column length differs');
    const nowMs = this.#clock().getTime();
    const out: Candle[] = [];
    let prevMs = -Infinity;
    for (let i = 0; i < n; i++) {
      const tText = numericText(arrs['t']![i]);
      if (tText === null || !/^\d+$/.test(tText)) throw schema(endpoint, `t[${i}] is not an integer timestamp`);
      const tNum = Number(tText);
      const openMs = tNum > 1e12 ? tNum : tNum * 1000; // seconds per docs; tolerate ms
      if (openMs <= prevMs) throw schema(endpoint, 't is not strictly increasing');
      prevMs = openMs;
      const px = (k: string) => {
        const t = numericText(arrs[k]![i]);
        if (t === null) throw schema(endpoint, `${k}[${i}] is not numeric`);
        const m = decimalToMinor(t, instrument.pricePrecision);
        if (m <= 0n) throw schema(endpoint, `${k}[${i}] is not positive`);
        return m;
      };
      const [o, h, l, c] = [px('o'), px('h'), px('l'), px('c')];
      if (h < l || h < o || h < c || l > o || l > c) throw schema(endpoint, `bar ${i} has inconsistent OHLC`);
      out.push({
        kind: 'CANDLE',
        instrument,
        period: '1d',
        eventTs: new Date(openMs).toISOString(),
        retrievalTs: retrievedAt,
        freshness: DataFreshness.DELAYED,
        freshnessWindowSec: 36 * 3600,
        licensing: this.licensingFor(opts.use),
        openMinor: o,
        highMinor: h,
        lowMinor: l,
        closeMinor: c,
        volume: (v ? numericText(v[i]) : null) ?? '0',
        isClosed: openMs + DAY_MS <= nowMs,
      });
    }
    return out;
  }

  /** GET /fundamentals/financials/{id}/ratios */
  async ratios(identifier: string, opts: RequestOptions): Promise<FundamentalRatios> {
    const endpoint = `/fundamentals/financials/${encodeURIComponent(identifier)}/ratios`;
    const { body, retrievedAt } = await this.#get(endpoint, {}, opts);
    if (!isObject(body)) throw schema(endpoint, 'expected an object');
    const fy = numericText(body['fiscal_year']);
    return Object.freeze({
      ticker: typeof body['ticker'] === 'string' ? body['ticker'] : identifier,
      fiscalYear: fy !== null && /^\d{4}$/.test(fy) ? Number(fy) : null,
      peRatio: optNum(body, 'pe_ratio', endpoint),
      pbRatio: optNum(body, 'pb_ratio', endpoint),
      debtToEquity: optNum(body, 'debt_to_equity', endpoint),
      roe: optNum(body, 'roe', endpoint),
      profitMargin: optNum(body, 'profit_margin', endpoint),
      retrievedAt,
    });
  }

  /** @deprecated use ratios(). Kept so existing callers keep compiling. */
  async getFundamentals(symbol: string, opts: RequestOptions = { use: 'CUSTOMER_FACING' }): Promise<FundamentalRatios> {
    return this.ratios(symbol, opts);
  }

  /** GET /sentiment/insider-sentiment/{id} */
  async insiderSentiment(identifier: string, opts: RequestOptions): Promise<InsiderSentimentPoint[]> {
    const endpoint = `/sentiment/insider-sentiment/${encodeURIComponent(identifier)}`;
    const { body } = await this.#get(endpoint, {}, opts);
    if (!Array.isArray(body)) throw schema(endpoint, 'expected an array');
    return body.map((row, i) => {
      if (!isObject(row)) throw schema(endpoint, `row ${i} is not an object`);
      const y = numericText(row['year']);
      const m = numericText(row['month']);
      if (y === null || !/^\d{4}$/.test(y) || m === null || !/^\d{1,2}$/.test(m)) throw schema(endpoint, `row ${i} year/month invalid`);
      return Object.freeze({ year: Number(y), month: Number(m), change: optNum(row, 'change', endpoint), mspr: optNum(row, 'mspr', endpoint) });
    });
  }

  /**
   * GET /equity/insider-trades/{id}. The upstream response schema is undocumented
   * (docs show `{}`): rows are accepted only as an array of flat objects, and nested
   * values are dropped. Treat as UNVERIFIED until the contract records a real shape.
   */
  async insiderTrades(identifier: string, opts: RequestOptions): Promise<InsiderTradeRow[]> {
    const endpoint = `/equity/insider-trades/${encodeURIComponent(identifier)}`;
    const { body } = await this.#get(endpoint, {}, opts);
    const rows = Array.isArray(body) ? body : isObject(body) && Array.isArray(body['data']) ? (body['data'] as LosslessValue[]) : null;
    if (!rows) throw schema(endpoint, 'expected an array (or { data: [] })');
    return rows.map((row, i) => {
      if (!isObject(row)) throw schema(endpoint, `row ${i} is not an object`);
      const out: Record<string, string | boolean | null> = {};
      for (const [k, val] of Object.entries(row)) {
        if (val instanceof JsonNumber) out[k] = val.text;
        else if (typeof val === 'string' || typeof val === 'boolean' || val === null) out[k] = val;
      }
      return Object.freeze(out);
    });
  }

  /** GET /calendar/earnings-by-symbol/{symbol} */
  async earningsDates(symbol: string, opts: RequestOptions): Promise<EarningsDate[]> {
    const endpoint = `/calendar/earnings-by-symbol/${encodeURIComponent(symbol)}`;
    const { body } = await this.#get(endpoint, {}, opts);
    if (!Array.isArray(body)) throw schema(endpoint, 'expected an array');
    return body.map((row, i) => {
      if (!isObject(row)) throw schema(endpoint, `row ${i} is not an object`);
      const d = row['date'];
      if (typeof d !== 'string' || Number.isNaN(Date.parse(d))) throw schema(endpoint, `row ${i} date invalid`);
      return Object.freeze({
        symbol: typeof row['symbol'] === 'string' ? row['symbol'] : symbol,
        date: new Date(d).toISOString(),
        epsEstimate: optNum(row, 'epsEstimate', endpoint),
        epsActual: optNum(row, 'epsActual', endpoint),
        revenueEstimate: optNum(row, 'revenueEstimate', endpoint),
        revenueActual: optNum(row, 'revenueActual', endpoint),
      });
    });
  }

  /** GET /macro/fred/observations/{seriesId}?limit= */
  async fredObservations(seriesId: string, limit: number, opts: RequestOptions): Promise<MacroSeries> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new EulerpoolError(EulerpoolErrorCode.BAD_REQUEST, 'limit must be 1..5000');
    const endpoint = `/macro/fred/observations/${encodeURIComponent(seriesId)}`;
    const { body, retrievedAt } = await this.#get(endpoint, { limit: String(limit) }, opts);
    if (!isObject(body)) throw schema(endpoint, 'expected an object');
    const rawObs = body['observations'];
    // Docs render `observations` as a single object; accept an array or one object.
    const list = Array.isArray(rawObs) ? rawObs : isObject(rawObs) ? [rawObs] : null;
    if (!list) throw schema(endpoint, 'observations missing');
    const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : null);
    return Object.freeze({
      seriesId: str('series_id') ?? seriesId,
      name: str('name'),
      frequency: str('frequency'),
      units: str('units'),
      observations: list.map((o, i) => {
        if (!isObject(o) || typeof o['date'] !== 'string' || Number.isNaN(Date.parse(o['date'] as string))) throw schema(endpoint, `observation ${i} invalid`);
        return Object.freeze({ date: new Date(o['date'] as string).toISOString(), value: optNum(o, 'value', endpoint) });
      }),
      retrievedAt,
    });
  }

  // ── transport ────────────────────────────────────────────────────────────

  #period(): string { return this.#clock().toISOString().slice(0, 7); }

  #checkLicence(opts: RequestOptions, endpoint: string): void {
    const l = this.licensingFor(opts.use);
    if (opts.use === 'CUSTOMER_FACING' && !l.displayPermitted) {
      throw new EulerpoolError(EulerpoolErrorCode.LICENCE_BLOCKED, 'Eulerpool data may not be shown to customers under the current licence', { endpoint });
    }
    if (!l.strategyDerivationPermitted) {
      throw new EulerpoolError(EulerpoolErrorCode.LICENCE_BLOCKED, `Eulerpool licence evidence does not permit ${opts.use}`, { endpoint });
    }
  }

  async #get(endpoint: string, query: Record<string, string>, opts: RequestOptions): Promise<{ body: LosslessValue; retrievedAt: string }> {
    if (!opts || (opts.use !== 'INTERNAL_RESEARCH' && opts.use !== 'CUSTOMER_FACING')) {
      throw new EulerpoolError(EulerpoolErrorCode.LICENCE_BLOCKED, 'a declared use is required', { endpoint });
    }
    this.#checkLicence(opts, endpoint);
    const qs = new URLSearchParams(query).toString();
    const pathAndQuery = `${endpoint}${qs ? `?${qs}` : ''}`;
    const cacheKey = createHash('sha256').update(`eulerpool:${pathAndQuery}`).digest('hex');
    if (opts.cache && this.#cache) {
      const hit = await this.#cache.get(cacheKey);
      if (hit !== null) return { body: parseBody(hit, endpoint), retrievedAt: this.#clock().toISOString() };
    }
    if (!this.#apiKey) throw new EulerpoolError(EulerpoolErrorCode.NO_API_KEY, 'no API key configured', { endpoint });

    let attempt = 0;
    for (;;) {
      await this.#guardQuota(endpoint);
      const text = await this.#once(pathAndQuery, endpoint).catch(async (e: unknown) => {
        if (e instanceof EulerpoolError && e.details.retryable && attempt < this.#maxRetries) return null;
        throw e;
      });
      if (text !== null) {
        if (opts.cache && this.#cache) await this.#cache.set(cacheKey, text);
        return { body: parseBody(text, endpoint), retrievedAt: this.#clock().toISOString() };
      }
      await this.#sleep(this.#retryBaseMs * 2 ** attempt);
      attempt++;
    }
  }

  async #guardQuota(endpoint: string): Promise<void> {
    const period = this.#period();
    const used = await this.#quota.used(period);
    if (used >= this.quotaStopAt) {
      this.#alert(period, used);
      throw new EulerpoolError(EulerpoolErrorCode.QUOTA_GUARD, `monthly quota guard: ${used}/${this.#limit} used, stop at ${this.quotaStopAt}`, { endpoint, retryable: false });
    }
  }

  #alert(period: string, used: number): void {
    if (this.#alerted.has(period)) return;
    this.#alerted.add(period);
    try { this.#onAlert({ kind: 'EULERPOOL_QUOTA_90', period, used, limit: this.#limit }); } catch { /* alert sink failure must not break the guard */ }
  }

  async #once(pathAndQuery: string, endpoint: string): Promise<string> {
    const period = this.#period();
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.#timeoutMs);
    let res: EulerpoolResponse;
    try {
      const used = await this.#quota.increment(period);
      if (used >= this.quotaStopAt) this.#alert(period, used);
      res = await this.#fetch(`${this.#baseUrl}${pathAndQuery}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.#apiKey}`, Accept: 'application/json' },
        signal: ac.signal,
      });
    } catch (e) {
      const aborted = (e as { name?: string })?.name === 'AbortError';
      throw new EulerpoolError(aborted ? EulerpoolErrorCode.TIMEOUT : EulerpoolErrorCode.NETWORK, aborted ? `timed out after ${this.#timeoutMs}ms` : 'network error', { endpoint, retryable: true });
    } finally {
      clearTimeout(timer);
    }
    const limit = Number(res.headers?.get('x-ratelimit-limit') ?? NaN);
    const remaining = Number(res.headers?.get('x-ratelimit-remaining') ?? NaN);
    if (Number.isFinite(limit) && Number.isFinite(remaining) && limit >= remaining) {
      await this.#quota.raiseTo(period, limit - remaining);
    }
    let text: string;
    try { text = await res.text(); } catch { throw new EulerpoolError(EulerpoolErrorCode.NETWORK, 'body read failed', { endpoint, status: res.status, retryable: true }); }
    if (res.ok) return text;
    const s = res.status;
    if (s === 401 || s === 403) throw new EulerpoolError(EulerpoolErrorCode.UNAUTHORIZED, `HTTP ${s} (invalid or missing API key)`, { endpoint, status: s, retryable: false });
    if (s === 429) throw new EulerpoolError(EulerpoolErrorCode.RATE_LIMITED, 'HTTP 429 (Free plan hard limit until monthly reset)', { endpoint, status: s, retryable: false, resetAt: res.headers?.get('x-ratelimit-reset') ?? null });
    if (s === 404) throw new EulerpoolError(EulerpoolErrorCode.NOT_FOUND, 'HTTP 404', { endpoint, status: s, retryable: false });
    if (s >= 500) throw new EulerpoolError(EulerpoolErrorCode.UPSTREAM, `HTTP ${s}`, { endpoint, status: s, retryable: true });
    throw new EulerpoolError(EulerpoolErrorCode.BAD_REQUEST, `HTTP ${s}`, { endpoint, status: s, retryable: false });
  }
}

/** A canonical USD equity instrument for Eulerpool EOD research (4-decimal minor units). */
export function eulerpoolEquityInstrument(ticker: string, opts: { exchange?: Exchange; name?: string; identifier?: string } = {}): Instrument {
  const exchange = opts.exchange ?? Exchange.NASDAQ;
  return Object.freeze({
    id: `${exchange}:${ticker}`,
    symbol: ticker,
    name: opts.name ?? ticker,
    assetClass: AssetClass.EQUITY,
    exchange,
    currency: 'USD',
    pricePrecision: 4,
    lotSize: 1,
    tickSizeMinor: 1n,
    tradingHours: { open: '09:30:00', close: '16:00:00', timezone: 'America/New_York', tradingDays: [1, 2, 3, 4, 5] },
    brokerSymbols: { eulerpool: opts.identifier ?? ticker },
  });
}

function parseBody(text: string, endpoint: string): LosslessValue {
  try { return parseLosslessJson(text); } catch { throw schema(endpoint, 'response is not valid JSON'); }
}

function schema(endpoint: string, msg: string): EulerpoolError {
  return new EulerpoolError(EulerpoolErrorCode.SCHEMA_MISMATCH, `${endpoint}: ${msg}`, { endpoint, retryable: false });
}

function optNum(obj: { [k: string]: LosslessValue }, key: string, endpoint: string): string | null {
  const v = obj[key];
  if (v === undefined || v === null) return null;
  const t = numericText(v);
  if (t === null) throw schema(endpoint, `'${key}' is not numeric`);
  return t;
}
