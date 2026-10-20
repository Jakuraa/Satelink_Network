// Core RPC client
export { SatelinkRPC, createProvider } from './rpc.js';

// EIP-1193 Provider
export { SatelinkProvider, createSatelinkProvider } from './provider.js';

// MEV relay client
export { SatelinkMEV, createMevClient } from './mev.js';

// Framework adapters (ethers.js, viem, wagmi)
export {
  SATELINK_CHAINS,
  getSatelinkRpcUrl,
  getEthersProvider,
  getViemTransport,
  getSatelinkChainConfig,
  rpc
} from './adapters.js';

// Types
export type {
  SatelinkRPCOptions,
  JsonRpcRequest,
  JsonRpcResponse,
  TransactionRequest
} from './types.js';
export type { EIP1193Provider } from './rpc.js';
export type { SatelinkProviderOptions } from './provider.js';
export type { SatelinkChain } from './adapters.js';
export type {
  MevClientOptions,
  MevSubmitResult,
  MevSimulationResult,
  MevBundleStatus
} from './mev.js';
