-- Rollback for 037_trading_trace_coverage (local / ephemeral databases only). Run before 036's down.
DELETE FROM schema_migrations WHERE filename = '037_trading_trace_coverage.sql';
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['trading_decisions', 'trading_proposals', 'trading_proposal_events', 'decision_memory', 'trade_memory', 'trading_agent_usage'] LOOP
        IF to_regclass(t) IS NOT NULL THEN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_trace', t);
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS parent_span_id, DROP COLUMN IF EXISTS span_id, DROP COLUMN IF EXISTS trace_id', t);
        END IF;
    END LOOP;
END
$$;
DO $$
BEGIN
    IF to_regclass('trading_proposal_events') IS NOT NULL THEN
        ALTER TABLE trading_proposal_events DROP CONSTRAINT IF EXISTS trading_proposal_events_action_check;
        ALTER TABLE trading_proposal_events ADD CONSTRAINT trading_proposal_events_action_check
            CHECK (action IN ('created', 'approved', 'rejected', 'expired', 'execution_refused'));
    END IF;
END
$$;
