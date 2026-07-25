-- Adds video-to-annotation linking (Task 7.6 — the teacher-facing half,
-- owned by Videos.tsx). Additive only, same pattern as 003/004/005.
--
-- Direction: the FK lives on `videos` (pointing at the annotation it
-- explains), matching the original tasks.md spec's `videos.linked_label_id`
-- design — just renamed and pointed at the real `annotations` table
-- instead of the never-built `labels` table.
--
-- Task 7.5 (showing the linked video inside Viewer.tsx when an annotation
-- is selected) is NOT part of this migration or this feature slice — that's
-- Tim's half, built separately in Viewer.tsx once this field exists for him
-- to query against (`SELECT * FROM videos WHERE annotation_id = <id>`).
--
-- To apply on an existing dev database:
--   Get-Content backend/sql/006_add_video_annotation_link.sql | docker compose exec -T postgres psql -U anatolearn -d anatolearn

ALTER TABLE videos ADD COLUMN IF NOT EXISTS annotation_id INTEGER REFERENCES annotations(id) ON DELETE SET NULL;
