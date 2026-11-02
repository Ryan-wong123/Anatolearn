-- Random generations prevent version reuse after Redis eviction or cache restart.
-- Flush Redis when restoring a database snapshot into a running environment.
CREATE TABLE IF NOT EXISTS cache_versions (
  name TEXT PRIMARY KEY,
  version UUID NOT NULL DEFAULT gen_random_uuid(),
  last_transaction XID8
);
ALTER TABLE cache_versions ADD COLUMN IF NOT EXISTS last_transaction XID8;
INSERT INTO cache_versions(name) VALUES ('programs'), ('catalog'), ('annotations'), ('stats') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION bump_cache_versions() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- All invalidation locks are acquired only after business DML has finished.
  -- One commit-time lock orders multiple domain updates across transactions.
  PERFORM pg_advisory_xact_lock(71212, 23);
  UPDATE cache_versions SET version = gen_random_uuid(), last_transaction = pg_current_xact_id()
    WHERE name = ANY(TG_ARGV) AND last_transaction IS DISTINCT FROM pg_current_xact_id();
  RETURN NULL;
END;
$$;

-- Deferred row triggers cover cascades, bulk ownership changes and direct SQL.
-- Update each domain once per transaction, without retaining cache locks during DML.
DROP TRIGGER IF EXISTS cache_programs ON programs;
CREATE CONSTRAINT TRIGGER cache_programs AFTER INSERT OR UPDATE OR DELETE ON programs
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('programs', 'catalog', 'stats');
DROP TRIGGER IF EXISTS cache_models ON models;
CREATE CONSTRAINT TRIGGER cache_models AFTER INSERT OR UPDATE OR DELETE ON models
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('catalog', 'annotations');
DROP TRIGGER IF EXISTS cache_videos ON videos;
CREATE CONSTRAINT TRIGGER cache_videos AFTER INSERT OR UPDATE OR DELETE ON videos
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('catalog');
DROP TRIGGER IF EXISTS cache_resources ON resources;
CREATE CONSTRAINT TRIGGER cache_resources AFTER INSERT OR UPDATE OR DELETE ON resources
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('catalog');
DROP TRIGGER IF EXISTS cache_quizzes ON quizzes;
CREATE CONSTRAINT TRIGGER cache_quizzes AFTER INSERT OR UPDATE OR DELETE ON quizzes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('catalog', 'stats');
DROP TRIGGER IF EXISTS cache_annotations ON annotations;
CREATE CONSTRAINT TRIGGER cache_annotations AFTER INSERT OR UPDATE OR DELETE ON annotations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('annotations');
DROP TRIGGER IF EXISTS cache_users ON users;
CREATE CONSTRAINT TRIGGER cache_users AFTER INSERT OR UPDATE OR DELETE ON users
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('catalog', 'stats');
DROP TRIGGER IF EXISTS cache_attempts ON quiz_attempts;
CREATE CONSTRAINT TRIGGER cache_attempts AFTER INSERT OR UPDATE OR DELETE ON quiz_attempts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('stats');
DROP TRIGGER IF EXISTS cache_answers ON quiz_attempt_answers;
CREATE CONSTRAINT TRIGGER cache_answers AFTER INSERT OR UPDATE OR DELETE ON quiz_attempt_answers
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('stats');
DROP TRIGGER IF EXISTS cache_questions ON quiz_questions;
CREATE CONSTRAINT TRIGGER cache_questions AFTER INSERT OR UPDATE OR DELETE ON quiz_questions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION bump_cache_versions('stats');

DROP TRIGGER IF EXISTS cache_truncate_programs ON programs;
CREATE TRIGGER cache_truncate_programs AFTER TRUNCATE ON programs
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('programs', 'catalog', 'stats');
DROP TRIGGER IF EXISTS cache_truncate_models ON models;
CREATE TRIGGER cache_truncate_models AFTER TRUNCATE ON models
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('catalog', 'annotations');
DROP TRIGGER IF EXISTS cache_truncate_videos ON videos;
CREATE TRIGGER cache_truncate_videos AFTER TRUNCATE ON videos
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('catalog');
DROP TRIGGER IF EXISTS cache_truncate_resources ON resources;
CREATE TRIGGER cache_truncate_resources AFTER TRUNCATE ON resources
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('catalog');
DROP TRIGGER IF EXISTS cache_truncate_quizzes ON quizzes;
CREATE TRIGGER cache_truncate_quizzes AFTER TRUNCATE ON quizzes
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('catalog', 'stats');
DROP TRIGGER IF EXISTS cache_truncate_annotations ON annotations;
CREATE TRIGGER cache_truncate_annotations AFTER TRUNCATE ON annotations
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('annotations');
DROP TRIGGER IF EXISTS cache_truncate_users ON users;
CREATE TRIGGER cache_truncate_users AFTER TRUNCATE ON users
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('catalog', 'stats');
DROP TRIGGER IF EXISTS cache_truncate_quiz_attempts ON quiz_attempts;
CREATE TRIGGER cache_truncate_quiz_attempts AFTER TRUNCATE ON quiz_attempts
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('stats');
DROP TRIGGER IF EXISTS cache_truncate_quiz_attempt_answers ON quiz_attempt_answers;
CREATE TRIGGER cache_truncate_quiz_attempt_answers AFTER TRUNCATE ON quiz_attempt_answers
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('stats');
DROP TRIGGER IF EXISTS cache_truncate_quiz_questions ON quiz_questions;
CREATE TRIGGER cache_truncate_quiz_questions AFTER TRUNCATE ON quiz_questions
  FOR EACH STATEMENT EXECUTE FUNCTION bump_cache_versions('stats');

-- Runtime triggers execute as the application role, which needs to update versions.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anatolearn_app') THEN
    GRANT SELECT, UPDATE ON cache_versions TO anatolearn_app;
  END IF;
END $$;
