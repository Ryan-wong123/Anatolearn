-- Preserve in-progress student responses across refreshes and device changes.
-- Only the owning student may access drafts via authenticated session routes.
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS draft_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS draft_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS draft_saved_at TIMESTAMPTZ;
