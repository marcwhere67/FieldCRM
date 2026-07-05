-- FieldCRM Seed Data
-- Run AFTER schema.sql
-- Note: Users with supabase_auth_id must be created via Auth first.
-- This seed uses placeholder auth IDs that should be replaced with real ones,
-- or run via the service role which bypasses RLS.

-- For demo purposes, we insert with RLS bypassed (service role).

-- Insert organisation
INSERT INTO organisations (id, name, abn, phone, email, address, timezone, subscription_plan)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Salt Air Cleaning',
  '12 345 678 901',
  '+61 3 9000 0000',
  'admin@saltaircleaning.com.au',
  '123 Collins St, Melbourne VIC 3000',
  'Australia/Melbourne',
  'professional'
) ON CONFLICT (id) DO NOTHING;

-- Insert users (supabase_auth_id will be linked after real auth users are created)
INSERT INTO users (id, org_id, email, full_name, role, phone, hourly_rate, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'marc@saltaircleaning.com.au', 'Marc Hare', 'admin', '+61 400 100 001', 85.00, true),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'tegan@saltaircleaning.com.au', 'Tegan', 'admin', '+61 400 100 002', 70.00, true),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'technician@saltaircleaning.com.au', 'Technician', 'field', '+61 400 100 003', 45.00, true)
ON CONFLICT (id) DO NOTHING;

-- Insert pipeline stages
INSERT INTO pipeline_stages (id, org_id, name, position, color, pipeline_type)
VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'New Lead', 0, '#6366f1', 'leads'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Contacted', 1, '#8b5cf6', 'leads'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'Quote Sent', 2, '#f59e0b', 'leads'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000001', 'Quote Approved', 3, '#10b981', 'leads'),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000001', 'Job Booked', 4, '#3b82f6', 'leads'),
  ('00000000-0000-0000-0001-000000000006', '00000000-0000-0000-0000-000000000001', 'Completed', 5, '#14b8a6', 'leads'),
  ('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0000-000000000001', 'Invoiced', 6, '#f97316', 'leads'),
  ('00000000-0000-0000-0001-000000000008', '00000000-0000-0000-0000-000000000001', 'Paid', 7, '#22c55e', 'leads')
ON CONFLICT (id) DO NOTHING;

-- Insert services
INSERT INTO services (id, org_id, name, description, category, unit_price, unit, tax_rate)
VALUES
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000001', 'Standard House Clean', 'Full interior clean — 3 bed 2 bath', 'Cleaning', 280.00, 'job', 10.0),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000001', 'Deep Clean', 'Intensive clean including oven, fridge, grout', 'Cleaning', 450.00, 'job', 10.0),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0000-000000000001', 'End of Lease Clean', 'Bond-back guaranteed clean', 'Cleaning', 550.00, 'job', 10.0),
  ('00000000-0000-0000-0002-000000000004', '00000000-0000-0000-0000-000000000001', 'Window Clean (Internal)', 'All internal windows and tracks', 'Windows', 150.00, 'job', 10.0),
  ('00000000-0000-0000-0002-000000000005', '00000000-0000-0000-0000-000000000001', 'Carpet Steam Clean', 'Per room steam cleaning', 'Carpet', 80.00, 'room', 10.0)
ON CONFLICT (id) DO NOTHING;

