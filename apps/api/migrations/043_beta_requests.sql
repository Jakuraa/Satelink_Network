-- 043_beta_requests.sql — Trading AI beta waitlist capture (Phase 7 amendment,
-- #511). Additive only: one new table, no change to any existing table.
-- Prod has no migration runner, so ensureBetaRequestsSchema (src/beta/
-- beta_requests.mjs) applies this DDL idempotently on first use (same
-- boot-DDL pattern as 038/039/042); this numbered file is the reviewable
-- record.
CREATE TABLE IF NOT EXISTS beta_requests (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT        NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200),
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  role         TEXT        NOT NULL CHECK (role IN ('human', 'ai_agent', 'machine')),
  use_case     TEXT        NOT NULL CHECK (char_length(use_case) BETWEEN 1 AND 2000),
  capital_band TEXT        CHECK (capital_band IS NULL OR char_length(capital_band) <= 80),
  broker       TEXT        CHECK (broker IS NULL OR char_length(broker) <= 80),
  source       TEXT,
  ip_hash      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per requester. A resubmission with the same email is idempotent —
-- the API returns success without creating a duplicate waitlist entry.
CREATE UNIQUE INDEX IF NOT EXISTS beta_requests_email_unique ON beta_requests (lower(email));
CREATE INDEX IF NOT EXISTS beta_requests_created_at ON beta_requests (created_at DESC);
