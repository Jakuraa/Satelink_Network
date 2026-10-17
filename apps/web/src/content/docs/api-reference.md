Base URL: `https://rpc.satelink.network` (also served as
`api.satelink.network`). All bodies are JSON.

## Discovery

### `GET /.well-known/satelink.json`

The public machine-readable service discovery catalogue. Returns available services,
supported payment rails (x402 on Base, USDT on Polygon PoS), endpoints, and unit prices
without authentication.

## RPC

### `POST /rpc`

The metered JSON-RPC gateway (Polygon PoS by default). Standard JSON-RPC 2.0
body. Requires `X-API-Key` (metered against prepaid USDT credits) or keyless
`X-Payment` (x402 micropayment in USDC on Base). Unpaid calls return HTTP 402.

```bash
curl -X POST https://rpc.satelink.network/rpc \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x...","latest"],"id":1}'
```

Error responses you should handle:

| Status | Meaning | Action |
|---|---|---|
| 402 | Unpaid call / zero credit balance | Satisfy x402 payment requirements or deposit USDT credits |
| 429 | Abuse limit (automated non-developer traffic) | Respect `Retry-After` |

### `GET /rpc/health`

Public health of every upstream provider (per-chain success rates, latency,
last error). No auth.

### `GET /rpc/stats/polygon`

Provider circuit-breaker states and edge-cache hit rates. No auth.

## Keys & usage

### `POST /api/keys`

Create an API key. Body: `{"label": "...", "tier": "free", "email": "optional",
"email_consent": false}`. Returns the key once.

### `GET /api/keys/usage`

Header `X-API-Key`. Returns tier, daily limit, requests today, total spend,
and credits remaining.

### `POST /v1/machine/register`

Machine onboarding — registers a machine identity and returns an API key.
Designed to be called from the HTTP 402 body instructions. See
[Machine Customers](/docs/machine-customers).

## Credits

### `GET /credits/initiate?amount=<usdt>`

Returns everything needed to deposit: RevenueVault address, USDT contract
address, chain id (137), the raw amount, and ready-to-send `approve` and
`deposit` calldata, plus a Polygonscan link.

## Status & network

### `GET /api/status`

Live network status: nodes online, current epoch, requests today (Redis
counter, resets UTC midnight), measured uptime and p50 latency over the last
24h of health samples (`null` when there is no sample — never a made-up
number).

### `GET /v1/intelligence/catalog`

Returns the catalogue of active Trading Intelligence analytical metrics, pricing, and schema specifications.

### `GET /health`

Liveness: `{ ok, server, db, uptime }`.

## Node operators (Paused)

The node operator program is paused. Operator payouts are not active, and node registration is not currently accepting new operators. See [Node Operators](/docs/node-operators).

## Conventions

- Machine values (addresses, hashes, keys, amounts) are returned in full —
  truncate for display, never for storage.
- Amounts are USDT with 6 decimals unless a field name says otherwise.
- Admin endpoints (`/admin/*`) exist but are operator-only (header-token
  gated) and intentionally not documented here.
