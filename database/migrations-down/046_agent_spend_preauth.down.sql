-- 046_agent_spend_preauth.down.sql — LOCAL / EPHEMERAL DATABASES ONLY.
BEGIN;
ALTER TABLE developer_api_keys DROP COLUMN IF EXISTS agent_spend_preauth_minor;
DELETE FROM schema_migrations WHERE filename = '046_agent_spend_preauth.sql';
COMMIT;
