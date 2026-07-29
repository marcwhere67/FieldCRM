-- ============================================================================
-- QUOTE-MATCHED INVOICE + RECEIPT NUMBERS  (idempotent -- safe to re-run)
--
-- Invoices raised from a quote now inherit the quote's number instead of
-- pulling the next value off the independent invoice counter, and receipts
-- inherit their invoice's number. So one job reads as one family:
--
--   Q-0128                     (quote)
--    |- INV-0128-D             (deposit invoice)
--    |   \- RCT-0128-A         (deposit payment receipt)
--    \- INV-0128               (final invoice)
--        |- RCT-0128-B
--        \- RCT-0128-C         (part payments)
--
-- Invoices with no quote behind them (ad-hoc jobs, recurring agreements) keep
-- using the INV counter as before -- which means that counter now has gaps.
-- Their receipts still match their own invoice: INV-0129 -> RCT-0129-A.
--
-- Existing documents are untouched; this only affects new ones.
-- Run in the Supabase SQL Editor (plain SQL tab, not the AI assistant).
-- ============================================================================

-- Strip the alpha prefix off a document number to get the shared root.
-- 'Q-0128' -> '0128'.  Legacy 'Q-2026-0007' -> '2026-0007'.
CREATE OR REPLACE FUNCTION document_number_root(p_number text)
RETURNS text AS $$
  SELECT regexp_replace(COALESCE(p_number, ''), '^[A-Za-z]+-', '');
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the uniqueness probe sees every row. invoice_number is
-- UNIQUE table-wide, but RLS would scope the SELECT to the caller's org and we
-- would only find out about a cross-org clash as a constraint violation.
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

  -- No quote (or a quote that somehow has no number): fall back to the counter.
  IF v_root IS NULL OR v_root = '' THEN
    NEW.invoice_number := next_document_number(NEW.org_id, 'invoice', 'INV');
    RETURN NEW;
  END IF;

  v_base := 'INV-' || v_root;
  IF NEW.invoice_type = 'deposit' THEN
    v_base := v_base || '-D';
  END IF;

  -- Deposit and final are distinguished by the -D suffix, so normally there is
  -- no clash. This covers a quote re-invoiced more than once: INV-0128-2, -3...
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

-- ---------------------------------------------------------------------------
-- Receipts
-- ---------------------------------------------------------------------------
-- Letters rather than digits so a receipt is never mistaken for an invoice.
-- The sequence runs across the whole quote family, not per invoice: a deposit
-- receipt of RCT-0128-A makes the first receipt on the final invoice -B.
CREATE OR REPLACE FUNCTION assign_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_no text;
  v_root       text;
  v_base       text;
  v_candidate  text;
  v_n          int := 0;
BEGIN
  IF NEW.receipt_number IS NOT NULL AND NEW.receipt_number <> '' THEN
    RETURN NEW;
  END IF;

  SELECT invoice_number INTO v_invoice_no FROM invoices WHERE id = NEW.invoice_id;

  IF v_invoice_no IS NULL OR v_invoice_no = '' THEN
    NEW.receipt_number := next_document_number(NEW.org_id, 'receipt', 'RCT');
    RETURN NEW;
  END IF;

  -- Drop the -D so deposit and final receipts share one root and one sequence.
  v_root := regexp_replace(document_number_root(v_invoice_no), '-D$', '');
  v_base := 'RCT-' || v_root;

  LOOP
    -- A..Z, then -27, -28... for the pathological many-part-payments case.
    v_candidate := v_base || '-' || CASE WHEN v_n < 26 THEN chr(65 + v_n) ELSE (v_n + 1)::text END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM payments WHERE receipt_number = v_candidate);
    v_n := v_n + 1;
  END LOOP;

  NEW.receipt_number := v_candidate;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_receipt_number ON payments;
CREATE TRIGGER trg_receipt_number BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION assign_receipt_number();

-- Rollback: re-run p0_lockdown.sql (invoices) and record_payment.sql (receipts)
-- to restore the plain counter-based triggers, then:
-- DROP FUNCTION IF EXISTS document_number_root(text);
