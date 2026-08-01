# Running the RLS tenant-isolation gate

The suite in `src/tests/rls.spec.ts` proves a session in org A cannot read, write
or delete org B's rows on all 21 org-scoped tables (84 assertions). It's the
SPEC.md §4 merge gate. It skips until pointed at a database. Here's the whole path.

## Step 1 — Create a throwaway Supabase project
Dashboard → New project. **Never use the live Salt Air project** — the suite
seeds and deletes a test org and signs in as a real user. A free-tier project is
fine. Note the project's **URL**, **anon key**, and **service_role key**
(Settings → API).

## Step 2 — Apply the schema + isolation policies
SQL editor → paste the whole of **`supabase/rls-test-bootstrap.sql`** → Run.

That file is `schema.sql` + `rls-test-policies.sql` (the real role-aware policies
for the 21 core tables, minus the numbering/totals triggers that would interfere
with seeding). It's generated — regenerate any time with `npm run rls:bootstrap`.

## Step 3 — Create the test user
Dashboard → Authentication → Users → **Add user**. Give it an email + password,
turn **Auto Confirm** ON. This is org A's user.

Then SQL editor → open **`supabase/rls-test-seed.sql`**, replace
`REPLACE_WITH_TEST_EMAIL` (two places) with that email → Run. It creates org A and
links the auth user to a `users` row. The sanity `SELECT` at the end must return
exactly one row.

## Step 4 — Run the suite
Set the five env vars and run. Locally:

```bash
export RLS_TEST_SUPABASE_URL="https://<project>.supabase.co"
export RLS_TEST_ANON_KEY="<anon key>"
export RLS_TEST_SERVICE_ROLE_KEY="<service_role key>"
export RLS_TEST_USER_EMAIL="<the email from step 3>"
export RLS_TEST_USER_PASSWORD="<that user's password>"
npm run test:rls
```

## Step 5 — Read the result
- **All green (84 passing)** → tenant isolation is proven, not assumed.
- **A failure** → a real cross-tenant leak; the failing table + operation names it.
  Fix the RLS policy before anything else.
- **"suite SKIPPED"** → an env var didn't reach the process. Not a pass.

## CI (permanent gate)
Add the same five as GitHub Actions repository secrets (Settings → Secrets and
variables → Actions). The `rls` job in `.github/workflows/ci.yml` already reads
them, fails if they're missing, and asserts real assertions ran — so once set,
every push to `main` re-proves isolation.

## If you'd rather I run it
Give me the five values **from the throwaway project only** (never production
keys) and I'll run step 4 here and report. The service_role key is powerful, so
only share a disposable-project one you can rotate afterward.
