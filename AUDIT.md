# FieldCRM — Codebase Audit

Audited 2026-07-26 against commit `73abfc0`. Every claim below is cited to a file and line
I actually read.

---

## Verdict

This is a genuinely capable single-tenant CRM for Salt Air — the money paths (RLS lockdown,
server-authoritative totals, atomic document numbering, ABN/GST-aware PDFs) are better built
than most one-person builds ever get. But it is **not shippable as a multi-tenant product**,
and it has one live hole in the deployment you are running today: the role gate that is
supposed to keep the technician out of your books never executes, so `technician@` can read
every invoice, every quote, and every team member's hourly rate by typing the URL. Fix the
three P0s and this is safe for your own business; multi-tenancy, Stripe reconciliation and
offline field capture are the gap between "my tool" and "a product I sell".

---

## P0 — will lose data, leak data, or lose money

### P0-1. The field-role route gate is dead code. Your technician can read your entire book of business.

`src/app/(app)/layout.tsx:21` reads the current path from a request header:

```ts
const pathname = headersList.get('x-pathname') ?? ''
```

**Nothing in the codebase ever sets `x-pathname`.** `src/proxy.ts` is the only middleware and
it sets no headers (`src/proxy.ts:16-59`). I grepped the whole tree — one hit, the read at
`layout.tsx:21`. So `pathname` is always `''`, `segment` is always `'/'`, and the guard at
`layout.tsx:25-28`:

```ts
const FIELD_ALLOWED = ['/dashboard','/schedule','/jobs','/timesheets','/field-map','/clock','/settings']
if (profile?.role === 'field') {
  const segment = '/' + pathname.split('/')[1]
  if (!FIELD_ALLOWED.includes(segment)) redirect('/dashboard')
}
```

never redirects anybody. `'/'` is not in `FIELD_ALLOWED`, so it *should* redirect on every
page — it doesn't, because `profile?.role === 'field'` is the outer condition and the inner
check is comparing garbage. Either way the intent is broken.

**Exploit path (no tooling, just a browser):** log in as `technician@saltaircleaning.com.au`,
type `/invoices`, `/quotes`, `/reports`, `/finances`, `/team`. The sidebar hides the links
(`Sidebar` and `MobileNav` do take `role`), but the pages render. And RLS does not save you:
`p0_lockdown.sql:58-62` deliberately grants **org-wide SELECT to every role** on `quotes`,
`invoices`, `payments`, `timesheets`. Only `/payroll` (`payroll/page.tsx:12`) and
`/job-costing` (`job-costing/page.tsx:13`) guard themselves. `/finances/page.tsx:78` only
downgrades *edit* rights (`canManage`) — the revenue numbers still render.
`/team/page.tsx:16` selects `hourly_rate` for every staff member.

**Cost:** your technician sees every client's contract value, your margins, and what everyone
else is paid. This directly contradicts the rule you set for this project (Marc's account is
the template; technician stays restricted).

**Fix:** don't route-guard from a header. Either (a) set `x-pathname` in `src/proxy.ts` on
the forwarded request headers, or better (b) delete the layout guard and put an explicit
`requireManager()` call at the top of each server page that shows money — the same two-line
pattern already used correctly at `payroll/page.tsx:12`. Option (b) is the one I'd take: a
header can be spoofed by the client, a per-page check can't.

### P0-2. Every table added after the P0 lockdown reverted to `FOR ALL` — including HR records.

`p0_lockdown.sql` carefully tiers writes by role. Every migration written *after* it ignores
that and uses a single blanket policy. Concretely:

| Table | Policy | File:line |
|---|---|---|
| `employee_profiles` | `FOR ALL USING (org_id = auth_user_org_id())` | `team_hr.sql:22-25` |
| `leave_requests` | `FOR ALL` | `team_hr.sql:48-51` |
| `employee_contracts` | `CREATE POLICY org_access ... USING (org_id = ...)` — no command, no WITH CHECK | `admin_hub.sql:70` |
| `sops`, `admin_documents`, `notices` | same | `admin_hub.sql:64,67,73` |
| `client_documents` | `FOR ALL` | `client_documents.sql:25-28` |
| `products` (cost prices) | `FOR ALL` | `products_catalogue.sql:45-48` |
| `suppliers`, `purchase_orders` | `FOR ALL` | `suppliers.sql:20,49` |
| `assets` | `FOR ALL` | `assets.sql:21-24` |
| `job_notes` | `FOR ALL` | `job_notes.sql:18-21` |
| `cleaning_procedures`, `procedure_steps`, `job_procedure_progress` | `FOR ALL` | `2026-07-21_cleaning_procedures.sql:67,73,79` |
| `property_procedure_notes` | `FOR ALL` | `2026-07-21_property_procedure_notes.sql:21` |
| `message_templates` | `FOR ALL` | `message_templates.sql:27-30` |

