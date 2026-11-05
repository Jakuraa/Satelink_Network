-- 043 — Release A task lifecycle, unified capability registry, quotes, simulated reservations, revenue truth.
--
-- Additive only (new columns default/nullable, new tables, new view). Applied ONLY to local and CI databases;
-- production apply is a founder decision (OB-8, ADR-5 in docs/build/DECISION_LOG.md).
--
-- R5: every money row carries origin ∈ {external, founder, test, demo, simulated, promotional} and
-- environment ∈ {preview, beta, live}. Revenue = origin='external' AND environment='live' ONLY (view below).
-- Existing ledger rows keep origin/environment NULL = historical/unclassified and are excluded from revenue.

-- ── workflow_runs: the mandate lifecycle on #609's run table (one engine, R1) ──────────────────────────
ALTER TABLE workflow_runs
    ADD COLUMN state       TEXT CHECK (state IS NULL OR state IN (
        'CREATED','UNDERSTANDING','PLANNING','AWAITING_INPUT','QUOTED','AWAITING_APPROVAL','AUTHORIZED',
        'RESERVED','EXECUTING','VERIFYING','SUCCEEDED','REJECTED','FAILED','CANCELLED','EXPIRED',
        'PARTIALLY_SUCCEEDED','REQUIRES_RECONCILIATION','UNKNOWN_EXECUTION_OUTCOME')),
    ADD COLUMN version     BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    ADD COLUMN tenant_id   TEXT,
    ADD COLUMN actor_type  TEXT CHECK (actor_type IS NULL OR actor_type IN ('human','developer','agent','machine')),
    ADD COLUMN environment TEXT NOT NULL DEFAULT 'preview' CHECK (environment IN ('preview','beta','live')),
    ADD COLUMN origin      TEXT NOT NULL DEFAULT 'test'
        CHECK (origin IN ('external','founder','test','demo','simulated','promotional')),
    ADD COLUMN intent      TEXT,
    ADD COLUMN plan        JSONB,
    ADD COLUMN quote_id    TEXT,
    ADD COLUMN expires_at  TIMESTAMPTZ;

