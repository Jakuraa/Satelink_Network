/**
 * Read side of rpc_traffic_daily — aggregates only, every query bounded by a day
 * window (1..30) and a LIMIT. client_hash is a keyed pseudonym (see
 * rpc_traffic_recorder.mjs); no raw IP exists in the table to return.
 *
 * "paid" = a 2xx response with auth_state key-funded or x402.
 * 402-then-paid is day-granular: a client seen with a 402 on day D and a paid call on
 * any day >= D (same-day ordering is not recorded).
 */

const PAID = `status_class = '2xx' AND auth_state IN ('key-funded','x402')`;
const REAL_CLIENT = `client_hash NOT IN ('other','nosecret','noip')`;

export function parseDays(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 30) : 7;
}

export async function getRpcTrafficReport(pool, { days = 7 } = {}) {
  const d = parseDays(days);
  // Window: the last d UTC days including today.
  const win = `day > (now() AT TIME ZONE 'utc')::date - $1::int`;
  const q = async (sql) => (await pool.query(sql, [d])).rows;

  // Sequential on purpose: never hold more than one shared-pool connection for an
  // admin read (Promise.all would take up to 10 from the pool the RPC path uses).
  const queries = [
    `SELECT day::text AS day, auth_state, SUM(count)::bigint AS requests
         FROM rpc_traffic_daily WHERE ${win}
        GROUP BY day, auth_state ORDER BY day, auth_state`,
    `SELECT origin_host, SUM(count)::bigint AS requests,
              COUNT(DISTINCT client_hash)::int AS clients,
              SUM(count) FILTER (WHERE ${PAID})::bigint AS paid_requests
         FROM rpc_traffic_daily WHERE ${win}
        GROUP BY origin_host ORDER BY requests DESC LIMIT 20`,
    `SELECT ua_family, SUM(count)::bigint AS requests,
              COUNT(DISTINCT client_hash)::int AS clients,
              SUM(count) FILTER (WHERE ${PAID})::bigint AS paid_requests
         FROM rpc_traffic_daily WHERE ${win}
        GROUP BY ua_family ORDER BY requests DESC LIMIT 25`,
    `SELECT method, SUM(count)::bigint AS requests
         FROM rpc_traffic_daily WHERE ${win}
        GROUP BY method ORDER BY requests DESC LIMIT 30`,
    `SELECT day::text AS day, COUNT(DISTINCT client_hash)::int AS distinct_clients
         FROM rpc_traffic_daily WHERE ${win} AND ${REAL_CLIENT}
        GROUP BY day ORDER BY day`,
    `SELECT COUNT(*)::int AS repeat_clients, COALESCE(SUM(requests),0)::bigint AS repeat_requests FROM (
         SELECT client_hash, SUM(count) AS requests FROM rpc_traffic_daily
          WHERE ${win} AND ${REAL_CLIENT}
          GROUP BY client_hash HAVING COUNT(DISTINCT day) >= 3) r`,
    // Per-client profile for the top repeat callers: dominant UA family / origin,
    // and whether they ever paid. Pseudonymous hash only.
    `WITH r AS (
         SELECT client_hash, COUNT(DISTINCT day)::int AS days_seen, SUM(count)::bigint AS requests,
                SUM(count) FILTER (WHERE ${PAID})::bigint AS paid_requests,
                SUM(count) FILTER (WHERE status_class = '402')::bigint AS got_402
           FROM rpc_traffic_daily WHERE ${win} AND ${REAL_CLIENT}
          GROUP BY client_hash HAVING COUNT(DISTINCT day) >= 3
          ORDER BY requests DESC LIMIT 25)
       SELECT r.*,
              (SELECT ua_family FROM rpc_traffic_daily t WHERE t.client_hash = r.client_hash AND ${win}
                GROUP BY ua_family ORDER BY SUM(count) DESC LIMIT 1) AS top_ua_family,
              (SELECT origin_host FROM rpc_traffic_daily t WHERE t.client_hash = r.client_hash AND ${win}
                GROUP BY origin_host ORDER BY SUM(count) DESC LIMIT 1) AS top_origin_host,
              (SELECT method FROM rpc_traffic_daily t WHERE t.client_hash = r.client_hash AND ${win}
                GROUP BY method ORDER BY SUM(count) DESC LIMIT 1) AS top_method
         FROM r ORDER BY r.requests DESC`,
    `WITH first402 AS (
         SELECT client_hash, MIN(day) AS d FROM rpc_traffic_daily
          WHERE ${win} AND ${REAL_CLIENT} AND status_class = '402' GROUP BY client_hash),
       paid AS (
         SELECT client_hash, MAX(day) AS d FROM rpc_traffic_daily
          WHERE ${win} AND ${REAL_CLIENT} AND ${PAID} GROUP BY client_hash)
       SELECT (SELECT COUNT(*) FROM first402)::int AS clients_sent_402,
              COUNT(*)::int AS clients_402_then_paid
         FROM first402 f JOIN paid p USING (client_hash) WHERE p.d >= f.d`,
    `WITH first402 AS (
         SELECT client_hash, MIN(day) AS d FROM rpc_traffic_daily
          WHERE ${win} AND ${REAL_CLIENT} AND status_class = '402' GROUP BY client_hash),
       paid AS (
         SELECT client_hash, MAX(day) AS d, SUM(count)::bigint AS paid_requests,
                array_agg(DISTINCT auth_state) AS rails
           FROM rpc_traffic_daily WHERE ${win} AND ${REAL_CLIENT} AND ${PAID} GROUP BY client_hash)
       SELECT f.client_hash, f.d::text AS first_402_day, p.d::text AS last_paid_day, p.paid_requests, p.rails
         FROM first402 f JOIN paid p USING (client_hash) WHERE p.d >= f.d
        ORDER BY p.paid_requests DESC LIMIT 25`,
    `SELECT COALESCE(SUM(count),0)::bigint AS requests,
              COALESCE(SUM(count) FILTER (WHERE client_hash = 'other'),0)::bigint AS overflow_requests,
              COUNT(*)::int AS rows
         FROM rpc_traffic_daily WHERE ${win}`,
  ];
  const results = [];
  for (const sql of queries) results.push(await q(sql));
  const [byAuth, origins, uas, methods, distinct, repeatSummary, repeatTop, conv, conversions, totals] = results;

  return {
    window_days: d,
    totals: totals[0] || { requests: 0, overflow_requests: 0, rows: 0 },
    requests_by_day_auth_state: byAuth,
    top_origin_hosts: origins,
    top_ua_families: uas,
    methods,
    distinct_clients_per_day: distinct,
    repeat_callers: { ...(repeatSummary[0] || { repeat_clients: 0, repeat_requests: 0 }), top: repeatTop },
    sent_402_then_paid: { ...(conv[0] || { clients_sent_402: 0, clients_402_then_paid: 0 }), clients: conversions },
    notes: [
      "method 'unread' = rejected by the anonymous gate before the body is parsed (by design).",
      "paid = 2xx with auth_state key-funded or x402; 402-then-paid is day-granular.",
      "client_hash is a keyed HMAC pseudonym, stable only while the server secret is unchanged.",
    ],
  };
}
