# Unpaid /rpc/polygon traffic — who is it? (2026-10-15)

## Status: PARTIAL — 15-minute sample only, not 7 days. Read the limitations before quoting any number.

## Methodology (exact commands run)

```bash
railway logs --http --path /rpc/polygon --since 7d --json   # → 500 lines, span 06:08:46–06:12:08 UTC (3.5 min)
railway logs --http --path /rpc/polygon --lines 5000 --json # → 2,246 lines, span 05:57:37–06:12:34 UTC (~15 min)
railway logs --http --path /rpc/polygon --lines 10000 --json # → FAILS: "Error in beforeLimit - Invalid input" (5,000 is the practical ceiling)
railway logs --http --path /rpc/polygon --since 3d --until 2d --json # → 0 lines
```

**The 7-day ask could not be fulfilled.** Railway's `--http --json` log query returns only the
most recent entries regardless of `--since`/`--until` — `--since 30m`, `2h`, `12h`, and `24h` all
returned the identical most-recent 500 lines, and a 2–3-day-old window returned zero rows. This is
a platform log-retention limit on the HTTP log type, not a flag I'm missing. The only way to get
more rows was to raise `--lines` (max ~5,000 before the API errors), which bought ~15 minutes of
history, not more days. **Everything below is a 15-minute sample (2,246 requests, 05:57–06:12 UTC,
2026-10-15), scaled conclusions, not a 7-day census.** If the founder needs real 7-day numbers, the
options are: a Railway log drain to long-term storage (not currently configured, per
`docs/platform/EXECUTION_BOARD.md` there is no mention of one), or re-running this exact pull
repeatedly over a week and concatenating.

This sample's rate (2,246 req / 15 min ≈ 215k/day if constant) runs higher than CLAUDE.md's
~94k/day baseline — either this 15-minute window was busier than average, or the two measures
count slightly different things (this count includes `OPTIONS` CORS preflights). Treat the
breakdown proportions as more reliable than the absolute daily extrapolation.

## What the HTTP log schema actually contains

Fields present on every row: `timestamp, method, path, httpStatus, totalDuration, requestId, host,
clientUa, srcIp, edgeRegion, txBytes, rxBytes, upstreamRqDuration, upstreamAddress, upstreamProto,
downstreamProto, upstreamErrors, responseDetails, deploymentId, deploymentInstanceId`.

**Not present, confirmed by enumerating every key across all 2,246 rows:**
- **Referer / Origin** — not captured at all. Cannot tell which website/dApp front-end a browser
  call came from.
- **JSON-RPC method** (`eth_call`, `eth_getLogs`, etc.) — the edge HTTP log only has the HTTP
  `method` (POST/OPTIONS), never the request body. A JSON-RPC method breakdown is **not possible
  from these logs**; it would need app-level logging of the parsed body, which doesn't currently
  write to anywhere this session could read without DB access.

## Breakdown (this 15-minute sample, n=2,246)

**HTTP method:** POST 1,726 (76.8%) · OPTIONS 520 (23.2%, CORS preflight, not billable)
**HTTP status:** 402 1,724 · 204 520 (preflight) · 499 2 (client closed connection). **Zero
non-402/204 responses** — confirms no free-tier leak in this window.
**Edge region:** 100% `us-west2` (single edge POP in this sample).
**Distinct source IPs:** 105 total; 17 of those (16%) were seen exactly once.

**User-agent family** (POST requests, by family):
| Family | Count | Read |
|---|---|---|
| Generic browser-UA (Chrome-shaped) | 1,058 (47%) | Ambiguous — see note below |
| No UA sent | 480 (21%) | Bare scripts/scanners; no identity to convert |
| `go-http-client` (Go stdlib) | 161 (7%) | Custom Go client — worth a look |
| `RPCHub/1.0 ... Darwin/` (self-identified, macOS/iOS app) | 149 (7%), all from one IP | Dedicated client app |
| Python generic (`requests`/urllib) | 119 (5%) | Script |
| Firefox-shaped browser UA | 55 (2%) | — |
| `node-fetch` | 30 (1%) | Node script |
| `rpc-hash-checker/0.1.0` | 15 | Self-identified monitoring tool |
| `polygon-one/0.1 (+github...)` | 15 | Self-identified Polygon tool, has a repo link |
| `curl` | 14 | Manual/script testing |
| Self-identified bot/crawler string | 13 | Declares itself |
| bare `node` | 13 | Script |
| `Lightpanda/1.0` | 13 | Lightweight headless browser — scraping/automation |
| `Deno (SupabaseEdgeRuntime...)` | 12 | A Supabase Edge Function calling Satelink |
| `axios` | 10 | Script/backend |
| `ureq/2.12.1` (Rust) | 10 | Custom Rust client |
| `PolymarketCleanChain/1.0 verified public` | 8 | Self-identified, Polymarket-branded |
| `erpc (0.1.2 / dev)` | 14 total | eRPC — a real open-source RPC proxy/load-balancer |
| `Bun/1.3.10` | 6 | Script on Bun runtime |

