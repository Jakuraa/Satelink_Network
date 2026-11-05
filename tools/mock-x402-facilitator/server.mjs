#!/usr/bin/env node
// "x402 Facilitator (MOCK)" — LOCAL stand-in for an x402 V2 facilitator (Release A, Slice S6). Binds 127.0.0.1.
// It implements ONLY POST /verify (+ GET /supported). There is no /settle: nothing is ever broadcast, nothing moves.
// Mock signature scheme (no keys, no chain): signature = 0x + sha256("satelink-x402-preview-mock|" + canonical(authorization)).
// Every request path is logged (GET /requests) so tests can assert that /settle was never called.
import http from 'node:http';
import { mockSignature } from './mock_sig.mjs';

const PORT = Number(process.env.MOCK_FACILITATOR_PORT || 4440);
const seenNonces = new Set();
const requests = [];
const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

function verify({ x402Version, paymentPayload: p, paymentRequirements: r }) {
  const bad = (invalidReason, invalidMessage) => ({ isValid: false, invalidReason, invalidMessage });
  if (x402Version !== 2 || p?.x402Version !== 2) return bad('invalid_x402_version', 'x402Version must be 2');
  const a = p?.accepted; const auth = p?.payload?.authorization;
  if (!a || !r || !auth) return bad('invalid_payload', 'accepted, requirements and payload.authorization are required');
  for (const k of ['scheme', 'network', 'asset', 'amount', 'payTo']) if (a[k] !== r[k]) return bad('requirements_mismatch', `accepted.${k} differs from the requirements`);
  if (r.scheme !== 'exact') return bad('unsupported_scheme', 'only exact');
  if (auth.to?.toLowerCase() !== r.payTo.toLowerCase()) return bad('invalid_exact_evm_payload_recipient_mismatch', 'authorization.to != payTo');
  if (String(auth.value) !== String(r.amount)) return bad('invalid_exact_evm_payload_authorization_value', 'authorization.value != amount');
  const now = Math.floor(Date.now() / 1000);
  if (Number(auth.validBefore) <= now || Number(auth.validAfter) > now) return bad('invalid_exact_evm_payload_authorization_valid_before', 'authorization outside its validity window');
  if (!/^0x[0-9a-fA-F]{40}$/.test(auth.from || '')) return bad('invalid_payload', 'authorization.from must be an address');
  if (p.payload.signature !== mockSignature(auth)) return bad('invalid_exact_evm_payload_signature', 'mock signature does not match');
  if (seenNonces.has(auth.nonce)) return bad('invalid_exact_evm_payload_authorization_nonce_used', 'nonce already used');
  seenNonces.add(auth.nonce);
  return { isValid: true, payer: auth.from, extra: { simulated: true, facilitator: 'x402 Facilitator (MOCK)' } };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/requests' && url.pathname !== '/health') requests.push(`${req.method} ${url.pathname}`);
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, name: 'x402 Facilitator (MOCK)' });
  if (req.method === 'GET' && url.pathname === '/requests') return send(res, 200, { requests });
  if (req.method === 'GET' && url.pathname === '/supported') return send(res, 200, { kinds: [{ x402Version: 2, scheme: 'exact', network: 'eip155:84532', extra: { simulated: true } }], extensions: [], signers: {} });
  if (req.method === 'POST' && url.pathname === '/verify') {
    let raw = ''; for await (const c of req) raw += c;
    let body; try { body = JSON.parse(raw); } catch { return send(res, 400, { isValid: false, invalidReason: 'invalid_json' }); }
    return send(res, 200, verify(body));
  }
  send(res, 404, { error: 'not_found', note: 'This mock implements /verify only. It never settles.' });
}).listen(PORT, '127.0.0.1', () => console.log(`[mock-x402-facilitator] x402 Facilitator (MOCK) on http://127.0.0.1:${PORT}`));
