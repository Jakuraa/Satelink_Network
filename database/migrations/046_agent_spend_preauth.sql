-- 046 — Release A S5: per-key agent spend pre-authorization (integer micro-USD). Default $0: any spend on a task an
-- agent created through a key needs a human approval in the console. Additive; local/CI only.
ALTER TABLE developer_api_keys
    ADD COLUMN agent_spend_preauth_minor BIGINT NOT NULL DEFAULT 0 CHECK (agent_spend_preauth_minor >= 0);
