// POST /beta/request — Satelink Trading AI beta waitlist capture (Phase 7
// amendment, #511). Public and CORS-open (apps/web proxies the marketing-site
// form to it server-side; AI agents/machines may also call it directly — the
// role enum covers both). Validates, rate-limits per IP, stores the row, then
// best-effort emails the founder + an auto-reply to the requester. A send
// failure never loses the row: the insert always happens first.
import express from 'express';
import { betaRequestLimiter } from '../security/middleware/rate_limits.js';
import {
  ensureBetaRequestsSchema,
  validateBetaRequest,
  insertBetaRequest,
  sendBetaRequestEmails,
} from '../beta/beta_requests.mjs';

export function createBetaRequestsRouter(pool, { sendEmails = sendBetaRequestEmails } = {}) {
  const router = express.Router();

  router.post('/request', betaRequestLimiter, express.json({ limit: '16kb' }), async (req, res) => {
    const parsed = validateBetaRequest(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ ok: false, error: 'validation_failed', issues: parsed.errors });
    }

    try {
      await ensureBetaRequestsSchema(pool);
    } catch (err) {
      console.error('[beta-requests] schema init failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }

    let row;
    try {
      const result = await insertBetaRequest(pool, parsed.data, { ip: req.ip });
      row = result.row;
    } catch (err) {
      console.error('[beta-requests] insert failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }

    // Email delivery is best-effort; the row above is already durable.
    try {
      const outcome = await sendEmails(parsed.data);
      if (outcome.founder?.startsWith('failed') || outcome.requester?.startsWith('failed')) {
        console.warn('[beta-requests] email outcome:', JSON.stringify(outcome));
      }
    } catch (err) {
      console.error('[beta-requests] email send threw:', err.message);
    }

    res.json({ ok: true, id: row?.id ?? null });
  });

  return router;
}
