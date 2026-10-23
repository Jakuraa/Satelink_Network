import { createHash, timingSafeEqual } from 'crypto';

/** Constant-time string equality that does not leak length (compares SHA-256 digests). */
export function secretEquals(got, expected) {
  if (typeof got !== 'string' || typeof expected !== 'string' || got.length === 0 || expected.length === 0) return false;
  const a = createHash('sha256').update(got).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * True only when the request carries the staff token (ADMIN_SECRET_TOKEN) in
 * `x-admin-token` or `Authorization: Bearer …` — the same sources requireAdminAuth accepts.
 * False when the env var is unset. For routes that serve a reduced public view and a
 * full staff view; routes that must refuse non-staff use requireAdminAuth.
 */
export function staffTokenFrom(req) {
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  return req.headers['x-admin-token'] || bearer;
}

export function isStaffRequest(req) {
  return secretEquals(staffTokenFrom(req), process.env.ADMIN_SECRET_TOKEN);
}

/**
 * Fail-closed, constant-time shared-secret check for a request header (W1, 2026-10-20).
 *
 * Replaces `if (req.headers[h] !== process.env.X)` checks, which pass when X is unset
 * and the header is absent (undefined !== undefined is false). Accepts the header if it
 * matches ANY of the named env vars that are set; if none is set the route is
 * unavailable (503), never open.
 */
export function requireHeaderSecret(header, envNames) {
  const name = header.toLowerCase();
  return function headerSecretGuard(req, res, next) {
    const secrets = envNames.map((n) => process.env[n]).filter((v) => typeof v === 'string' && v.length > 0);
    if (secrets.length === 0) {
      return res.status(503).json({ ok: false, error: 'admin_secret_not_configured' });
    }
    const got = req.headers[name];
    let ok = false;
    for (const s of secrets) ok = secretEquals(got, s) || ok; // check every secret; no early exit
    if (ok) return next();
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  };
}
