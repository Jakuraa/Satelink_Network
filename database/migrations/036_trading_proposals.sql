-- 036_trading_proposals — Phase 6 item 13 (proposal review queue; replaces the Stage 24 501s)
--
-- Proposals from agents, machines and the assistant wait here for a HUMAN decision. Approval needs
-- step-up (enforced by the API) and turns an order proposal into a human-approved order intent that
-- goes through OMS acceptance → the full risk engine. The status column moves once
-- (pending_review → approved | rejected | expired); every transition is ALSO an append-only event.
--
-- * Additive. Depends on 001 (principals) and 029 (guard).
-- * Down: database/migrations-down/036_trading_proposals.down.sql (local/ephemeral only).
CREATE TABLE trading_proposals (
    id                 TEXT        PRIMARY KEY,                       -- 'prp_…'
    principal_id       TEXT        NOT NULL REFERENCES principals(id), -- the human who must decide
    proposed_by        TEXT        NOT NULL,                          -- agent / machine / assistant principal or run
    proposed_by_kind   TEXT        NOT NULL CHECK (proposed_by_kind IN ('agent', 'machine', 'assistant', 'human')),
    kind               TEXT        NOT NULL CHECK (kind IN ('order', 'strategy', 'cancel', 'alert', 'note')),
    mandate_id         TEXT,
    decision_id        TEXT,
    execution_path     TEXT        NOT NULL DEFAULT 'human_review' CHECK (execution_path IN ('human_review', 'mode_b_candidate')),
    payload            JSONB       NOT NULL,
    rationale          TEXT        CHECK (char_length(rationale) <= 2000),
    status             TEXT        NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'expired')),
    result_ref         TEXT,                                          -- order id / strategy version id on approval
    created_at         TIMESTAMPTZ NOT NULL,
    expires_at         TIMESTAMPTZ NOT NULL,
    decided_at         TIMESTAMPTZ,
    CHECK (expires_at > created_at),
    CHECK ((status = 'pending_review') = (decided_at IS NULL)),
    CHECK (kind <> 'order' OR mandate_id IS NOT NULL)
);
CREATE INDEX idx_trading_proposals_principal ON trading_proposals (principal_id, status, created_at DESC);

CREATE TABLE trading_proposal_events (
    id               BIGSERIAL   PRIMARY KEY,
    proposal_id      TEXT        NOT NULL REFERENCES trading_proposals(id),
    action           TEXT        NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'expired', 'execution_refused')),
    actor_id         TEXT        NOT NULL,
    step_up_method   TEXT,
    detail           JSONB,
    at               TIMESTAMPTZ NOT NULL,
    CHECK (action <> 'approved' OR step_up_method IS NOT NULL)
);
CREATE INDEX idx_trading_proposal_events_proposal ON trading_proposal_events (proposal_id, id);

CREATE TRIGGER trading_proposal_events_append_only BEFORE UPDATE OR DELETE ON trading_proposal_events FOR EACH ROW EXECUTE FUNCTION trading_append_only_guard();
CREATE TRIGGER trading_proposal_events_no_truncate BEFORE TRUNCATE ON trading_proposal_events FOR EACH STATEMENT EXECUTE FUNCTION trading_append_only_guard();
REVOKE UPDATE, DELETE, TRUNCATE ON trading_proposal_events FROM PUBLIC;
REVOKE DELETE, TRUNCATE ON trading_proposals FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'satelink_app') THEN
        EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON trading_proposal_events FROM satelink_app';
        EXECUTE 'REVOKE DELETE, TRUNCATE ON trading_proposals FROM satelink_app';
    END IF;
END
$$;
