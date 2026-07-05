-- ADMIN HUB TABLES
-- Run in Supabase SQL Editor (plain SQL tab)

CREATE TABLE IF NOT EXISTS sops (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_by uuid REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS admin_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  description text,
  url text NOT NULL,
  file_type text NOT NULL DEFAULT 'link',
  created_by uuid REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS employee_contracts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  url text NOT NULL,
  signed boolean NOT NULL DEFAULT false,
  signed_at timestamptz,
  expires_at date,
  created_by uuid REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id)
);

-- Enable RLS
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- RLS policies (org-scoped, same pattern as rest of app)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sops' AND policyname = 'org_access') THEN
    CREATE POLICY org_access ON sops USING (org_id = auth_user_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_documents' AND policyname = 'org_access') THEN
    CREATE POLICY org_access ON admin_documents USING (org_id = auth_user_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employee_contracts' AND policyname = 'org_access') THEN
    CREATE POLICY org_access ON employee_contracts USING (org_id = auth_user_org_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notices' AND policyname = 'org_access') THEN
    CREATE POLICY org_access ON notices USING (org_id = auth_user_org_id());
  END IF;
END $$;
