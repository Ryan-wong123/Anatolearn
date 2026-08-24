-- Records the teacher who created an annotation so mutations can enforce ownership.
ALTER TABLE annotations ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_annotations_created_by ON annotations(created_by);
