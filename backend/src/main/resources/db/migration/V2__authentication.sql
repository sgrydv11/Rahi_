ALTER TABLE users ADD COLUMN role VARCHAR(10) NOT NULL DEFAULT 'USER'
    CHECK (role IN ('USER', 'ADMIN'));

CREATE TABLE refresh_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX refresh_sessions_user_idx ON refresh_sessions(user_id);

-- Retain consumed hashes until the family expires so replay revokes the whole family.
CREATE TABLE refresh_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES refresh_sessions(id) ON DELETE RESTRICT,
    consumed BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX refresh_tokens_session_idx ON refresh_tokens(session_id);
