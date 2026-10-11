-- 037_trading_trace_coverage — Phase 6 item 14 (full-loop trace + Mode B execution event)
--
-- 1. The Phase 6 tables join the 029 trace model, so ONE trace id ties a whole loop together:
--    decision → proposal → (approval) → order → fills → memory → usage. Same columns and the same
--    trading_stamp_trace() trigger as 029: stamped from the session trace context (tracedPool);
--    untraced writes stay NULL.
-- 2. trading_proposal_events gains the action 'mode_b_executed': a Mode B candidate submitted
--    without a per-order click (Phase 6 item 12 rule, decided by the risk engine).
--
-- * Additive. Depends on 029, 033, 034, 035, 036.
-- * Down: database/migrations-down/037_trading_trace_coverage.down.sql (local/ephemeral only).
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['trading_decisions', 'trading_proposals', 'trading_proposal_events', 'decision_memory', 'trade_memory', 'trading_agent_usage'] LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN trace_id TEXT CHECK (trace_id ~ ''^[0-9a-f]{32}$'' AND trace_id <> ''00000000000000000000000000000000'')', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN span_id TEXT CHECK (span_id ~ ''^[0-9a-f]{16}$'')', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN parent_span_id TEXT CHECK (parent_span_id ~ ''^[0-9a-f]{16}$'')', t);
        EXECUTE format('CREATE INDEX %I ON %I (trace_id) WHERE trace_id IS NOT NULL', 'idx_' || t || '_trace', t);
        EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trading_stamp_trace()', t || '_trace', t);
    END LOOP;
END
$$;

ALTER TABLE trading_proposal_events DROP CONSTRAINT trading_proposal_events_action_check;
ALTER TABLE trading_proposal_events ADD CONSTRAINT trading_proposal_events_action_check
    CHECK (action IN ('created', 'approved', 'rejected', 'expired', 'execution_refused', 'mode_b_executed'));
