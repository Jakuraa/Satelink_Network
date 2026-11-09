// Network egress guard for every connector (REST/OpenAPI, MCP, OAuth token endpoint, mock store, x402 facilitator)
// — Release A P4 (SSRF). One guard instead of per-driver loopback checks.
//
//   preview  → only loopback http(s) (the local mocks). Everything else is refused.
//   beta/live → https only; refuses loopback, private (RFC 1918 / CGNAT / ULA), link-local (incl. 169.254.169.254
//               metadata), unspecified/broadcast, and known metadata hostnames.
// Every request refuses redirects (`redirect: 'error'`), so an allowed host cannot bounce us to a forbidden one.
// Known gap (documented): hostnames are not DNS-resolved here, so DNS rebinding to a private IP needs a resolving
// check at connect time before beta/live — tracked in STATUS_MATRIX tech debt.

const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const METADATA_NAMES = new Set(['metadata.google.internal', 'metadata', 'instance-data', 'metadata.azure.com']);

export class EgressError extends Error {
  constructor(message, url) { super(message); this.name = 'EgressError'; this.code = 'EGRESS_BLOCKED'; this.url = String(url); }
}

function ipv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  return m ? m.slice(1).map(Number) : null;
}
/** True for addresses no beta/live connector may reach. */
export function isForbiddenAddress(hostname) {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (LOOPBACK_NAMES.has(h) || METADATA_NAMES.has(h) || h.endsWith('.localhost') || h.endsWith('.internal')) return true;
  const v4 = ipv4(h);
  if (v4) {
    const [a, b] = v4;
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (h.includes(':')) {
    if (h === '::' || h === '::1') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h)) return true; // ULA, link-local
    // IPv4-mapped IPv6, in either form — WHATWG URL normalises [::ffff:10.0.0.1] to [::ffff:a00:1].
    const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
    if (dotted) return isForbiddenAddress(dotted[1]);
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
    if (hex) { const hi = parseInt(hex[1], 16); const lo = parseInt(hex[2], 16); return isForbiddenAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`); }
  }
  return false;
}

/** Throws EgressError unless `url` is allowed in `mode`. Returns the parsed URL. */
export function assertEgressUrl(url, { mode = 'preview', what = 'outbound request' } = {}) {
  let u;
  try { u = new URL(url); } catch { throw new EgressError(`${what}: not a URL`, url); }
  if (u.username || u.password) throw new EgressError(`${what}: credentials in URLs are not allowed`, url);
  if (mode === 'preview') {
    if (!['http:', 'https:'].includes(u.protocol) || !LOOPBACK_NAMES.has(u.hostname)) throw new EgressError(`${what} must be a loopback URL in the preview`, url);
    return u;
  }
  if (u.protocol !== 'https:') throw new EgressError(`${what} must use https`, url);
  if (isForbiddenAddress(u.hostname)) throw new EgressError(`${what} targets a private, loopback, link-local or metadata address`, url);
  return u;
}

/** fetch wrapper: checks every URL and refuses redirects. */
export function egressFetch(fetchImpl = globalThis.fetch, { mode = 'preview', what } = {}) {
  return (url, init = {}) => {
    assertEgressUrl(typeof url === 'string' ? url : url.url ?? String(url), { mode, what });
    return fetchImpl(url, { ...init, redirect: 'error' });
  };
}
