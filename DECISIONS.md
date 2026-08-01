# Decisions

Assumptions made under ambiguity, per SPEC.md §1. Newest first.

---

## D-011 — Added End of Lease as a 4th clean type
**Date:** 2026-08-02

User's explicit choices: End of Lease / Bond Clean; priced identically to Deep
Clean for now (may get its own pricing model later); I draft the Scope of
Work wording for review; add a staff completion checklist now.

**Decision:** found and updated all 8 hardcoded `'regular'|'deep'|'airbnb'`
literal spots across the app (quote calculator, quote builder, job forms,
admin procedures, scope-of-work.ts) plus the 3 database CHECK constraints
(`quotes.clean_type`, `jobs.clean_type`, `cleaning_procedures.clean_type`),
via migration `2026-08-02_end_of_lease_clean_type.sql`.

**Pricing:** the calculator's `deep` timing flag now also matches
`end_of_lease`, so both price identically off the same per-room minutes —
verified live (1 bedroom + 1 kitchen + 1 bathroom = $540.00 under both). When
a distinct pricing model is wanted later, this is a one-line split back into
its own flag, not a rework.

**Scope of Work wording — DRAFTED FOR REVIEW, not yet business-confirmed.**
Built by extending the Deep Clean list with what AU end-of-lease/bond cleans
typically add: full oven in/out, wardrobes, exhaust fans, blinds, interior
window glass, garage sweep. **Deliberately excludes any "bond back guarantee"
or free re-clean promise** — that's a contractual commitment for Marc to
decide on, not a cleaning-scope detail; a test (`scope-of-work.test.ts`)
asserts this text never sneaks in. Same content also seeds the staff
completion checklist (`cleaning_procedures`/`procedure_steps`) so quote scope
and job checklist stay in sync from day one.

**Consequence:** verified live that a not-yet-migrated environment degrades
correctly — Admin → Procedures shows "End of Lease Clean — No procedure set
up yet [+ Create]" rather than erroring, and will auto-populate with the
seeded 23-step checklist the moment the migration runs.

---

## D-010 — Free-form per-user signature editor, reusing the existing template engine
**Date:** 2026-08-01

User's explicit choice: full free-form editor (not just more structured
fields), per-person in Settings → Profile (not a shared org-wide setting).

