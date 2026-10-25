-- Content ownership: only the teacher who created a model, video, quiz, resource or question-bank entry may change it, grade
-- its attempts or see its answer keys. Existing rows have no recorded owner, so they stay NULL ("unclaimed"): any teacher may
-- manage and claim them, and an administrator can assign them in bulk (Users -> Assign unclaimed content).
-- A teacher who is deleted leaves their content unclaimed (ON DELETE SET NULL) instead of destroying it.
-- announcements already records its author in created_by and uses the same rules.
ALTER TABLE models ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS models_owner_idx ON models (owner_id);
CREATE INDEX IF NOT EXISTS videos_owner_idx ON videos (owner_id);
CREATE INDEX IF NOT EXISTS quizzes_owner_idx ON quizzes (owner_id);
CREATE INDEX IF NOT EXISTS resources_owner_idx ON resources (owner_id);
CREATE INDEX IF NOT EXISTS question_bank_owner_idx ON question_bank (owner_id);
CREATE INDEX IF NOT EXISTS announcements_created_by_idx ON announcements (created_by);
