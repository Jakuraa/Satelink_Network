# /rpc traffic segments — runbook + decision rules (2026-10-15)

**Status: WAITING FOR DATA.** The persistent recorder (`rpc_traffic_daily`, PR #538) has been
counting since deploy `438b4ac3` (2026-10-15 ~17:30 UTC); the first full UTC day is 2026-10-16,
so the earliest useful read is **2026-10-18 UTC** (`?days=2` covers 16th–17th complete). This doc is filled in from `GET /admin/traffic/rpc` output once there are
**≥ 48 hours** (2 full UTC days) of data. Until then nothing below is a measured result — the
segment rules and the decision table are written down *before* the data so the choice in
Step D cannot be fitted to it afterwards.

## 1. Collect (founder, read-only, ~1 minute)

```bash
# Token straight from Railway into the header — never printed, never pasted anywhere.
T=$(railway variables --service Satelink-api --kv | sed -n 's/^ADMIN_SECRET_TOKEN=//p')
curl -s -H "X-Admin-Token: $T" "https://api.satelink.network/admin/traffic/rpc?days=7" > traffic_7d.json
unset T
```

Paste `traffic_7d.json` back to Claude. It contains aggregates and keyed HMAC pseudonyms
(`client_hash`) only — no IPs, no keys. Check first: `data.totals.overflow_requests` should be
small relative to `data.totals.requests`; if it is large, the row cap
(`RPC_TRAFFIC_ROW_CAP`, default 20,000/day) is saturating and per-client numbers undercount.

## 2. Segment rules (fixed before the data)

Applied to `top_ua_families`, `top_origin_hosts`, `repeat_callers.top[]`, `methods`:

| segment | rule (any one is enough) | can it pay x402 today? |
|---|---|---|
| **1. Wallet / dApp** | `ua_family` starts with `browser-` **or** `metamask`; or `origin_host` is a real site domain (not `none` / `ip-literal` / `invalid`) | No — a browser wallet user won't sign a Base USDC payment for an RPC call they don't know is happening; the dApp operator would have to pay |
| **2. Scanner / noise** | `ua_family` in `none`, `bot`, `curl`, `wget`, `python-*`, `go-http` **and** client never on 3+ days **and** never a `2xx`; or a client ≥ 1,000 req/day that only ever got `402` (no reaction to the 402) | Irrelevant |
| **3. Repeat agent / dev** | client in `repeat_callers` (3+ days) with `ua_family` an SDK/tool (`ethers`, `viem`, `web3*`, `erpc`, `go-ethereum`, `hardhat`, `foundry`, `node-fetch`, `undici`, `axios`, `deno`, `supabase-edge`, `ua:<custom>`) | Yes, if the operator reads the 402 |

Edge rules: a browser UA with `origin_host = none` on POST JSON-RPC is **ambiguous** (spoofed
scraper or server-side proxy) — report it separately, do not add it to segment 1. A client in
segment 3 that already appears in `sent_402_then_paid.clients` is a **converted** customer and
is listed first.

### Segment 3 output format (who to contact)
For each: `client_hash` (pseudonym), `top_ua_family`, `top_origin_host`, `days_seen`,
`requests`, `got_402`, `paid_requests`. Contact only where a public, self-published channel
exists (a domain's site, a GitHub repo named in a UA) — never via inferred ISP/abuse addresses
(rejected earlier, see memory `outreach-email-collection`).

## 3. Segment 1 — is a different offer realistic? (math, filled from data)

Price: **$0.10 per 1,000 calls = $0.0001/call** (x402 bundle; deposits are $0.00003/call).

Let `V1` = segment-1 requests/day (from data). Revenue/day if a fraction `c` of that volume
converts to paid calls = `V1 × c × $0.0001`.

Reference using the known ~94,000 req/day total on `/rpc/polygon` (upper bound for any segment):

| conversion of volume | paid calls/day | $/day | $/month |
|---|---|---|---|
| 100% | 94,000 | $9.40 | ~$282 |
| 10% | 9,400 | $0.94 | ~$28 |
| 1% | 940 | $0.094 | ~$2.82 |
| first payment | 1,000 (one bundle) | $0.10 once | — |

Consequences, before any data:
- At this volume **no conversion rate reaches the $500/hr target** (that needs 5M paid
  calls/hour). Segment 1 can only matter as *proof of first external payment*, not revenue.
- A prepaid card or USDT-deposit offer to segment 1 matters only if a **dApp operator** (one
  `origin_host`) converts — a single operator moving its whole volume is the realistic unit,
  not per-user conversion. So the question for each top `origin_host` is binary: does this
  operator have a public contact and enough volume (≥ 1,000 calls/day = one bundle/day)?
- Minimum to matter for "first real external payment": **one** origin_host or one repeat
  client buying **one** $0.10 bundle (or a $1+ USDT deposit). Any decision should be judged
  against that bar, not a percentage.

## 4. Step D decision table (one change only, chosen by the data)

| if the 48h data shows… | the single change | funnel metric (instrumented before launch) |
|---|---|---|
| Segment 3 has ≥ 1 repeat SDK/agent client that got 402s and never paid | Sharper 402 copy for `none`-auth SDK callers: lead with the one-line x402 retry and the exact bundle price; nothing else | `rpc_traffic_daily`: that segment's `402 → 2xx paid` transition (`sent_402_then_paid`) + x402 settlements count |
| Segment 1 dominated by 1–3 `origin_host`s with ≥ 1,000 req/day each | Dev signup page: funded key via existing USDT deposit path in ≤ 5 steps (register → deposit calldata → confirm → key works) | page view → `/credits/deposit/initiate` → confirmed deposit → first `key-funded` 2xx |
| `key-unfunded` volume is material (keys exist, unfunded) | 402 copy for keyed-but-unfunded callers pointing at the deposit/top-up path | `key-unfunded` → `key-funded` per client_hash across days |
| Mostly segment 2 / ambiguous | No product change; report that the traffic is not a conversion opportunity | — |

Ties break toward the smallest diff. No new products, no new channels.

## 5. Results

_Not yet filled — waiting for ≥ 48h of `rpc_traffic_daily` data after PR #538 deploys._
