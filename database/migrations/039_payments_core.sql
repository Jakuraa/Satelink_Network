-- 039 — provider-agnostic payment ingestion (2026-10-12 platform directive, Wave 1.2). ADDITIVE ONLY.
--
-- One path for every provider:
--   verified webhook → payment_events (UNIQUE provider+provider_event_id)
--     → Financial OS posting (ledger_txns/ledger_entries) in the SAME transaction
--     → entitlement grant/revoke → outbox
-- Money is integer minor units (NUMERIC(38,0)) + a currency code; nothing here
-- sums across currencies. No existing table is altered.
-- Names avoid the existing payment_sources / billing_payments / pv2_* tables.
-- Status 'disputed' = dispute LOST (reversal); 'dispute_open' / 'dispute_won' never move money.
-- Down: database/migrations-down/039_payments_core.down.sql (local/ephemeral only).

-- What Satelink asked the customer to pay (checkout / on-chain invoice).
CREATE TABLE payment_intents (
    canonical_ref        TEXT        PRIMARY KEY,           -- our id, sent to the provider (invoice id / notes)
    provider             TEXT        NOT NULL,
    provider_payment_id  TEXT,                               -- provider's id once known
    customer_account_id  TEXT        NOT NULL,
    product_id           TEXT        NOT NULL,
    intent_kind          TEXT        NOT NULL CHECK (intent_kind IN ('one_time', 'subscription_period', 'credit_pack')),
    amount_minor         NUMERIC(38,0) NOT NULL CHECK (amount_minor > 0),
    currency             TEXT        NOT NULL,
    network              TEXT,
    period_days          INTEGER     CHECK (period_days IS NULL OR period_days > 0),
    status               TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'succeeded', 'failed', 'expired', 'refunded',
                                             'disputed', 'partially_paid', 'overpaid',
                                             'dispute_open', 'dispute_won')),
    expires_at           TIMESTAMPTZ,
    metadata             JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_payment_intents_provider_payment
    ON payment_intents (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX idx_payment_intents_customer ON payment_intents (customer_account_id, created_at DESC);

-- Every normalised provider event, exactly once. The UNIQUE key is the idempotency guard.
CREATE TABLE payment_events (
    id                   BIGSERIAL   PRIMARY KEY,
    provider             TEXT        NOT NULL,
    provider_event_id    TEXT        NOT NULL,
    provider_payment_id  TEXT,
    canonical_ref        TEXT,
    customer_account_id  TEXT,
    product_id           TEXT,
    amount_minor         NUMERIC(38,0) NOT NULL CHECK (amount_minor >= 0),
    currency             TEXT        NOT NULL,
    network              TEXT,
    status               TEXT        NOT NULL
                           CHECK (status IN ('pending', 'succeeded', 'failed', 'expired', 'refunded',
                                             'disputed', 'partially_paid', 'overpaid',
                                             'dispute_open', 'dispute_won')),
    occurred_at          TIMESTAMPTZ NOT NULL,
    raw_hash             TEXT        NOT NULL,                -- sha256 of the verified raw body; raw is never stored
    ledger_txn_id        TEXT        REFERENCES ledger_txns(txn_id),
    received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_events_provider_event_uniq UNIQUE (provider, provider_event_id)
);
CREATE INDEX idx_payment_events_ref ON payment_events (canonical_ref);
CREATE INDEX idx_payment_events_provider_payment ON payment_events (provider, provider_payment_id);
CREATE INDEX idx_payment_events_received ON payment_events (provider, received_at);

-- Entitlements granted by payments (a period or a credit pack). Revoked, never deleted.
CREATE TABLE payment_entitlement_grants (
    id                   BIGSERIAL   PRIMARY KEY,
    payment_event_id     BIGINT      NOT NULL UNIQUE REFERENCES payment_events(id),
    canonical_ref        TEXT        NOT NULL,
    customer_account_id  TEXT        NOT NULL,
    product_id           TEXT        NOT NULL,
    grant_kind           TEXT        NOT NULL CHECK (grant_kind IN ('period', 'credits')),
    period_start         TIMESTAMPTZ,
    period_end           TIMESTAMPTZ,
    credits_minor        NUMERIC(38,0),
    currency             TEXT,
    status               TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    revoked_by_event_id  BIGINT      REFERENCES payment_events(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((grant_kind = 'period' AND period_start IS NOT NULL AND period_end > period_start)
        OR (grant_kind = 'credits' AND credits_minor > 0 AND currency IS NOT NULL))
);
CREATE INDEX idx_payment_grants_customer_product
    ON payment_entitlement_grants (customer_account_id, product_id, status, period_end DESC);

-- Daily provider ⟷ payment_events ⟷ ledger comparison runs (Wave 1.9 worker).
CREATE TABLE provider_reconciliation_runs (
    id                   BIGSERIAL   PRIMARY KEY,
    provider             TEXT        NOT NULL,
    window_start         TIMESTAMPTZ NOT NULL,
    window_end           TIMESTAMPTZ NOT NULL CHECK (window_end > window_start),
    status               TEXT        NOT NULL DEFAULT 'running'
                           CHECK (status IN ('running', 'clean', 'mismatch', 'error')),
    provider_records     INTEGER,
    payment_events       INTEGER,
    ledger_postings      INTEGER,
    mismatches           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    error                TEXT,
    started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at          TIMESTAMPTZ
);
CREATE INDEX idx_provider_recon_runs ON provider_reconciliation_runs (provider, window_end DESC);
