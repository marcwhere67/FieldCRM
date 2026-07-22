-- ============================================================================
-- DOCUMENT NUMBER RESET  (idempotent — safe to run multiple times)
-- 1. Removes the year segment from quote/invoice/job/receipt numbers
--    (was "Q-2026-0001", now "Q-0128").
-- 2. Resets the quote, invoice, job AND receipt counters (each independently)
--    so the NEXT one generated is 0128.
--    (Existing documents already issued keep their current numbers --
--    this only affects new documents going forward.)
-- Run in the Supabase SQL Editor (plain SQL tab, not the AI assistant).
-- ============================================================================

-- 1. Reshape document_counters to a single row per (org_id, doc_type),
--    dropping the legacy per-year `year` column. This runs from ANY starting
--    state (year column present or already dropped, primary key present or
--    dropped, duplicate rows or not) and always ends with a clean table keyed
--    on (org_id, doc_type) -- so it is safe to re-run after a partial attempt.
DO $$
BEGIN
  -- Snapshot the highest counter value per (org_id, doc_type). MAX() collapses
  -- any per-year rows; the year column (if present) is simply ignored.
  CREATE TEMP TABLE _dc AS
    SELECT org_id, doc_type, MAX(last_value) AS last_value
    FROM document_counters
    GROUP BY org_id, doc_type;

  ALTER TABLE document_counters DROP CONSTRAINT IF EXISTS document_counters_pkey;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_counters' AND column_name = 'year'
  ) THEN
    ALTER TABLE document_counters DROP COLUMN year;
  END IF;

  DELETE FROM document_counters;
  ALTER TABLE document_counters ADD PRIMARY KEY (org_id, doc_type);

  INSERT INTO document_counters (org_id, doc_type, last_value)
    SELECT org_id, doc_type, last_value FROM _dc;

  DROP TABLE _dc;
END $$;

-- 2. Number generator: no year segment, no year in the ON CONFLICT key.
CREATE OR REPLACE FUNCTION next_document_number(p_org uuid, p_doc_type text, p_prefix text)
RETURNS text AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO document_counters (org_id, doc_type, last_value)
  VALUES (p_org, p_doc_type, 1)
  ON CONFLICT (org_id, doc_type)
  DO UPDATE SET last_value = document_counters.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN p_prefix || '-' || LPAD(v_next::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Reset counters (per org) so the next number issued is 0128, for every
--    document type -- quote, invoice, job and receipt each start at 0128.
INSERT INTO document_counters (org_id, doc_type, last_value)
SELECT id, 'quote', 127 FROM organisations
ON CONFLICT (org_id, doc_type) DO UPDATE SET last_value = 127;

INSERT INTO document_counters (org_id, doc_type, last_value)
SELECT id, 'invoice', 127 FROM organisations
ON CONFLICT (org_id, doc_type) DO UPDATE SET last_value = 127;

INSERT INTO document_counters (org_id, doc_type, last_value)
SELECT id, 'job', 127 FROM organisations
ON CONFLICT (org_id, doc_type) DO UPDATE SET last_value = 127;

INSERT INTO document_counters (org_id, doc_type, last_value)
SELECT id, 'receipt', 127 FROM organisations
ON CONFLICT (org_id, doc_type) DO UPDATE SET last_value = 127;
