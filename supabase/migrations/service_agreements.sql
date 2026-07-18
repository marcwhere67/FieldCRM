-- ============================================================
-- Recurring service agreements  —  2026-07-18  (Phase 3a)
-- ============================================================
-- A service_agreement is a recurring contract (e.g. "fortnightly clean").
-- A background generator turns each upcoming occurrence into a normal job
-- (job_type='recurring', linked via jobs.service_agreement_id), which then
-- flows through the existing schedule→complete→invoice→pay lifecycle.
--
-- jobs.line_items lets a generated job carry its agreed price so it can be
-- invoiced without a quote (the job→invoice route falls back to it).
-- Non-destructive, reversible (rollback at the bottom).
-- ============================================================

CREATE TABLE IF NOT EXISTS service_agreements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  title text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly','fortnightly','four_weekly','monthly')),
  anchor_date date NOT NULL,                    -- first occurrence; sets the day-of-week/month
  start_time time NOT NULL DEFAULT '09:00',
  duration_minutes int NOT NULL DEFAULT 120,
  end_date date,                                -- null = runs indefinitely
  line_items jsonb NOT NULL DEFAULT '[]',       -- agreed price, copied onto each generated job
  assigned_users uuid[] DEFAULT '{}',
  instructions text,
  active boolean NOT NULL DEFAULT true,
  last_generated_date date                      -- cursor: latest occurrence already generated
);

CREATE INDEX IF NOT EXISTS idx_service_agreements_org_active ON service_agreements (org_id, active);

-- Link generated jobs back to their agreement, and let any job carry line items.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_agreement_id uuid REFERENCES service_agreements(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_jobs_service_agreement ON jobs (service_agreement_id);

-- Role-aware RLS, matching the other financial tables (Track A): everyone in the
-- org can read; only managers/admins can create or change agreements.
ALTER TABLE service_agreements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_agreements' AND policyname='org members read agreements') THEN
    CREATE POLICY "org members read agreements" ON service_agreements
      FOR SELECT USING (org_id = (SELECT auth_user_org_id()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_agreements' AND policyname='managers insert agreements') THEN
    CREATE POLICY "managers insert agreements" ON service_agreements
      FOR INSERT WITH CHECK (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_agreements' AND policyname='managers update agreements') THEN
    CREATE POLICY "managers update agreements" ON service_agreements
      FOR UPDATE USING (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='service_agreements' AND policyname='managers delete agreements') THEN
    CREATE POLICY "managers delete agreements" ON service_agreements
      FOR DELETE USING (org_id = (SELECT auth_user_org_id()) AND (SELECT auth_is_manager()));
  END IF;
END $$;

-- Keep updated_at fresh (function defined in schema.sql).
DROP TRIGGER IF EXISTS set_updated_at ON service_agreements;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON service_agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP TRIGGER IF EXISTS set_updated_at ON service_agreements;
-- DROP POLICY IF EXISTS "org members read agreements" ON service_agreements;
-- DROP POLICY IF EXISTS "managers insert agreements" ON service_agreements;
-- DROP POLICY IF EXISTS "managers update agreements" ON service_agreements;
-- DROP POLICY IF EXISTS "managers delete agreements" ON service_agreements;
-- DROP INDEX IF EXISTS idx_jobs_service_agreement;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS line_items;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS service_agreement_id;
-- DROP INDEX IF EXISTS idx_service_agreements_org_active;
-- DROP TABLE IF EXISTS service_agreements;
