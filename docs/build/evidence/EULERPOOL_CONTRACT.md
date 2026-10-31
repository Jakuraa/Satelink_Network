# Eulerpool API contract (evidence, 2026-10-31)

Source: official docs at `eulerpool.com/developers` (Introduction, Quick Start, Authentication,
Rate Limits, Errors, endpoint pages) and `eulerpool.com/financial-data-api/pricing`, read
2026-10-31. Implementation: `services/trading/src/market/eulerpool-provider.ts`.
Licence evidence record: `docs/build/evidence/licences/eulerpool.json`.

## Base URL and auth
- Base URL: `https://api.eulerpool.com/api/1` (Quick Start example). HTTPS only; HTTP is rejected.
- Auth: the docs allow `?token=` **or** `Authorization: Bearer <key>`.
  **We use only the Bearer header.** The query parameter leaks into logs, proxies and URLs.

## Endpoints used (all `GET`)
| Use | Path | Params | Documented 200 shape |
|---|---|---|---|
| EOD prices (equities/ETFs) | `/charting/ohlcv/{identifier}` | `resolution` (1,5,15,30,60,D,W,M; we send `D`), `from`/`to` unix seconds | `{ t:[], o:[], h:[], l:[], c:[], v:[] }` (element types not stated; docs examples elsewhere use JSON numbers) |
| Fundamentals | `/fundamentals/financials/{identifier}/ratios` | optional `price` | `{ ticker, fiscal_year, pe_ratio, pb_ratio, debt_to_equity, roe, profit_margin }` |
| Insider activity (aggregate) | `/sentiment/insider-sentiment/{identifier}` | — | `[{ year, month, change, mspr }]` (mspr −100..100) |
| Insider trades | `/equity/insider-trades/{identifier}` | — | **Undocumented** (docs show `{}`); adapter accepts an array of flat objects only |
| Earnings dates | `/calendar/earnings-by-symbol/{symbol}` | — | `[{ symbol, date, epsEstimate, epsActual, revenueEstimate, revenueActual }]` |
| Macro series | `/macro/fred/observations/{seriesId}` | `limit` (default 500, max 5000) | `{ series_id, name, frequency, units, observations }` (docs render `observations` as one object; adapter accepts object or array) |

`{identifier}` accepts ISIN, ticker, CUSIP, SEDOL or WKN. Doc-page URLs differ from API paths
(e.g. doc `/developers/api/sentiment/insider/sentiment` → API `/sentiment/insider-sentiment/{id}`);
the paths above are the API paths stated on each endpoint page.

Not added (no strategy uses them yet): quotes, `/equity/candles` (OHLC "approximated from daily
quotes"), splits, dividends, other macro sources.

## Rate limits and quota
- Monthly only; no per-second limit is published.
- Free 100,000/month, **hard limit**: HTTP 429 until the month resets. Builder 1M (metered),
  Startup 10M, Scale unlimited.
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Adapter: local monthly counter (UTC `YYYY-MM`), raised to provider-reported usage when the
  headers are present; **stops at 90,000 (90%)** and fires one `EULERPOOL_QUOTA_90` alert per month.

## Errors
Documented: 200, 400, 401, 404, 429, 500. Only the 401 body is shown:
`{ "error": "Unauthorized", "message": "Invalid or missing API key.", "status": 401 }`.
Adapter error codes: `UNAUTHORIZED` (401/403), `RATE_LIMITED` (429, carries reset),
`NOT_FOUND`, `BAD_REQUEST`, `UPSTREAM` (5xx), `TIMEOUT`, `NETWORK`, `SCHEMA_MISMATCH`,
`QUOTA_GUARD`, `LICENCE_BLOCKED`, `NO_API_KEY`. Retries: 5xx/timeout/network only, bounded
(default 2, exponential backoff); 401/400/404/429 are never retried.

## Plan restrictions (Free) — consistent with the founder input, no contradiction
- "EOD + delayed quotes"; "personal and non-commercial use"; attribution "Data by Eulerpool"
  in any public-facing product. Free includes full statements & ratios, complete price history,
  all endpoints.
- Builder (cheapest commercial): $990/yr, 1M requests/month, commercial use, no attribution.
- Licensing derived from the evidence record: `strategyDerivationPermitted=true` for
  INTERNAL_RESEARCH only; display, redistribution and commercial use false. Any
  CUSTOMER_FACING request fails closed before the network call (`LICENCE_BLOCKED`), and
  `assertCustomerDisplayable()` blocks any customer response that includes Eulerpool provenance.

## Data-quality limits (record before any backtest conclusion)
- Split/dividend adjustment of `/charting/ohlcv` is **not documented**. Treat the series as
  unadjusted until a live check against a known split (e.g. AAPL 2020-08-31 4:1) proves otherwise.
- Survivorship: the docs say nothing about delisted securities. Universe selection from
  today's listings is survivorship-biased; equity backtests must state this.

## Live check (opt-in, run once 2026-10-31 ~15:55 IST)
- From the Railway API runtime (`Satelink-api`, region `us-west2`, Node v20.19.5), with the
  Railway-held key (never read by this session): all 8 endpoints → **HTTP 502** from Eulerpool's
  edge, ~310–660 ms; no `X-RateLimit-*` headers; the invalid-token control also → 502.
- From the build machine (India), keyless/invalid token: **HTTP 401** in ~0.9 s, body `{}`
  (documented 401 behaviour).
- Conclusion: Eulerpool is not reachable from Railway us-west2 egress today; authenticated
  responses could not be recorded. Fixtures follow the documented schemas and are labelled as
  such. Quota consumed by the probe: at most 8 requests (if 502s counted).
- Re-run: `EULERPOOL_LIVE=1 EULERPOOL_API_KEY=… npx vitest run src/__tests__/eulerpool.live.test.ts`
  in `services/trading` from a host that can reach the API (1 request; prints status/latency only).
