# Satelink

**AI-agent assistance and machine-commerce infrastructure for software agents and machines to discover, evaluate, access, use, meter, and pay for supported digital services programmatically.**

Satelink is the flagship technology platform built and operated by [Jakuraa Commercial Private Limited](https://jakuraa.com).

---

## Strategic Product Hierarchy

1. **Satelink (Platform):** AI-agent assistance and machine-commerce infrastructure enabling software agents and automated systems to discover, evaluate, access, use, meter, and pay for supported digital services programmatically.
2. **Platform Capabilities:**
   - **Polygon PoS RPC Gateway:** High-performance JSON-RPC access at a flat $0.00003/call.
   - **x402 Protocol:** HTTP-native keyless pay-per-call micropayments in USDC on Base (`eip155:8453`).
   - **Prepaid Credit Metering:** Permissionless on-chain USDT deposit vault on Polygon (`0x577D3716d6Ad5b676d230f5409deF9838FABaCEF`).
   - **Trading Intelligence API:** Metered analytical metrics and market statistics bought per call.
3. **Applications:**
   - **Satelink Trading AI (Controlled Paper-Trading Beta):** An autonomous trading copilot application following a strict safety boundary (AI proposes, deterministic risk and signed mandates decide). Live execution is not available.

> **Status Notice:**
> - **Platform & Payment Rails:** Live on mainnet (Polygon PoS & Base).
> - **Trading AI:** Controlled paper-trading beta. Live execution is not yet available.
> - **Node Operator Program:** Paused. Operator payouts are not active.

---

## Agent Procurement Workflow

Every client — a person, an autonomous AI agent, or a machine — operates through a deterministic 7-stage lifecycle:

```
Understand → Discover → Compare → Select → Authorize → Execute → Meter & Reconcile
```

1. **Understand:** Understand the agent's task or requirement, identifying required digital capabilities, payload parameters, and execution constraints.
2. **Discover:** Discover relevant digital services and providers via machine catalogues (`/.well-known/satelink.json`), service registries, or MCP tools.
3. **Compare:** Compare supported capabilities, pricing, unit costs, requirements, and constraints against budget parameters.
4. **Select:** Select a service and verify eligibility and operational availability before calling.
5. **Authorize:** Authorize access using the supported authentication and payment mechanism (HTTP 402 on Base USDC, scoped keys, or user-signed mandates).
6. **Execute:** Execute the permitted request or workload through high-availability gateways or keyless RPC proxies.
7. **Meter & Reconcile:** Meter usage, report the result, and reconcile applicable charges to prepaid balances or on-chain vaults (Polygon PoS).

---

## Three Interfaces

| Interface | For | Status | Description |
|---|---|---|---|
| **Web** | People | Live | Manage keys, spending limits, view transaction receipts, and explore service catalogues. |
| **API** | AI Agents & Machines | Live | Programmatic discovery (`/.well-known/satelink.json`), Polygon JSON-RPC, and Trading Intelligence. |
| **MCP** | AI Agents | Planned | Model Context Protocol tools for AI agents to discover resources and propose actions. |

---

## Production Capabilities

### 1. RPC Infrastructure (Polygon PoS)
- **Endpoint:** `https://rpc.satelink.network/rpc/polygon`
- **Rate:** Flat $0.00003 per call ($30 per million calls). No subscription, no monthly minimums.
- **Payment Options:** Keyless x402 bundle ($0.10 USDC = 1,000 calls on Base) or prepaid USDT credits on Polygon PoS.

### 2. x402 Machine Payments (Base)
- HTTP-native 402 payment challenge/response flow.
- Settles in USDC on Base (`eip155:8453`).
- Open-source middleware toolkit: [x402-kit](https://github.com/Jakuraa/x402-kit).

### 3. API Metering & Credits
- Prepaid balances funded by permissionless USDT deposits on Polygon (chain 137).
- Bounded spend: calls halt with HTTP 402 when credits reach zero.

### 4. Trading Intelligence API
- Derived market statistics (funding rate heatmap, open interest, liquidation clusters) metered per call ($0.01/call).
- Research input only; strictly not investment advice.

---

## Application: Satelink Trading AI (Paper Beta)

Satelink Trading AI is an application built on the Satelink platform.

- **Status:** Paper trading in controlled beta. Live execution is not available.
- **Safety Boundary:**
  - **AI proposes:** Models read context and suggest actions, with zero direct broker execution authority.
  - **Deterministic risk decides:** 20+ fixed hard gates, kill switches, and price collars enforce safety.
  - **Your signed mandate decides:** Operations require explicit parameters authenticated by one-time codes.
  - **Non-custodial:** Funds remain at your broker or wallet; withdrawals are never enabled.

---

## Verified On-Chain Contracts (Polygon PoS 137)

| Contract | Chain | Address |
|----------|-------|---------|
| RevenueVaultV2 (deposits) | Polygon 137 | `0x577D3716d6Ad5b676d230f5409deF9838FABaCEF` |
| USDT | Polygon 137 | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| Treasury / x402 payTo | Polygon / Base | `0x966E1Ae22996545015b1414B35234b10719d7Ad4` |

---

## Quickstart

### Service Discovery
```bash
curl https://api.satelink.network/.well-known/satelink.json
```

### Metered RPC Call (Polygon)
```bash
# Unpaid calls return HTTP 402 with complete machine-readable payment instructions:
curl -i -X POST https://rpc.satelink.network/rpc/polygon \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## Repository Structure

```
satelink/
├── apps/
│   ├── api/          # Express API monolith: RPC gateway, metering, credits, settlement
│   ├── web/          # Satelink platform Next.js frontend (satelink.network)
│   ├── corporate/    # Jakuraa corporate Next.js site (jakuraa.com)
│   └── mcp-server/   # Model Context Protocol tools for AI agents
├── packages/
│   ├── content/      # Canonical navigation, footer, and site fixtures
│   ├── sdk/          # @satelink/sdk TypeScript client library
│   └── seo/          # Shared SEO, metadata, and JSON-LD utilities
└── contracts/        # Foundry Solidity contracts: RevenueVaultV2, settlement
```

---

## Legal & Corporate

Satelink is operated by **Jakuraa Commercial Private Limited** (CIN: U51909TZ2019PTC031777), Coimbatore, Tamil Nadu, India.

- [Website](https://satelink.network)
- [Corporate Parent](https://jakuraa.com)
- [Terms of Service](https://satelink.network/terms)
- [Privacy Policy](https://satelink.network/privacy)

## License

MIT
