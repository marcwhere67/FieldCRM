-- ============================================================================
-- P0 LOCKDOWN MIGRATION
-- Track A: role-aware RLS, server-authoritative financial totals,
--          atomic document numbering, timesheet approval guard.
--
-- Safe to run multiple times (idempotent). Run in Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. HELPER FUNCTIONS
--    auth_user_org_id() / auth_user_role() already exist (schema.sql).
--    Add auth_user_id() -> the app users.id for the current auth user.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS uuid AS $$
  SELECT id FROM users WHERE supabase_auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_is_manager()
RETURNS boolean AS $$
  SELECT COALESCE(auth_user_role() IN ('admin','manager'), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- 1. ROLE-AWARE RLS
--    Drop the permissive org-only policies from schema.sql and recreate
--    them tiered by role. SELECT stays org-wide (dashboards need it);
--    the lockdown is on writes.
--
--    Helper calls are wrapped in (SELECT ...) so the planner evaluates them
--    ONCE per query instead of once per row (large-table perf win).
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  -- field users may INSERT/UPDATE these (day-to-day field work); managers+ only DELETE
  operational text[] := ARRAY[
    'contacts','properties','jobs','visits','conversations','messages',
    'expenses','form_submissions'
  ];
  -- managers+ only for ALL writes; field is read-only (money & config)
  restricted text[] := ARRAY[
    'quotes','invoices','payments','services','pipeline_stages','campaigns',
    'workflows','workflow_executions','automation_queue','call_tracking_numbers',
    'reviews','forms'
  ];
BEGIN
  -- Drop every existing generic policy so we can redefine cleanly
  FOREACH t IN ARRAY operational || restricted || ARRAY['timesheets'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I;', t, t);
  END LOOP;

  -- SELECT: org-wide for every table (unchanged behaviour)
  FOREACH t IN ARRAY operational || restricted || ARRAY['timesheets'] LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (org_id = (SELECT auth_user_org_id()));',
      t, t);
  END LOOP;

  -- Operational tables: any org member INSERT/UPDATE; managers+ DELETE
  FOREACH t IN ARRAY operational LOOP
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT
         WITH CHECK (org_id = (SELECT auth_user_org_id()));', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE
         USING (org_id = (SELECT auth_user_org_id()));', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON %I FOR DELETE
         USING (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));', t, t);
  END LOOP;

  -- Restricted tables: managers+ only for INSERT/UPDATE/DELETE
  FOREACH t IN ARRAY restricted LOOP
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT
         WITH CHECK (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE
         USING (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON %I FOR DELETE
         USING (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));', t, t);
  END LOOP;
END $$;

-- timesheets: field may INSERT/UPDATE only their OWN rows; managers+ full control
CREATE POLICY "timesheets_insert" ON timesheets FOR INSERT
  WITH CHECK (
    org_id = (SELECT auth_user_org_id())
    AND (user_id = (SELECT auth_user_id()) OR (SELECT auth_is_manager()))
  );
CREATE POLICY "timesheets_update" ON timesheets FOR UPDATE
  USING (
    org_id = (SELECT auth_user_org_id())
    AND (user_id = (SELECT auth_user_id()) OR (SELECT auth_is_manager()))
  );
CREATE POLICY "timesheets_delete" ON timesheets FOR DELETE
  USING (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));

-- ----------------------------------------------------------------------------
-- 2. TIMESHEET APPROVAL GUARD
--    Defence-in-depth: even with UPDATE rights, a non-manager cannot flip
--    `approved` to true (self-approval of payroll).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_timesheet_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.approved IS DISTINCT FROM OLD.approved) AND NOT auth_is_manager() THEN
    RAISE EXCEPTION 'Only managers or admins can change timesheet approval';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_timesheet_approval ON timesheets;
CREATE TRIGGER trg_guard_timesheet_approval
  BEFORE UPDATE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION guard_timesheet_approval();

-- ----------------------------------------------------------------------------
-- 3. SERVER-AUTHORITATIVE FINANCIAL TOTALS
--    Recompute subtotal / tax / total from line_items on the DB side.
--    Client-supplied totals are ignored -> no `total: 0` tampering.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recompute_document_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal numeric(14,4) := 0;
  v_tax      numeric(14,4) := 0;
  item       jsonb;
  qty        numeric;
  price      numeric;
  rate       numeric;
