// POST /webhooks/:provider — the single ingress for provider payment events
// (2026-10-12 directive, Wave 1.8): api.satelink.network/webhooks/<provider>.
//   * raw body (express.raw) — signatures are verified over the exact bytes received;
//   * CSRF-exempt by construction: no cookies/sessions are read, auth is the provider signature;
//   * rate-limited per IP;
//   * only adapters passed in `adapters` are reachable — anything else 404s
//     (Dodo keeps its existing /webhooks/dodo/v2 route; it is never registered here).
// Responses: 200 ingested/duplicate/ignored, 401 bad signature, 400 malformed,
// 500 anything else (the provider retries; ingest is all-or-nothing).
import express from 'express';
import rateLimit from 'express-rate-limit';
import { assertAdapter, PaymentError } from './contract.mjs';
import { ingestWebhook } from './ingest.mjs';

export function createPaymentWebhookRouter(pool, { adapters = [], ingest = ingestWebhook, logger = console, limiter } = {}) {
  const byId = new Map(adapters.map((a) => [assertAdapter(a).id, a]));
  const router = express.Router();
  const limit = limiter ?? rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, validate: false });

  router.post('/:provider', limit, express.raw({ type: '*/*', limit: '256kb' }), async (req, res) => {
    const adapter = byId.get(req.params.provider);
    if (!adapter) return res.status(404).json({ ok: false, error: 'unknown_provider' });
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (raw.length === 0) return res.status(400).json({ ok: false, error: 'empty_body' });
    try {
      const r = await ingest(pool, adapter, raw, req.headers);
      return res.status(200).json({ ok: true, duplicate: Boolean(r?.duplicate), ignored: Boolean(r?.ignored), status: r?.status ?? null });
    } catch (err) {
      if (err instanceof PaymentError && err.code === 'BAD_SIGNATURE') return res.status(401).json({ ok: false, error: 'bad_signature' });
      if (err instanceof PaymentError && err.code === 'INVALID') {
        logger.warn?.(`[payments] ${adapter.id} rejected event: ${err.message}`);
        return res.status(400).json({ ok: false, error: 'invalid_event' });
      }
      logger.error?.(`[payments] ${adapter.id} ingest failed (provider will retry): ${err?.message ?? err}`);
      return res.status(500).json({ ok: false, error: 'ingest_failed' });
    }
  });
  return router;
}
