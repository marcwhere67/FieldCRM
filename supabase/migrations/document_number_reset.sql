-- ============================================================================
-- DOCUMENT NUMBER RESET
-- 1. Removes the year segment from quote/invoice/job/receipt numbers
--    (was "Q-2026-0001", now "Q-0128").
-- 2. Resets the quote, invoice, job AND receipt counters (each independently)
--    so the NEXT one generated is 0128.
--    (Existing quotes/invoices already sent keep their current numbers —
--    this only affects new documents going forward.)
-- Safe to run once. Run in Supabase SQL Editor.
-- ============================================================================

-- Collapse any per-year rows into a single row per (org_id, doc_type),
-- keeping the highest last_value seen.
CREATE TABLE document_counters_collapsed AS
SELECT org_id, doc_type, MAX(last_value) AS last_value
FROM document_counters
GROUP BY org_id, doc_type;

ALTER TABLE document_counters DROP CONSTRAINT document_counters_pkey;
ALTER TABLE document_counters DROP COLUMN year;
DELETE FROM document_counters;

ALTER TABLE document_counters ADD PRIMARY KEY (org_id, doc_type);

INSERT INTO document_counters (org_id, doc_type, last_value)
SELECT org_id, doc_type, last_value FROM document_counters_collapsed;

DROP TABLE document_counters_collapsed;

-- Reset counters (per org) so the next number issued is 0128, for every
-- document type — quote, invoice, job and receipt all start at 0128.
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

-- Number generator: no more year, no more year in the ON CONFLICT key.
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
