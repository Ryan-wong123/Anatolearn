-- Adds real student attribution to quiz_attempts (Task 8.8), now unblocked
-- since Week 9 auth exists. Additive only, same pattern as 003/004.
--
-- To apply on an existing dev database:
--   Get-Content backend/sql/005_add_quiz_attempt_student_id.sql | docker compose exec -T postgres psql -U anatolearn -d anatolearn
--
-- Existing attempt rows (created before auth existed) will have
-- student_id = NULL — there's no way to retroactively attribute them to a
-- real student, since they were genuinely anonymous when created.

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