-- Insert contacts (mix of leads and clients)
INSERT INTO contacts (id, org_id, first_name, last_name, email, phone, suburb, state, postcode, status, source, tags, assigned_to, pipeline_stage_id)
VALUES
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-000000000001', 'Emily', 'Chen', 'emily.chen@email.com', '+61 411 111 001', 'Richmond', 'VIC', '3121', 'active', 'referral', ARRAY['vip','repeat'], '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000008'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0000-000000000001', 'Marcus', 'Thompson', 'marcus.t@gmail.com', '+61 411 111 002', 'Fitzroy', 'VIC', '3065', 'active', 'google_ad', ARRAY['end-of-lease'], '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0001-000000000007'),
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0000-000000000001', 'Priya', 'Sharma', 'priya.sharma@work.com', '+61 411 111 003', 'South Yarra', 'VIC', '3141', 'prospect', 'facebook_ad', ARRAY['lead'], '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000003'),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0000-000000000001', 'Daniel', 'Walsh', 'dan.walsh@hotmail.com', '+61 411 111 004', 'Collingwood', 'VIC', '3066', 'lead', 'website_form', ARRAY['new'], '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0000-000000000001', 'Rachel', 'Kim', 'rachel.kim@email.com', '+61 411 111 005', 'Hawthorn', 'VIC', '3122', 'active', 'referral', ARRAY['repeat','carpet'], '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000008'),
  ('00000000-0000-0000-0003-000000000006', '00000000-0000-0000-0000-000000000001', 'Jake', 'Morrison', 'jake.m@company.com.au', '+61 411 111 006', 'St Kilda', 'VIC', '3182', 'prospect', 'google_ad', ARRAY['commercial'], '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0001-000000000002'),
  ('00000000-0000-0000-0003-000000000007', '00000000-0000-0000-0000-000000000001', 'Aisha', 'Patel', 'aisha.p@gmail.com', '+61 411 111 007', 'Carlton', 'VIC', '3053', 'lead', 'facebook_ad', ARRAY['new','deep-clean'], '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000001'),
  ('00000000-0000-0000-0003-000000000008', '00000000-0000-0000-0000-000000000001', 'Ben', 'Fletcher', 'ben.fletcher@icloud.com', '+61 411 111 008', 'Northcote', 'VIC', '3070', 'active', 'referral', ARRAY['vip'], '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0001-000000000006'),
  ('00000000-0000-0000-0003-000000000009', '00000000-0000-0000-0000-000000000001', 'Sophie', 'Laurent', 'sophie.l@email.com', '+61 411 111 009', 'Prahran', 'VIC', '3181', 'inactive', 'manual', ARRAY['inactive'], '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0001-000000000006'),
  ('00000000-0000-0000-0003-000000000010', '00000000-0000-0000-0000-000000000001', 'Connor', 'Hughes', 'c.hughes@techco.com', '+61 411 111 010', 'Docklands', 'VIC', '3008', 'prospect', 'google_ad', ARRAY['commercial','windows'], '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0001-000000000003')
ON CONFLICT (id) DO NOTHING;

-- Insert properties for key contacts
INSERT INTO properties (id, org_id, contact_id, label, address_line1, suburb, state, postcode, lat, lng)
VALUES
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0003-000000000001', 'Home', '12 Bridge Rd', 'Richmond', 'VIC', '3121', -37.8182, 145.0036),
  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0003-000000000002', 'Home', '45 Smith St', 'Fitzroy', 'VIC', '3065', -37.7998, 144.9784),
  ('00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0003-000000000005', 'Home', '88 Glenferrie Rd', 'Hawthorn', 'VIC', '3122', -37.8225, 145.0325),
  ('00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0003-000000000008', 'Home', '3 High St', 'Northcote', 'VIC', '3070', -37.7710, 144.9996)
ON CONFLICT (id) DO NOTHING;

-- Insert quotes
INSERT INTO quotes (id, org_id, contact_id, property_id, quote_number, status, line_items, subtotal, tax, total, valid_until)
VALUES
  (
    '00000000-0000-0000-0005-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000003',
    NULL,
    'Q-2026-001',
    'sent',
    '[{"name":"Deep Clean","qty":1,"unit_price":450.00,"tax_rate":10.0,"subtotal":450.00}]',
    450.00, 45.00, 495.00,
    (CURRENT_DATE + 30)
  ),
  (
    '00000000-0000-0000-0005-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000010',
    NULL,
    'Q-2026-002',
    'approved',
    '[{"name":"Window Clean (Internal)","qty":1,"unit_price":150.00,"tax_rate":10.0,"subtotal":150.00},{"name":"Standard House Clean","qty":1,"unit_price":280.00,"tax_rate":10.0,"subtotal":280.00}]',
    430.00, 43.00, 473.00,
    (CURRENT_DATE + 14)
  ),
  (
    '00000000-0000-0000-0005-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0004-000000000001',
    'Q-2026-003',
    'converted',
    '[{"name":"Standard House Clean","qty":1,"unit_price":280.00,"tax_rate":10.0,"subtotal":280.00}]',
    280.00, 28.00, 308.00,
    (CURRENT_DATE - 10)
  )
ON CONFLICT (id) DO NOTHING;

