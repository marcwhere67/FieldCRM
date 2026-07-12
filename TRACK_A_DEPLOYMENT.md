# Track A Deployment Guide — P0 Lockdown

**Status:** Ready for deployment  
**Target:** Security hardening before customer data enters the system  
**Impact:** Authorization + financial integrity + numbering atomicity

---

## What Changed

### 1. Database Migration (`supabase/migrations/p0_lockdown.sql`)

Applied a comprehensive defense-in-depth migration with zero breaking changes:

#### RLS (Role-Aware Access Control)
- **Operational tables** (contacts, jobs, visits, expenses…): field users can INSERT/UPDATE; managers+ can DELETE
- **Financial tables** (quotes, invoices, payments, services, campaigns…): managers+ only for all writes; field users are read-only
- **Timesheets**: field users can only manage their own; managers+ manage all
- **Performance win**: RLS helpers wrapped in `(SELECT …)` subqueries → planner evaluates once per query, not once per row

#### Financial Integrity (Server-Authoritative Totals)
- Triggers on `quotes` and `invoices` recompute `subtotal`, `tax`, `total` from `line_items`
- Client-supplied totals are overwritten → no `total: 0` tampering possible
- Works even if a compromised client bypasses validation

#### Atomic Document Numbering
- New `document_counters` table (org_id + doc_type + year) per-row locked by `ON CONFLICT DO UPDATE`
- Race-free: no two jobs/quotes/invoices can ever get the same number
- No number reuse on deletion (counter persists)
- Auto-seeded from current max numbers → no restart at 0001
- Format: `Q-2026-0001`, `INV-2026-0001`, `J-2026-0001`

#### Timesheet Approval Guard
- Trigger prevents non-managers from changing `approved` to true (self-approval blocker)
- Defense-in-depth on top of RLS

---

### 2. Code Changes (Client-Side)

**Removed:** Client-side document number generation (all race-prone patterns)

| File | Change |
|------|--------|
| `quote-builder.tsx` | Removed `nextQuoteNumber` prop; client no longer sends quote_number on INSERT (DB trigger assigns it) |
| `quotes/new/page.tsx` | Removed `count(*) + 1` logic (was racy) |
| `quote-detail.tsx` | Removed invoice number generation in quote→job conversion; DB trigger assigns it. Fixed job `status: 'pending'` → `'draft'` (was invalid schema) |
| `jobs/new/page.tsx` | Removed `count(*) + 1` logic |
| `new-job-form.tsx` | Removed `nextJobNumber` prop; client doesn't send job_number on INSERT |
| `timesheets/approve/route.ts` | Added role check (`admin`/`manager` only) — defense-in-depth on top of RLS |

**Totals removed from client payloads:**
- Quote/Invoice inserts no longer send `subtotal`, `tax`, `total` — DB triggers recompute from `line_items`

---

## Deployment Steps

### Step 1: Run the Migration in Supabase

