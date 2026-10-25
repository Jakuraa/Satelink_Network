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
  if (typeof signature !== 'string' || signature.length === 0 || signature.length > 200 || timestamp === undefined || timestamp === null) {
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

export function isBlockedIp(host) {
  const v = net.isIP(host);
  if (v === 4) {
    const [a, b, c] = host.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
      || (a === 198 && (b === 18 || b === 19))                       // benchmarking 198.18/15
      || (a === 192 && b === 0 && (c === 0 || c === 2))               // 192.0.0/24, TEST-NET-1
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113); // TEST-NET-2/3
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
      return true; // any other ::ffff: form (e.g. ::ffff:0:7f00:1) is not global unicast
    }
    // Only global unicast (2000::/3) is a node endpoint; that excludes ::/96 (IPv4-compatible),
    // ::ffff:0:0/96, 64:ff9b::/96 (NAT64), fc00::/7, fe80::/10, fec0::/10, multicast. Inside
    // 2000::/3, 6to4 (2002::/16, embeds an IPv4) and documentation (2001:db8::/32) are refused.
    const first = parseInt(h.split(':')[0] || '0', 16);
    if (!(first >= 0x2000 && first <= 0x3fff)) return true;
    // Teredo 2001:0::/32 embeds an IPv4 address like 6to4 does.
    return first === 0x2002 || h.startsWith('2001:db8:') || h.startsWith('2001:0db8:') || /^2001:(0{1,4})?:/.test(h);
  }
  return false;
}

// Replay guard: a node's accepted heartbeat timestamps must strictly increase, so a captured
// heartbeat cannot be replayed (e.g. to roll back a newer endpoint change). Redis when
// available (shared across instances), an in-process map otherwise.
const lastAccepted = new Map();
const MONOTONIC_LUA = "local c=redis.call('GET',KEYS[1]) if c and tonumber(c)>=tonumber(ARGV[1]) then return 0 end redis.call('SET',KEYS[1],ARGV[1],'EX',600) return 1";

export async function acceptMonotonicHeartbeat(nodeId, timestamp, redis) {
  const ts = Number(timestamp);
  const prev = lastAccepted.get(nodeId);
  if (prev !== undefined && ts <= prev) return false;
  if (redis && typeof redis.eval === 'function') {
    try {
      const ok = await redis.eval(MONOTONIC_LUA, 1, `node:hb:last:${nodeId}`, String(ts));
      if (Number(ok) !== 1) return false;
    } catch { /* redis optional: the in-process guard still applies */ }
  }
  lastAccepted.set(nodeId, ts);
  return true;
}

/**
 * Validates a node endpoint URL (used before storing it). Literal-address checks only: a DNS
 * name that resolves to a private address is caught at connect time by node_endpoint_fetch.js
 * (resolve-then-check in the socket's own lookup; redirects are never followed).
 * @returns {string|null} error code, or null when acceptable
 */
export function validateNodeEndpoint(endpointUrl) {
  // The raw string is what gets stored and signed: no whitespace/control characters (the URL
  // parser silently strips them, so the validated and the stored value could differ).
  if (typeof endpointUrl !== 'string' || endpointUrl.length > 2048 || /[\s\x00-\x1f\x7f]/.test(endpointUrl)) return 'invalid_endpoint';
  let u;
  try { u = new URL(endpointUrl); } catch { return 'invalid_endpoint'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'invalid_endpoint';
  if (u.username || u.password) return 'invalid_endpoint';
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.+$/, ''); // "localhost." == localhost
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return 'invalid_endpoint';
  }
  if (host === 'satelink.network' || host.endsWith('.satelink.network')) return 'invalid_endpoint'; // circular
  if (isBlockedIp(host)) return 'invalid_endpoint';
  return null;
}

// ── Registration proof (W1 follow-up, 2026-10-21) ──────────────────────────────────────────
// POST /api/nodes/register used to accept any wallet_address, so anyone could register nodes
// (and earnings) under a wallet they do not control. Registration must now be signed
// (EIP-191) by that wallet over every registered field. The first line separates it from
// heartbeats and from the /api/keys bind_wallet challenge.
//   Satelink node registration
//   wallet: <lowercase address>
//   node_type: <type>
//   endpoint: <endpoint_url>
//   region: <region>
//   chain_ids: <ids joined by ",">
//   timestamp: <unix ms>
// Registration is a one-off, possibly hand-signed step: a wider window than heartbeats. Replay
// within it is harmless (same signed fields → the duplicate check answers 409).
export const REGISTRATION_MAX_AGE_MS = 5 * 60_000;

export function registrationMessage({ walletAddress, nodeType, endpointUrl, region, chainIds, timestamp }) {
  return [
    'Satelink node registration',
    `wallet: ${String(walletAddress).toLowerCase()}`,
    `node_type: ${nodeType}`,
    `endpoint: ${endpointUrl}`,
    `region: ${region}`,
    `chain_ids: ${chainIds.join(',')}`,
    `timestamp: ${timestamp}`,
  ].join('\n');
}

/** @returns {{ok: true} | {ok: false, http: number, error: string}} */
export function verifyNodeRegistration({ walletAddress, nodeType, endpointUrl, region, chainIds, timestamp, signature, now = Date.now() }) {
  if (typeof signature !== 'string' || signature.length === 0 || signature.length > 200 || timestamp === undefined || timestamp === null) {
    return { ok: false, http: 401, error: 'registration_signature_required' };
  }
  const ts = Number(timestamp);
  if (!Number.isSafeInteger(ts)) return { ok: false, http: 400, error: 'invalid_timestamp' };
  if (now - ts > REGISTRATION_MAX_AGE_MS) return { ok: false, http: 400, error: 'stale_registration' };
  if (ts - now > HEARTBEAT_MAX_FUTURE_MS) return { ok: false, http: 400, error: 'future_registration' };
  if (!Array.isArray(chainIds) || !chainIds.every((c) => Number.isSafeInteger(c) && c > 0)) {
    return { ok: false, http: 400, error: 'invalid_chain_ids' };
  }
  let recovered;
  try {
    recovered = ethers.verifyMessage(
      registrationMessage({ walletAddress, nodeType, endpointUrl, region, chainIds, timestamp: ts }), signature);
  } catch {
    return { ok: false, http: 401, error: 'invalid_registration_signature' };
  }
  if (recovered.toLowerCase() !== String(walletAddress).toLowerCase()) {
    return { ok: false, http: 401, error: 'invalid_registration_signature' };
  }
  return { ok: true };
}
