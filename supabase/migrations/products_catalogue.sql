-- ============================================================
-- Products / services catalogue — version-control record  2026-07-17
-- ============================================================
-- The `products` table (the Catalogue: services + products used to build
-- quotes) was created directly in the live database and never captured in
-- version control. This migration documents its structure so a fresh
-- environment can rebuild it, and backfills the auto-`updated_at` trigger the
-- other tables get in schema.sql (products was added after that loop, so it
-- was missing it).
--
-- NON-DESTRUCTIVE on the live DB: every statement is IF NOT EXISTS / guarded,
-- so on production (where the table already exists with its data) this changes
-- nothing except adding the missing updated_at trigger. Reconstructed from the
-- app's usage (api/products, catalogue-view, quote builders).
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'service' CHECK (type IN ('service','product')),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'each',
  category text,
  active boolean NOT NULL DEFAULT true
);

-- Index the catalogue's hot filter (org + active), matching core_indexes.sql.
CREATE INDEX IF NOT EXISTS idx_products_org_active ON products (org_id, active);

-- Row-level security: org members can manage their own org's catalogue.
-- (Writes are additionally gated to admin/manager in the API routes.)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products'
      AND policyname = 'org members can manage products'
  ) THEN
    CREATE POLICY "org members can manage products" ON products
      FOR ALL
      USING (org_id = auth_user_org_id())
      WITH CHECK (org_id = auth_user_org_id());
  END IF;
END $$;

-- Keep updated_at fresh on every UPDATE (function defined in schema.sql).
DROP TRIGGER IF EXISTS set_updated_at ON products;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- ROLLBACK  —  ⚠️ DESTRUCTIVE: only for a FRESH environment where this
-- migration CREATED the table. On production the table holds your live
-- catalogue — do NOT run the DROP TABLE line there; it deletes all products.
-- ============================================================
-- DROP TRIGGER IF EXISTS set_updated_at ON products;
-- DROP POLICY IF EXISTS "org members can manage products" ON products;
-- DROP INDEX IF EXISTS idx_products_org_active;
-- DROP TABLE IF EXISTS products;   -- ⚠️ deletes all catalogue rows
