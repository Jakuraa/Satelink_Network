import { timingSafeEqual } from 'crypto';

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
    if (typeof got === 'string' && got.length > 0) {
      const a = Buffer.from(got);
      for (const s of secrets) {
        const b = Buffer.from(s);
        if (a.length === b.length && timingSafeEqual(a, b)) return next();
      }
    }
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  };
}
