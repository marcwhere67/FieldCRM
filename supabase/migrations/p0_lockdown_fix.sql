-- ============================================================================
-- P0 LOCKDOWN FIX
-- next_document_number() must run as SECURITY DEFINER so it can write the
-- RLS-locked document_counters table on behalf of browser clients.
-- Without this, creating a quote/invoice/job errors:
--   "new row violates row-level security policy for table document_counters"
-- Safe to run once. Run in Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION next_document_number(p_org uuid, p_doc_type text, p_prefix text)
RETURNS text AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Australia/Melbourne'))::int;
  v_next int;
BEGIN
  INSERT INTO document_counters (org_id, doc_type, year, last_value)
  VALUES (p_org, p_doc_type, v_year, 1)
  ON CONFLICT (org_id, doc_type, year)
  DO UPDATE SET last_value = document_counters.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN p_prefix || '-' || v_year || '-' || LPAD(v_next::text, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
