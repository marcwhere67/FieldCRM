-- ============================================================================
-- PAYMENT IDEMPOTENCY  (P0-4)
--
-- Recording a payment was not idempotent: a double-tap on a slow connection, or
-- a request retried after a lost/timed-out response, inserted a second payments
-- row — double-crediting the invoice and emailing a second receipt.
--
-- The app now sends a client-minted UUID (client_request_id) that is stable
-- across retries of the same payment. This column + unique index let the server
-- dedupe on it: a repeat insert with the same key is rejected by the index and
-- the route returns the original result instead of recording a new payment.
--
-- Non-destructive: the column is nullable, so every existing payment row (and
-- any future insert that omits the key) is unaffected — the partial index only
-- constrains rows where client_request_id IS NOT NULL, and NULLs never clash.
--
-- IMPORTANT: apply this BEFORE deploying the matching app code, otherwise the
-- payment insert references a column that doesn't exist yet.
-- Run in the Supabase SQL Editor (plain SQL tab).
-- ============================================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS payments_client_request_id_key
  ON payments (client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Rollback:
-- DROP INDEX IF EXISTS payments_client_request_id_key;
-- ALTER TABLE payments DROP COLUMN IF EXISTS client_request_id;
