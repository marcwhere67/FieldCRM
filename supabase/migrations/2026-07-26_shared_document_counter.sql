-- ============================================================================
-- SHARED QUOTE/INVOICE COUNTER  (idempotent -- safe to re-run)
--
-- Follows 2026-07-26_quote_matched_numbers.sql, and fixes a collision in it:
-- quotes and invoices drew from two independent counters that were both reset
-- to 127, so the first ad-hoc invoice would generate INV-0128 while quote 0128
-- had already produced an invoice of that name. invoice_number is UNIQUE, and
-- the ad-hoc branch had no collision guard, so that insert failed outright.
--
-- Fix: ONE counter ('document') issues every quote and every invoice number,
-- so a number is handed out once and never means two things.
--
--   Q-0128  -> INV-0128    quote, converted
--              INV-0129    ad-hoc job, no quote
--   Q-0130                 quote, never accepted -- number retired
--   Q-0131  -> INV-0131    quote, converted
--
-- Invoices on the books read 0128, 0129, 0131. Every gap is a quote that was
-- never accepted, and can be pointed at. Quote numbers go gappy in return.
--
-- Job numbers are unaffected and keep their own counter.
-- Run in the Supabase SQL Editor (plain SQL tab, not the AI assistant).
-- ============================================================================

-- 1. Seed the shared counter above every number already issued, so nothing is
--    handed out twice. Takes the high-water mark of the two old counters and
--    of the numbers actually on quotes and invoices.
--
--    The scan only matches the current prefix-then-digits format and ignores
--    anything over 9999, which skips the legacy year-bearing demo rows
--    ('INV-2026-001') that would otherwise shove the counter up to 2026.
INSERT INTO document_counters (org_id, doc_type, last_value)
SELECT o.id, 'document', GREATEST(
  COALESCE((SELECT MAX(dc.last_value) FROM document_counters dc
             WHERE dc.org_id = o.id AND dc.doc_type IN ('quote', 'invoice')), 0),
  COALESCE((SELECT MAX((regexp_match(q.quote_number, '^[A-Za-z]+-(\d{1,4})(-|$)'))[1]::int)
              FROM quotes q WHERE q.org_id = o.id), 0),
  COALESCE((SELECT MAX((regexp_match(i.invoice_number, '^[A-Za-z]+-(\d{1,4})(-|$)'))[1]::int)
              FROM invoices i WHERE i.org_id = o.id), 0)
)
FROM organisations o
ON CONFLICT (org_id, doc_type)
DO UPDATE SET last_value = GREATEST(document_counters.last_value, EXCLUDED.last_value);

-- 2. Quotes draw from the shared counter.
CREATE OR REPLACE FUNCTION assign_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := next_document_number(NEW.org_id, 'document', 'Q');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_number ON quotes;
CREATE TRIGGER trg_quote_number BEFORE INSERT ON quotes
  FOR EACH ROW EXECUTE FUNCTION assign_quote_number();

-- 3. Invoices inherit the quote's number, or draw from the shared counter when
--    there is no quote. The collision loop now covers BOTH branches -- with one
--    counter a clash should be impossible, but a UNIQUE violation here means a
--    failed invoice for the user, so it is worth the belt and braces.
CREATE OR REPLACE FUNCTION assign_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  v_root      text;
  v_base      text;
  v_candidate text;
  v_seq       int := 2;
BEGIN
  IF NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.quote_id IS NOT NULL THEN
    SELECT document_number_root(quote_number) INTO v_root
    FROM quotes WHERE id = NEW.quote_id;
  END IF;

  IF v_root IS NULL OR v_root = '' THEN
    -- Ad-hoc job or recurring agreement: take the next shared number.
    v_base := next_document_number(NEW.org_id, 'document', 'INV');
  ELSE
    v_base := 'INV-' || v_root;
    IF NEW.invoice_type = 'deposit' THEN
      v_base := v_base || '-D';
    END IF;
  END IF;

  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM invoices WHERE invoice_number = v_candidate) LOOP
    v_candidate := v_base || '-' || v_seq;
    v_seq := v_seq + 1;
  END LOOP;

  NEW.invoice_number := v_candidate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_invoice_number ON invoices;
CREATE TRIGGER trg_invoice_number BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION assign_invoice_number();

-- The old 'quote' and 'invoice' counter rows are left in place, unused. They
-- are the restore point if this is rolled back.
--
-- Rollback: re-run 2026-07-26_quote_matched_numbers.sql and p0_lockdown.sql,
-- then: DELETE FROM document_counters WHERE doc_type = 'document';
