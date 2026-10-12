// apps/api/src/routes/well_known_x402.js
//
// GET /.well-known/x402 — M7 (T-25): every priced route, in one place, for an
// x402-aware agent that wants to discover what it can pay for without probing
// individual endpoints for a 402. Purely descriptive — reads the SAME env vars
// the actual payment enforcement (src/payments/x402/middleware.js) reads, but
// is an independent file so a change here can never affect payment behavior.
//
// Trading Intelligence delisting (founder decision, Phase 7 amendment): the
// /v1/intelligence/* routes keep serving existing keys (src/routes/
// intelligence_route.js) — this file only stops ADVERTISING them as a
// standalone, independently-discoverable product in the x402 catalog. They
// were never x402-payable here anyway (metered via api_credits, not a direct
// 402 challenge on this path) — see /v1/intelligence for discovery instead.

import { Router } from 'express';
import { railPrices, bundlePriceText } from '../pricing_v2/rails.mjs';

const API_BASE = () => process.env.API_BASE_URL || 'https://rpc.satelink.network';
const X402_NETWORK = () => process.env.X402_NETWORK || 'eip155:8453';
const X402_PAY_TO = () => process.env.X402_PAY_TO || '0x966E1Ae22996545015b1414B35234b10719d7Ad4';

function listing() {
  const base = API_BASE();
  const network = X402_NETWORK();
  const payTo = X402_PAY_TO();
  // Prices from the PlanCatalog (railPrices; x402 env overrides honoured, as enforcement does).
  const rails = railPrices();
  const bundle = rails.rpc_x402_bundle;
  return {
    schema_version: '1.0',
    service: 'Satelink',
    network,
    pay_to: payTo,
    asset: 'USDC',
    routes: [
      {
        method: 'POST',
        resource: `${base}/rpc/polygon`,
        price: bundlePriceText(rails),
        rail: 'x402',
        x402_challenge: true,
        status: bundle.status,
        description:
          'Polygon PoS (chain 137) JSON-RPC — the full standard method set (eth_call, eth_getBalance, ' +
          'eth_blockNumber, eth_getLogs, eth_getTransactionReceipt, eth_sendRawTransaction, and the rest).',
        live: true,
      },
    ],
    rails,
    manifest_url: `${base}/.well-known/satelink.json`,
    docs: 'https://docs.satelink.network',
  };
}

export function createWellKnownX402Router() {
  const router = Router();
  router.get('/x402', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(listing());
  });
  return router;
}
