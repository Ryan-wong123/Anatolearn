-- Idle timeout: a session that has not made a request recently is treated as expired (see src/sessionPolicy.js).
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
