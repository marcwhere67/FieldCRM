-- ============================================================================
-- BANK DETAILS (bank-transfer payments)
-- Adds org bank account fields shown on invoices/receipts so customers can pay
-- by transfer. All nullable, non-destructive. Run in Supabase SQL Editor.
-- ============================================================================

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS bank_account_name   text,
  ADD COLUMN IF NOT EXISTS bank_bsb            text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_payid          text,
  ADD COLUMN IF NOT EXISTS payment_instructions text;

-- Rollback:
-- ALTER TABLE organisations
--   DROP COLUMN IF EXISTS bank_account_name,
--   DROP COLUMN IF EXISTS bank_bsb,
--   DROP COLUMN IF EXISTS bank_account_number,
--   DROP COLUMN IF EXISTS bank_payid,
--   DROP COLUMN IF EXISTS payment_instructions;
