ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMPTZ;
UPDATE quiz_sessions SET session_expires_at = GREATEST(started_at + INTERVAL '24 hours', expires_at + INTERVAL '10 seconds') WHERE session_expires_at IS NULL;
ALTER TABLE quiz_sessions ALTER COLUMN session_expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');
ALTER TABLE quiz_sessions ALTER COLUMN session_expires_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS quiz_sessions_cleanup_idx ON quiz_sessions (session_expires_at) WHERE submitted_at IS NULL;
CREATE INDEX IF NOT EXISTS quiz_sessions_retention_idx ON quiz_sessions (submitted_at) WHERE submitted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_sessions_cleanup_idx ON auth_sessions (expires_at);
