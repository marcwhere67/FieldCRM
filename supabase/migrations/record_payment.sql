-- ============================================================================
-- RECORD PAYMENT + RECEIPTS
-- Adds reference/notes to payments and auto-assigns an atomic receipt number
-- (reuses the Track A document_counters + next_document_number infra).
-- Non-destructive. Run in Supabase SQL Editor.
-- ============================================================================

-- 1. Extra columns for reconciliation (bank reference + free-text note)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS notes text;

-- 2. Atomic receipt numbering — assign on INSERT when blank (format RCT-YYYY-0001)
CREATE OR REPLACE FUNCTION assign_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := next_document_number(NEW.org_id, 'receipt', 'RCT');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_receipt_number ON payments;
CREATE TRIGGER trg_receipt_number BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION assign_receipt_number();

-- 3. Seed the receipt counter from any existing payments (usually none)
INSERT INTO document_counters (org_id, doc_type, year, last_value)
SELECT org_id, 'receipt',
       EXTRACT(YEAR FROM (now() AT TIME ZONE 'Australia/Melbourne'))::int,
       COALESCE(MAX((regexp_match(receipt_number, '(\d+)\s*$'))[1]::int), 0)
FROM payments WHERE receipt_number IS NOT NULL GROUP BY org_id
ON CONFLICT (org_id, doc_type, year)
DO UPDATE SET last_value = GREATEST(document_counters.last_value, EXCLUDED.last_value);

-- Rollback:
-- DROP TRIGGER IF EXISTS trg_receipt_number ON payments;
-- DROP FUNCTION IF EXISTS assign_receipt_number();
-- ALTER TABLE payments DROP COLUMN IF EXISTS reference, DROP COLUMN IF EXISTS notes;
