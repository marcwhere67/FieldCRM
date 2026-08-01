-- ============================================================================
-- RLS TEST SEED — org A + the test user the suite signs in as.
--
-- PREREQUISITE: create the auth user first (Supabase dashboard →
-- Authentication → Users → Add user), with a password, "Auto Confirm" ON.
-- Then set that same email as RLS_TEST_USER_EMAIL / password as _PASSWORD.
--
-- Replace the email below with that user's email, then run this in the SQL
-- editor. It auto-links by email, so there's no UUID to copy.
-- ============================================================================

-- Org A: the tenant the test session belongs to.
INSERT INTO organisations (id, name, slug)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'RLS Test Org A', 'rls-test-org-a')
ON CONFLICT (id) DO NOTHING;

-- Link the auth user to an app users row in org A (admin role).
INSERT INTO users (org_id, supabase_auth_id, email, full_name, role)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', au.id, au.email, 'RLS Test A', 'admin'
FROM auth.users au
WHERE au.email = 'REPLACE_WITH_TEST_EMAIL'
ON CONFLICT DO NOTHING;

-- Sanity check — should return exactly one row after seeding.
SELECT u.email, u.role, o.name AS org
FROM users u JOIN organisations o ON o.id = u.org_id
WHERE u.email = 'REPLACE_WITH_TEST_EMAIL';
