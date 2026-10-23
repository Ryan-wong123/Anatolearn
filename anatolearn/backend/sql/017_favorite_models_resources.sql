ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_item_type_check;
ALTER TABLE favorites ADD CONSTRAINT favorites_item_type_check CHECK (item_type IN ('video', 'quiz', 'model', 'resource'));

CREATE OR REPLACE FUNCTION remove_content_favorites() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM favorites WHERE item_type = CASE TG_TABLE_NAME
      WHEN 'videos' THEN 'video' WHEN 'models' THEN 'model' WHEN 'resources' THEN 'resource' ELSE 'quiz' END
    AND item_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS models_remove_favorites ON models;
CREATE TRIGGER models_remove_favorites AFTER DELETE ON models FOR EACH ROW EXECUTE FUNCTION remove_content_favorites();
DROP TRIGGER IF EXISTS resources_remove_favorites ON resources;
CREATE TRIGGER resources_remove_favorites AFTER DELETE ON resources FOR EACH ROW EXECUTE FUNCTION remove_content_favorites();
