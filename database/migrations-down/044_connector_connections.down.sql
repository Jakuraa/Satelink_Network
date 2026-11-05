-- 044_connector_connections.down.sql — LOCAL / EPHEMERAL DATABASES ONLY.
BEGIN;
DROP TABLE IF EXISTS connector_connections;
DROP TABLE IF EXISTS connector_oauth_states;
DELETE FROM schema_migrations WHERE filename = '044_connector_connections.sql';
COMMIT;
