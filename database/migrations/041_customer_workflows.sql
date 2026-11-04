-- 041 — Customer workflows (Strategy Lab, Agent Marketplace). ADDITIVE ONLY.
--
-- Two groups of tables:
--
-- 1. wf_journal / wf_idempotency / wf_suppliers / wf_dlq — the durable store of the
--    workflow RoutingKernel (apps/api/src/vnext/reliability/pg_durable_store.js with
--    prefix 'wf_'). Same shape as the vnext_* tables, but a SEPARATE hash chain: the
--    journal keeps its chain tail in memory, so two journals must never share a table.
--
-- 2. workflow_* — the customer-facing read model: who owns which run, its status,
--    quote, approval, result, receipt and cost. Queried with the owner (principal) in
--    every WHERE clause. The audit trail is the wf_journal hash chain (stream = run id
--    for kernel phases, 'run:<id>' for lifecycle events).
--
-- NOT a ledger. No balance lives here and nothing here is revenue: workflow_usage_records
-- has a CHECK that counted_as_revenue is false. Money, if ever charged, moves through the
-- Financial OS (reserve/capture/release) and revenue_events_v2 — never through these tables.
-- Strategy Lab evaluations are stored in trading_strategy_evaluations (migration 040).
-- Receipts are append-only (trigger), like 040.
-- Down: database/migrations-down/041_customer_workflows.down.sql (local/ephemeral only).

-- ---------- workflow kernel durable store (prefix wf_) ----------
CREATE TABLE wf_journal (
    seq          BIGSERIAL PRIMARY KEY,
    stream_id    TEXT   NOT NULL,
    phase        TEXT   NOT NULL,
    payload      JSONB  NOT NULL,
    ts           BIGINT NOT NULL,
    hash_prev    TEXT   NOT NULL,
    hash_current TEXT   NOT NULL
);
CREATE INDEX idx_wf_journal_stream ON wf_journal (stream_id, seq);

CREATE TABLE wf_idempotency (
    key      TEXT PRIMARY KEY,
    result   JSONB  NOT NULL,
    created  BIGINT NOT NULL
);

CREATE TABLE wf_suppliers (
    supplier_id TEXT PRIMARY KEY,
    snapshot    JSONB  NOT NULL,
    updated_at  BIGINT NOT NULL
);

CREATE TABLE wf_dlq (
    tx_id     TEXT PRIMARY KEY,
    reason    TEXT   NOT NULL,
    attempts  INT    NOT NULL,
    request   JSONB  NOT NULL,
    failed_at BIGINT NOT NULL
);

-- ---------- customer read model ----------
CREATE TABLE workflow_definitions (
    template_id  TEXT        NOT NULL,
    version      INT         NOT NULL CHECK (version > 0),
    definition   JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (template_id, version)
);

-- A customer's saved strategy specs (satelink.strategy/v1). One row per (owner, spec id);
-- the spec id is a content hash, so the same spec saved twice is the same row.
CREATE TABLE workflow_strategies (
    principal    TEXT        NOT NULL CHECK (char_length(principal) BETWEEN 3 AND 200),
    strategy_id  TEXT        NOT NULL CHECK (strategy_id ~ '^strat_[0-9a-f]{16}$'),
    name         TEXT        NOT NULL,
    spec         JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (principal, strategy_id)
);

