ALTER TYPE resource_type ADD VALUE IF NOT EXISTS 'image';
ALTER TABLE models ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER CHECK (time_limit_seconds BETWEEN 30 AND 86400);
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS category VARCHAR(100);
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  questions JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS question_bank (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  format question_format NOT NULL,
  category VARCHAR(100),
  option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
  correct_option CHAR(1) CHECK (correct_option IN ('A','B','C','D')),
  model_answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION remove_content_favorites() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM favorites WHERE item_type = CASE WHEN TG_TABLE_NAME='videos' THEN 'video' ELSE 'quiz' END AND item_id=OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS videos_remove_favorites ON videos;
CREATE TRIGGER videos_remove_favorites AFTER DELETE ON videos FOR EACH ROW EXECUTE FUNCTION remove_content_favorites();
DROP TRIGGER IF EXISTS quizzes_remove_favorites ON quizzes;
CREATE TRIGGER quizzes_remove_favorites AFTER DELETE ON quizzes FOR EACH ROW EXECUTE FUNCTION remove_content_favorites();
