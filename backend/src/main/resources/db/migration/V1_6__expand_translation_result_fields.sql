ALTER TABLE translations
  ADD COLUMN explanation TEXT,
  ADD COLUMN keywords JSONB,
  ADD COLUMN alternatives JSONB,
  ADD COLUMN provider VARCHAR(100);