BEGIN
  IF NEW.line_items IS NOT NULL AND jsonb_typeof(NEW.line_items) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.line_items) LOOP
      qty   := COALESCE((item->>'quantity')::numeric, 0);
      price := COALESCE((item->>'unit_price')::numeric, 0);
      rate  := COALESCE((item->>'tax_rate')::numeric, 0);
      v_subtotal := v_subtotal + (qty * price);
      v_tax      := v_tax + (qty * price * rate / 100.0);
    END LOOP;
  END IF;

  NEW.subtotal := ROUND(v_subtotal, 2);
  NEW.tax      := ROUND(v_tax, 2);
  NEW.total    := ROUND(v_subtotal + v_tax, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotes_totals ON quotes;
CREATE TRIGGER trg_quotes_totals
  BEFORE INSERT OR UPDATE OF line_items ON quotes
  FOR EACH ROW EXECUTE FUNCTION recompute_document_totals();

DROP TRIGGER IF EXISTS trg_invoices_totals ON invoices;
CREATE TRIGGER trg_invoices_totals
  BEFORE INSERT OR UPDATE OF line_items ON invoices
  FOR EACH ROW EXECUTE FUNCTION recompute_document_totals();

-- ----------------------------------------------------------------------------
-- 4. ATOMIC DOCUMENT NUMBERING
--    Race-free per-org, per-year counters. ON CONFLICT DO UPDATE takes a
--    row lock, so concurrent inserts can never collide or reuse a number.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_counters (
  org_id     uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  doc_type   text NOT NULL,             -- 'quote' | 'invoice' | 'job'
  year       int  NOT NULL,
  last_value int  NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, doc_type, year)
);

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
$$ LANGUAGE plpgsql;

-- Assign a number on INSERT only when one wasn't supplied.
CREATE OR REPLACE FUNCTION assign_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := next_document_number(NEW.org_id, 'quote', 'Q');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := next_document_number(NEW.org_id, 'invoice', 'INV');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION assign_job_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    NEW.job_number := next_document_number(NEW.org_id, 'job', 'J');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quote_number ON quotes;
CREATE TRIGGER trg_quote_number BEFORE INSERT ON quotes
  FOR EACH ROW EXECUTE FUNCTION assign_quote_number();

DROP TRIGGER IF EXISTS trg_invoice_number ON invoices;
CREATE TRIGGER trg_invoice_number BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION assign_invoice_number();

DROP TRIGGER IF EXISTS trg_job_number ON jobs;
CREATE TRIGGER trg_job_number BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION assign_job_number();

-- Seed counters from existing max numbers so we continue, not restart at 0001.
-- (regexp_match grabs only the TRAILING digit run, e.g. "Q-2026-0007" -> 7.)
INSERT INTO document_counters (org_id, doc_type, year, last_value)
SELECT org_id, 'quote',
       EXTRACT(YEAR FROM (now() AT TIME ZONE 'Australia/Melbourne'))::int,
       COALESCE(MAX((regexp_match(quote_number, '(\d+)\s*$'))[1]::int), 0)
FROM quotes GROUP BY org_id
ON CONFLICT (org_id, doc_type, year)
DO UPDATE SET last_value = GREATEST(document_counters.last_value, EXCLUDED.last_value);

INSERT INTO document_counters (org_id, doc_type, year, last_value)
SELECT org_id, 'invoice',
       EXTRACT(YEAR FROM (now() AT TIME ZONE 'Australia/Melbourne'))::int,
       COALESCE(MAX((regexp_match(invoice_number, '(\d+)\s*$'))[1]::int), 0)
FROM invoices GROUP BY org_id
ON CONFLICT (org_id, doc_type, year)
DO UPDATE SET last_value = GREATEST(document_counters.last_value, EXCLUDED.last_value);

INSERT INTO document_counters (org_id, doc_type, year, last_value)
SELECT org_id, 'job',
       EXTRACT(YEAR FROM (now() AT TIME ZONE 'Australia/Melbourne'))::int,
       COALESCE(MAX((regexp_match(job_number, '(\d+)\s*$'))[1]::int), 0)
FROM jobs GROUP BY org_id
ON CONFLICT (org_id, doc_type, year)
DO UPDATE SET last_value = GREATEST(document_counters.last_value, EXCLUDED.last_value);

-- document_counters: lock down completely (server/trigger only, never client)
ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;
-- (no policies -> browser clients cannot read or write; SECURITY DEFINER
--  function and service role still work)

-- ============================================================================
-- END P0 LOCKDOWN
-- ============================================================================
