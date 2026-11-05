// x402 V2 PREVIEW for machine commerce (Release A, Slice S6) — mounted only by the local preview server.
//   GET /v1/x402/preview/:capability_id?q=<request>   (Idempotency-Key header required)
//   1st call  → HTTP 402 + PAYMENT-REQUIRED (base64 PaymentRequired: scheme exact, testnet CAIP-2 network, asset,
//               amount = the quote's Satelink credit charge, placeholder payTo, resource, extra.simulated=true)
//   retry with PAYMENT-SIGNATURE → LOCAL MOCK facilitator /verify → the payment approves the exact quote → the ONE task
//               engine executes → 200 + PAYMENT-RESPONSE (base64 SettleResponse, simulated, no transaction) + receipt.
// Never calls a facilitator /settle, never imports the live x402 middleware or the USDT/Polygon vault, never moves
// money. The amount covers only Satelink's (PROPOSED) fee: supplier amounts are never collected by Satelink.
// Header codecs are the official @x402/core 2.18.0 ones (already an apps/api dependency).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { encodePaymentRequiredHeader, decodePaymentSignatureHeader, encodePaymentResponseHeader } from '@x402/core/http';
import { TaskError } from '../workflows/errors.js';

const CFG_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'config', 'x402.preview.json');
const SIM_LABEL = 'SIMULATED — NO MONEY MOVED';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const IDEM = /^[A-Za-z0-9._:-]{8,100}$/;
const TRANSITIONAL = ['CREATED', 'UNDERSTANDING', 'PLANNING', 'QUOTED', 'AUTHORIZED', 'RESERVED', 'EXECUTING', 'UNKNOWN_EXECUTION_OUTCOME', 'VERIFYING'];

export function loadX402PreviewConfig(file = CFG_FILE) {
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (cfg.x402Version !== 2 || cfg.scheme !== 'exact') throw new Error('x402 preview config must be x402 V2 / exact');
  if (!/^eip155:(84532|11155111|80002)$/.test(cfg.network)) throw new Error('x402 preview network must be a testnet CAIP-2 id');
  if (!/^0x0{40}$/.test(cfg.pay_to_placeholder)) throw new Error('x402 preview payTo must be the zero-address placeholder');
  return cfg;
}

/** PaymentRequirements for a quoted task (pure; unit-tested). */
export function requirementsFor(cfg, task, capabilityId) {
  return {
    scheme: cfg.scheme, network: cfg.network, asset: cfg.asset, amount: String(task.quote.credit_charge_minor),
    payTo: cfg.pay_to_placeholder, maxTimeoutSeconds: cfg.max_timeout_seconds,
    extra: { ...cfg.asset_eip712, simulated: true, simulation_label: SIM_LABEL, placeholder_pay_to: true, fees: 'PROPOSED — NOT APPROVED',
      capability_id: capabilityId, task_id: task.id, quote_id: task.quote.quote_id, quote_version: task.quote.version,
      covers: 'Satelink fee only — supplier amounts are paid to the supplier directly (simulated)' },
  };
}