-- Insert jobs
INSERT INTO jobs (id, org_id, contact_id, property_id, job_number, title, status, scheduled_start, scheduled_end, assigned_users, checklist)
VALUES
  (
    '00000000-0000-0000-0006-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0004-000000000001',
    'J-2026-001',
    'Standard House Clean — Emily Chen',
    'scheduled',
    (now() + interval '2 hours'),
    (now() + interval '5 hours'),
    ARRAY['00000000-0000-0000-0000-000000000012'::uuid],
    '[{"label":"Vacuum all rooms","completed":false,"completed_by":null,"completed_at":null},{"label":"Mop hard floors","completed":false,"completed_by":null,"completed_at":null},{"label":"Clean bathrooms","completed":false,"completed_by":null,"completed_at":null},{"label":"Wipe kitchen benches","completed":false,"completed_by":null,"completed_at":null}]'
  ),
  (
    '00000000-0000-0000-0006-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000002',
    '00000000-0000-0000-0004-000000000002',
    'J-2026-002',
    'End of Lease Clean — Marcus Thompson',
    'in_progress',
    (now() - interval '1 hour'),
    (now() + interval '3 hours'),
    ARRAY['00000000-0000-0000-0000-000000000012'::uuid],
    '[{"label":"Clean oven","completed":true,"completed_by":"Tom Bradley","completed_at":"2026-06-27T08:00:00Z"},{"label":"Clean fridge","completed":false,"completed_by":null,"completed_at":null},{"label":"Steam grout","completed":false,"completed_by":null,"completed_at":null}]'
  ),
  (
    '00000000-0000-0000-0006-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000005',
    '00000000-0000-0000-0004-000000000003',
    'J-2026-003',
    'Carpet Steam Clean — Rachel Kim',
    'completed',
    (now() - interval '2 days'),
    (now() - interval '2 days' + interval '3 hours'),
    ARRAY['00000000-0000-0000-0000-000000000012'::uuid],
    '[{"label":"Pre-treat stains","completed":true,"completed_by":"Tom Bradley","completed_at":"2026-06-25T09:00:00Z"},{"label":"Steam clean lounge","completed":true,"completed_by":"Tom Bradley","completed_at":"2026-06-25T10:00:00Z"},{"label":"Steam clean bedrooms","completed":true,"completed_by":"Tom Bradley","completed_at":"2026-06-25T11:00:00Z"}]'
  ),
  (
    '00000000-0000-0000-0006-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000008',
    '00000000-0000-0000-0004-000000000004',
    'J-2026-004',
    'Deep Clean — Ben Fletcher',
    'invoiced',
    (now() - interval '5 days'),
    (now() - interval '5 days' + interval '4 hours'),
    ARRAY['00000000-0000-0000-0000-000000000012'::uuid],
    '[]'
  ),
  (
    '00000000-0000-0000-0006-000000000005',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0004-000000000001',
    'J-2026-005',
    'Standard House Clean — Emily Chen (Jun)',
    'paid',
    (now() - interval '10 days'),
    (now() - interval '10 days' + interval '3 hours'),
    ARRAY['00000000-0000-0000-0000-000000000012'::uuid],
    '[]'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert invoices
INSERT INTO invoices (id, org_id, contact_id, job_id, invoice_number, status, line_items, subtotal, tax, total, amount_paid, due_date, sent_at)
VALUES
  (
    '00000000-0000-0000-0007-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000008',
    '00000000-0000-0000-0006-000000000004',
    'INV-2026-001',
    'sent',
    '[{"name":"Deep Clean","qty":1,"unit_price":450.00,"tax_rate":10.0,"subtotal":450.00}]',
    450.00, 45.00, 495.00, 0,
    (CURRENT_DATE + 7),
    (now() - interval '4 days')
  ),
  (
    '00000000-0000-0000-0007-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000005',
    '00000000-0000-0000-0006-000000000003',
    'INV-2026-002',
    'paid',
    '[{"name":"Carpet Steam Clean","qty":3,"unit_price":80.00,"tax_rate":10.0,"subtotal":240.00}]',
    240.00, 24.00, 264.00, 264.00,
    (CURRENT_DATE - 5),
    (now() - interval '7 days')
  ),
  (
    '00000000-0000-0000-0007-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0006-000000000005',
    'INV-2026-003',
    'paid',
    '[{"name":"Standard House Clean","qty":1,"unit_price":280.00,"tax_rate":10.0,"subtotal":280.00}]',
    280.00, 28.00, 308.00, 308.00,
    (CURRENT_DATE - 10),
    (now() - interval '12 days')
  )
ON CONFLICT (id) DO NOTHING;
