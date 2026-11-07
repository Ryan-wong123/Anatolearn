-- Safe, additive migration: does not alter existing quiz attempts or annotations.
ALTER TYPE question_format ADD VALUE IF NOT EXISTS 'region_identification';
ALTER TYPE question_format ADD VALUE IF NOT EXISTS 'annotation_matching';
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_config JSONB;
ALTER TABLE quiz_attempt_answers ADD COLUMN IF NOT EXISTS answer_json JSONB;
