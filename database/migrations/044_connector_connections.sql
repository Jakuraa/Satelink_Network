-- 044 — Release A S2: per-user connector connections (OAuth 2.1 + PKCE) for MCP connectors.
-- Additive; local/CI only (production apply = founder decision).
-- Tokens are stored ENCRYPTED (AES-256-GCM, key outside the database); verifiers are single-use and short-lived.

CREATE TABLE connector_oauth_states (
    state          TEXT        PRIMARY KEY CHECK (char_length(state) BETWEEN 32 AND 128),
    principal      TEXT        NOT NULL,
    connector_id   TEXT        NOT NULL,
    code_verifier  TEXT        NOT NULL CHECK (code_verifier ~ '^[A-Za-z0-9._~-]{43,128}$'),
    redirect_uri   TEXT        NOT NULL,
    return_to      TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,
    used_at        TIMESTAMPTZ
);

CREATE TABLE connector_connections (
    principal      TEXT        NOT NULL,
    connector_id   TEXT        NOT NULL,
    scopes         TEXT        NOT NULL,
    token_ciphertext TEXT      NOT NULL,
    token_iv       TEXT        NOT NULL,
    token_tag      TEXT        NOT NULL,
    expires_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at     TIMESTAMPTZ,
    environment    TEXT        NOT NULL DEFAULT 'preview' CHECK (environment IN ('preview','beta','live')),
    PRIMARY KEY (principal, connector_id)
);
