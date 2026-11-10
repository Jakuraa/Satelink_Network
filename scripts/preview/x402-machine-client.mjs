#!/usr/bin/env node
// Release A, Slice S6 — scripted MACHINE client for the x402 V2 preview (local only).
//   GET → 402 + PAYMENT-REQUIRED → mock-signed PAYMENT-SIGNATURE (no keys, no chain) → retry → PAYMENT-RESPONSE + receipt.
// Usage: node scripts/preview/x402-machine-client.mjs --capability dev.data.extract --q "Extract …" [--key slk_preview_…]
//        [--api http://127.0.0.1:4500] [--idem <key>]
// Prints a final line "X402_OK <task_id> <receipt_id>" on success. Everything is SIMULATED — NO MONEY MOVED.
import crypto from 'node:crypto';
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader, decodePaymentResponseHeader } from '@x402/core/http';
import { mockSignature } from '../../tools/mock-x402-facilitator/mock_sig.mjs';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const API = arg('api', process.env.API || 'http://127.0.0.1:4500');
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(API)) { console.error('x402-machine-client: API must be a local preview URL'); process.exit(2); }
const capability = arg('capability', 'dev.data.extract');
const q = arg('q', 'Extract the contacts from: machine@example.com, due 2026-12-31');
const key = arg('key', process.env.SATELINK_API_KEY || '');
const idem = arg('idem', `machine-${crypto.randomBytes(8).toString('hex')}`);
const url = `${API}/v1/x402/preview/${capability}?q=${encodeURIComponent(q)}`;
const headers = { 'Idempotency-Key': idem, ...(key ? { Authorization: `Bearer ${key}` } : {}) };

const first = await fetch(url, { headers });
if (first.status !== 402) { console.error(`expected 402, got ${first.status}`, await first.text()); process.exit(1); }
const required = decodePaymentRequiredHeader(first.headers.get('PAYMENT-REQUIRED'));
const req = required.accepts[0];
console.log(`1. 402 PAYMENT-REQUIRED: x402v${required.x402Version} ${req.scheme} on ${req.network}, amount ${req.amount} (atomic USDC), payTo ${req.payTo} (placeholder), simulated=${req.extra.simulated}`);

// A throwaway mock payer address — no private key exists anywhere in this flow.
const now = Math.floor(Date.now() / 1000);
const authorization = { from: `0x${crypto.randomBytes(20).toString('hex')}`, to: req.payTo, value: req.amount, validAfter: String(now - 5), validBefore: String(now + req.maxTimeoutSeconds), nonce: `0x${crypto.randomBytes(32).toString('hex')}` };
const paymentPayload = { x402Version: 2, resource: required.resource, accepted: req, payload: { signature: mockSignature(authorization), authorization } };
console.log(`2. PAYMENT-SIGNATURE (MOCK-signed) from ${authorization.from}`);

const paid = await fetch(url, { headers: { ...headers, 'PAYMENT-SIGNATURE': encodePaymentSignatureHeader(paymentPayload) } });
const body = await paid.json();
const response = paid.headers.get('PAYMENT-RESPONSE') ? decodePaymentResponseHeader(paid.headers.get('PAYMENT-RESPONSE')) : null;
console.log(`3. ${paid.status} PAYMENT-RESPONSE: success=${response?.success} transaction="${response?.transaction}" settled=${response?.extra?.settled} (${response?.extra?.simulation_label})`);
if (paid.status !== 200 || !body.ok) { console.error(JSON.stringify(body, null, 2)); process.exit(1); }
console.log(`4. result: ${JSON.stringify(body.task.output?.result ?? body.task.output)}`);
console.log(`5. receipt ${body.receipt.receipt_id}: ${body.receipt.outcome}, credits ${body.receipt.charges.credits_charged_usd}, paid via ${body.receipt.payment?.rail} (${body.receipt.payment?.verified_by}) — ${body.receipt.simulation_label}`);
console.log(`X402_OK ${body.task.id} ${body.receipt.receipt_id}`);
