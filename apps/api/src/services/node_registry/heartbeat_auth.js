// Node heartbeat authentication (SEC-5, W1 follow-up 2026-10-21).
//
// POST /api/nodes/heartbeat and /api/nodes/:nodeId/heartbeat used to accept any caller
// that knew a (public) node id: they flipped status to active and could rewrite the
// node's endpoint_url — hijacking routed RPC traffic and aiming the health monitor at
// arbitrary hosts (SSRF). A heartbeat must now be signed (EIP-191 personal_sign) by the
// wallet the node registered with. No new credential or schema is needed.
//
// Message (exact bytes, \n separated):
//   Satelink node heartbeat
//   node: <nodeId>
//   timestamp: <unix ms>
//   endpoint: <endpoint_url or ->
// The endpoint is part of the signed message, so a captured signature cannot be reused to
// point the node somewhere else; the timestamp window bounds replay.
import { ethers } from 'ethers';
import net from 'node:net';

export const HEARTBEAT_MAX_AGE_MS = 60_000;
export const HEARTBEAT_MAX_FUTURE_MS = 5_000;

export function heartbeatMessage({ nodeId, timestamp, endpointUrl }) {
  return [
    'Satelink node heartbeat',
    `node: ${nodeId}`,
    `timestamp: ${timestamp}`,
    `endpoint: ${endpointUrl || '-'}`,
  ].join('\n');
}

/**
 * @returns {{ok: true} | {ok: false, http: number, error: string}}
 */
export function verifyNodeHeartbeat({ nodeId, wallet, timestamp, signature, endpointUrl, now = Date.now() }) {
  if (typeof signature !== 'string' || signature.length === 0 || timestamp === undefined || timestamp === null) {
    return { ok: false, http: 401, error: 'heartbeat_signature_required' };
  }
  const ts = Number(timestamp);
  if (!Number.isSafeInteger(ts)) return { ok: false, http: 400, error: 'invalid_timestamp' };
  if (now - ts > HEARTBEAT_MAX_AGE_MS) return { ok: false, http: 400, error: 'stale_heartbeat' };
  if (ts - now > HEARTBEAT_MAX_FUTURE_MS) return { ok: false, http: 400, error: 'future_heartbeat' };
  if (typeof wallet !== 'string' || !ethers.isAddress(wallet)) {
    // A node with no valid registered wallet can never prove ownership.
    return { ok: false, http: 401, error: 'invalid_heartbeat_signature' };
  }
  let recovered;
  try {
    recovered = ethers.verifyMessage(heartbeatMessage({ nodeId, timestamp: ts, endpointUrl }), signature);
  } catch {
    return { ok: false, http: 401, error: 'invalid_heartbeat_signature' };
  }
  if (recovered.toLowerCase() !== wallet.toLowerCase()) {
    return { ok: false, http: 401, error: 'invalid_heartbeat_signature' };
  }
  return { ok: true };
}

function isBlockedIp(host) {
  const v = net.isIP(host);
  if (v === 4) {
    const [a, b] = host.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (v === 6) {
    const h = host.toLowerCase();
    if (h.startsWith('::ffff:')) {
      // IPv4-mapped. WHATWG URL normalises [::ffff:127.0.0.1] to [::ffff:7f00:1].
      const rest = h.slice(7);
      const hex = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
      if (hex) {
        const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
        return isBlockedIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
      }
      return isBlockedIp(rest);
    }
    return h === '::' || h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80');
  }
  return false;
}

/**
 * Validates a node endpoint URL (used before storing it). Literal-address checks only;
 * hostnames that resolve to private addresses are the health monitor's concern.
 * @returns {string|null} error code, or null when acceptable
 */
export function validateNodeEndpoint(endpointUrl) {
  let u;
  try { u = new URL(endpointUrl); } catch { return 'invalid_endpoint'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'invalid_endpoint';
  if (u.username || u.password) return 'invalid_endpoint';
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return 'invalid_endpoint';
  }
  if (host === 'satelink.network' || host.endsWith('.satelink.network')) return 'invalid_endpoint'; // circular
  if (isBlockedIp(host)) return 'invalid_endpoint';
  return null;
}
