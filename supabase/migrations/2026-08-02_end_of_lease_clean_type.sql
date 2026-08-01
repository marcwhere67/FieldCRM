-- ============================================================
-- Add 'end_of_lease' as a 4th clean type — 2026-08-02
-- ============================================================
-- Priced the same as Deep Clean for now (per business decision — may get its
-- own pricing model later). Gets its own Scope of Work wording (quotes) and
-- its own staff completion checklist (cleaning_procedures), same as
-- Regular/Deep/Airbnb.
--
-- Widens the existing CHECK constraints on quotes.clean_type,
-- jobs.clean_type and cleaning_procedures.clean_type from 3 values to 4.
-- Non-destructive: no existing row's clean_type value changes.
-- ============================================================

-- quotes.clean_type — constraint was explicitly named in 2026-07-19_quote_clean_type.sql
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_clean_type_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_clean_type_check
  CHECK (clean_type IS NULL OR clean_type IN ('regular','deep','airbnb','end_of_lease'));

-- jobs.clean_type — constraint was explicitly named in 2026-07-21_cleaning_procedures.sql
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_clean_type_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_clean_type_check
  CHECK (clean_type IS NULL OR clean_type IN ('regular','deep','airbnb','end_of_lease'));

-- cleaning_procedures.clean_type — this one was an inline (unnamed) column
-- CHECK, so Postgres auto-generated its name. Find and drop it dynamically
-- rather than guessing the generated name.
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'cleaning_procedures'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%clean_type%'
  LOOP
    EXECUTE format('ALTER TABLE cleaning_procedures DROP CONSTRAINT %I', con.conname);
  END LOOP;

  ALTER TABLE cleaning_procedures ADD CONSTRAINT cleaning_procedures_clean_type_check
    CHECK (clean_type IN ('regular','deep','airbnb','end_of_lease'));
END $$;

-- ------------------------------------------------------------
-- Seed: one End of Lease procedure per existing org, same pattern as the
-- Regular/Deep/Airbnb seed in 2026-07-21_cleaning_procedures.sql. Idempotent.
-- Scope drafted from typical AU bond-clean inclusions, built as an extension
-- of the Deep Clean checklist (oven in/out, wardrobes, exhaust fans, blinds,
-- interior window glass, garage) — DELIBERATELY EXCLUDES any "bond back
-- guarantee" / free re-clean promise, since that is a contractual commitment
-- for the business to decide on, not a cleaning-scope detail. Flagged for
-- review, same as the rest of this wording.
-- ------------------------------------------------------------
DO $$
DECLARE
  org record;
  proc_id uuid;
BEGIN
  FOR org IN SELECT id FROM organisations LOOP
    IF NOT EXISTS (SELECT 1 FROM cleaning_procedures WHERE org_id = org.id AND clean_type = 'end_of_lease') THEN
      INSERT INTO cleaning_procedures (org_id, clean_type, title, description, status)
      VALUES (
        org.id, 'end_of_lease', 'End of Lease Clean',
        'A comprehensive clean designed to help meet real estate and landlord expectations at the end of a tenancy, covering the areas most commonly checked during a bond/exit inspection.',
        'active'
      )
      RETURNING id INTO proc_id;

      INSERT INTO procedure_steps (procedure_id, org_id, area, order_index, title, is_required) VALUES
        (proc_id, org.id, 'kitchen', 1, 'Kitchen bench tops, splashbacks and surfaces cleaned', true),
        (proc_id, org.id, 'kitchen', 2, 'Sink and cooktop cleaned', true),
        (proc_id, org.id, 'kitchen', 3, 'Exterior of appliances wiped', true),
        (proc_id, org.id, 'kitchen', 4, 'Kitchen cupboards and drawers cleaned inside and out (non-food cupboards only)', true),
        (proc_id, org.id, 'kitchen', 5, 'Interior and exterior oven cleaning', true),
        (proc_id, org.id, 'kitchen', 6, 'Interior microwave cleaning', true),
        (proc_id, org.id, 'kitchen', 7, 'Range hood and filter cleaned', true),
        (proc_id, org.id, 'bathroom', 8, 'Bathrooms: toilet, shower, sinks and visible surfaces cleaned', true),
        (proc_id, org.id, 'bathroom', 9, 'Bathrooms given additional detailed cleaning including grout, tap fittings and exhaust fans', true),
        (proc_id, org.id, 'bathroom', 10, 'Bathroom cabinets and drawers cleaned inside and out', true),
        (proc_id, org.id, 'bedroom', 11, 'Bedrooms and living areas dusted and cleaned', true),
        (proc_id, org.id, 'bedroom', 12, 'Built-in wardrobes cleaned inside and out', true),
        (proc_id, org.id, 'general', 13, 'Ceiling fans and light fittings cleaned', true),
        (proc_id, org.id, 'floors', 14, 'Floors vacuumed and mopped throughout accessible areas', true),
        (proc_id, org.id, 'floors', 15, 'Carpets vacuumed throughout', true),
        (proc_id, org.id, 'floors', 16, 'Skirting boards thoroughly cleaned', true),
        (proc_id, org.id, 'floors', 17, 'Window tracks and sills cleaned where accessible', true),
        (proc_id, org.id, 'floors', 18, 'Interior window glass cleaned', true),
        (proc_id, org.id, 'general', 19, 'Light switches, door handles and door frames wiped down', true),
        (proc_id, org.id, 'general', 20, 'Accessible air conditioning filters removed, cleaned and put back', true),
        (proc_id, org.id, 'general', 21, 'Blinds dusted/wiped where accessible', true),
        (proc_id, org.id, 'general', 22, 'Exhaust fans cleaned throughout', true),
        (proc_id, org.id, 'general', 23, 'Garage/carport floor swept where accessible', true);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- ROLLBACK (paste to undo)
-- ============================================================
-- DELETE FROM procedure_steps WHERE procedure_id IN (SELECT id FROM cleaning_procedures WHERE clean_type = 'end_of_lease');
-- DELETE FROM cleaning_procedures WHERE clean_type = 'end_of_lease';
-- ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_clean_type_check;
-- ALTER TABLE quotes ADD CONSTRAINT quotes_clean_type_check CHECK (clean_type IS NULL OR clean_type IN ('regular','deep','airbnb'));
-- ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_clean_type_check;
-- ALTER TABLE jobs ADD CONSTRAINT jobs_clean_type_check CHECK (clean_type IS NULL OR clean_type IN ('regular','deep','airbnb'));
-- ALTER TABLE cleaning_procedures DROP CONSTRAINT IF EXISTS cleaning_procedures_clean_type_check;
-- ALTER TABLE cleaning_procedures ADD CONSTRAINT cleaning_procedures_clean_type_check CHECK (clean_type IN ('regular','deep','airbnb'));
