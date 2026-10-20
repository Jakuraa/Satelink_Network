# @satelink/sdk

[![npm version](https://img.shields.io/npm/v/@satelink/sdk)](https://npmjs.com/package/@satelink/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@satelink/sdk)](https://npmjs.com/package/@satelink/sdk)

> **Published:** [npmjs.com/package/@satelink/sdk](https://npmjs.com/package/@satelink/sdk) (scoped)  
> **Fallback:** [npmjs.com/package/satelink-sdk](https://npmjs.com/package/satelink-sdk) (unscoped)

Official TypeScript/JavaScript SDK for the Satelink AI-agent and machine-commerce platform — metered Polygon PoS RPC, agent adapters, and payment rails.

## Install

```bash
npm install @satelink/sdk
# or
pnpm add @satelink/sdk
# or
yarn add @satelink/sdk
```

## Quick Start

```typescript
import { SatelinkRPC, getEthersProvider } from '@satelink/sdk';

// RPC calls with your API key
const rpc = new SatelinkRPC({ apiKey: 'sat_live_...', chain: 'polygon' });
const blockNumber = await rpc.getBlockNumber();
console.log('Current block:', blockNumber);

// ethers.js provider (drop-in Polygon RPC provider)
const provider = getEthersProvider('polygon', { apiKey: 'sat_live_...' });
const balance = await provider.getBalance('0x...');
```

## RPC Usage

```typescript
import { SatelinkRPC } from '@satelink/sdk';

const rpc = new SatelinkRPC({
  apiKey: 'sat_live_...', // Your metered API key
  chain: 'polygon' // polygon (live gateway), ethereum, arbitrum, base
});

// Get block number
const block = await rpc.getBlockNumber();

// Get balance
const balance = await rpc.getBalance('0x742d35Cc6634C0532925a3b844Bc9e7595f7bA8f');

// Make contract call
const result = await rpc.call({
  to: '0x...',
  data: '0x...'
});

// Send signed transaction
const txHash = await rpc.sendRawTransaction('0x...');

// Raw JSON-RPC request
const logs = await rpc.request('eth_getLogs', [{
  fromBlock: '0x0',
  toBlock: 'latest',
  address: '0x...'
}]);
```

## MEV Relay

Private mempool for MEV searchers. Transactions bypass public mempool.

```typescript
import { createMevClient } from '@satelink/sdk';

const mev = createMevClient({ apiKey: 'sk_your_api_key' });

// 1. Simulate bundle first (cheap - $0.0001)
const simulation = await mev.simulateBundle([
  '0x02f8...', // signed tx 1
  '0x02f8...'  // signed tx 2
]);

console.log('Profitable:', simulation.profitable);
console.log('Coinbase diff:', simulation.simulation?.coinbaseDiff);

// 2. Submit if profitable ($0.005 per bundle)
if (simulation.profitable) {
  const result = await mev.submitBundle(
    ['0x02f8...', '0x02f8...'],
    { blockNumber: 'latest' }
  );
  console.log('Bundle hash:', result.bundleHash);

  // 3. Track inclusion status
  const status = await mev.getBundleStatus(result.bundleHash);
  console.log('Status:', status.status);
}

// Submit single private tx ($0.001)
const tx = await mev.submitPrivateTransaction('0x02f8...');
```

### MEV Pricing

| Method | Price |
|--------|-------|
| eth_callBundle (simulation) | $0.0001 |
| eth_sendRawTransaction | $0.001 |
| eth_sendBundle | $0.005 |
| flashbots_getBundleStats | $0.00005 |

## Framework Adapters

Drop-in replacements for Alchemy/Infura with zero config changes.

### ethers.js

```typescript
import { getEthersProvider } from '@satelink/sdk';

// ethers v5 or v6 - auto-detected
const provider = getEthersProvider('polygon');
const block = await provider.getBlockNumber();
const balance = await provider.getBalance('0x...');
```

### viem

```typescript
import { createPublicClient } from 'viem';
import { polygon } from 'viem/chains';
import { getViemTransport } from '@satelink/sdk';

const client = createPublicClient({
  chain: polygon,
  transport: getViemTransport('polygon'),
});

const block = await client.getBlockNumber();
```

### wagmi

```typescript
import { createConfig, http } from 'wagmi';
import { polygon, arbitrum, base } from 'wagmi/chains';
import { getSatelinkRpcUrl } from '@satelink/sdk';

const config = createConfig({
  chains: [polygon, arbitrum, base],
  transports: {
    [polygon.id]: http(getSatelinkRpcUrl('polygon')),
    [arbitrum.id]: http(getSatelinkRpcUrl('arbitrum')),
    [base.id]: http(getSatelinkRpcUrl('base')),
  },
});
```

### Raw JSON-RPC (no dependencies)

```typescript
import { rpc } from '@satelink/sdk';

const blockNumber = await rpc('eth_blockNumber', [], 'polygon');
const balance = await rpc('eth_getBalance', ['0x...', 'latest'], 'ethereum');
```

## EIP-1193 Provider

Full EIP-1193 compatible provider with event support:

```typescript
import { SatelinkProvider } from '@satelink/sdk';

const provider = new SatelinkProvider({
  chainId: 137, // Polygon
  apiKey: 'sk_your_api_key'
});

// Standard EIP-1193 request
const blockNumber = await provider.request({ method: 'eth_blockNumber' });

// Listen for chain changes
provider.on('chainChanged', (chainId) => {
  console.log('Chain changed to:', chainId);
});

// Switch chains
await provider.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0x89' }] // Polygon
});
```

## Supported Chains

| Chain | ID | Slug | MEV Support |
|-------|-----|------|-------------|
| Ethereum | 1 | `ethereum` | Yes (Flashbots) |
| Polygon | 137 | `polygon` | Yes |
| Arbitrum | 42161 | `arbitrum` | Yes |
| Base | 8453 | `base` | No |
| Polygon Amoy | 80002 | `amoy` | No (testnet) |

## Pricing

- **RPC calls**: x402 bundle $0.10 USDC = 1,000 calls (Base), or prepaid USDT
  deposit $0.00003/call, min $0.50 (Polygon) — no free tier
- **MEV relay**: $0.00005-$0.005 per tx/bundle, flat per method (not metered
  per token/byte)

## Links

- Website: https://satelink.network
- RPC Endpoint: https://rpc.satelink.network
- GitHub: https://github.com/Jakuraa/Satelink_Network

## License

MIT
