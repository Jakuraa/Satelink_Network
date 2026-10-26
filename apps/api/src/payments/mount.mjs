// Mount the payments surface (Wave 1.8) — only when PAYMENTS_V1=true (read at boot; default OFF).
//   /webhooks/:provider            provider webhooks (raw body, signature-verified, rate-limited)
//   /v1/payments/*                 console checkout API
// Adapters are enabled individually and never with live credentials from this code:
//   onchain-native   always (existing vault + x402 rails; createIntent only — no webhook)
//   razorpay         only with a rzp_test_ key (the gateway refuses live keys)
//   payram           only with PAYMENT_PAYRAM=true + PAYRAM_BASE_URL
// Dodo stays on its existing routes and is NOT registered here.
import { createPaymentWebhookRouter } from './webhook_router.mjs';
import { createPaymentsCheckoutRouter } from './checkout_router.mjs';
import { createOnchainNativeAdapter, validateInvoiceConfig } from './adapters/onchain_native.mjs';
import { createRazorpayAdapter } from './adapters/razorpay.mjs';
import { createPayramAdapter, payramEnabled } from './adapters/payram.mjs';
import { createTransactyAdapter, transactyEnabled } from './adapters/transacty.mjs';
import { createDodoAdapter } from './adapters/dodo.mjs';
import { createCashfreeAdapter } from './adapters/cashfree.mjs';

export function isPaymentsV1Enabled(env = process.env) { return env.PAYMENTS_V1 === 'true'; }

export function buildAdapters(pool, env = process.env) {
  const adapters = {
    'onchain-native': createOnchainNativeAdapter({
      env,
      lookupIntentAmount: async (ref) => (await pool.query('SELECT amount_minor::text a FROM payment_intents WHERE canonical_ref = $1', [ref])).rows[0]?.a ?? null,
    }),
  };
  if (env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && env.RAZORPAY_WEBHOOK_SECRET) {
    adapters.razorpay = createRazorpayAdapter({ keyId: env.RAZORPAY_KEY_ID, keySecret: async () => env.RAZORPAY_KEY_SECRET, webhookSecret: async () => env.RAZORPAY_WEBHOOK_SECRET, fetch });
  } else {
    adapters.razorpay = createRazorpayAdapter({
      gateway: { mode: 'test', capabilities: () => ({ available: false, unavailableReason: 'provider_suspended' }) },
    });
  }
  if (payramEnabled(env) && env.PAYRAM_BASE_URL && env.PAYRAM_API_KEY) {
    adapters.payram = createPayramAdapter({ baseUrl: env.PAYRAM_BASE_URL, apiKey: async () => env.PAYRAM_API_KEY, fetch, env });
  } else {
    adapters.payram = createPayramAdapter({ env });
  }
  if (transactyEnabled(env) && env.TRANSACTY_KEY && env.TRANSACTY_SECRET) {
    adapters.transacty = createTransactyAdapter({
      apiKey: async () => env.TRANSACTY_KEY,
      apiSecret: async () => env.TRANSACTY_SECRET,
      webhookSecret: async () => env.TRANSACTY_WEBHOOK_SECRET,
      baseUrl: env.TRANSACTY_BASE_URL,
      fetch,
      env,
    });
  } else {
    adapters.transacty = createTransactyAdapter({ env });
  }
  adapters.dodo = createDodoAdapter();
  adapters.cashfree = createCashfreeAdapter();
  return adapters;
}

/** Wrap a Promise<provider> in the sync shape the router expects. */
function lazyProvider(p) {
  return {
    getTransactionReceipt: async (h) => (await p).getTransactionReceipt(h),
    getBlockNumber: async () => (await p).getBlockNumber(),
    getBlock: async (n) => (await p).getBlock(n),
  };
}

export function mountPayments(app, pool, { env = process.env, logger = console } = {}) {
  if (!isPaymentsV1Enabled(env)) return false;
  const adapters = buildAdapters(pool, env);
  // Startup validator (Step 4.2): on-chain invoices stay refused — and are not
  // offered at checkout — until a dedicated, non-listener-credited address is set.
  const invoice = validateInvoiceConfig(env);
  if (!invoice.ok) logger.warn(`[payments] on-chain invoices DISABLED (${invoice.reason}): ${invoice.message}`);
  const webhookAdapters = Object.values(adapters).filter((a) => a.id !== 'onchain-native');
  app.use('/webhooks', createPaymentWebhookRouter(pool, { adapters: webhookAdapters, logger }));
  const rpc = { polygon: env.PAYMENTS_RPC_POLYGON, base: env.PAYMENTS_RPC_BASE };
  const providers = {};
  const chainProvider = (network) => {
    if (!rpc[network]) return null;
    if (!providers[network]) providers[network] = import('ethers').then(({ JsonRpcProvider }) => new JsonRpcProvider(rpc[network]));
    return lazyProvider(providers[network]);
  };
  app.use('/v1/payments', createPaymentsCheckoutRouter(pool, { adapters, logger, mode: 'test', chainProvider, env }));
  logger.info?.(`[payments] PAYMENTS_V1 on — adapters: ${Object.keys(adapters).join(', ')} (test mode)`);
  return true;
}
