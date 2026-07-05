-- Phase 22: Asset & Equipment Management
CREATE TABLE IF NOT EXISTS assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL, -- vehicle, tool, equipment, other
  serial_number text,
  assigned_to uuid REFERENCES users(id),
  purchase_date date,
  purchase_price numeric(10,2),
  maintenance_due date,
  last_serviced date,
  notes text,
  status text NOT NULL DEFAULT 'active' -- active, maintenance, retired
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage assets"
  ON assets FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON assets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
