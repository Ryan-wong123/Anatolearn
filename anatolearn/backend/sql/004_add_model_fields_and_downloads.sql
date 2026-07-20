-- Adds body_system/body_part to models (Tasks 4.1/4.3/4.4) and a downloads
-- log table (Task 10.1). Additive only, like 003_add_users.sql — safe to run
-- against an existing database.
--
-- To apply on an existing dev database:
--   docker compose exec -T postgres psql -U anatolearn -d anatolearn < backend/sql/004_add_model_fields_and_downloads.sql
--
-- (On Windows PowerShell, use:
--   Get-Content backend/sql/004_add_model_fields_and_downloads.sql | docker compose exec -T postgres psql -U anatolearn -d anatolearn
-- — PowerShell doesn't support `<` file redirection the way bash does.)

ALTER TABLE models ADD COLUMN IF NOT EXISTS body_system VARCHAR(100);
ALTER TABLE models ADD COLUMN IF NOT EXISTS body_part VARCHAR(100);

CREATE TABLE IF NOT EXISTS downloads (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    downloaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
