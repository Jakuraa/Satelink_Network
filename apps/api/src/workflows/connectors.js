// Capability connectors — the only code that talks to a supplier.
//
// A connector executes one call for a catalog offer and returns the supplier's
// data. It never decides price, approval or settlement (the workflow service and
// the RoutingKernel do). Result verification lives here too: a connector result
// that does not match the capability's output contract is rejected, so the
// kernel FAILS the transaction and never reaches SETTLE (no charge).

export class ConnectorError extends Error {
  // The kernel only keeps err.message, so the code travels in it: "[code] detail".
  constructor(code, message) { super(`[${code}] ${message}`); this.name = 'ConnectorError'; this.code = code; this.detail = message; }
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX_QTY = /^0x[0-9a-fA-F]{1,64}$/;

/** wei (bigint) -> decimal string with 18 decimals trimmed. */
export function formatUnits(wei, decimals = 18) {
  const d = 10n ** BigInt(decimals);
  const whole = wei / d;
  const frac = (wei % d).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/**
 * eth_getBalance over JSON-RPC. URL comes ONLY from the env var named in the
 * catalog (never from the request), so this cannot be used as an SSRF proxy.
 */
export function createJsonRpcBalanceConnector({ fetchImpl = globalThis.fetch, env = process.env, timeoutMs = 8000 } = {}) {
  return {
    type: 'jsonrpc_balance',
    configured(offer) { return Boolean(env[offer.connector.url_env]); },
    async call(offer, input) {
      const url = env[offer.connector.url_env];
      if (!url) throw new ConnectorError('connector_unconfigured', `${offer.connector.url_env} is not set`);
      if (!ADDRESS.test(input.address || '')) throw new ConnectorError('bad_input', 'address must be 0x + 40 hex');
      const started = Date.now();
      let res;
      try {
        res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [input.address, 'latest'] }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        throw new ConnectorError('supplier_unreachable', e?.name === 'TimeoutError' ? 'supplier timed out' : 'supplier unreachable');
      }
      if (!res.ok) throw new ConnectorError('supplier_error', `supplier HTTP ${res.status}`);
      const body = await res.json().catch(() => null);
      if (!body || body.error) throw new ConnectorError('supplier_error', body?.error?.message || 'invalid JSON-RPC response');
      return {
        raw: body.result,
        data: { address: input.address, network: input.network, native_symbol: 'POL', balance_wei: body.result },
        latency_ms: Date.now() - started,
      };
    },
  };
}

/**
 * x402 HTTP supplier. Paying requires a funded wallet and a founder spend
 * authorization; neither exists, so every paid call is refused here. Evaluation
 * offers are never registered for execution anyway — this is defence in depth.
 */
export function createX402HttpConnector({ payer = null } = {}) {
  return {
    type: 'x402_http',
    configured() { return Boolean(payer); },
    async call(offer) {
      if (!payer) {
        throw new ConnectorError('payment_not_authorized',
          `Outbound x402 payments to ${offer.provider.name} are not enabled (no funded wallet, no spend authorization).`);
      }
      throw new ConnectorError('not_implemented', 'x402 outbound execution is not wired in this build');
    },
  };
}

// Output contracts per capability. Each returns the verified, normalised data
// or throws ConnectorError('invalid_result').
export const VERIFIERS = {
  'wallet.balance'(result) {
    const wei = result?.data?.balance_wei;
    if (typeof wei !== 'string' || !HEX_QTY.test(wei)) throw new ConnectorError('invalid_result', 'balance is not a hex quantity');
    const v = BigInt(wei);
    return { ...result.data, balance_wei: v.toString(), balance: formatUnits(v) };
  },
  'token.risk'(result) {
    const s = result?.data?.score;
    if (!Number.isFinite(s) || s < 0 || s > 100) throw new ConnectorError('invalid_result', 'risk score must be 0–100');
    return result.data;
  },
  'token.verdict'(result) {
    if (typeof result?.data?.verdict !== 'string') throw new ConnectorError('invalid_result', 'verdict missing');
    return result.data;
  },
};

/** Split a kernel failure reason back into {code, detail}. */
export function parseReason(reason) {
  const m = /^\[([a-z0-9_]+)\] ([\s\S]*)$/.exec(String(reason || ''));
  return m ? { code: m[1], detail: m[2] } : { code: 'execution_failed', detail: String(reason || 'unknown error') };
}

export function verifyResult(capability, result) {
  const v = VERIFIERS[capability];
  if (!v) throw new ConnectorError('invalid_result', `no output contract for '${capability}'`);
  return v(result);
}
