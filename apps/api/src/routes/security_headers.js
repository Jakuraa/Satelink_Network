// Baseline security headers for the Release A preview API (P4). Task, receipt and money responses are never cached.
export function securityHeaders() {
  return (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-site' });
    if (req.path.startsWith('/v1/') || req.path.startsWith('/a2a/')) res.set('Cache-Control', 'no-store');
    next();
  };
}
