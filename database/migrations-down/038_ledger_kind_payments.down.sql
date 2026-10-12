-- Down for 038 (local/ephemeral only). Fails if any row already uses a 038 kind — by design.
ALTER TABLE ledger_txns DROP CONSTRAINT IF EXISTS ledger_txns_kind_check;
ALTER TABLE ledger_txns ADD CONSTRAINT ledger_txns_kind_check
  CHECK (kind IN ('draw', 'settlement', 'deposit', 'adjustment', 'reversal', 'refund'));
