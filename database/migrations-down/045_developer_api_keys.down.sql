-- 045_developer_api_keys.down.sql — LOCAL / EPHEMERAL DATABASES ONLY.
BEGIN;
DROP TABLE IF EXISTS developer_api_key_usage;
DROP TABLE IF EXISTS developer_api_keys;
DELETE FROM schema_migrations WHERE filename = '045_developer_api_keys.sql';
COMMIT;
