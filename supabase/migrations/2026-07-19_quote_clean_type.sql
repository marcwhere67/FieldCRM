-- ============================================================
-- Add clean_type to quotes → drives the Scope of Work page on the quote PDF
-- ============================================================
-- Non-destructive. Nullable: NULL = "None" (no scope shown).
-- Allowed values: 'regular' | 'deep' | 'airbnb'.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS clean_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_clean_type_check'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_clean_type_check
      CHECK (clean_type IS NULL OR clean_type IN ('regular','deep','airbnb'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- ROLLBACK (only if you need to undo):
-- ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_clean_type_check;
-- ALTER TABLE quotes DROP COLUMN IF EXISTS clean_type;
-- ------------------------------------------------------------
