Satelink provides predictable, machine-metered pricing with no subscriptions, seats, or hidden fees.

## Service Discovery

| | |
|---|---|
| Price | $0 (Free) |
| Endpoint | `/.well-known/satelink.json` |
| Requirements | None — public machine-readable catalogue |

Public endpoints can be queried by agents and automated systems before authentication.

## Metered RPC (Pay-as-you-go)

| | |
|---|---|
| Price | **$0.00003 per call**, flat ($30 / million calls) |
| Billing | Deducted from a prepaid USDT credit balance |
| Deposits | Permissionless on-chain (Polygon PoS 137) to RevenueVaultV2 |
| Expiry | Credits never expire |
| Minimum | Returned live by `GET /credits/initiate` |

## x402 Keyless Payments (Base)

| | |
|---|---|
| Price | **$0.10 per 1,000 calls** |
| Asset & Network | USDC on Base (`eip155:8453`) |
| Auth | Keyless — payment travels in the HTTP request (`X-Payment`) |

## Trading Intelligence

| | |
|---|---|
| Per-call | $0.01 per call on crypto rails |
| Starter Pack | $9.99 one-time purchase via card / UPI (Dodo) |

## Trading AI — Paper Simulation

| | |
|---|---|
| Price | **$0.05 per simulation run** (50 UU) |
| Mode | Simulated paper execution (live trading is strictly disabled) |
| Billing | Deducted from a prepaid USDT credit balance |
| Idempotency | Replays with identical `idempotencyKey` return cached results at **$0 extra charge** |
| Zero-charge guarantee | Unsuccessful simulations never deduct credits |

That works out to **$30 per million calls**, always, at any volume. There are
no plans, no tiers, no rate negotiations, and no "contact sales."

## What we deliberately don't have

- **No subscriptions** — old references to $9/$49/$199 monthly plans are
  obsolete; those plans no longer exist.
- **No SLA guarantees yet** — uptime and latency are *measured* and published
  live on the [status page](https://satelink.network/status), but we do not
  sell a contractual SLA at this stage. Treat the network as beta capacity
  and keep a fallback RPC for critical production paths.
