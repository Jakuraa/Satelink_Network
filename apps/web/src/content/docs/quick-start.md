## 1. Discover services

The fastest way to understand Satelink is to query its public machine discovery catalogue:

```bash
curl https://api.satelink.network/.well-known/satelink.json
```

This returns machine-readable endpoints, capabilities, and pricing specifications for all supported platform services before authentication.

## 2. Inspect payment requirements (HTTP 402)

Unauthenticated calls to protected endpoints return self-contained HTTP 402 responses with exact payment terms:

```bash
curl -i -X POST https://rpc.satelink.network/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

The response includes the required payment terms: you can pay per call keylessly via x402 (USDC on Base), or create an API key funded with prepaid USDT credits. See [Machine Customers](/docs/machine-customers).

## 3. Create an API key

An API key gives you your own metered quota and a usage dashboard. One call, no signup form:

```bash
curl -X POST https://rpc.satelink.network/api/keys \
  -H "Content-Type: application/json" \
  -d '{"label":"my-first-key"}'
```

The response contains your `api_key` (shown once — store it). Prefer a UI?
The [developer console](/satelink/os/keys) creates a wallet-bound key from a
single MetaMask signature.

## 4. Add prepaid credits

Deposit USDT on Polygon PoS to the RevenueVault — permissionless, from any
wallet. At the flat metered rate of $0.00003/call, $1 buys ≈ 33,333 calls:

```bash
curl "https://rpc.satelink.network/credits/initiate?amount=10"
```

The response contains the vault address, the USDT contract address, and
ready-to-send `approve` + `deposit` calldata. Credits appear after ~25 block
confirmations (about 5 minutes). Full detail: [Billing & Credits](/docs/billing).

## 5. Call with your key & check usage

Call with your authenticated key:

```bash
curl -X POST https://rpc.satelink.network/rpc \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

Check your usage and remaining credits:

```bash
curl https://rpc.satelink.network/api/keys/usage \
  -H "X-API-Key: YOUR_API_KEY"
```

## Supported chains

| Chain | Chain ID |
|---|---|
| Polygon PoS | 137 |
| Ethereum | 1 |
| Arbitrum | 42161 |
| Base | 8453 |
| Polygon Amoy (testnet) | 80002 |

The gateway monitors every upstream provider with health checks and circuit
breakers — see live provider status at
[rpc.satelink.network/rpc/health](https://rpc.satelink.network/rpc/health).
