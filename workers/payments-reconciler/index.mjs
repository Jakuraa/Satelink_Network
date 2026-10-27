// Daily payments reconciliation worker (Wave 1.9). Separate process — NOT the API.
// Run once per day (Railway cron / scheduled service):  node workers/payments-reconciler/index.mjs
// Needs PAYMENTS_RECON_DATABASE_URL (never falls back to DATABASE_URL, so it can't be
// pointed at a database by accident). Providers without live API access record an
// 'error' run (visible in the admin queue) rather than a false 'clean'.
import pg from 'pg';
import { reconcileProvider, previousUtcDay } from '../../apps/api/src/payments/reconcile.mjs';
import { createRazorpayAdapter } from '../../apps/api/src/payments/adapters/razorpay.mjs';
import { createPayramAdapter, payramEnabled } from '../../apps/api/src/payments/adapters/payram.mjs';

const url = process.env.PAYMENTS_RECON_DATABASE_URL;
if (!url) { console.error('[payments-recon] PAYMENTS_RECON_DATABASE_URL is not set — refusing to run'); process.exit(2); }

const adapters = [];
if (process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')) {
  adapters.push(createRazorpayAdapter({ keyId: process.env.RAZORPAY_KEY_ID, keySecret: async () => process.env.RAZORPAY_KEY_SECRET, webhookSecret: async () => process.env.RAZORPAY_WEBHOOK_SECRET, fetch }));
}
if (payramEnabled() && process.env.PAYRAM_BASE_URL) {
  adapters.push(createPayramAdapter({ baseUrl: process.env.PAYRAM_BASE_URL, apiKey: async () => process.env.PAYRAM_API_KEY, fetch }));
}

const pool = new pg.Pool({ connectionString: url, max: 2 });
const window = previousUtcDay();
let exitCode = 0;
for (const a of adapters) {
  const r = await reconcileProvider(pool, a, window);
  console.log(`[payments-recon] ${a.id} ${window.windowStart.toISOString()}..${window.windowEnd.toISOString()} → ${r.status}${r.mismatches ? ` (${r.mismatches.length} mismatches)` : ''}`);
  if (r.status !== 'clean') exitCode = 1;
}
if (!adapters.length) console.log('[payments-recon] no providers configured — nothing to reconcile');
await pool.end();
process.exit(exitCode);
