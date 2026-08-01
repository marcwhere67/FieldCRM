# Decisions

Assumptions made under ambiguity, per SPEC.md §1. Newest first.

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
