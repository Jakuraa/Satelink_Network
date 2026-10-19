# Satelink Web Frontend

Next.js 15 application for Satelink (`satelink.network`) — AI-agent assistance and machine-commerce infrastructure for software agents and machines to discover, evaluate, access, use, meter, and pay for supported digital services programmatically.

## Live URLs

- **Production:** https://satelink.network
- **Documentation:** https://docs.satelink.network

## Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Platform overview & agent procurement loop |
| `/products/machine-commerce` | Machine-commerce infrastructure & payment rails |
| `/products/rpc` | Metered Polygon PoS RPC capability |
| `/products/x402` | Keyless pay-per-call in USDC on Base |
| `/pricing` | Flat rate card & x402 bundle pricing |
| `/docs` | Developer documentation & guides |
| `/trading-agent` | Satelink Trading AI application (paper beta) |
| `/satelink/os/keys` | API key management & MetaMask binding |
| `/satelink/os/deposit` | Permissionless USDT credit deposits |

## Development

```bash
cd apps/web
npm install
npm run dev
```

Requires backend running at `http://localhost:8080`.

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

## Stack

- Next.js 14 (App Router)
- Tailwind CSS
- shadcn/ui components
- Recharts for analytics
- wagmi + viem for wallet connection

## Deployment

Auto-deploys to Vercel on push to `main` branch.
