-- Optional authenticated WebVTT captions for educational videos.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS captions_path TEXT;
