/**
 * RPC traffic recorder — persistent, privacy-safe daily aggregates of /rpc traffic.
 *
 * Why: Railway retains ~15 minutes of HTTP logs, so "who is calling /rpc/polygon and
 * do they ever pay" could not be answered over days. This records one counter row per
 * (day, client_hash, ua_family, origin_host, method, status_class, auth_state) into
 * rpc_traffic_daily (migrations/047_rpc_traffic_daily.sql).
 *
 * Guarantees:
 *   - Never stores or logs a raw IP. client_hash = HMAC-SHA256(secret, ip), 16 hex chars.
 *     With no secret configured the client is recorded as 'nosecret' (an unkeyed hash
 *     of an IPv4 address is trivially reversible, so we refuse to fall back to one).
 *     IP-literal Origin/Referer hosts are recorded as 'ip-literal', never verbatim.
 *   - Never blocks or fails the request path: recording runs on res 'finish', is
 *     wrapped in try/catch, and only touches an in-memory Map. The DB write happens in
 *     a 60s unref'd timer; any failure drops that batch (metrics lost, requests served).
 *   - Bounded cardinality: every dimension is normalized into a bounded vocabulary or
 *     capped per day, and the distinct rows per day are capped (RPC_TRAFFIC_ROW_CAP,
 *     default 20000). Overflow collapses into a single 'other' bucket per
 *     (status_class, auth_state), so nothing is silently uncounted.
 *
 * Known limits: a request aborted by the client before the response finished is not
 * counted ('finish' never fires). Anonymous callers are 402'd by freeTierGate BEFORE the JSON body is
 * parsed (deliberate OOM guard), so their JSON-RPC method is recorded as 'unread'.
 */

import { createHmac } from 'crypto';

export const OTHER = 'other';

const DEFAULTS = {
  flushIntervalMs: 60_000,
  rowCapPerDay: 20_000,
  maxPendingKeys: 25_000,   // in-memory batch bound between flushes
  maxUaTokensPerDay: 200,
  maxOriginsPerDay: 1_000,
  maxMethodsPerDay: 150,
  flushTimeoutMs: 15_000,
  chunkSize: 2_000,
};