**Note on the 47% "browser-shaped" UA:** this is POST JSON-RPC traffic, not page loads. A real
human does not hand-type JSON-RPC in a browser address bar, so this is either (a) a dApp's
front-end calling Satelink directly client-side (e.g. a wallet/dApp configured with Satelink as a
custom RPC endpoint — consistent with no Referer being captured, since many wallet RPC calls don't
set one), or (b) scrapers/bots spoofing a common desktop UA to blend in. **Cannot distinguish (a)
from (b) with this log schema — UNVERIFIED.**

**Top 15 source IPs by volume (hashed, salted sha256, truncated to 12 hex chars — no raw IP appears
anywhere in this file or was printed to any log this report is built from):**
| Hashed IP | Reqs | Status seen | UA |
|---|---|---|---|
| `022c3a1b0e1c` | 302 | 402 only | none |
| `f8206b170db8` | 150 | 402 only | RPCHub/1.0 (Darwin) |
| `3db5a3de6a1c` | 133 | 402 only | go-http-client |
| `3ebeef583a63` | 114 | 402 only | python-generic |
| `d3bf2c8922a2` | 106 | 402 + preflight | browser-shaped |
| `50c2af1386bb` | 92 | 402 only | browser-shaped |
| `b05e06a1e26f` | 90 | 402 + preflight | browser-shaped |
| `8416c899e9c6` | 60 | 402 only | none |
| `d31fa3449046` | 60 | 402 + preflight | browser-shaped |
| `3d6d13219f6c` / `cdc975d0614c` / `037a8bdb84e5` | 55–58 each | 402 + preflight | browser-shaped |
| `b837b6a93776` | 55 | 402 + client-closed | none |
| `8235618cd228` / `3c051d591efa` | 50–52 each | 402 + preflight | browser-shaped |

## The 31 instant-key machines

**UNVERIFIED — not found.** Checked `railway logs --filter "instant"` and `--filter
"machine/register"` (deploy/app logs, text search, last 200 lines): zero matches. Either the
registration events aren't logged to stdout/stderr at app level, or they fall outside the log
buffer's retention window. Confirming the 31 instant-key machines' origin requires a read on
`api_credits`/the registration table — out of scope for this session (no DB access).

## Verdict: worth converting vs. scanners

**Likely worth converting (real client, identifiable, low-volume, structured):**
1. **`PolymarketCleanChain/1.0 verified public`** — self-identifies as verified, Polymarket-branded
   (Polymarket is a major Polygon-chain prediction market — a legitimate high-value target).
2. **eRPC clients (`erpc 0.1.2` / `erpc dev`)** — eRPC is a real, widely-used open-source RPC
   proxy/load-balancer; someone has Satelink configured as a backend.
3. **`polygon-one/0.1` + `RPCHub/1.0` (149 reqs, one dedicated client app) + the Supabase Edge
   Function UA** — self-identified, purpose-built clients, not generic scripts.

**Likely scanners/noise, lower priority:**
- The 480 requests with **no UA at all** and the **302-request single IP with no UA** hammering
  steadily at 402 with zero variation — classic naive scanner, not reading or reacting to the
  payment instructions.
- `curl`/bare `node` one-off testing (14 + 13 reqs) — likely developers probing, not production
  traffic.
- `Lightpanda` headless-browser traffic — scraping, not an RPC consumer with a wallet.

**Genuinely ambiguous, needs the founder's judgment:** the 47% browser-shaped UA bucket. If this is
real dApp front-end traffic, it's the single largest conversion opportunity in this sample; if it's
spoofed-UA scraping, it's noise. This log schema cannot resolve it — would need either an
app-level Referer/Origin capture or a CAPTCHA-style client-hint check, neither of which exists today.
