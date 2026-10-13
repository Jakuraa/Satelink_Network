// apps/mcp-server/src/server-factory.mjs
// Builds a configured MCP Server (tools/list, tools/call, resources/list,
// resources/read, prompts/list, prompts/get) around a single RPC executor.
// Shared by both transports: index.js (stdio) and http.mjs (Streamable HTTP),
// so the tool/resource/prompt surface is defined exactly once.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export const POLYGON_RPC_TOOL = {
  name: 'polygon_rpc',
  description:
    'Call any Polygon PoS (chain 137) JSON-RPC method through Satelink — pay-per-call, ' +
    'no account, no subscription. Every call is paid: with a Base-funded USDC wallet ' +
    'configured (SATELINK_WALLET_PRIVATE_KEY) the first call buys a 1,000-call bundle via ' +
    'x402 ($0.10) and later calls draw it down automatically. Supports every standard method: ' +
    'eth_call, eth_getBalance, eth_blockNumber, eth_getLogs, eth_getTransactionReceipt, ' +
    'eth_sendRawTransaction, eth_estimateGas, eth_getCode, and the rest.',
  inputSchema: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        description: 'JSON-RPC method, e.g. eth_blockNumber, eth_getBalance, eth_call',
      },
      params: {
        type: 'array',
        description: 'Positional params for the method (default []).',
        default: [],
      },
    },
    required: ['method'],
  },
};

// M7 (T-11): four intelligence tools, $0.01/call via x402 — same rail as
// polygon_rpc, distinct endpoints. See src/intelligence.mjs's header comment
// for why these may currently return `not_yet_available` (M3 not shipped).
const INTELLIGENCE_TOOL_DEFS = [
  {
    name: 'funding_rate_heatmap',
    description:
      'Funding-rate heatmap across perp markets — derived analytics, not raw quotes. $0.01/call via x402.',
  },
  {
    name: 'open_interest_shifts',
    description: 'Recent shifts in open interest across markets — derived, not raw quotes. $0.01/call via x402.',
  },
  {
    name: 'liquidation_clusters',
    description: 'Clustered liquidation levels/density — derived, not raw quotes. $0.01/call via x402.',
  },
  {
    name: 'market_microstructure',
    description: 'Market microstructure summary (spread, depth, imbalance) — derived, not raw quotes. $0.01/call via x402.',
  },
].map((t) => ({
  ...t,
  inputSchema: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Market symbol, e.g. BTC-USD (optional — omit for all tracked markets).' },
    },
  },
}));
const INTELLIGENCE_TOOL_NAMES = new Set(INTELLIGENCE_TOOL_DEFS.map((t) => t.name));

const PRICING_RESOURCE_URI = 'satelink://pricing';
const CHECK_BALANCE_PROMPT = 'check_wallet_balance';

/**
 * @param {object} deps
 * @param {(a:{method:string,params?:any[]})=>Promise<any>} deps.executeRpc
 * @param {(a:{tool:string,symbol?:string})=>Promise<any>} [deps.executeIntelligence]
 * @param {string}  deps.rpcUrl
 * @param {string|null} deps.wallet
 * @param {boolean} deps.canPay
 */
// tool name → registry product id (apps/api/config/plan_catalog.v2.json `products`).
export const TOOL_PRODUCTS = Object.freeze({
  polygon_rpc: 'polygon_rpc',
  ...Object.fromEntries(INTELLIGENCE_TOOL_DEFS.map((t) => [t.name, 'trading_intelligence'])),
});

/** The tool list a server advertises; internal products only on explicit opt-in. */
export function advertisedTools({ includeInternal = process.env.SATELINK_MCP_INTERNAL_TOOLS === '1' } = {}) {
  return [POLYGON_RPC_TOOL, ...(includeInternal ? INTELLIGENCE_TOOL_DEFS : [])];
}

export function createSatelinkMcpServer({ executeRpc, executeIntelligence, rpcUrl, wallet, canPay, includeInternal }) {
  const server = new Server(
    { name: 'satelink-mcp', version: '2.1.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  // Advertised tools follow the product registry (apps/api/config/plan_catalog.v2.json
  // `products`; enforced by apps/api/test/product_registry.test.js). Trading
  // Intelligence is INTERNAL since its delisting (#515) — its tools are listed
  // only when the operator opts in with SATELINK_MCP_INTERNAL_TOOLS=1.
  const tools = advertisedTools({ includeInternal });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (INTELLIGENCE_TOOL_NAMES.has(name) && !tools.some((t) => t.name === name)) {
      throw new Error(`Unknown tool: ${name}`);
    }
    if (INTELLIGENCE_TOOL_NAMES.has(name)) {
      if (!executeIntelligence) {
        return { content: [{ type: 'text', text: 'Intelligence tools are not configured on this server.' }], isError: true };
      }
      const out = await executeIntelligence({ tool: name, symbol: args?.symbol });
      if (!out.ok) {
        return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: true };
      }
      const note = out.paid ? `\n\n[x402 PAID] settlement=${out.payment_response || 'n/a'}` : '';
      return { content: [{ type: 'text', text: JSON.stringify(out.result, null, 2) + note }] };
    }

    if (name !== 'polygon_rpc') {
      throw new Error(`Unknown tool: ${name}`);
    }
    const { method, params } = args || {};
    const out = await executeRpc({ method, params });
    if (!out.ok) {
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: true };
    }
    const note = out.paid
      ? `\n\n[x402 PAID] settlement=${out.payment_response || 'see credited'} ` +
        `credited=${out.credited ? JSON.stringify(out.credited) : 'n/a'}`
      : '';
    return { content: [{ type: 'text', text: JSON.stringify(out.result, null, 2) + note }] };
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: PRICING_RESOURCE_URI,
        name: 'Satelink pricing & payment',
        description: 'Pricing, payment rail, and wallet configuration for the polygon_rpc tool.',
        mimeType: 'application/json',
      },
    ],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== PRICING_RESOURCE_URI) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }
    const pricing = {
      chain: 'Polygon PoS (chainId 137)',
      rpc_url: rpcUrl,
      price: '$0.10 USDC per 1,000-call bundle (≈ $0.0001/call)',
      payment_rail: 'x402 — USDC on Base (eip155:8453)',
      free_tier: null, // no free RPC: every call is paid (x402 bundle or USDT credits)
      wallet_configured: canPay,
      paying_wallet: wallet || null,
      how_to_pay:
        'Set SATELINK_WALLET_PRIVATE_KEY to a Base-funded USDC wallet; payment is automatic on 402.',
    };
    return {
      contents: [
        { uri: PRICING_RESOURCE_URI, mimeType: 'application/json', text: JSON.stringify(pricing, null, 2) },
      ],
    };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: CHECK_BALANCE_PROMPT,
        description: 'Check the native MATIC balance of a Polygon address via polygon_rpc.',
        arguments: [{ name: 'address', description: '0x address to check', required: true }],
      },
    ],
  }));
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    if (request.params.name !== CHECK_BALANCE_PROMPT) {
      throw new Error(`Unknown prompt: ${request.params.name}`);
    }
    const address = request.params.arguments?.address || '<ADDRESS>';
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Call the polygon_rpc tool with method "eth_getBalance" and params ` +
              `["${address}", "latest"], then convert the hex wei result to MATIC and report it.`,
          },
        },
      ],
    };
  });

  return server;
}