export function createX402PreviewRouter(svc, { resolvePrincipal, facilitatorUrl, publicBaseUrl, cfg = loadX402PreviewConfig(), pollMs = 100, maxWaitMs = 30_000 }) {
  const fac = new URL(facilitatorUrl);
  if (!LOOPBACK.has(fac.hostname)) throw new Error('x402 preview: the facilitator must be the LOCAL mock (loopback URL)');
  const r = express.Router();
  const wait = async (p, id, until) => {
    let t = await svc.getTask(p, id);
    for (let w = 0; until(t) && w < maxWaitMs; w += pollMs) { await new Promise((x) => setTimeout(x, pollMs)); t = await svc.getTask(p, id); }
    return t;
  };
  const err = (res, status, code, message, extra = {}) => res.status(status).json({ ok: false, simulated: true, simulation_label: SIM_LABEL, error: { code, message, retryable: status >= 500, ...extra } });

  r.get('/x402/preview/:capability_id', async (req, res) => {
    try {
      const idem = req.get('Idempotency-Key') || '';
      if (!IDEM.test(idem)) return err(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (8–100 characters [A-Za-z0-9._:-]).');
      const text = String(req.query.q || '').trim();
      if (text.length < 2 || text.length > 2000) return err(res, 400, 'VALIDATION_FAILED', 'Describe the request in q (2–2000 characters).');
      const cap = await svc.registry.get(req.params.capability_id);
      if (!cap) return err(res, 404, 'NOT_FOUND', 'Unknown capability.');

      // A developer key binds the purchase to its owner (receipt in their usage); otherwise the machine is keyless and
      // the Idempotency-Key scopes the task.
      let p;
      if (req.get('Authorization')) {
        p = await resolvePrincipal(req);
        if (!p?.id) return err(res, 401, 'UNAUTHENTICATED', 'Unknown or revoked key.');
        if (p.scopes && !p.scopes.includes('tasks:create')) return err(res, 403, 'FORBIDDEN_SCOPE', 'This key lacks the "tasks:create" scope.');
      } else {
        p = { id: `machine:x402:${crypto.createHash('sha256').update(idem).digest('hex').slice(0, 32)}`, via: 'x402', actor_type: 'machine' };
      }

      const created = await svc.createTask(p, { text, idempotency_key: `x402-${idem}`, actor_type: 'machine' });
      let task = await wait(p, created.task.id, (t) => ['CREATED', 'UNDERSTANDING', 'PLANNING', 'QUOTED'].includes(t.state));
      const planned = task.plan?.steps?.[0]?.capability_id;
      if (planned && planned !== cap.id) {
        if (task.state === 'AWAITING_APPROVAL') await svc.cancel(p, task.id).catch(() => {});
        return err(res, 409, 'CAPABILITY_MISMATCH', `The request was planned as ${planned}, not ${cap.id}. Nothing was charged.`);
      }
      const paid = await svc.paymentFor(p, task.id);
      if (!paid) {
        if (task.state === 'AWAITING_INPUT') return err(res, 422, 'INPUT_REQUIRED', task.question?.text || 'More detail is needed in q.');
        if (task.state !== 'AWAITING_APPROVAL') return err(res, 422, task.error?.code || 'NOT_PAYABLE', task.error?.message || `The task is ${task.state}.`);
      }

      const requirements = requirementsFor(cfg, task, cap.id);
      const resource = { url: `${publicBaseUrl}/v1/x402/preview/${cap.id}`, description: `${cap.name} — ${SIM_LABEL}`, mimeType: 'application/json' };
      const paymentRequired = (error) => ({ x402Version: 2, ...(error ? { error } : {}), resource, accepts: [requirements], extensions: { satelink: { simulated: true, simulation_label: SIM_LABEL } } });
      const send402 = (error) => {
        const pr = paymentRequired(error);
        res.set('PAYMENT-REQUIRED', encodePaymentRequiredHeader(pr));
        return res.status(402).json({ ...pr, simulated: true, simulation_label: SIM_LABEL, task_id: task.id });
      };

      const header = req.get('PAYMENT-SIGNATURE');
      if (!paid) {
        if (!header) return send402();
        let payload;
        try { payload = decodePaymentSignatureHeader(header); } catch { return send402('invalid_payment_signature_header'); }
        let verdict;
        try {
          const vr = await fetch(`${fac.origin}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x402Version: 2, paymentPayload: payload, paymentRequirements: requirements }), signal: AbortSignal.timeout(10_000) });
          verdict = await vr.json();
        } catch {
          return err(res, 503, 'FACILITATOR_UNAVAILABLE', 'The (mock) facilitator did not answer. Nothing was charged.');
        }
        if (!verdict?.isValid) return send402(verdict?.invalidReason || 'invalid_payment');
        await svc.approveWithPayment(p, task.id, { quote_id: task.quote.quote_id, quote_version: task.quote.version, payment: {
          rail: 'x402', x402Version: 2, scheme: requirements.scheme, network: requirements.network, asset: requirements.asset, amount_minor: requirements.amount,
          payer: verdict.payer, nonce: String(payload.payload.authorization.nonce), verified_by: 'x402 Facilitator (MOCK, local)', settlement: 'none — preview (no /settle call, no transaction)' } });
      } else if (header) {
        // Replays of an already-accepted payment return the same outcome; a different payment is refused.
        let payload; try { payload = decodePaymentSignatureHeader(header); } catch { payload = null; }
        if (String(payload?.payload?.authorization?.nonce) !== paid.nonce) return err(res, 409, 'ALREADY_PAID', 'This task was already paid with a different payment.');
      }

      task = await wait(p, task.id, (t) => TRANSITIONAL.includes(t.state));
      const payment = (await svc.paymentFor(p, task.id)) || {};
      const receipt = task.receipt_id ? await svc.getReceipt(p, task.receipt_id) : null;
      res.set('PAYMENT-RESPONSE', encodePaymentResponseHeader({
        success: task.state === 'SUCCEEDED', ...(task.state === 'SUCCEEDED' ? {} : { errorReason: task.error?.code || task.state }),
        payer: payment.payer, transaction: '', network: requirements.network,
        extra: { simulated: true, simulation_label: SIM_LABEL, settled: false, receipt_id: task.receipt_id },
      }));
      const body = { ok: task.state === 'SUCCEEDED', simulated: true, simulation_label: SIM_LABEL, task: { id: task.id, state: task.state, output: task.output ?? null, error: task.error }, receipt };
      return res.status(task.state === 'SUCCEEDED' ? 200 : TRANSITIONAL.includes(task.state) ? 202 : 502).json(body);
    } catch (e) {
      if (e instanceof TaskError) return err(res, e.status || 400, e.code, e.message);
      return err(res, 500, 'INTERNAL', 'Unexpected error. Nothing was charged.');
    }
  });
  return r;
}
