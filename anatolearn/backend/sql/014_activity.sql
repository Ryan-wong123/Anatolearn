CREATE TABLE IF NOT EXISTS user_activity (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('model', 'video', 'quiz', 'resource')),
  item_id INTEGER NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 1,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS user_activity_recent_idx ON user_activity (user_id, last_viewed_at DESC);
