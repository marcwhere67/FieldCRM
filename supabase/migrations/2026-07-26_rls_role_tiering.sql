-- ============================================================================
-- RLS ROLE TIERING FOR POST-LOCKDOWN TABLES  (P0-2)
--
-- Every table added AFTER p0_lockdown.sql shipped with a single blanket
-- "FOR ALL USING (org_id = auth_user_org_id())" policy. That lets a `field`
-- user read, write AND delete HR records, employee contracts, supplier cost
-- prices and client documents straight from the browser Supabase client.
--
-- This migration re-tiers them the same way p0_lockdown tiered the core tables,
-- using the existing helpers auth_user_org_id() (schema.sql) and
-- auth_is_manager() (p0_lockdown.sql). Three buckets:
--
--   SENSITIVE     manager-only for SELECT and every write. PII / HR / legal /
--                 margin data a field tech must never see.
--   CONFIG        org-wide SELECT (field job pages read cleaning procedures),
--                 manager-only writes.
--   OPERATIONAL   org-wide SELECT + any org member INSERT/UPDATE/DELETE. These
--                 are field work products (job notes, procedure progress).
--
-- Idempotent AND tolerant of a partially-migrated database: any table in the
-- lists below that doesn't exist yet is skipped (to_regclass check), so this
-- secures whatever you have and ignores features not yet installed. Re-run it
-- after applying any skipped feature migration to tier its tables too.
-- Run in the Supabase SQL Editor (plain SQL tab).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Wipe existing policies on the affected tables so we can redefine cleanly.
--    Helper-call wrapping in (SELECT ...) makes the planner evaluate the
--    org/role lookup once per query, not once per row (same trick as Track A).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p text;
  all_tables text[] := ARRAY[
    -- sensitive
    'employee_profiles','employee_contracts','leave_requests','client_documents',
    'admin_documents','sops','notices','products','suppliers','purchase_orders',
    -- config
    'cleaning_procedures','procedure_steps','message_templates','assets',
    -- operational
    'job_notes','job_procedure_progress','property_procedure_notes'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    FOR p IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', p, t);
    END LOOP;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 1. SENSITIVE — manager-only for SELECT and all writes.
--    Field techs cannot read colleagues' HR records, contracts, supplier cost
--    prices or client documents even via the raw browser client.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  sensitive text[] := ARRAY[
    'employee_profiles','employee_contracts','leave_requests','client_documents',
    'admin_documents','sops','notices','products','suppliers','purchase_orders'
  ];
BEGIN
  FOREACH t IN ARRAY sensitive LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT
         USING (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));', t, t);
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

-- ----------------------------------------------------------------------------
-- 2. CONFIG — org-wide SELECT (field job pages read cleaning procedures and
--    step definitions), manager-only INSERT/UPDATE/DELETE.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  config text[] := ARRAY[
    'cleaning_procedures','procedure_steps','message_templates','assets'
  ];
BEGIN
  FOREACH t IN ARRAY config LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT
         USING (org_id = (SELECT auth_user_org_id()));', t, t);
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

-- ----------------------------------------------------------------------------
-- 3. OPERATIONAL — org-wide SELECT + any org member INSERT/UPDATE/DELETE.
--    Job notes/photos and procedure progress are created and removed by field
--    techs during a job, so writes stay open to every member of the org.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  operational text[] := ARRAY[
    'job_notes','job_procedure_progress','property_procedure_notes'
  ];
BEGIN
  FOREACH t IN ARRAY operational LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT
         USING (org_id = (SELECT auth_user_org_id()));', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT
         WITH CHECK (org_id = (SELECT auth_user_org_id()));', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE
         USING (org_id = (SELECT auth_user_org_id()));', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON %I FOR DELETE
         USING (org_id = (SELECT auth_user_org_id()));', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- After running: to see which of the listed tables actually exist and now have
-- policies, run —
--   SELECT tablename, count(*) FROM pg_policies WHERE schemaname='public'
--   GROUP BY tablename ORDER BY tablename;
--
-- ROLLBACK: drop the *_select/_insert/_update/_delete policies created above and
-- re-run the original feature migrations (team_hr.sql, admin_hub.sql,
-- client_documents.sql, products_catalogue.sql, suppliers.sql, assets.sql,
-- message_templates.sql, job_notes.sql, 2026-07-21_cleaning_procedures.sql,
-- 2026-07-21_property_procedure_notes.sql).
-- ============================================================================
