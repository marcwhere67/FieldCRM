-- Phase 23: Team / HR

CREATE TABLE IF NOT EXISTS employee_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  hire_date date,
  job_title text,
  department text,
  employment_type text DEFAULT 'full_time', -- full_time, part_time, casual, contractor
  skills text[] DEFAULT '{}',
  certifications jsonb DEFAULT '[]', -- [{name, issued, expires, issuer}]
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  notes text
);

ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can manage employee profiles"
  ON employee_profiles FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON employee_profiles;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON employee_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL, -- annual, sick, unpaid, other
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(4,1) NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, declined
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can manage leave requests"
  ON leave_requests FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON leave_requests;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
