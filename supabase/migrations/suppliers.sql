-- Phase 24: Supplier / Purchase Orders

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  website text,
  category text,
  notes text,
  is_active bool DEFAULT true
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can manage suppliers"
  ON suppliers FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON suppliers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  job_id uuid REFERENCES jobs(id),
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, sent, received, cancelled
  line_items jsonb NOT NULL DEFAULT '[]', -- [{description, quantity, unit_price, subtotal}]
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  expected_date date,
  received_date date,
  expense_id uuid REFERENCES expenses(id)
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can manage purchase orders"
  ON purchase_orders FOR ALL
  USING (org_id = auth_user_org_id())
  WITH CHECK (org_id = auth_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON purchase_orders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
