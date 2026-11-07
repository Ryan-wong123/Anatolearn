-- Preserve the teacher's reference projection with each graded region answer.
-- Existing attempts remain valid; no data or tables are deleted.
ALTER TABLE quiz_attempt_answers
  ADD COLUMN IF NOT EXISTS region_review JSONB;
