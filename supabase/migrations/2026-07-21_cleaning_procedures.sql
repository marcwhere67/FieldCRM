-- Cleaning Procedures: standardized, area-grouped checklists per clean_type (regular/deep/airbnb)
-- with reference photos, tech proof-of-completion photos, and job-completion gating.

-- jobs.clean_type (mirrors quotes.clean_type exactly)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS clean_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_clean_type_check'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_clean_type_check
      CHECK (clean_type IS NULL OR clean_type IN ('regular','deep','airbnb'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cleaning_procedures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  clean_type text NOT NULL CHECK (clean_type IN ('regular','deep','airbnb')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (org_id, clean_type)
);

CREATE TABLE IF NOT EXISTS procedure_steps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  procedure_id uuid NOT NULL REFERENCES cleaning_procedures(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (area IN ('kitchen','bathroom','bedroom','living','laundry','floors','turnover','general')),
  order_index int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  reference_photo_path text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))
);

CREATE TABLE IF NOT EXISTS job_procedure_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES procedure_steps(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  proof_photo_path text,
  UNIQUE (job_id, step_id)
);

-- RLS (org-scoped, same pattern as sops/job_notes)
ALTER TABLE cleaning_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_procedure_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members access cleaning procedures" ON cleaning_procedures;
CREATE POLICY "org members access cleaning procedures"
  ON cleaning_procedures FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP POLICY IF EXISTS "org members access procedure steps" ON procedure_steps;
CREATE POLICY "org members access procedure steps"
  ON procedure_steps FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP POLICY IF EXISTS "org members access job procedure progress" ON job_procedure_progress;
CREATE POLICY "org members access job procedure progress"
  ON job_procedure_progress FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

-- updated_at triggers (reuses existing update_updated_at() function)
DROP TRIGGER IF EXISTS set_updated_at ON cleaning_procedures;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cleaning_procedures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON procedure_steps;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON procedure_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON job_procedure_progress;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON job_procedure_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_procedure_steps_procedure ON procedure_steps (procedure_id, area, order_index);
CREATE INDEX IF NOT EXISTS idx_procedure_steps_org ON procedure_steps (org_id);
CREATE INDEX IF NOT EXISTS idx_job_procedure_progress_job ON job_procedure_progress (job_id);
CREATE INDEX IF NOT EXISTS idx_job_procedure_progress_org ON job_procedure_progress (org_id);

-- Defense-in-depth: block marking a job 'completed' while required procedure steps
-- (for the job's clean_type/org) are incomplete, regardless of code path.
CREATE OR REPLACE FUNCTION enforce_procedure_completion()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.clean_type IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM procedure_steps ps
      JOIN cleaning_procedures cp ON cp.id = ps.procedure_id
      WHERE cp.org_id = NEW.org_id
        AND cp.clean_type = NEW.clean_type
        AND cp.status = 'active'
        AND ps.status = 'active'
        AND ps.is_required
        AND NOT EXISTS (
          SELECT 1 FROM job_procedure_progress jpp
          WHERE jpp.step_id = ps.id AND jpp.job_id = NEW.id AND jpp.completed
        )
    ) THEN
      RAISE EXCEPTION 'Cannot complete job: required cleaning procedure steps are not checked off';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_procedure_completion ON jobs;
CREATE TRIGGER enforce_procedure_completion
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION enforce_procedure_completion();

-- ------------------------------------------------------------
-- Seed: one procedure per clean_type per existing org, converted from the
-- area-ordered bullet lists in src/lib/scope-of-work.ts. Idempotent — safe to re-run.
-- ------------------------------------------------------------
DO $$
DECLARE
  org record;
  proc_id uuid;