`employee_profiles` holds emergency contacts, certifications and employment type
(`team_hr.sql:9-18`). `employee_contracts` is exactly what it sounds like. A field user can
read *and delete* all of them straight from the browser Supabase client — they don't even
need a route, `createClient()` in `src/lib/supabase/client.ts` is right there in the bundle.

**Australian angle:** emergency contacts + certifications + (via `users.hourly_rate`)
remuneration is personal information under the Privacy Act. An employee reading a colleague's
record is a notifiable-eligible disclosure if it goes further.

**Fix:** one migration that redefines these with the `p0_lockdown` tiering — SELECT org-wide
where it's operational (job_notes, procedures), manager-only SELECT *and* write for HR/money
(`employee_profiles`, `employee_contracts`, `leave_requests`, `products`, `suppliers`,
`purchase_orders`, `client_documents`). `auth_is_manager()` already exists
(`p0_lockdown.sql:19-22`) — this is copy-paste.

Also note `admin_hub.sql:64-73` omits `WITH CHECK` on a `FOR ALL` policy. Postgres falls
back to the `USING` expression for the insert check, so `org_id` *is* constrained to the
user's own org — but a `field` user in that org can still freely insert/update/delete
employee contracts, SOPs and notices, which is the real problem.

*Status: addressed by `supabase/migrations/2026-07-26_rls_role_tiering.sql` (needs to be
applied in the Supabase SQL Editor — migrations don't auto-run).*

### P0-3. Stripe is wired into the UI but there is no webhook. Card payments never reconcile.

`STRIPE_WEBHOOK_SECRET` is set in `.env.local`. There is **no route that consumes it** — I
grepped `constructEvent` across `src/`: zero hits. There is no `/api/stripe/*` route at all
(see the route listing; the only webhook is Twilio's).

Meanwhile `invoices.stripe_payment_link` and `invoices.stripe_payment_intent_id`
(`schema.sql:265,271`) are rendered to customers, and `payments` rows are only ever created
by `api/invoices/[id]/payment/route.ts:52`, which requires an admin/manager to be logged in
and click.

**Failure path:** a client pays by card via the payment link. Stripe takes the money.
FieldCRM never hears about it. The invoice stays `sent`, then flips to `overdue`, and the
quote-follow-up cron (`api/cron/quote-followup/route.ts`) plus your automations start chasing
a client who has already paid. You then hand-reconcile from the Stripe dashboard forever.

**Fix:** either build the webhook (`checkout.session.completed` / `payment_intent.succeeded`
→ verify signature with `stripe.webhooks.constructEvent` → upsert a `payments` row keyed on
`stripe_payment_intent_id` for idempotency), or rip the Stripe surfaces out of the invoice UI
and go bank-transfer-only (you already have `bank_details.sql` and PayID). Half-wired is the
worst of the three.

### P0-4. Recording a payment is not idempotent. A double-tap on a flaky connection double-credits.

`api/invoices/[id]/payment/route.ts:52-66` inserts a `payments` row with no idempotency key
and no uniqueness constraint. Line 77-79 then recomputes `amount_paid` as the **sum of all
payment rows**, and line 90 marks the invoice `paid`.

Field reality: you tap "Record payment" on a phone at a job site, the request is slow, you
tap again. Two rows, two receipt numbers (both issued by the trigger at
`record_payment.sql:25`), `amount_paid` = 2× the payment, invoice shows overpaid, and two
receipt emails land in the client's inbox. Your BAS is now wrong.

**Fix:** accept a client-generated `idempotency_key` (uuid minted when the modal opens),
add `UNIQUE (invoice_id, idempotency_key)` on `payments`, and treat a unique violation as
success. ~20 lines.

---

## P1 — will break under real use

### P1-1. Three features are querying columns that don't exist. They're silently 404ing.

- `api/ai/job-summary/route.ts:22` selects `notes` from `jobs`. The `jobs` table has
  `description` and `instructions` — no `notes` (`schema.sql:188-214`, and no migration adds
  it). PostgREST rejects the whole select, `job` is null, line 32 returns
  `{error:'Job not found'}`. **The AI job summary has never worked.**
- `api/ai/draft-reply/route.ts:23` selects `messages(body, ...)`. The column is `content`
  (`schema.sql:353`). Same outcome: 404 at line 29. **AI draft reply has never worked.**
- `api/twilio/webhook/route.ts:75` inserts a contact with `is_active: true`. `contacts` has
  no `is_active` column (`schema.sql:84-111`). The insert fails, `contactId` is undefined,
  and line 83-86 returns empty TwiML. **Every inbound SMS from a number not already in your
  contacts is silently discarded.** No error, no log, no message in the inbox. That's a lost
  lead every time.

### P1-2. Twilio webhook: not idempotent, and hard-wired to one org.

- `api/twilio/webhook/route.ts:44-49` finds the org with
  `.from('organisations').select('id').limit(1)` — it takes an **arbitrary org**, ignoring
  `To` (which it parsed at line 24 and never uses). Single-tenant today; a straight
  cross-tenant data-write leak the moment you onboard a second business.
- No dedupe on `external_message_id` (line 141). Twilio retries on any non-2xx or timeout, so
  a slow cold start gives you duplicate inbound messages and double-incremented
  `unread_count` (line 123).
- Signature check (line 14) is correctly implemented but **skipped when `TWILIO_AUTH_TOKEN`
  is unset**. If that env var ever goes missing in prod, the endpoint silently becomes an open
  write into your contacts and messages tables via the service role.

**Fix:** `UNIQUE (external_message_id)` on `messages` + `.upsert(..., {onConflict})`; look up
the org by `to` against a stored number; make the signature check fail-closed in production.

### P1-3. The field app has no offline story, despite being a PWA.

`next.config.ts:29-37` enables `next-pwa` with `cacheOnFrontEndNav` — that caches *page
shells*. Every write is a bare `fetch` with no queue:

- Clock in: `components/timeclock/clock-widget.tsx:44-49`. Fetch fails → `toast.error` →
  the punch is gone. The tech is on site and unpaid for that block.
- Job note: `components/jobs/job-notes.tsx:44-56` — same, note lost.
- Photo upload: `job-notes.tsx:61-83` posts the **raw file**, no client-side resize. A modern
  phone camera JPEG is 4-8 MB. On 3G at a coastal property that's 40-90 seconds with no
  progress indicator, and any drop loses it entirely.
- Status change: `job-detail.tsx:171` writes directly via the browser Supabase client, no
  retry.

**Fix, in order of value:** (1) canvas-downscale photos to ~1600px/80% before upload — turns
6 MB into ~400 KB and is 30 lines; (2) an IndexedDB outbox for clock punches and notes,
drained on `online`. Until (2) exists, at minimum stop swallowing the failure — keep the note
text in the textarea and say "not saved, still offline".

### P1-4. GPS is captured *after* the punch and thrown away on failure.

`clock-widget.tsx:54-59` and `75-80`: the punch is recorded, then GPS is fetched with a 4s
timeout and PATCHed in a fire-and-forget `.catch(() => {})`. Indoors or on patchy reception
you get no fix within 4s, and the timesheet has no location at all. There's no accuracy
threshold either — a 2 km cell-tower fix is stored as fact. If you ever need clock-in
location to settle a dispute, it won't be there.

### P1-5. No double-booking protection anywhere.

I grepped `schedule-view.tsx` and `new-job-form.tsx` for conflict/overlap logic — nothing.
`jobs` has `scheduled_start`/`scheduled_end` and `assigned_users uuid[]` (`schema.sql:202-206`)
with no exclusion constraint. Two jobs can be booked on the same tech at the same time from
the schedule page or by the recurring generator, and nobody finds out until the morning of.
An `EXCLUDE USING gist` constraint is awkward with a uuid array; a pre-insert overlap check
plus a visible warning is the pragmatic version.

### P1-6. Recurring generation is sequential and unbounded.

`lib/recurring.ts:131-165` loops every active agreement, and inside the loop awaits one INSERT
**per occurrence** (`insertJob`, line 159) plus a SELECT per agreement (line 137). At 21 days
horizon × weekly agreements that's fine at 10 clients; at 200 clients this is thousands of
serial round trips inside a Vercel function with a hard timeout. When it times out mid-way,
`last_generated_date` is only written at line 163 — after the loop — so a partial run leaves
jobs created but the cursor unadvanced, and the next run re-checks them (the `existingDates`
guard at line 141 saves you from duplicates, but only for jobs scheduled from today onward).

Also: `generateRecurringJobs` fetches agreements with **no `org_id` filter** (line 105). It's
service-role, so that's intentional cross-org batch work — but it means one org's bad data
can abort the run for everyone.

### P1-7. Error monitoring exists but Sentry is not installed.

`lib/monitor.ts` is well designed — console + durable `error_events` + optional Sentry. But
`forwardToSentry` (line 71) no-ops unless `SENTRY_DSN` is set, and `@sentry/nextjs` is not in
`package.json`. So today your only alerting is: a `critical` error emails the org address
*via the org's connected Gmail token* (`monitor.ts:88-112`) — which means **if Gmail auth is
what broke, the alert about it can't be sent**. Circular dependency on the failure path.

Worse, `captureError` is only wired into a handful of routes. `api/timeclock/punch/route.ts:111`
swallows everything into a bare 500 with the raw error message returned to the client.

### P1-8. PII in logs.

- `api/setup/route.ts:207-215` returns four sets of **real credentials in plaintext** in the
  HTTP response body. Yes, it's gated behind `ALLOW_SETUP` (line 11) — but the passwords are
  also hardcoded at lines 90, 94, 109, 123, 137 and committed to git. `SaltAir2024!` is in
  your repository history. Rotate those four passwords today regardless of anything else in
  this document.
- `api/timeclock/punch/route.ts:112` returns `err.message` verbatim to the client.
- `lib/monitor.ts:33` logs the full `context` object to Vercel logs; callers pass invoice ids,
  amounts and org ids (e.g. `payment/route.ts:71`). Not catastrophic, but Vercel logs are not
  a Privacy-Act-appropriate store for financial records — put a retention policy on them.

---

## P2 — technical debt with a date on it

**By the time you have a second paying org (multi-tenancy blockers):**

- `quotes.quote_number`, `invoices.invoice_number`, `jobs.job_number`, `payments.receipt_number`
  are **globally UNIQUE**, not unique-per-org (`schema.sql:161,196,254,294`). Org B creating
  `INV-0128` collides with Org A's. The counter is per-org
  (`2026-07-26_shared_document_counter.sql:32`) but the constraint isn't.
- Twilio org resolution (P1-2) and the hardcoded `'00000000-...-0001'` org id throughout
  `api/setup/route.ts`.
- `organisations.timezone` exists (`schema.sql:23`) and is **never read**. Everything
  hardcodes `Australia/Melbourne`: `recurring.ts:68`, `melbourneToUtcISO` (line 78),
  `p0_lockdown.sql:185`, `record_payment.sql:31`. Fine for Salt Air, wrong for a WA customer.

**Domain model — judged against how trades actually run:**

- **Recurring jobs are modelled correctly.** `service_agreements` is the template and
  `jobs.service_agreement_id` are the instances (`service_agreements.sql:14-39`). This is the
  thing most people get wrong and you got right.
- **`visits` is orphaned.** The table exists (`schema.sql:226-242`) with a proper
  visit_number/status/assignment shape, and the recurring generator writes *jobs*, not visits.
  Nothing in `src/` meaningfully uses it. Either delete it or decide that a multi-day epoxy
  job needs it — you can't invoice a 3-day floor job per-visit today.
- **No reschedule or cancel history.** Changing `scheduled_start` overwrites it
  (`job-detail.tsx:171` style updates). When a client says "you moved it twice, I want a
  discount", you have nothing.
- **No soft deletes on jobs, quotes or invoices.** `job-detail.tsx:156` does a hard
  `.delete()` behind a `confirm()`. `contacts` got `archived_at` (`contacts_archive.sql:7`) —
  jobs and quotes didn't. A mis-tap permanently destroys a job and its notes (job_notes
  cascades).
- **No audit trail on price changes.** `recompute_document_totals` (`p0_lockdown.sql:130-155`)
  recalculates on every `line_items` update and overwrites `subtotal/tax/total` with no
  history row. Someone edits an approved quote's price and there is no record it ever said
  something else.
- **Money is `numeric(12,2)`, not integer cents** (`schema.sql:164-166` etc). This is
  *acceptable* — Postgres `numeric` is exact, unlike float — but `lib/money.ts` does the JS
  side in floats and rounds (`money.ts:16`). The DB trigger is authoritative so drift can't
  persist, but the number the user sees mid-edit and the number stored can disagree by a cent.
- **Timestamps are `timestamptz` throughout** — correct, and `melbourneToUtcISO`
  (`recurring.ts:78-87`) handles the AEST/AEDT transition properly with a two-pass offset
  refine. Good work. The exposure is `payment/route.ts:62`:
  `new Date(`${paymentDate}T12:00:00`)` parses in the **server's** timezone (UTC on Vercel),
  so a payment dated 2026-07-01 is stored as 12:00 UTC = 22:00 Melbourne. Noon-anchoring
  saves you from date-shifting, but it's luck, not design.

**Dead code and half-built features:**

- The customer portal: `src/app/(portal)/**` (6 pages), `components/portal/**` (5 components),
  `api/portal/**`, `portal.sql` RLS policies — all live in the tree, all unreachable because
  `proxy.ts:9-14` redirects `/portal*` to `/login`. `api/portal/send-otp/route.ts` is stubbed
  to 404 with a comment explaining why. The RLS policies from `portal.sql` are **still active
  on `contacts`, `quotes`, `jobs`, `invoices`** in your database though — dormant, harmless
  while `portal_auth_id` is null everywhere, but they're attack surface for a feature you
  turned off.
- `api/cron/generate-jobs/route.ts` duplicates what `api/cron/tick/route.ts:30` already does,
  and isn't registered in `vercel.json` (only `quote-followup` and `tick` are). Dead route.
- The "Photos → Add" button on the job detail page (`job-detail.tsx:543-545`) has **no
  `onClick`**. It renders, it's styled, it does nothing. A tech taps it and thinks the app is
  broken. (Photos do work — via the notes tab.)
- `lib/cache.ts` exports `getCacheHeaders` — grep it, nothing calls it.
- `forms` / `form_submissions` tables (`schema.sql:456-485`): no UI, superseded by
  `/api/intake/[orgSlug]`.
- `call_tracking_numbers` (`schema.sql:420-430`): table only, no code.

**Migrations:**

`supabase/migrations/` has no ordering convention — `003_`, `004_`, then bare names
(`portal.sql`, `admin_hub.sql`), then ISO dates. There's no `schema_migrations` table and no
runner; the headers say "Run this in the Supabase SQL Editor". You cannot currently tell what
has been applied to production. `2026-07-26_shared_document_counter.sql:4-8` documents a bug
that shipped *because* of exactly this. Some files carry commented rollback blocks
(`core_indexes.sql:80`, `record_payment.sql:37`) — most don't.

---

## Quick wins — under 30 minutes each, biggest impact first

1. **Rotate the four `SaltAir2024!` passwords** and confirm `ALLOW_SETUP` is unset in Vercel.
   The passwords are in git history. ~5 min. (`api/setup/route.ts:90,94,109,123,137`)
2. **Add `requireManager()` to `/finances`, `/reports`, `/invoices`, `/quotes`, `/team`** —
   copy the two lines from `payroll/page.tsx:12`. Closes P0-1 for the pages that matter
   without touching the broken header plumbing. ~15 min.
3. **Delete `is_active: true` from `api/twilio/webhook/route.ts:75`.** One line. Restores
   inbound SMS from new numbers — every one of those is a lead you're currently dropping.
4. **Fix `notes` → `description` (`ai/job-summary/route.ts:22`) and `body` → `content`
   (`ai/draft-reply/route.ts:23`).** Two words. Turns two dead AI features back on.
5. **Client-side photo downscale before upload** in `job-notes.tsx:61`. ~30 min, turns a
   90-second 3G upload into 8 seconds.
6. **Add `onClick` to the job-detail Photos "Add" button, or delete it** (`job-detail.tsx:543`).
7. **Add `UNIQUE (external_message_id)` on `messages`** and switch the webhook insert to an
   upsert. Kills duplicate-SMS-on-retry. ~10 min.
8. **`npm i @sentry/nextjs` + set `SENTRY_DSN`.** `monitor.ts:65-84` is already written to
   pick it up. ~15 min and you stop finding out about failures from customers.

---

## What's missing entirely that a field management platform cannot ship without

1. **Payment reconciliation.** No Stripe webhook (P0-3). Every card payment is manual data
   entry. This is the single biggest gap between this and Jobber.
2. **Offline write queue.** A field app for "patchy coastal reception" that loses a clock
   punch on a failed fetch isn't a field app. The PWA shell is there; the outbox isn't.
3. **A migration runner.** No `schema_migrations`, no ordering, no way to know prod's state.
   You will eventually apply something twice or skip something, at 2am, on a Friday.
4. **Reschedule / cancellation history + soft deletes.** Trade disputes are settled with
   history. There is none, and a hard `.delete()` on jobs is one mis-tap from unrecoverable.
5. **Scheduling conflict detection.** Nothing stops double-booking a tech (P1-5).
6. **Client-facing surfaces.** The portal is built and switched off (`proxy.ts:9`). Quote
   acceptance works via the public `/quote-approval/[id]` link — which is well built,
   rate-limited (`quote-approval/route.ts:9`), state-guarded (line 27) and expiry-checked
   (line 30) — but there is no self-service booking and no online invoice payment page. Every
   one of those is a friction point where money leaks.
7. **Invoice reminders / dunning.** `invoices.status` has `overdue` in the CHECK
   (`schema.sql:255`) but nothing ever sets it — no cron transitions `sent` → `overdue`, and
   nothing chases. `cron/quote-followup` chases quotes; nothing chases money you're owed.
8. **A GST/BAS export.** You have `tax` per document and `expenses.tax_included`
   (`schema.sql:499`) but no quarterly report. Your accountant will ask.

---

## AI spend

Verdict: **this is the healthiest part of the codebase and needs almost no work.** All four
calls use `claude-haiku-4-5-20251001` with tight ceilings — 512 tokens (`quote-suggest:35`,
`insights:67`, `job-summary:69`), 256 (`draft-reply:52`). Right model for the difficulty,
ceilings present. Notes:

- **`ai/insights` should not be an LLM call at all** (`api/ai/insights/route.ts:48-62`). You
  compute revenue, deltas, overdue totals and job-type breakdowns in JS at lines 38-46, then
  pay Claude to write three sentences about numbers you already have. A template with three
  `if` branches ("revenue down X%", "$Y overdue across Z invoices") gives the same value,
  instantly, for free, and can't hallucinate a number. This is the one call I'd delete.
- **No rate limiting on any AI route.** `lib/rate-limit.ts` exists and is used on the public
  endpoints, but not on `/api/ai/*`. Authenticated-only, so the blast radius is your own
  staff — but a stuck retry loop in a client component will happily burn your key.
- **No prompt caching**, correctly — these prompts are short and don't share a stable prefix.
  Nothing to cache. Don't add it.
- Two of the four calls are dead anyway (P1-1), so your actual AI spend right now is
  `quote-suggest` + `insights`.

---

## What this system actually does today vs. what it thinks it does

**Does, and does well:** contacts/pipeline, quotes with a room-based calculator, quote PDF +
email send (multi-quote), public quote acceptance, jobs with cleaning-procedure checklists and
photo proof, recurring service agreements → generated jobs, invoices + receipts with
GST-correct "Tax Invoice" labelling (`invoice-pdf.tsx:337`) and ABN (line 315), manual payment
recording, Gmail-based inbox, timeclock, timesheets, payroll export.

**Thinks it does:** customer portal (off), Stripe payments (no webhook), Meta/Facebook DMs
(`schema.sql:335` channel enum, env vars, zero code), call tracking (table only), forms
(superseded), AI job summaries and draft replies (broken queries), automations
(`automation-engine.ts` + queue exist and are drained by `cron/tick:23` — this one is real,
but there's one daily cron at 06:00, so a "1 hour after job completion" step actually fires
up to 24 hours late).

---

*Nothing in this audit has been fixed. Tell me which items to take and I'll start with P0-1
and P0-2 — they're one migration and five two-line page guards between them.*