CREATE TABLE workflow_runs (
    run_id            TEXT        PRIMARY KEY CHECK (run_id ~ '^run_[0-9a-f]{8,64}$'),
    principal         TEXT        NOT NULL CHECK (char_length(principal) BETWEEN 3 AND 200),
    idempotency_key   TEXT        NOT NULL,
    template_id       TEXT        NOT NULL,
    template_version  INT         NOT NULL,
    status            TEXT        NOT NULL CHECK (status IN ('running', 'awaiting_approval', 'completed', 'failed', 'blocked', 'cancelled')),
    strategy_id       TEXT,
    capability        TEXT,
    network           TEXT,
    input             JSONB       NOT NULL,
    request           JSONB,      -- kernel request (server-built, never client-supplied)
    quote             JSONB       NOT NULL,
    approval          JSONB       NOT NULL,
    blocked           JSONB,
    budget_micros     BIGINT      CHECK (budget_micros IS NULL OR budget_micros >= 0),
    budget_hold       JSONB       NOT NULL,
    result            JSONB,
    receipt_id        TEXT,
    error             JSONB,
    decision          JSONB,
    is_simulation     BOOLEAN     NOT NULL,
    is_test_data      BOOLEAN     NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL,
    FOREIGN KEY (template_id, template_version) REFERENCES workflow_definitions (template_id, version),
    UNIQUE (principal, idempotency_key)
);
CREATE INDEX idx_workflow_runs_owner ON workflow_runs (principal, created_at DESC);
CREATE INDEX idx_workflow_runs_open ON workflow_runs (status) WHERE status = 'running';

CREATE TABLE workflow_run_steps (
    run_id      TEXT        NOT NULL REFERENCES workflow_runs (run_id),
    node_id     TEXT        NOT NULL,
    status      TEXT        NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (run_id, node_id)
);

-- Cost / usage per completed run. Supplier references, quoted and charged amounts in
-- integer micro-USD. Never revenue (CHECK), test data by default.
CREATE TABLE workflow_usage_records (
    run_id                 TEXT        PRIMARY KEY REFERENCES workflow_runs (run_id),
    principal              TEXT        NOT NULL,
    offer_id               TEXT        NOT NULL,
    capability             TEXT        NOT NULL,
    supplier_cost_micros   BIGINT      NOT NULL CHECK (supplier_cost_micros >= 0),
    customer_charge_micros BIGINT      NOT NULL CHECK (customer_charge_micros >= 0),
    list_price_micros      BIGINT      CHECK (list_price_micros IS NULL OR list_price_micros >= 0),
    pricing_approved       BOOLEAN     NOT NULL,
    money_moved            BOOLEAN     NOT NULL DEFAULT false CHECK (money_moved = false),
    counted_as_revenue     BOOLEAN     NOT NULL DEFAULT false CHECK (counted_as_revenue = false),
    is_test_data           BOOLEAN     NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_receipts (
    receipt_id  TEXT        PRIMARY KEY CHECK (receipt_id ~ '^rcpt_[0-9a-f]{8,64}$'),
    run_id      TEXT        NOT NULL UNIQUE REFERENCES workflow_runs (run_id),
    principal   TEXT        NOT NULL,
    body        JSONB       NOT NULL,
    body_sha256 TEXT        NOT NULL CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
    issued_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_workflow_receipts_owner ON workflow_receipts (principal, issued_at DESC);

CREATE FUNCTION workflow_receipts_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'workflow_receipts is append-only (% rejected)', TG_OP;
END;
$$;
CREATE TRIGGER workflow_receipts_no_update BEFORE UPDATE OR DELETE ON workflow_receipts
    FOR EACH ROW EXECUTE FUNCTION workflow_receipts_append_only();
CREATE TRIGGER workflow_receipts_no_truncate BEFORE TRUNCATE ON workflow_receipts
    FOR EACH STATEMENT EXECUTE FUNCTION workflow_receipts_append_only();

-- The journal is append-only too (the hash chain is verified on every boot).
CREATE FUNCTION wf_journal_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'wf_journal is append-only (% rejected)', TG_OP;
END;
$$;
CREATE TRIGGER wf_journal_no_update BEFORE UPDATE OR DELETE ON wf_journal
    FOR EACH ROW EXECUTE FUNCTION wf_journal_append_only();
CREATE TRIGGER wf_journal_no_truncate BEFORE TRUNCATE ON wf_journal
    FOR EACH STATEMENT EXECUTE FUNCTION wf_journal_append_only();
