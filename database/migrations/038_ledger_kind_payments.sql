-- 038 — allow the payment-ledger kinds (2026-10-12 platform directive, Wave 1.2).
--
-- FOUNDER-APPROVED (2026-10-12): an ADDITIVE extension of ledger_txns.kind,
-- following the 019 pattern exactly, for:
--   'payment'      a one-time customer payment recognised from a provider event
--   'subscription' a subscription period paid (fiat recurring or crypto prepaid renewal)
--   'commission'   partner/referral commission owed (reserved; no writer yet)
--   'rebate'       a rebate returned to a customer/partner (reserved; no writer yet)
--   'provider_fee' a payment provider's fee on a payment (reserved; no writer yet)
-- Writer: apps/api/src/payments/ledger_posting.mjs (inside the ingest transaction).
-- Additive: widens the allowed set, no row changes, no other table touched.
ALTER TABLE ledger_txns DROP CONSTRAINT IF EXISTS ledger_txns_kind_check;
ALTER TABLE ledger_txns ADD CONSTRAINT ledger_txns_kind_check
  CHECK (kind IN ('draw', 'settlement', 'deposit', 'adjustment', 'reversal', 'refund',
                  'payment', 'subscription', 'commission', 'rebate', 'provider_fee'));
