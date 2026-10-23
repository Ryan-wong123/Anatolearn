ALTER TABLE user_activity ADD COLUMN IF NOT EXISTS position_seconds REAL NOT NULL DEFAULT 0 CHECK (position_seconds >= 0);