BEGIN
  FOR org IN SELECT id FROM organisations LOOP

    -- Regular
    IF NOT EXISTS (SELECT 1 FROM cleaning_procedures WHERE org_id = org.id AND clean_type = 'regular') THEN
      INSERT INTO cleaning_procedures (org_id, clean_type, title, description, status)
      VALUES (org.id, 'regular', 'Regular Clean', 'A maintenance clean designed to maintain cleanliness and presentation of a regularly serviced property.', 'active')
      RETURNING id INTO proc_id;

      INSERT INTO procedure_steps (procedure_id, org_id, area, order_index, title, is_required) VALUES
        (proc_id, org.id, 'kitchen', 1, 'Kitchen bench tops, splashbacks and surfaces cleaned', true),
        (proc_id, org.id, 'kitchen', 2, 'Sink and cooktop cleaned', true),
        (proc_id, org.id, 'kitchen', 3, 'Exterior of appliances wiped', true),
        (proc_id, org.id, 'bathroom', 4, 'Bathrooms: toilet, shower, sinks and visible surfaces cleaned', true),
        (proc_id, org.id, 'bedroom', 5, 'Bedrooms and living areas tidied and cleaned', true),
        (proc_id, org.id, 'floors', 6, 'Floors vacuumed and mopped throughout accessible areas', true),
        (proc_id, org.id, 'floors', 7, 'Skirting boards dusted', true);
    END IF;

    -- Deep
    IF NOT EXISTS (SELECT 1 FROM cleaning_procedures WHERE org_id = org.id AND clean_type = 'deep') THEN
      INSERT INTO cleaning_procedures (org_id, clean_type, title, description, status)
      VALUES (org.id, 'deep', 'Deep Clean', 'A detailed service intended for properties requiring a higher level of attention, build-up removal, or periodic intensive cleaning.', 'active')
      RETURNING id INTO proc_id;

      INSERT INTO procedure_steps (procedure_id, org_id, area, order_index, title, is_required) VALUES
        (proc_id, org.id, 'kitchen', 1, 'Kitchen bench tops, splashbacks and surfaces cleaned', true),
        (proc_id, org.id, 'kitchen', 2, 'Sink and cooktop cleaned', true),
        (proc_id, org.id, 'kitchen', 3, 'Exterior of appliances wiped', true),
        (proc_id, org.id, 'kitchen', 4, 'Interior microwave cleaning', true),
        (proc_id, org.id, 'kitchen', 5, 'Interior cupboards cleaned (non-food cupboards only)', true),
        (proc_id, org.id, 'bathroom', 6, 'Bathrooms: toilet, shower, sinks and visible surfaces cleaned', true),
        (proc_id, org.id, 'bathroom', 7, 'Bathrooms given additional detailed cleaning including grout attention where required', true),
        (proc_id, org.id, 'bedroom', 8, 'Bedrooms and living areas tidied and cleaned', true),
        (proc_id, org.id, 'floors', 9, 'Floors vacuumed and mopped throughout accessible areas', true),
        (proc_id, org.id, 'floors', 10, 'Skirting boards thoroughly cleaned', true),
        (proc_id, org.id, 'floors', 11, 'Window tracks cleaned where accessible', true),
        (proc_id, org.id, 'general', 12, 'Additional detailed attention to high and hard-to-reach areas', true);
    END IF;

    -- Airbnb
    IF NOT EXISTS (SELECT 1 FROM cleaning_procedures WHERE org_id = org.id AND clean_type = 'airbnb') THEN
      INSERT INTO cleaning_procedures (org_id, clean_type, title, description, status)
      VALUES (org.id, 'airbnb', 'Airbnb / Short-Stay Turnover Clean', 'A presentation-focused service designed specifically for short-term rental properties between guest stays.', 'active')
      RETURNING id INTO proc_id;

      INSERT INTO procedure_steps (procedure_id, org_id, area, order_index, title, is_required) VALUES
        (proc_id, org.id, 'kitchen', 1, 'Kitchen bench tops, splashbacks and surfaces cleaned', true),
        (proc_id, org.id, 'kitchen', 2, 'Sink and cooktop cleaned', true),
        (proc_id, org.id, 'kitchen', 3, 'Exterior of appliances wiped', true),
        (proc_id, org.id, 'kitchen', 4, 'Interior check of cupboards and appliances', true),
        (proc_id, org.id, 'kitchen', 5, 'Washing dishes and returning them to cupboards where required', true),
        (proc_id, org.id, 'bathroom', 6, 'Bathrooms: toilet, shower, sinks and visible surfaces cleaned', true),
        (proc_id, org.id, 'bedroom', 7, 'Bedrooms and living areas tidied and cleaned', true),
        (proc_id, org.id, 'bedroom', 8, 'Linen changed and beds remade', true),
        (proc_id, org.id, 'floors', 9, 'Floors vacuumed and mopped throughout accessible areas', true),
        (proc_id, org.id, 'floors', 10, 'Skirting boards dusted', true),
        (proc_id, org.id, 'turnover', 11, 'Full property reset and staging for the next guest', true),
        (proc_id, org.id, 'turnover', 12, 'Restocking of provided guest amenities', true),
        (proc_id, org.id, 'turnover', 13, 'BBQ maintenance between guest stays', true),
        (proc_id, org.id, 'turnover', 14, 'Quick post-stay condition check', true),
        (proc_id, org.id, 'turnover', 15, 'Photo documentation where required', true),
        (proc_id, org.id, 'turnover', 16, 'Reporting of visible guest damages or issues', true);
    END IF;

  END LOOP;
END $$;

-- ------------------------------------------------------------
-- ROLLBACK (only if you need to undo):
-- DROP TRIGGER IF EXISTS enforce_procedure_completion ON jobs;
-- DROP FUNCTION IF EXISTS enforce_procedure_completion();
-- DROP TABLE IF EXISTS job_procedure_progress;
-- DROP TABLE IF EXISTS procedure_steps;
-- DROP TABLE IF EXISTS cleaning_procedures;
-- ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_clean_type_check;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS clean_type;
-- ------------------------------------------------------------
