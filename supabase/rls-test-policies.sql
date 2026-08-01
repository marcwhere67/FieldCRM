-- ============================================================================
-- RLS TEST POLICIES — the tenant-isolation policies for the 21 core tables.
--
-- This is the RLS-relevant slice of supabase/migrations/p0_lockdown.sql:
-- the two helper functions + the role-aware policy block. It deliberately
-- OMITS p0_lockdown's numbering/totals triggers, which need columns from other
-- migrations and would fire during test seeding. Isolation depends only on the
-- policies, so this reproduces production's tenant boundary exactly, trigger-free.
--
-- Run AFTER supabase/schema.sql on a throwaway project. See docs/rls-gate-setup.md.
-- ============================================================================

-- Helpers (auth_user_org_id/auth_user_role already exist from schema.sql).
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS uuid AS $$
  SELECT id FROM users WHERE supabase_auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_is_manager()
RETURNS boolean AS $$
  SELECT COALESCE(auth_user_role() IN ('admin','manager'), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Role-aware policies for the 21 org-scoped core tables.
DO $$
DECLARE
  t text;
  operational text[] := ARRAY[
    'contacts','properties','jobs','visits','conversations','messages',
    'expenses','form_submissions'
  ];
  restricted text[] := ARRAY[
    'quotes','invoices','payments','services','pipeline_stages','campaigns',
    'workflows','workflow_executions','automation_queue','call_tracking_numbers',
    'reviews','forms'
  ];
BEGIN
  FOREACH t IN ARRAY operational || restricted || ARRAY['timesheets'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I;', t, t);
  END LOOP;

  -- SELECT: org-wide for every table.
  FOREACH t IN ARRAY operational || restricted || ARRAY['timesheets'] LOOP
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT USING (org_id = (SELECT auth_user_org_id()));',
      t, t);
  END LOOP;

  -- Operational: any org member INSERT/UPDATE; managers+ DELETE.
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

  -- Restricted: managers+ only for INSERT/UPDATE/DELETE.
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

-- timesheets: field may write only their OWN rows; managers+ full control.
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