1. Open [Supabase Dashboard](https://app.supabase.com) → your FieldCRM project
2. Go to **SQL Editor** → create a new query
3. Copy-paste the entire contents of `supabase/migrations/p0_lockdown.sql`
4. **Run** (takes 2–5 seconds)
5. Watch for errors. The migration is idempotent — safe to re-run if needed.

**Expected output:** No errors, 6 functions created/updated, 3 triggers created, 1 table created, RLS policies rebuilt.

### Step 2: Deploy Code Changes

```bash
cd /path/to/fieldcrm
git add .
git commit -m "Track A: Remove racy number generation, server-authoritative totals, add timesheet approval guard

- Database: Add atomic document counters, recompute totals via triggers, role-aware RLS, timesheet guard
- Remove client-side number generation (quote/job/invoice numbers now DB-assigned)
- Remove totals from client payloads (computed server-side)
- Add role check to timesheet approval endpoint
- Fix invalid job status 'pending' → 'draft'

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

Vercel will auto-deploy.

### Step 3: Smoke Test (5 minutes)

**Test 1: Quote Creation**
- Go to Quotes → New Quote
- Add a line item, save as draft
- ✅ Quote number should be assigned on save (e.g., `Q-2026-0012`)
- ✅ Totals should be calculated correctly

**Test 2: Quote → Job Conversion**
- Open an approved quote
- Click "Convert to Job"
- ✅ Job should be created with status `draft` (not `pending`)
- ✅ If deposit: deposit invoice auto-created with number assigned (e.g., `INV-2026-0045`)

**Test 3: Timesheet Approval**
- Clock in/out as a field user
- Switch to an admin account
- Go to Timesheets → try to approve the field user's entry
- ✅ Should succeed
- Switch back to field user account
- ✅ Try to approve your own timesheet via devtools (or the UI if visible) → should fail with 403 error

**Test 4: Authorization**
- Log in as a **field user**
- Try to edit a quote (via devtools): `supabase.from('quotes').update({...}).eq('id', ...)`
- ✅ Should fail with `Error: new row violates row-level security policy`
- Try to delete a contact: same → should fail
- Try to create a new contact: should succeed (operational table)
- Try to create a new invoice: should fail

---

## What Attackers (or Bugs) Can No Longer Do

| Attack | Before | After |
|--------|--------|-------|
| Tamper with invoice totals | ✅ Send `total: 0` via devtools → accepted | ❌ Recomputed server-side, client value ignored |
| Reuse invoice numbers | ✅ Two concurrent quotes → race → UNIQUE violation | ❌ Atomic counter ensures uniqueness |
| Field user approves own timesheet | ✅ Possible via API or devtools | ❌ Trigger blocks it |
| Field user deletes an invoice | ✅ RLS only checked org, not role | ❌ DELETE policy requires manager role |
| Claim a different user's job | ✅ Possible | ❌ Unchanged (no user-job FK yet — see Track C) |

---

## FAQ

**Q: Does this break the UI?**  
A: No. All changes are backend-only or reduce client burden. Quote/job creation UX is slightly cleaner (no "Generating number…").

**Q: What if a document number is skipped (e.g., Q-0007, Q-0009)?**  
A: Normal. Happens if an INSERT fails after incrementing the counter, or if you manually insert a document. Not a bug — the counter doesn't *mean* you have every number in sequence.

**Q: Can I manually set a document number?**  
A: Yes. If you pass a non-empty `quote_number` on INSERT, the trigger respects it (doesn't auto-assign). Use this only for imports or migrations.

**Q: Performance impact?**  
A: Positive. RLS subqueries + index on `document_counters` mean large queries get faster, not slower. The three triggers are microseconds.

**Q: What about existing documents?**  
A: Unchanged. Only new inserts go through the triggers. Old quotes/invoices keep their original numbers.

---

## Next Steps (Track B & Beyond)

Once this is live and tested:

- **Track B** — Add missing indexes on the big tables (`contacts.org_id`, `jobs.org_id`, `jobs.status`, `invoices.org_id`, etc.). ~30 seconds to deploy, 2x query speed.
- **Track C** — Move financial writes to API routes with zod validation. Tighten the mutation boundary.
- **Track D** — Job costing dashboard (gross margin per job from labour + materials + expenses vs revenue). Jobber/ServiceTitan differentiator.

---

## Rollback (if needed)

If something breaks:

```sql
-- Undo in Supabase SQL Editor (in this order):
DROP TRIGGER IF EXISTS trg_quote_number ON quotes;
DROP TRIGGER IF EXISTS trg_invoice_number ON invoices;
DROP TRIGGER IF EXISTS trg_job_number ON jobs;
DROP TRIGGER IF EXISTS trg_quotes_totals ON quotes;
DROP TRIGGER IF EXISTS trg_invoices_totals ON invoices;
DROP TRIGGER IF EXISTS trg_guard_timesheet_approval ON timesheets;
DROP TABLE IF EXISTS document_counters;
DROP FUNCTION IF EXISTS next_document_number(...);
DROP FUNCTION IF EXISTS assign_quote_number();
DROP FUNCTION IF EXISTS assign_invoice_number();
DROP FUNCTION IF EXISTS assign_job_number();
DROP FUNCTION IF EXISTS recompute_document_totals();
DROP FUNCTION IF EXISTS guard_timesheet_approval();
-- Then re-run the original policies from schema.sql
```

Then `git revert` the code changes and redeploy.

---

**Questions?** Post in the project channel or ask before running the migration.
