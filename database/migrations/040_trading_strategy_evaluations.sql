-- 040 — Trading AI: append-only strategy evaluations and go/no-go decisions. ADDITIVE ONLY.
--
-- trading_strategy_evaluations: one immutable StrategyEvaluation per backtest/walk-forward
--   run (services/trading/src/backtest/evaluation.ts). PASS rule and expiry live in code;
--   the full record is kept as JSONB (bigints as decimal strings).
-- trading_decisions: every Decision API outcome, GO or NO_GO
--   (services/trading/src/decision/go-no-go.ts). Test/demo activity only — never revenue.
--
-- Both tables are append-only: a trigger rejects UPDATE and DELETE for every role
-- (including the superuser the API still connects as — see 017), so the guarantee does
-- not depend on role grants. No existing table is altered.
-- Down: database/migrations-down/040_trading_strategy_evaluations.down.sql (local/ephemeral only).

CREATE TABLE trading_strategy_evaluations (
    evaluation_id     TEXT        PRIMARY KEY,
    result_hash       TEXT        NOT NULL CHECK (result_hash ~ '^[0-9a-f]{64}$'),
    strategy_id       TEXT        NOT NULL,
    strategy_version  TEXT        NOT NULL,
    instrument_id     TEXT        NOT NULL,
    verdict           TEXT        NOT NULL CHECK (verdict IN ('PASS', 'FAIL')),
    flags             TEXT[]      NOT NULL DEFAULT '{}',
    record            JSONB       NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL,
    expires_at        TIMESTAMPTZ NOT NULL,
    inserted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);
CREATE INDEX idx_trading_eval_latest
    ON trading_strategy_evaluations (strategy_id, strategy_version, instrument_id, created_at DESC);

CREATE TABLE trading_decisions (
    decision_id       TEXT        PRIMARY KEY,
    instrument_id     TEXT        NOT NULL,
    decided_at        TIMESTAMPTZ NOT NULL,
    strategy_id       TEXT        NOT NULL,
    strategy_version  TEXT        NOT NULL,
    evaluation_id     TEXT,       -- NULL when no evaluation existed (that decision is NO_GO)
    mode              TEXT        NOT NULL CHECK (mode IN ('MODEL_AND_BASELINE', 'BASELINE_ONLY')),
    verdict           TEXT        NOT NULL CHECK (verdict IN ('GO', 'NO_GO')),
    is_test           BOOLEAN     NOT NULL DEFAULT true,
    record            JSONB       NOT NULL,
    inserted_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trading_decisions_instrument ON trading_decisions (instrument_id, decided_at DESC);

CREATE FUNCTION trading_append_only_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER trading_strategy_evaluations_append_only
    BEFORE UPDATE OR DELETE ON trading_strategy_evaluations
    FOR EACH ROW EXECUTE FUNCTION trading_append_only_guard();
CREATE TRIGGER trading_strategy_evaluations_no_truncate
    BEFORE TRUNCATE ON trading_strategy_evaluations
    FOR EACH STATEMENT EXECUTE FUNCTION trading_append_only_guard();

CREATE TRIGGER trading_decisions_append_only
    BEFORE UPDATE OR DELETE ON trading_decisions
    FOR EACH ROW EXECUTE FUNCTION trading_append_only_guard();
CREATE TRIGGER trading_decisions_no_truncate
    BEFORE TRUNCATE ON trading_decisions
    FOR EACH STATEMENT EXECUTE FUNCTION trading_append_only_guard();