// Ordered: specific SDK/tool markers before generic HTTP clients before browsers.
const UA_FAMILIES = [
  ['erpc', /\berpc\b/],
  ['ethers', /ethers/],
  ['viem', /viem/],
  ['web3js', /web3\.js|web3js/],
  ['web3py', /web3\.py|web3py|web3\/\d/],
  ['go-ethereum', /go-ethereum|geth/],
  ['hardhat', /hardhat/],
  ['foundry', /foundry|\bcast\b|alloy/],
  ['metamask', /metamask/],
  ['curl', /^curl\//],
  ['wget', /^wget/],
  ['python-requests', /python-requests/],
  ['python-aiohttp', /aiohttp/],
  ['python-httpx', /httpx/],
  ['python-other', /python/],
  ['node-fetch', /node-fetch/],
  ['undici', /undici|^node$/],
  ['axios', /axios/],
  ['okhttp', /okhttp/],
  ['go-http', /go-http-client/],
  ['java', /java\/|apache-httpclient/],
  ['rust', /reqwest|hyper\//],
  ['deno', /deno\//],
  ['supabase-edge', /supabase/],
  ['postman', /postman/],
  ['bot', /bot\b|spider|crawl|scrapy|headless/],
  ['browser-edge', /edg\//],
  ['browser-chrome', /chrome\//],
  ['browser-firefox', /firefox\//],
  ['browser-safari', /safari\//],
  ['browser-other', /mozilla\//],
];

const PRODUCT_TOKEN = /^([a-z][a-z0-9._-]{1,31})\//;
const HOSTNAME = /^[a-z0-9]([a-z0-9-]{0,62}\.)*[a-z0-9-]{1,63}$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const RPC_METHOD = /^(eth|net|web3|debug|trace|txpool|bor|erigon|parity|ots|zks|alchemy|qn)_[A-Za-z0-9]{1,48}$/;

export function statusClass(code) {
  const c = Number(code) || 0;
  if (c >= 200 && c < 300) return '2xx';
  if (c === 401 || c === 402 || c === 429) return String(c);
  if (c >= 400 && c < 500) return '4xx';
  if (c >= 500 && c < 600) return '5xx';
  return OTHER;
}

/**
 * none         — no credential presented
 * x402         — a settled x402 payment rode on the request
 * key-funded   — X-API-Key presented and the request was not refused for payment/auth
 * key-unfunded — X-API-Key presented and refused with 401/402/403 (unknown, unfunded,
 *                inactive or on hold — the caller has a key but cannot pay with it)
 */
export function authState(req, code) {
  if (req?.x402?.settled) return 'x402';
  if (req?.headers?.['x-api-key']) {
    const c = Number(code) || 0;
    return (c === 401 || c === 402 || c === 403) ? 'key-unfunded' : 'key-funded';
  }
  return 'none';
}

export function uaFamilyRaw(ua) {
  if (!ua) return 'none';
  const s = String(ua).slice(0, 256).toLowerCase().trim();
  if (!s) return 'none';
  for (const [name, re] of UA_FAMILIES) if (re.test(s)) return name;
  // Unknown custom client: keep only its product token ("rpchub/1.0 ..." -> "rpchub"),
  // never the version/OS/comment detail. Capped per day by the recorder.
  const m = s.match(PRODUCT_TOKEN);
  return m ? `ua:${m[1]}` : OTHER;
}

export function originHostRaw(headers = {}) {
  const raw = headers.origin || headers.referer || headers.referrer;
  if (!raw) return 'none';
  if (raw === 'null') return 'null-origin';
  let host;
  try { host = new URL(String(raw).slice(0, 512)).hostname.toLowerCase(); } catch { return 'invalid'; }
  if (!host) return 'invalid';
  // Never persist an address: IPv4/IPv6 literal hosts are collapsed.
  if (IPV4.test(host) || host.includes(':') || host.startsWith('[')) return 'ip-literal';
  if (host.length > 100 || !HOSTNAME.test(host)) return 'invalid';
  return host;
}

export function methodRaw(req) {
  if (req?.method && req.method !== 'POST') return req.method.slice(0, 8);
  const body = req?.body;
  // Body never parsed (rejected upstream of express.json) vs parsed but empty.
  if (body === undefined) return 'unread';
  if (Array.isArray(body)) return 'batch';
  const m = body && typeof body === 'object' ? body.method : undefined;
  if (typeof m !== 'string') return 'invalid';
  return RPC_METHOD.test(m) ? m : OTHER;
}

function clientIp(req) {
  return req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || req?.headers?.['x-real-ip']
    || req?.socket?.remoteAddress
    || '';
}

export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

const KEY_SEP = '\u0001';

export function createRpcTrafficRecorder(pool, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const rowCap = Number(opts.rowCapPerDay ?? process.env.RPC_TRAFFIC_ROW_CAP) || DEFAULTS.rowCapPerDay;
  const secret = opts.secret !== undefined
    ? opts.secret
    : (process.env.RPC_TRAFFIC_HMAC_SECRET || process.env.IP_SALT || process.env.IP_HASH_SALT || '');
  const log = opts.log || console;
  const now = opts.now || (() => Date.now());
  const enabled = opts.enabled ?? (process.env.RPC_TRAFFIC_ANALYTICS !== 'off');

  let pending = new Map();
  let day = utcDay(now());
  let dayKeys = new Set();        // distinct row keys admitted today (this process)
  let dayBaseline = 0;            // rows already in the DB for today (seeded once per day)
  let uaTokens = new Set();
  let origins = new Set();
  let methods = new Set();
  let schemaReady = false;
  let flushing = null;
  let writing = null;             // the real DB write; outlives a timed-out flush
  let timer = null;
  const stats = { recorded: 0, dropped: 0, overflowed: 0, flushes: 0, flushFailures: 0 };

  function rollDay(d) {
    if (d === day) return;
    day = d; dayKeys = new Set(); dayBaseline = 0;
    uaTokens = new Set(); origins = new Set(); methods = new Set();
    seedBaseline(d);
  }

  function capped(set, value, max) {
    if (set.has(value)) return value;
    if (set.size >= max) return OTHER;
    set.add(value);
    return value;
  }

  function hashClient(ip) {
    if (!secret) return 'nosecret';
    if (!ip) return 'noip';
    return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 16);
  }

  function record(req, code) {
    if (!enabled) return;
    try {
      rollDay(utcDay(now()));
      let ua = uaFamilyRaw(req?.headers?.['user-agent']);
      if (ua.startsWith('ua:')) ua = capped(uaTokens, ua, cfg.maxUaTokensPerDay);
      let origin = originHostRaw(req?.headers);
      if (!['none', 'null-origin', 'invalid', 'ip-literal'].includes(origin)) {
        origin = capped(origins, origin, cfg.maxOriginsPerDay);
      }
      let method = methodRaw(req);
      if (RPC_METHOD.test(method)) method = capped(methods, method, cfg.maxMethodsPerDay);
      const sc = statusClass(code);
      const auth = authState(req, code);
      let key = [day, hashClient(clientIp(req)), ua, origin, method, sc, auth].join(KEY_SEP);
      if (!dayKeys.has(key)) {
        if (dayBaseline + dayKeys.size >= rowCap) {
          // Overflow bucket: bounded to |status_class| x |auth_state| rows per day.
          key = [day, OTHER, OTHER, OTHER, OTHER, sc, auth].join(KEY_SEP);
          stats.overflowed++;
        } else {
          dayKeys.add(key);
        }
      }
      if (!pending.has(key) && pending.size >= cfg.maxPendingKeys) { stats.dropped++; return; }
      pending.set(key, (pending.get(key) || 0) + 1);
      stats.recorded++;
    } catch {
      stats.dropped++;
    }
  }

  function middleware(req, res, next) {
    if (enabled) {
      try { res.once('finish', () => record(req, res.statusCode)); } catch { /* fail open */ }
    }
    next();
  }

  async function ensureSchema() {
    if (schemaReady) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rpc_traffic_daily (
        day          DATE    NOT NULL,
        client_hash  TEXT    NOT NULL,
        ua_family    TEXT    NOT NULL,
        origin_host  TEXT    NOT NULL,
        method       TEXT    NOT NULL,
        status_class TEXT    NOT NULL,
        auth_state   TEXT    NOT NULL,
        count        BIGINT  NOT NULL DEFAULT 0,
        PRIMARY KEY (day, client_hash, ua_family, origin_host, method, status_class, auth_state)
      )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_rpc_traffic_daily_client ON rpc_traffic_daily (client_hash, day)`);
    schemaReady = true;
  }

  function seedBaseline(d) {
    if (!pool?.query) return;
    Promise.resolve()
      .then(ensureSchema)
      .then(() => pool.query('SELECT COUNT(*)::int AS c FROM rpc_traffic_daily WHERE day = $1', [d]))
      .then((r) => { if (d === day) dayBaseline = Number(r?.rows?.[0]?.c) || 0; })
      .catch(() => { /* fail open: cap still enforced per process */ });
  }

  function withTimeout(p, ms) {
    let t;
    return Promise.race([
      p,
      new Promise((_, rej) => { t = setTimeout(() => rej(new Error('flush timeout')), ms); t.unref?.(); }),
    ]).finally(() => clearTimeout(t));
  }

  async function writeBatch(entries) {
    await ensureSchema();
    for (let i = 0; i < entries.length; i += cfg.chunkSize) {
      const cols = [[], [], [], [], [], [], [], []];
      for (const [key, count] of entries.slice(i, i + cfg.chunkSize)) {
        const parts = key.split(KEY_SEP);
        for (let j = 0; j < 7; j++) cols[j].push(parts[j]);
        cols[7].push(count);
      }
      await pool.query(
        `INSERT INTO rpc_traffic_daily (day, client_hash, ua_family, origin_host, method, status_class, auth_state, count)
         SELECT * FROM unnest($1::date[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::bigint[])
         ON CONFLICT (day, client_hash, ua_family, origin_host, method, status_class, auth_state)
         DO UPDATE SET count = rpc_traffic_daily.count + EXCLUDED.count`,
        cols);
    }
  }

  /** Never throws. Returns true when the batch was written, false when dropped/empty. */
  async function flush() {
    if (flushing) return flushing;
    // At most ONE analytics write holds a pool connection at a time. A write that
    // outlived its timeout (slow/locked table) blocks new flushes until it settles,
    // so a DB problem can never drain the shared pool the billing path uses.
    // Meanwhile records keep accumulating, bounded by maxPendingKeys.
    if (writing) return false;
    if (pending.size === 0 || !pool?.query) return false;
    const batch = pending;
    pending = new Map();
    flushing = (async () => {
      try {
        writing = writeBatch([...batch]).finally(() => { writing = null; });
        writing.catch(() => {});
        await withTimeout(writing, cfg.flushTimeoutMs);
        stats.flushes++;
        return true;
      } catch (err) {
        // Drop, don't re-queue: a DB outage must not grow memory. Message only —
        // rows carry hashes, never IPs, but there is no reason to echo them.
        stats.flushFailures++;
        schemaReady = false;
        try { log.warn?.(`[RpcTraffic] flush failed, dropped ${batch.size} rows: ${String(err?.message || err).slice(0, 120)}`); } catch { /* ignore */ }
        return false;
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  function start() {
    if (timer || !enabled) return;
    seedBaseline(day);
    timer = setInterval(() => { flush().catch(() => {}); }, cfg.flushIntervalMs);
    timer.unref?.();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { middleware, record, flush, start, stop, stats, _pendingSize: () => pending.size };
}
