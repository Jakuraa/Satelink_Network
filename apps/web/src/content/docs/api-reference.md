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

## Trading AI — Paper Simulation

Multi-market trading strategy simulation engine. Runs paper execution against historical market data with full audit trail and financial receipt generation. Live trading is strictly disabled.

### `GET /v1/trading/paper/simulate`

Free capability discovery endpoint. Returns execution mode (`SIMULATED_PAPER_EXECUTION`), price ($0.05 USDT), supported instruments, supported strategies, disclaimer, and payment instructions without authentication.

```bash
curl -X GET https://api.satelink.network/v1/trading/paper/simulate
```

### `POST /v1/trading/paper/simulate`

Executes a metered paper-trading simulation run. Deducts $0.05 (USDT) from prepaid credits upon successful execution. Failed or rejected simulations are never charged.

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: YOUR_API_KEY` (or `Authorization: Bearer YOUR_API_KEY`)

**Body Parameters:**
- `idempotencyKey` (string, required): Unique caller-generated key (e.g. UUID) for idempotent execution and replay safety.
- `instrumentId` (string, required): Supported instrument (`BINANCE:BTCUSDT`, `PAPER:BTCUSDT`, `NSE:NIFTY50`).
- `strategy` (string, required): Strategy identifier (`sma-crossover`).
- `strategyParams` (object, optional): Strategy parameters (e.g. `fastPeriod`, `slowPeriod`).
- `orderQuantity` (number, optional): Simulation order quantity (default: `1`).

```bash
curl -X POST https://api.satelink.network/v1/trading/paper/simulate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "idempotencyKey": "sim_run_001",
    "instrumentId": "BINANCE:BTCUSDT",
    "strategy": "sma-crossover",
    "strategyParams": {
      "fastPeriod": 10,
      "slowPeriod": 30
    }
  }'
```

**Response Format:**
```json
{
  "ok": true,
  "service": "Satelink Multi-Market Trading AI — Paper Simulation",
  "mode": "SIMULATED_PAPER_EXECUTION",
  "disclaimer": "SIMULATED_PAPER_EXECUTION: NOT_ACTUAL_RETURNS",
  "revenue_receipt": {
    "revenue_request_id": "sim:sim_run_001",
    "amount_usdt": 0.05,
    "recorded": true
  },
  "execution_report": {
    "simulation_id": "sim_...",
    "instrument_id": "BINANCE:BTCUSDT",
    "strategy": "sma-crossover",
    "financial_settlement": {
      "billed": true,
      "revenueRequestId": "sim:sim_run_001"
    }
  }
}
```

**Errors & Idempotency:**
- **402 Payment Required**: Returned if credits are below $0.05 USDT. Response includes deposit instructions and x402 payment options.
- **422 Unprocessable Entity**: Returned if `idempotencyKey` or `instrumentId` is missing, or if an existing `idempotencyKey` is retried with a conflicting payload (`idempotency_payload_mismatch`).
- **503 Simulation Failed**: Returned if simulation encounters an internal failure. No credits are deducted ($0 charge).
- **Idempotent Replay**: Repeating the exact same request with the same `idempotencyKey` returns the stored result with `"idempotent_replay": true` at $0 additional charge.

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
