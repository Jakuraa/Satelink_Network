-- 042 — allow ledger_txns.kind IN ('hold', 'capture', 'release') (S-5 reserve → capture/release).
--
-- Renumbered from PR #583's 020 on build/integration-base (2026-11-04): 020 sorted BEFORE 038 and both
-- replace the same CHECK, so on a fresh DB 038 dropped hold/capture/release, and on production (038
-- already applied) a late 020 would have dropped the 038 payment kinds. 042 keeps the UNION.
--
-- Decision S-5 (2026-10-22): reserve → capture/release is the only charging path for new
-- capabilities. Postings (docs/build/REVENUE_MODEL.md §2), all POSTED, append-only:
--   hold    : Dr customer balance        / Cr customer holds
--   capture : Dr customer holds          / Cr revenue (captured) + Cr customer balance (remainder)
--   release : Dr customer holds          / Cr customer balance   (failure, cancel or expiry)
-- One settle transaction per reservation (txn id rsv:<id>:settle), so a reservation can never be
-- both captured and released, and replays are idempotent on the txn id.
-- Additive: widens the allowed set, no row changes. Production apply = F14 (founder).
ALTER TABLE ledger_txns DROP CONSTRAINT IF EXISTS ledger_txns_kind_check;
ALTER TABLE ledger_txns ADD CONSTRAINT ledger_txns_kind_check
  CHECK (kind IN ('draw', 'settlement', 'deposit', 'adjustment', 'reversal', 'refund',
                  'payment', 'subscription', 'commission', 'rebate', 'provider_fee',
                  'hold', 'capture', 'release'));
