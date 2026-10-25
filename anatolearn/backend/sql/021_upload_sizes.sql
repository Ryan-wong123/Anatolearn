-- Size in bytes of the uploaded file(s) behind each row, so storage per teacher and in total can be limited (src/quota.js).
-- Rows that existed before this migration start at 0; `npm run backfill:sizes` fills them in from the stored files.
ALTER TABLE models ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS file_size BIGINT NOT NULL DEFAULT 0;
