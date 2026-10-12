// apps/mcp-server/src/rpc.mjs
// The single tool executor: send a JSON-RPC request to Satelink's live,
// x402-enabled Polygon (chain 137) endpoint and pay for it if required.
//
// The money path is entirely production's (apps/api/app_factory.mjs:369):
//   x402Middleware → freeTierGateUnlessX402Paid → createRpcGateway
// We are the CLIENT. Behavior by design (no free RPC — every call is paid):
//   * No key, no wallet               → 402 surfaced to the caller verbatim.
//   * No key, with wallet             → payingFetch signs USDC-on-Base, prod
//                                        settles a 1,000-call bundle + returns a
//                                        one-time X-Satelink-API-Key, 200.
//   * Bundle already bought           → that session key is sent as X-API-Key
//                                        and draws down the bundle, no new payment.
//
// The session key lives in memory for this process only. After a restart, the
// next paid call issues a fresh key (or recover one with a wallet signature:
// POST /v1/x402/key/recover). x-payer-address is no longer a credential (P0-2).

const DEFAULT_RPC_URL =
  process.env.SATELINK_RPC_URL || 'https://rpc.satelink.network/rpc/polygon';

/**
 * @param {object} deps
 * @param {typeof fetch} deps.fetch   The (possibly x402-paying) fetch.
 * @param {string|null}  deps.wallet  Operator wallet address, or null.
 * @param {string}       [deps.rpcUrl]
 * @param {string}       [deps.apiKey] Optional Satelink API key (higher free limits).
 */
export function createRpcExecutor({ fetch, wallet, rpcUrl = DEFAULT_RPC_URL, apiKey } = {}) {
  // Session key issued by the API after an x402 bundle settles (X-Satelink-API-Key,
  // returned once). Reusing it spends the remaining bundle calls; without it every
  // call would trigger a NEW $0.10 payment (the header-named wallet "Rail 1.5" was
  // removed server-side for security, P0-2). Held in memory only, never logged.
  let sessionKey = null;
  return async function executeRpc({ method, params = [], id }) {
    if (!method || typeof method !== 'string') {
      return { ok: false, error: 'invalid_request', message: '`method` (string) is required' };
    }
    const headers = {
      'Content-Type': 'application/json',
      // Attribution so paid MCP traffic is distinguishable in the funnel.
      'X-Satelink-Partner': 'mcp-server',
      'X-Satelink-Integration': 'agent-tool',
    };
    // An explicit API key wins; otherwise reuse the x402 session key from the
    // last paid call. (x-payer-address is NOT a billing credential any more.)
    const key = apiKey || sessionKey;
    if (key) headers['X-API-Key'] = key;

    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: id ?? Date.now(),
      method,
      params: Array.isArray(params) ? params : [params],
    });

    let response;
    try {
      response = await fetch(rpcUrl, { method: 'POST', headers, body });
    } catch (err) {
      return { ok: false, error: 'network_error', message: err.message };
    }

    // The x402 settlement tx hash comes back in the payment-response header.
    const paymentResponse =
      response.headers.get('x-payment-response') ||
      response.headers.get('payment-response') ||
      null;

    const issued = response.headers.get('x-satelink-api-key');
    if (issued && /^x402_[0-9a-f]{64}$/.test(issued)) sessionKey = issued;

    let data = null;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (response.status === 402) {
      // Reached only when payment is required but could not be made (no wallet,
      // or a spending guard declined). Surface the requirements verbatim.
      return {
        ok: false,
        error: 'payment_required',
        status: 402,
        message: wallet
          ? 'Payment required but the x402 payment could not be completed — check the wallet holds USDC on Base and try again.'
          : 'Payment required. Configure SATELINK_WALLET_PRIVATE_KEY (a Base-funded USDC wallet) to pay automatically.',
        payment_requirements: data,
      };
    }

    if (!response.ok) {
      return { ok: false, error: 'rpc_http_error', status: response.status, data };
    }

    return {
      ok: true,
      status: response.status,
      result: data,
      // Present only when THIS call settled an x402 payment — the proof of a
      // paid call. `credited` (calls_remaining) is appended by production.
      paid: Boolean(paymentResponse) || Boolean(data?.credited),
      payment_response: paymentResponse,
      credited: data?.credited ?? null,
    };
  };
}
