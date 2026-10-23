export interface SatelinkRPCOptions {
  apiKey?: string;
  chain?: string;
  baseUrl?: string;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown[];
  id: number | string;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface TransactionRequest {
  to?: string;
  from?: string;
  data?: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
}
