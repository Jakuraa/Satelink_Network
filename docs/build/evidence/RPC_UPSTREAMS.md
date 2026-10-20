# RPC upstream inventory (W1, 2026-10-20)

Sources: `apps/api/src/workloads/rpc_gateway/providers.js`, `router.js`; Railway variable **names**
(values not read). Only Polygon PoS is sold (`$0.00003/call`, x402 bundle).

## Polygon (chain 137): effective order in production

| # | Provider | Type | Configured by | State in prod | Commercial use |
|---|---|---|---|---|---|
| 1 | llamarpc-polygon | public | default URL | `enabled: false` (hard-coded; endpoint down) | n/a |
| 2 | alchemy-polygon | keyed, paid plan | `ALCHEMY_POLYGON_KEY` / `ALCHEMY_API_KEY` (set) | **primary** | OK (plan terms) |
| 3 | publicnode-polygon | **free public** | default `https://polygon-bor-rpc.publicnode.com` (no `PUBLICNODE_POLYGON_URL` set) | **enabled fallback** | **GAP: free public endpoint serving paid traffic** |
| 3 | ankr-polygon | keyed | `ANKR_API_KEY` (set) | `enabled: false` (hard-coded) | would be OK; unused |
| 4 | drpc-polygon | **free public** | default `https://polygon.drpc.org` (no `DRPC_POLYGON_URL` set) | enabled (no flag) | **GAP** |
| — | router `EMERGENCY_FALLBACKS.polygon` | **free public** | hard-coded `https://polygon.drpc.org` | used when the chain is exhausted | **GAP** |

The other chains (ethereum, arbitrum, base, amoy) also default to public endpoints. They are not sold today.

## Why this is not fixed in code yet
Removing the public fallbacks makes a paid call fail whenever Alchemy errors. RPC billing has a known
**no-refund-on-upstream-error** defect (master execution contract 2026-09-27), so customers would be
charged for failures. The order must be: (1) a second **paid** upstream, (2) a refund/void on upstream
failure, (3) public endpoints excluded for billed requests.

## Proposal (founder decision F20)
1. Enable `ankr-polygon` when `ANKR_API_KEY` is valid (code change, ready on request). Confirm the Ankr plan
   covers commercial resale of RPC responses.
2. Confirm Alchemy plan terms allow resale through a paid gateway (record the plan and the ToS URL).
3. Then a code PR: billed requests use only `type ∈ {alchemy, ankr}`; public providers serve only unpaid
   health/info probes; on chain exhaustion return a typed `provider_unavailable` error and void the charge.
