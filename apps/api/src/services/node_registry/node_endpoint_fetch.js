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
import net from 'node:net';
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
      // fail closed: an answer that is not an IP address is refused like a private one
      if (list.some((a) => net.isIP(a.address) === 0 || isBlocked(a.address))) return callback(codedError('blocked_address'));
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
  const CATEGORIES = new Set(['blocked_address', 'timeout', 'response_too_large', 'dns_no_address', 'invalid_endpoint']);
  const categorize = (err) => (CATEGORIES.has(err?.code) ? err : Object.assign(new Error('unreachable'), { code: 'unreachable', cause: err }));

  return function nodeEndpointFetch(url, {
    method = 'GET', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, headersOnly = false,
  } = {}) {
    return new Promise((resolve, reject) => {
      // Literal-address and scheme checks (lookup is not consulted for IP literals).
      if (validateNodeEndpoint(url)) return reject(codedError('invalid_endpoint'));
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;

      // Settle exactly once; every path clears the hard deadline.
      let settled = false;
      let req;
      const finish = (fn, v) => { if (settled) return; settled = true; clearTimeout(deadline); fn(v); };
      const fail = (err) => { finish(reject, categorize(err)); if (req && !req.destroyed) req.destroy(); };
      // `timeout` on the request is an idle timer; this is the hard total deadline, so a
      // drip-feeding endpoint cannot hold a request (or a health-check cycle) open.
      const deadline = setTimeout(() => fail(codedError('timeout')), timeoutMs);

      const payload = body === undefined ? undefined : Buffer.from(String(body));
      const reqHeaders = { 'user-agent': 'satelink-gateway', ...headers };
      if (payload) reqHeaders['content-length'] = String(payload.length); // not chunked

      req = lib.request(u, { method, headers: reqHeaders, lookup, agent: false, timeout: timeoutMs }, (res) => {
        const result = (text) => ({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.headers,
          text: async () => text,
          json: async () => JSON.parse(text),
        });
        if (headersOnly) { finish(resolve, result('')); res.destroy(); return; } // body unused
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > maxBytes) return fail(codedError('response_too_large'));
          chunks.push(c);
        });
        res.on('end', () => finish(resolve, result(Buffer.concat(chunks).toString('utf8'))));
        res.on('error', fail);
        res.on('aborted', () => fail(new Error('aborted')));
      });
      req.on('timeout', () => fail(codedError('timeout')));
      req.on('error', fail);
      req.end(payload);
    });
  };
}

export const nodeEndpointFetch = createNodeEndpointFetch();
