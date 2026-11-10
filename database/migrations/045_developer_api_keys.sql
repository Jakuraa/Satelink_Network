-- 045 — Release A S4: developer API keys for the task API (bound to the same Better Auth principal; ADR-8).
-- Additive; local/CI only. Secrets are never stored: only a SHA-256 hash and a short display prefix.
CREATE TABLE developer_api_keys (
    key_id        TEXT        PRIMARY KEY CHECK (key_id ~ '^key_[0-9a-f]{16,32}$'),
    principal     TEXT        NOT NULL,
    name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
    prefix        TEXT        NOT NULL CHECK (char_length(prefix) BETWEEN 8 AND 24),
    key_hash      TEXT        NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
    scopes        TEXT[]      NOT NULL CHECK (scopes <@ ARRAY['tasks:create','tasks:read','tasks:approve','receipts:read','usage:read']::text[] AND cardinality(scopes) > 0),
    rate_limit_per_min INT    NOT NULL DEFAULT 60 CHECK (rate_limit_per_min BETWEEN 1 AND 6000),
    environment   TEXT        NOT NULL DEFAULT 'preview' CHECK (environment IN ('preview','beta','live')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ
);
CREATE INDEX idx_developer_api_keys_principal ON developer_api_keys (principal, created_at DESC);

CREATE TABLE developer_api_key_usage (
    key_id   TEXT  NOT NULL REFERENCES developer_api_keys (key_id),
    day      DATE  NOT NULL,
    requests BIGINT NOT NULL DEFAULT 0 CHECK (requests >= 0),
    PRIMARY KEY (key_id, day)
);