**Decision:** reuse the app's EXISTING `{{snake_case}}` merge-field engine
(`renderTemplate` in `src/lib/templates.ts`, already used for quote/invoice/
appointment message templates) rather than inventing a second templating
syntax. New variable catalog (`SIGNATURE_VARIABLES` in
`src/lib/emails/custom-signature.ts`) is kept SEPARATE from the existing
`TEMPLATE_VARIABLES` — `job_title` already means something different there
(a job/service title, not a staff member's title), so merging catalogs would
have created a real naming collision.

Empty/unset template = automatically use the existing CRM-built signature —
this feature is purely additive. A user flipping to "Write my own" for the
first time gets a working starter template (not a blank box), built from the
exact fields the default signature already uses.

**Resolution priority in `resolveSenderSignatureHtml`:** custom template →
CRM-built structured signature → live Gmail signature (unchanged from D-007).

**Consequence — verified live:** the new `users.email_signature_template`
column isn't applied to this environment yet. Confirmed the read path
degrades gracefully (preview and default signature both work, `captureError`
logs a clear warning) and the write path fails with a friendly, non-leaking
message (`friendlyDbError`) rather than a raw Postgres error — save will
start working the moment the migration
(`2026-08-01_custom_email_signature.sql`) is applied, no code changes needed.

---

## D-009 — Logo moved into the signature block; quote-acceptance email unified
**Date:** 2026-08-01

Two changes, same theme ("every email needs the same structure"):

1. **Logo placement.** Every email previously had a navy logo banner at the
   top (`shellHtml`'s `headerHtml`), separate from the sign-off block at the
   bottom. Per explicit instruction, the logo now lives INSIDE the signature
   (above "Kind regards,") and the top banner is gone — one logo per email,
   not two. Applies uniformly: real sends, the rare generic fallback (no
   Gmail/CRM signature available), and the Settings → Profile preview all use
   the same `buildSenderSignatureHtml`, so there is exactly one code path that
   can render a logo into an email.

2. **Quote-acceptance confirmation unified with every other send.** It
   previously used its own hand-rolled HTML in `sendBrandedAsOrg`, calling
   `getGmailSignature` directly — bypassing the CRM-signature system entirely
   (D-007's whole point) and explaining why it "had no signature." Rewrote
   `sendBrandedAsOrg` to use the same `shellHtml`/`resolveSenderSignatureHtml`
   pipeline as quotes/invoices/receipts.

   This email has no logged-in sender (a customer triggers it by clicking
   Approve). Per instruction: credit whoever actually SENT that quote. Added
   `quotes.sent_by` (migration `2026-08-01_quote_sent_by.sql`, nullable, set
   automatically when Send is clicked) and thread it through as the signature
   identity, falling back to whichever Gmail is connected for the org for
   quotes sent before this column existed (same fallback the job-auto-invoice
   email already used) — the user's explicit choice.

**Consequence:** a real, if minor, bug was caught during verification —
`height="32"` as a bare HTML attribute was overridden by Tailwind's preflight
`img { height: auto }`, rendering the logo at full natural size in the
Settings preview. Fixed by moving `height`/`width` into the inline `style`
(higher CSS specificity). Both the real logo path and the fallback path had
the same bug; both fixed.

Both new DB dependencies (`quotes.sent_by`, `organisations.website`/
`instagram_url` from D-008) are fetched via isolated, error-tolerant queries —
a missing column degrades gracefully (older sender-fallback behaviour) rather
than breaking the public approve/decline endpoint.

---

## D-008 — Website/Instagram fetched separately in the signature resolver
**Date:** 2026-08-01

Website and Instagram (`organisations.website`/`instagram_url`) ship via a
migration (`user_email_signature.sql`) written in an earlier session, whose
live-database status this session couldn't verify in advance.

**Decision:** rather than adding these two columns to each of the 6 existing
per-route `organisations` selects (any one missing column would 400 the whole
query and break that send), `resolveSenderSignatureHtml` fetches them itself
in an isolated, error-tolerant query. A missing column just omits those two
signature lines — it can never break an actual quote/invoice send. Confirmed
live (2026-08-01): the migration was already applied, both fields populated
with real data, and the signature renders exactly as specified: labelled
`Phone: / Email: / Website: / Instagram:` lines, website as a clean linked
domain, Instagram as a linked `@handle` extracted from the profile URL.
**Consequence:** Settings → Business gained editable Website/Instagram
fields; the org fetch in `settings/page.tsx` has the same resilient fallback
for the same reason.

---

## D-007 — Per-sender email signature is CRM-built, not fetched from Gmail
**Date:** 2026-08-01

Marc and Tegan share one Gmail login (hello@saltaircleaning.com.au). Gmail's
signature is a property of the mailbox, not of who's using it — so fetching it
live (`getGmailSignature`) could never distinguish sender A from sender B, no
matter which one's OAuth token was used to send. Confirmed by user: they
manually swap Gmail's signature by hand today when using a personal device.

**Decision:** build the signature from CRM data instead — `users.full_name`
(NOT NULL, always available) + `employee_profiles.job_title` (optional,
admin/manager-editable via Settings → Team, unchanged from existing access
rules) + `users.phone` (falls back to org phone if unset) + org name/email.
Resolution order per user's explicit choice: CRM-built signature first, live
Gmail fetch only as a fallback (dormant in practice, since full_name is
mandatory — kept for defensiveness, not expected to trigger).

**Consequence:** job title is not self-editable by field-role staff (existing
restriction, untouched) — Marc/Tegan can already set their own since they're
both admins. A live preview was added to Settings → Profile (built from the
exact same pure function used at send time) so what's seen matches what's
sent, no test email required to verify.

---

## D-006 — BAS GST summary is computed on an accrual basis
**Phase:** P1-8 · **Date:** 2026-07-31

The BAS GST summary (`/api/export?type=bas`) totals sales and GST by **invoice
issue date** (accrual), not by payment date (cash). Invoice data supports this
cleanly; a cash-basis figure would need every payment apportioned back to its
invoice's GST fraction.

**Decision:** ship accrual, and **label it in the output** ("Basis: Accrual
(invoice date)") so the accountant knows which basis they're filing. Most small
trades can lodge on either basis as long as it's consistent and disclosed.
**Consequence:** a cash-basis tenant will want a cash variant later — a follow-up,
not a correctness bug. Salt Air isn't GST-registered, so their summary is all
zeros regardless.

---

## D-005 — A stored invalid ABN will block saving org settings
**Phase:** P1-4 · **Date:** 2026-07-31

`settings/org` now checksum-validates `abn`. If a tenant already has a
non-checksum-valid ABN stored (e.g. a placeholder), the admin cannot save *any*
org-settings change until they enter a valid ABN or clear the field.

**Decision:** accept this. Forcing valid data at the point of entry is the whole
point of the moat, and a real trading business has a valid ABN. An empty ABN is
explicitly allowed, so the escape hatch is "clear the field" if one isn't handy.
**Consequence:** if Salt Air's stored ABN is a placeholder, the first org-settings
save will surface it — that's the validator doing its job, not a regression.

---

## D-004 — The RLS suite runs against a real project, not a throwaway Postgres
**Phase:** P0-1 · **Date:** 2026-07-31

RLS policies here depend on `auth_user_org_id()`, `auth_user_role()` and a live
`auth.users` row, so a bare Postgres container would not exercise the real policy
path. The suite therefore signs a real user in with the anon key and seeds a
second org via the service key.

**Assumption:** a paying tradie cares that isolation is proven against the actual
deployment, not a simulation. **Consequence:** the gate needs `RLS_TEST_*` secrets
and a non-production project. It skips locally; CI fails if the secrets are absent,
so a skip can never read as a pass.

---

## D-003 — Malformed idempotency keys are now rejected, not ignored
**Phase:** P0-1 · **Date:** 2026-07-31

`/api/invoices/[id]/payment` previously dropped a `client_request_id` that failed
its regex and carried on. That silently disabled idempotency: the retry of a
timed-out request became a **second real payment**.

**Decision:** a malformed key is a 400. An absent key is still allowed (older
clients), but a present-and-broken one fails loudly.

---

## D-002 — Money stays in dollars for now; the invariants move first
**Phase:** P0-1 · **Date:** 2026-07-31

SPEC.md §1 rule 4 mandates integer cents. The live schema stores
`numeric(12,2)` dollars across quotes, invoices, payments, expenses and
products, with DB triggers recomputing totals.

**Decision:** defer the representation change (AUDIT-vs-SPEC P3-12) and enforce
the invariants cents would give us at the boundary instead — `zMoney` rejects
negatives, non-finite values and sub-cent precision.

**Why:** a cents migration touches the schema, the triggers, three PDF renderers,
the email templates and every component at once. Doing it before the validation
and RLS gates exist means doing it without a safety net. **Consequence:** the
migration is still owed and is now a pure representation change.

---

## D-001 — `zUuid` is laxer than RFC 4122
**Phase:** P0-1 · **Date:** 2026-07-31

Zod 4's `z.uuid()` enforces the RFC version and variant nibbles, which rejects
this app's own seeded identifiers (e.g. `00000000-0000-0000-0000-000000000001`).

**Decision:** match Postgres's `uuid` type (any 32 hex digits in 8-4-4-4-12 form)
rather than the RFC. Locked in by a regression test.
