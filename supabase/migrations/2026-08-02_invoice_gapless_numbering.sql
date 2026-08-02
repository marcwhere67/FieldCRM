-- ============================================================================
-- GAPLESS INVOICE NUMBERING + SHARED COUNTER + RESET TO 174
-- (idempotent -- safe to re-run)
--
-- This migration does three things at once, because on this database they are
-- entangled:
--
-- A) SHARED QUOTE/INVOICE COUNTER (adopts 2026-07-26_shared_document_counter.sql,
--    which was written but never applied here -- prod is still on
--    2026-07-26_quote_matched_numbers.sql with SEPARATE 'quote' and 'invoice'
--    counters). One 'document' counter now feeds every quote and every ad-hoc
--    invoice, so a number is handed out once and never means two things:
--
--        Q-0174  -> INV-0174     quote, converted
--                   INV-0175     ad-hoc job, no quote
--        Q-0176                  quote, never accepted -- number retired
--
--    Without this, resetting both old counters to 173 would make quote Q-0174
--    convert to INV-0174 while the first ad-hoc invoice ALSO drew INV-0174 from
--    its own counter -- and invoice_number is UNIQUE, so that insert would fail.
--    The ad-hoc branch has no collision guard, exactly the bug the shared
--    counter was designed to remove.
--
-- B) GAPLESS DRAFTS: a standalone draft invoice (POST /api/invoices with
--    status='draft') no longer gets a number at INSERT. It stays NULL until the
--    invoice is actually sent, when finalize_invoice_number() assigns it. So a
--    draft that is deleted or never sent never burns a number -- no gaps in the
--    invoice sequence, which is what tax-invoice audits care about. Invoices
--    inserted already-finalized (e.g. deposit invoices created with
--    status='sent' from quote-detail.tsx) still get numbered immediately.
--
-- C) RESET TO 174: the shared 'document' counter, the 'job' counter and the
--    'receipt' counter are set so the next number each issues is 174.
--
-- Run in the Supabase SQL Editor (plain SQL tab, not the AI assistant).
-- ============================================================================

-- 0. invoice_number must be nullable so a draft invoice can exist without one.
--    UNIQUE already permits multiple NULLs in Postgres, so no other constraint
--    changes are needed.
ALTER TABLE invoices ALTER COLUMN invoice_number DROP NOT NULL;

-- 1. Quotes draw from the shared 'document' counter (was 'quote').
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

-- 2. Invoice INSERT trigger: inherit the quote's number, or draw from the
--    shared counter for ad-hoc invoices -- BUT skip entirely for standalone
--    drafts, which stay NULL until finalized at send time.
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

  -- Gapless: a standalone draft gets no number now. finalize_invoice_number()
  -- assigns it at send. (Invoices inserted as 'sent', e.g. deposits, fall
  -- through and get numbered immediately, as before.)
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  IF NEW.quote_id IS NOT NULL THEN
    SELECT document_number_root(quote_number) INTO v_root
    FROM quotes WHERE id = NEW.quote_id;
  END IF;

  IF v_root IS NULL OR v_root = '' THEN
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

-- 3. Finalize a draft invoice's number at send time. Same inherit-or-draw logic
--    as the trigger, but locks the row (FOR UPDATE) so two concurrent sends
--    can't double-assign, and is idempotent -- a resend where the number is
--    already set just returns it.
CREATE OR REPLACE FUNCTION finalize_invoice_number(p_invoice_id uuid)
RETURNS text AS $$
DECLARE
  v_invoice   invoices%ROWTYPE;
  v_root      text;
  v_base      text;
  v_candidate text;
  v_seq       int := 2;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;

  IF v_invoice.invoice_number IS NOT NULL AND v_invoice.invoice_number <> '' THEN
    RETURN v_invoice.invoice_number;
  END IF;

  IF v_invoice.quote_id IS NOT NULL THEN
    SELECT document_number_root(quote_number) INTO v_root
    FROM quotes WHERE id = v_invoice.quote_id;
  END IF;

  IF v_root IS NULL OR v_root = '' THEN
    v_base := next_document_number(v_invoice.org_id, 'document', 'INV');
  ELSE
    v_base := 'INV-' || v_root;
    IF v_invoice.invoice_type = 'deposit' THEN
      v_base := v_base || '-D';
    END IF;
  END IF;

  v_candidate := v_base;
  WHILE EXISTS (SELECT 1 FROM invoices WHERE invoice_number = v_candidate) LOOP
    v_candidate := v_base || '-' || v_seq;
    v_seq := v_seq + 1;
  END LOOP;

  UPDATE invoices SET invoice_number = v_candidate WHERE id = p_invoice_id;

  RETURN v_candidate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Reset counters so the next number issued is 174. The shared 'document'
--    counter (quotes + ad-hoc invoices), plus the independent 'job' and
--    'receipt' counters. Direct set to 173, mirroring document_number_reset.sql.
--    (Confirmed safe: current high-water mark across all documents is 146.)
INSERT INTO document_counters (org_id, doc_type, last_value)
SELECT id, 'document', 173 FROM organisations
ON CONFLICT (org_id, doc_type) DO UPDATE SET last_value = 173;

INSERT INTO document_counters (org_id, doc_type, last_value)
SELECT id, 'job', 173 FROM organisations
ON CONFLICT (org_id, doc_type) DO UPDATE SET last_value = 173;

INSERT INTO document_counters (org_id, doc_type, last_value)
SELECT id, 'receipt', 173 FROM organisations
ON CONFLICT (org_id, doc_type) DO UPDATE SET last_value = 173;

-- The old 'quote' and 'invoice' counter rows are left in place, unused, as a
-- rollback reference point.
-- ============================================================================