CREATE INDEX idx_workflow_runs_state ON workflow_runs (state) WHERE state IS NOT NULL;
CREATE INDEX idx_workflow_runs_tenant ON workflow_runs (tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;

-- ── workflow_run_steps: per-step effect bookkeeping (R6) ───────────────────────────────────────────────
ALTER TABLE workflow_run_steps
    ADD COLUMN step_no         INT,
    ADD COLUMN capability_id   TEXT,
    ADD COLUMN provider_id     TEXT,
    ADD COLUMN idempotency_key TEXT,
    ADD COLUMN attempts        INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    ADD COLUMN last_error_code TEXT,
    ADD COLUMN result          JSONB,
    ADD COLUMN verified_at     TIMESTAMPTZ;

CREATE UNIQUE INDEX uq_workflow_run_steps_idem ON workflow_run_steps (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ── capability_registry: ONE registry (R1/R9), seeded from config, read by every surface ───────────────
CREATE TABLE capability_registry (
    id             TEXT        NOT NULL CHECK (id ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'),
    version        INT         NOT NULL CHECK (version >= 1),
    entry          JSONB       NOT NULL,
    release_status TEXT        NOT NULL CHECK (release_status IN ('LIVE','PREVIEW','SIMULATED','COMING_SOON')),
    internal_only  BOOLEAN     NOT NULL DEFAULT false,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, version)
);

-- ── workflow_quotes: immutable priced offers (integer minor units, R4) ─────────────────────────────────
CREATE TABLE workflow_quotes (
    quote_id           TEXT        PRIMARY KEY CHECK (quote_id ~ '^q_[0-9a-f]{16,64}$'),
    run_id             TEXT        NOT NULL REFERENCES workflow_runs (run_id),
    version            INT         NOT NULL CHECK (version >= 1),
    currency           TEXT        NOT NULL CHECK (currency IN ('USD')),
    minor_decimals     SMALLINT    NOT NULL CHECK (minor_decimals = 6),
    lines              JSONB       NOT NULL,
    supplier_cost_minor BIGINT     NOT NULL CHECK (supplier_cost_minor >= 0),
    satelink_fee_minor BIGINT      NOT NULL CHECK (satelink_fee_minor >= 0),
    tax_minor          BIGINT      NOT NULL CHECK (tax_minor >= 0),
    total_minor        BIGINT      NOT NULL CHECK (total_minor = supplier_cost_minor + satelink_fee_minor + tax_minor),
    -- What Satelink credits pay (its own fee only); the merchant/supplier amount is paid by the user directly.
    credit_charge_minor BIGINT     NOT NULL CHECK (credit_charge_minor >= 0 AND credit_charge_minor <= total_minor),
    fee_policy_status  TEXT        NOT NULL CHECK (fee_policy_status = 'PROPOSED — NOT APPROVED'),
    disclosure         TEXT        NOT NULL,
    expires_at         TIMESTAMPTZ NOT NULL,
    origin             TEXT        NOT NULL CHECK (origin IN ('external','founder','test','demo','simulated','promotional')),
    environment        TEXT        NOT NULL CHECK (environment IN ('preview','beta','live')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, version)
);

CREATE FUNCTION workflow_quotes_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'workflow_quotes is immutable (re-quote creates a new version)'; END $$;
CREATE TRIGGER workflow_quotes_no_update BEFORE UPDATE OR DELETE ON workflow_quotes
    FOR EACH ROW EXECUTE FUNCTION workflow_quotes_immutable();

-- ── ledger_txns: provenance tags (nullable; NULL = historical/unclassified) ────────────────────────────
ALTER TABLE ledger_txns
    ADD COLUMN origin      TEXT CHECK (origin IS NULL OR origin IN ('external','founder','test','demo','simulated','promotional')),
    ADD COLUMN environment TEXT CHECK (environment IS NULL OR environment IN ('preview','beta','live'));
-- Reservation postings must always be tagged (no historical rows have ref_type 'reservation').
ALTER TABLE ledger_txns ADD CONSTRAINT ledger_txns_reservation_tagged
    CHECK (ref_type <> 'reservation' OR (origin IS NOT NULL AND environment IS NOT NULL));

-- ── workflow_reservations: one reservation per run (hold → capture | release | expire) ─────────────────
CREATE TABLE workflow_reservations (
    reservation_id   TEXT        PRIMARY KEY CHECK (reservation_id ~ '^rsv_[0-9a-f]{16,64}$'),
    run_id           TEXT        NOT NULL UNIQUE REFERENCES workflow_runs (run_id),
    quote_id         TEXT        NOT NULL REFERENCES workflow_quotes (quote_id),
    customer_account TEXT        NOT NULL REFERENCES accounts (id),
    holds_account    TEXT        NOT NULL REFERENCES accounts (id),
    revenue_account  TEXT        NOT NULL REFERENCES accounts (id),
    currency         TEXT        NOT NULL,
    amount_minor     BIGINT      NOT NULL CHECK (amount_minor > 0),
    captured_minor   BIGINT      CHECK (captured_minor IS NULL OR (captured_minor >= 0 AND captured_minor <= amount_minor)),
    state            TEXT        NOT NULL CHECK (state IN ('held','captured','released','expired')),
    idempotency_key  TEXT        NOT NULL UNIQUE,
    hold_txn_id      TEXT        NOT NULL REFERENCES ledger_txns (txn_id),
    settle_txn_id    TEXT        REFERENCES ledger_txns (txn_id),
    origin           TEXT        NOT NULL CHECK (origin IN ('external','founder','test','demo','simulated','promotional')),
    environment      TEXT        NOT NULL CHECK (environment IN ('preview','beta','live')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at       TIMESTAMPTZ,
    CHECK ((state = 'held') = (settle_txn_id IS NULL)),
    CHECK ((state = 'captured') = (captured_minor IS NOT NULL))
);

-- ── revenue_truth: the ONLY revenue definition for Release A surfaces ──────────────────────────────────
-- Posted credits to revenue accounts in transactions tagged external + live. Preview data can never match.
CREATE VIEW revenue_truth AS
SELECT e.currency,
       COALESCE(SUM(e.amount), 0)::numeric AS revenue_minor,
       COUNT(DISTINCT t.txn_id)            AS transactions
  FROM ledger_entries e
  JOIN ledger_txns t ON t.txn_id = e.txn_id
  JOIN accounts a    ON a.id = e.account_id
 WHERE t.origin = 'external' AND t.environment = 'live'
   AND e.direction = 'credit' AND e.state = 'posted' AND a.kind = 'revenue'
 GROUP BY e.currency;
