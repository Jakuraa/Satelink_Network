// Outbound requests to node-operator endpoints (SEC-5 follow-up, 2026-10-21).
//
// validateNodeEndpoint() only sees the URL: a hostname such as 127.0.0.1.nip.io, or a DNS
// name that re-binds to an internal address after validation, still reached private hosts.
// Every request to a node endpoint goes through here instead of fetch():
// - the address check runs inside the socket's DNS lookup, on the exact addresses the
//   connection will use (resolve-then-check at connect time — no rebinding window); if ANY
//   resolved address is private/reserved the request fails with code 'blocked_address'
// - literal-IP hosts are checked by validateNodeEndpoint (Node skips lookup for them)
// - redirects are never followed (node:http does not follow them)
// - no pooled sockets, a timeout, and a response size cap
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { isBlockedIp, validateNodeEndpoint } from './heartbeat_auth.js';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 1_000_000;

function codedError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

/** A dns.lookup-compatible function that refuses private/reserved answers. */
export function createGuardedLookup({ baseLookup = dns.lookup, isBlocked = isBlockedIp } = {}) {
  return function guardedLookup(hostname, options, callback) {
    if (typeof options === 'function') { callback = options; options = {}; }
    const opts = typeof options === 'number' ? { family: options } : { ...(options || {}) };
    baseLookup(hostname, { ...opts, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = (Array.isArray(addresses) ? addresses : [{ address: addresses, family: opts.family || 4 }])
        .filter((a) => a && a.address);
      if (list.length === 0) return callback(codedError('dns_no_address'));
      if (list.some((a) => isBlocked(a.address))) return callback(codedError('blocked_address'));
      if (opts.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };
}

/**
 * Factory (tests inject baseLookup / isBlocked). Production code uses nodeEndpointFetch.
 * @returns {(url: string, init?: {method?: string, headers?: object, body?: string, timeoutMs?: number, maxBytes?: number})
 *           => Promise<{ok: boolean, status: number, headers: object, text: () => Promise<string>, json: () => Promise<any>}>}
 */
export function createNodeEndpointFetch({ baseLookup, isBlocked = isBlockedIp } = {}) {
  const lookup = createGuardedLookup({ baseLookup, isBlocked });
  return function nodeEndpointFetch(url, { method = 'GET', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES } = {}) {
    return new Promise((resolve, reject) => {
      // Literal-address and scheme checks (lookup is not consulted for IP literals).
      if (validateNodeEndpoint(url)) return reject(codedError('invalid_endpoint'));
      let u;
      try { u = new URL(url); } catch { return reject(codedError('invalid_endpoint')); }
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(u, { method, headers, lookup, agent: false, timeout: timeoutMs }, (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > maxBytes) { req.destroy(codedError('response_too_large')); return; }
          chunks.push(c);
        });
        res.on('end', () => {
          const buf = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            text: async () => buf,
            json: async () => JSON.parse(buf),
          });
        });
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(codedError('timeout')));
      req.on('error', (err) => reject(err.code === 'blocked_address' || err.code === 'timeout' || err.code === 'response_too_large'
        || err.code === 'dns_no_address' ? err : Object.assign(new Error('unreachable'), { code: 'unreachable', cause: err })));
      if (body !== undefined) req.write(body);
      req.end();
    });
  };
}

export const nodeEndpointFetch = createNodeEndpointFetch();
