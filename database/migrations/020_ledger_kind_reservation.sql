-- 020 — allow ledger_txns.kind IN ('hold', 'capture', 'release') (S-5 reserve → capture/release).
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
  CHECK (kind IN ('draw', 'settlement', 'deposit', 'adjustment', 'reversal', 'refund', 'hold', 'capture', 'release'));
