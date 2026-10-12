// Payments module (2026-10-12 directive, Wave 1). See docs/platform/FINANCIAL_OS_PAYMENTS_MAP.md.
export * from './contract.mjs';
export { ingestCanonicalEvent, ingestWebhook, recordIntent } from './ingest.mjs';
export { postSettledPayment, postReversal, ensurePlatformAccount } from './ledger_posting.mjs';
export { createPaymentWebhookRouter } from './webhook_router.mjs';
export { createOnchainNativeAdapter, onchainConfig } from './adapters/onchain_native.mjs';
export { createRazorpayAdapter, RAZORPAY_EVENT_MAP } from './adapters/razorpay.mjs';
export { createPayramAdapter, payramEnabled, PAYRAM_STATUS_MAP } from './adapters/payram.mjs';
export { createDodoAdapter, DODO_EVENT_MAP } from './adapters/dodo.mjs';
export { createCashfreeAdapter } from './adapters/cashfree.mjs';
