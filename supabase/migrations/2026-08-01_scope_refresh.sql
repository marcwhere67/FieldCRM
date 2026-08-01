-- ============================================================
-- Scope of Work refresh — 2026-08-01
-- ============================================================
-- Client-facing scope wording (src/lib/scope-of-work.ts) was rewritten for
-- all four clean types: added a Laundry line to Regular/Deep/Airbnb, and
-- rewrote End of Lease as a fully standalone list (was "everything in Deep,
-- plus…") with a new footnote disclaiming bond-return guarantee.
--
-- This migration brings the staff completion checklist (cleaning_procedures
-- / procedure_steps) back in sync with that wording, per clean type per org.
-- Existing steps for these 4 clean types are REPLACED (not appended) so the
-- checklist matches exactly — idempotent, safe to re-run.
--
-- NOTE: replacing steps cascade-deletes any job_procedure_progress rows tied
-- to the old step ids (ON DELETE CASCADE). Any IN-PROGRESS job relying on
-- the old checklist will lose its tick marks for changed steps. Acceptable
-- for a wording refresh; flagging for awareness.
-- ============================================================

DO $$
DECLARE
  org record;
  proc_id uuid;
BEGIN
  FOR org IN SELECT id FROM organisations LOOP

    -- ---------------------------------------------------------
    -- Regular
    -- ---------------------------------------------------------
    SELECT id INTO proc_id FROM cleaning_procedures WHERE org_id = org.id AND clean_type = 'regular';
    IF proc_id IS NULL THEN
      INSERT INTO cleaning_procedures (org_id, clean_type, title, description, status)
      VALUES (org.id, 'regular', 'Regular Clean', 'A maintenance clean designed to maintain cleanliness and presentation of a regularly serviced property.', 'active')
      RETURNING id INTO proc_id;
    END IF;

    DELETE FROM procedure_steps WHERE procedure_id = proc_id;

    INSERT INTO procedure_steps (procedure_id, org_id, area, order_index, title, is_required) VALUES
      (proc_id, org.id, 'kitchen', 1, 'Kitchen bench tops, splashbacks and surfaces cleaned', true),
      (proc_id, org.id, 'kitchen', 2, 'Sink and cooktop cleaned', true),
      (proc_id, org.id, 'kitchen', 3, 'Exterior of appliances wiped', true),
      (proc_id, org.id, 'kitchen', 4, 'Kitchen and bathroom cupboard exteriors and kickboards wiped', true),
      (proc_id, org.id, 'bathroom', 5, 'Bathrooms: toilet, shower screen/walls and base, sinks, vanity surfaces and mirrors cleaned', true),
      (proc_id, org.id, 'laundry', 6, 'Laundry: sink, tapware and surfaces wiped', true),
      (proc_id, org.id, 'bedroom', 7, 'Bedrooms and living areas dusted and surfaces cleaned', true),
      (proc_id, org.id, 'floors', 8, 'Floors vacuumed and mopped throughout accessible areas', true),
      (proc_id, org.id, 'floors', 9, 'Skirting boards dusted', true);

    -- ---------------------------------------------------------
    -- Deep
    -- ---------------------------------------------------------
    SELECT id INTO proc_id FROM cleaning_procedures WHERE org_id = org.id AND clean_type = 'deep';
    IF proc_id IS NULL THEN
      INSERT INTO cleaning_procedures (org_id, clean_type, title, description, status)
      VALUES (org.id, 'deep', 'Deep Clean', 'A detailed service intended for properties requiring a higher level of attention, build-up removal, or periodic intensive cleaning.', 'active')
      RETURNING id INTO proc_id;
    END IF;

    DELETE FROM procedure_steps WHERE procedure_id = proc_id;

    INSERT INTO procedure_steps (procedure_id, org_id, area, order_index, title, is_required) VALUES
      (proc_id, org.id, 'kitchen', 1, 'Kitchen bench tops, splashbacks and surfaces cleaned', true),
      (proc_id, org.id, 'kitchen', 2, 'Sink and cooktop cleaned', true),
      (proc_id, org.id, 'kitchen', 3, 'Exterior of appliances wiped', true),
      (proc_id, org.id, 'kitchen', 4, 'Kitchen and bathroom cupboard exteriors and kickboards wiped', true),
      (proc_id, org.id, 'kitchen', 5, 'Kitchen cupboards cleaned internally (non-food cupboards only)', true),
      (proc_id, org.id, 'kitchen', 6, 'Interior microwave cleaning', true),
      (proc_id, org.id, 'kitchen', 7, 'Range hood filter cleaned', true),
      (proc_id, org.id, 'kitchen', 8, 'Interior and exterior of kitchen and bathroom bins cleaned', true),
      (proc_id, org.id, 'bathroom', 9, 'Bathrooms: toilet, shower screen/walls and base, sinks, vanity surfaces and mirrors cleaned', true),
      (proc_id, org.id, 'bathroom', 10, 'Bathrooms given additional detailed cleaning, including grout scrubbing and tap fittings', true),
      (proc_id, org.id, 'laundry', 11, 'Laundry: sink, tapware and surfaces wiped', true),
      (proc_id, org.id, 'laundry', 12, 'Laundry given additional detailed clean, including exterior of appliances', true),
      (proc_id, org.id, 'bedroom', 13, 'Bedrooms and living areas dusted and surfaces cleaned', true),
      (proc_id, org.id, 'floors', 14, 'Floors vacuumed and mopped throughout accessible areas', true),
      (proc_id, org.id, 'floors', 15, 'Skirting boards thoroughly cleaned', true),
      (proc_id, org.id, 'floors', 16, 'Window tracks cleaned where accessible', true),
      (proc_id, org.id, 'general', 17, 'Light switches, door handles and door frames wiped down', true),
      (proc_id, org.id, 'general', 18, 'Spot-cleaning of visible marks on walls where safely removable', true),
      (proc_id, org.id, 'general', 19, 'Accessible air conditioning filters removed, cleaned and put back', true),
      (proc_id, org.id, 'general', 20, 'Additional detailed attention to reachable high areas (ceiling fans, light fittings, exhaust fan covers), up to a two-step ladder height', true);

    -- ---------------------------------------------------------
    -- Airbnb
    -- ---------------------------------------------------------
    SELECT id INTO proc_id FROM cleaning_procedures WHERE org_id = org.id AND clean_type = 'airbnb';
    IF proc_id IS NULL THEN
      INSERT INTO cleaning_procedures (org_id, clean_type, title, description, status)
      VALUES (org.id, 'airbnb', 'Airbnb / Short-Stay Turnover Clean', 'A presentation-focused service designed specifically for short-term rental properties between guest stays.', 'active')
      RETURNING id INTO proc_id;
    END IF;

    DELETE FROM procedure_steps WHERE procedure_id = proc_id;

    INSERT INTO procedure_steps (procedure_id, org_id, area, order_index, title, is_required) VALUES
      (proc_id, org.id, 'kitchen', 1, 'Kitchen bench tops, splashbacks and surfaces cleaned', true),
      (proc_id, org.id, 'kitchen', 2, 'Sink and cooktop cleaned', true),
      (proc_id, org.id, 'kitchen', 3, 'Exterior of appliances wiped', true),
      (proc_id, org.id, 'kitchen', 4, 'Kitchen and bathroom cupboard exteriors and kickboards wiped', true),
      (proc_id, org.id, 'kitchen', 5, 'Interior check of cupboards and appliances for cleanliness and guest-left items', true),
      (proc_id, org.id, 'kitchen', 6, 'Dishes left by guests washed and returned to cupboards', true),
      (proc_id, org.id, 'kitchen', 7, 'Kitchen and bathroom bins emptied, re-lined, wiped down where required', true),
      (proc_id, org.id, 'bathroom', 8, 'Bathrooms: toilet, shower screen/walls and base, sinks, vanity surfaces and mirrors cleaned', true),
      (proc_id, org.id, 'laundry', 9, 'Laundry: sink, tapware and surfaces wiped', true),
      (proc_id, org.id, 'bedroom', 10, 'Bedrooms and living areas dusted and surfaces cleaned', true),
      (proc_id, org.id, 'bedroom', 11, 'Linen changed and beds remade with provided linen', true),
      (proc_id, org.id, 'general', 12, 'High-touch points cleaned (door handles, light switches)', true),
      (proc_id, org.id, 'floors', 13, 'Floors vacuumed and mopped throughout accessible areas', true),
      (proc_id, org.id, 'floors', 14, 'Skirting boards dusted', true),
      (proc_id, org.id, 'turnover', 15, 'Property reset to standard presentation (surfaces cleared, furniture/objects returned, general tidiness restored)', true),
      (proc_id, org.id, 'turnover', 16, 'Restocking of guest amenities using client-provided supplies', true),
      (proc_id, org.id, 'turnover', 17, 'BBQ exterior wiped down and grill plate cleaned where accessible', true),
      (proc_id, org.id, 'turnover', 18, 'Quick post-stay condition check of the property', true),
      (proc_id, org.id, 'turnover', 19, 'After-photos taken of the cleaned property and sent to the client', true),
      (proc_id, org.id, 'turnover', 20, 'Reporting of visible guest damages or issues to the client', true);

    -- ---------------------------------------------------------
    -- End of Lease
    -- ---------------------------------------------------------
    SELECT id INTO proc_id FROM cleaning_procedures WHERE org_id = org.id AND clean_type = 'end_of_lease';
    IF proc_id IS NULL THEN
      INSERT INTO cleaning_procedures (org_id, clean_type, title, description, status)
      VALUES (org.id, 'end_of_lease', 'End of Lease Clean', 'A thorough end of lease clean for vacating properties, assuming the property is empty of furniture and belongings (occupied properties may affect access and incur additional cost).', 'active')
      RETURNING id INTO proc_id;
    ELSE
      UPDATE cleaning_procedures
      SET description = 'A thorough end of lease clean for vacating properties, assuming the property is empty of furniture and belongings (occupied properties may affect access and incur additional cost).'
      WHERE id = proc_id;
    END IF;

    DELETE FROM procedure_steps WHERE procedure_id = proc_id;

    INSERT INTO procedure_steps (procedure_id, org_id, area, order_index, title, is_required) VALUES
      (proc_id, org.id, 'kitchen', 1, 'Kitchen bench tops, splashbacks and surfaces cleaned', true),
      (proc_id, org.id, 'kitchen', 2, 'Sink and cooktop cleaned', true),
      (proc_id, org.id, 'kitchen', 3, 'Exterior of appliances wiped', true),
      (proc_id, org.id, 'kitchen', 4, 'Oven cleaned inside and out, including racks and door glass (exterior/interior panel only, not between double-glazed panels)', true),
      (proc_id, org.id, 'kitchen', 5, 'Interior microwave cleaning', true),
      (proc_id, org.id, 'kitchen', 6, 'Range hood filter cleaned', true),
      (proc_id, org.id, 'kitchen', 7, 'Interior and exterior of kitchen and bathroom bins cleaned', true),
      (proc_id, org.id, 'kitchen', 8, 'Interior and exterior of all cupboards and drawers cleaned throughout the house (kitchen, bathroom, bedrooms, living areas — excluding food storage cupboards)', true),
      (proc_id, org.id, 'bedroom', 9, 'Wardrobes and built-in storage cleaned internally, including shelving and tracks', true),
      (proc_id, org.id, 'bathroom', 10, 'Bathrooms: toilet, shower screen/walls and base, sinks, vanity surfaces and mirrors cleaned', true),
      (proc_id, org.id, 'bathroom', 11, 'Bathrooms given additional detailed cleaning, including grout scrubbing and tap fittings', true),
      (proc_id, org.id, 'laundry', 12, 'Laundry: sink, tapware and surfaces wiped, including exterior of appliances', true),
      (proc_id, org.id, 'bedroom', 13, 'Bedrooms and living areas dusted and surfaces cleaned', true),
      (proc_id, org.id, 'floors', 14, 'Floors vacuumed and mopped throughout accessible areas', true),
      (proc_id, org.id, 'floors', 15, 'Carpets vacuumed throughout', true),
      (proc_id, org.id, 'floors', 16, 'Skirting boards, architraves and door frames cleaned throughout', true),
      (proc_id, org.id, 'floors', 17, 'Window tracks cleaned where accessible', true),
      (proc_id, org.id, 'general', 18, 'Light switches and door handles wiped down', true),
      (proc_id, org.id, 'general', 19, 'Spot-cleaning of visible marks on walls where safely removable', true),
      (proc_id, org.id, 'general', 20, 'Accessible air conditioning filters removed, cleaned and put back', true),
      (proc_id, org.id, 'general', 21, 'All light fittings, exhaust fans and ceiling fans cleaned, up to a two-step ladder height', true);

  END LOOP;
END $$;

-- ============================================================
-- ROLLBACK NOTE
-- ============================================================
-- This migration replaces step content, not structure — there is no clean
-- automatic rollback (old wording isn't preserved). If needed, restore step
-- text from git history of this file or the prior migrations
-- (2026-07-21_cleaning_procedures.sql seed block, 2026-08-02_end_of_lease_clean_type.sql).
