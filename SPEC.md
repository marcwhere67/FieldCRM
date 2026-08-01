# FieldCRM — Engineering Spec (the standard, effective 2026-07-31)

This is the governing standard for all future work on FieldCRM. Where existing code
conflicts, the conflict is recorded in `AUDIT-vs-SPEC.md` and closed deliberately —
not silently.

## 0. Mission
Commercial-grade, multi-tenant field service management + CRM for the Australian
trade services market. Benchmark: Jobber, ServiceM8, Tradify, GoHighLevel. Must beat
all of them on automation depth and Australian tax compliance, and lose to none of
them on reliability.

## 1. Quality bar — every change must satisfy all of these
1. Typed end to end. No `any`, no unchecked casts, no `@ts-ignore`.
2. Every DB mutation goes through a server action or route handler with **Zod-validated**
   input. Never trust the client.
3. Every table has RLS enforced by tenant. RLS is the security boundary, not app code.
4. Money = integer cents. Timestamps = `timestamptz` stored UTC, rendered Australia/Melbourne.
5. Every list endpoint paginated and indexed. No unbounded `select *`.
6. Every external call (Stripe, Twilio, Resend, Google, Anthropic) wrapped in a
   retry-with-backoff client, idempotent, logged to an outbound event table.
7. Every user-facing error is actionable. No raw exception text in the UI.
8. Every feature ships with tests: unit for business logic, integration for the data
   layer **with RLS assertions**, and at least one Playwright path for the critical flow.

Ambiguity rule: state it, choose what a paying tradie would prefer, record the
assumption in `DECISIONS.md`.

## 2. Stack (fixed)
Next.js 14+ App Router (RSC default) · TypeScript strict · Supabase (Postgres, RLS,
Edge Functions, Realtime, pg_cron, pgvector) · Supabase Auth (email + magic link +
Google) · Stripe (Checkout, Payment Links, Connect) · Twilio (AU sender IDs, +61) ·
Resend (per-tenant verified domains) · Google Maps Platform (Places, Distance Matrix,
Directions) · Anthropic Claude (server-side only) · Tailwind + shadcn/ui ·
Supabase Storage (signed URLs only) · Edge Functions + pg_cron + durable job queue ·
Vercel.

## 3. Australian requirements — non-negotiable (the moat)
- **AUD only** in v1. Cents integers. Display `$1,234.56`.
- **GST 10%.** Every line item carries `tax_treatment`: `gst | gst_free | input_taxed`.
  Totals reconcile to the cent; rounding applied on the tax line, not per item, and the
  rule is documented.
- **ABN** validated with the modulus-89 checksum (not a regex). Stored formatted
  `12 345 678 901`. Tenants without an ABN are flagged for no-ABN withholding warnings.
- **Tax invoice compliance.** Over $82.50 inc GST must show: "Tax Invoice", supplier
  identity, supplier ABN, issue date, item description, GST amount (or a statement that
  the total includes GST), and the buyer's identity/ABN where total ≥ $1,000. A validator
  blocks sending a non-compliant invoice.
- **Timezone** Australia/Melbourne with DST. Store UTC. No date maths on local strings.
- **Phone** normalised to E.164 `+61…` on write. Accept `04xx`, `+614xx`, `(03) 5xxx`.
- **Addresses** AU format, state enum, 4-digit postcode validation, Places restricted
  to `country: au`.
- **Public holidays** per-state table, VIC seeded minimum; scheduling and SLA timers respect it.
- **Export** CSV/journal shaped for Xero and MYOB, plus a BAS-ready GST summary by period.

## 4. Data model conventions
Multi-tenant shared schema, tenant key `not null` on every business table.
Every table: `id uuid default gen_random_uuid()`, tenant key, `created_at`, `updated_at`,
`created_by`, soft delete via `deleted_at`.
- RLS policy on every table (tenant match + role check for write).
- `tests/rls.spec.ts` proves tenant A cannot read/update/delete tenant B's rows on
  **every** table. This test gates merges.
- Index `(tenant_id, created_at desc)` and every FK.
- Status fields are Postgres enums, never free text.
- Totals computed in **one shared pricing module** used by server, PDF and email
  renderers, so quote / PDF / invoice can never disagree.

Domain groups: core (tenants, users, members, invites, audit_log) · CRM (contacts,
properties, leads, sources, pipelines, stages, deals, activities, notes, tags) · sales
(quotes, line items, versions, price book, templates, quote_events with IP+timestamp) ·
delivery (jobs, visits, assignments, checklists, photos, notes, timesheets, gps_pings,
materials) · money (invoices, payments, refunds, credit notes, recurring plans,
payment_intents, stripe_events) · automation (workflows, triggers, steps, runs,
templates, outbound/inbound messages, conversations) · ops (job_queue,
webhook_deliveries, feature_flags, usage_counters, subscription).

## 5. Modules (done = UI + server actions + tests + RLS coverage)
Auth/tenancy · contacts+properties · lead capture · pipeline · price book + quoting ·
scheduling/dispatch · offline-first field PWA · invoicing · payments · automation
engine · two-way messaging · reviews · reporting · AI layer · settings · client portal ·
platform billing.

## 6. AI layer — server side only
Rate-limited per tenant, cost-metered into `usage_counters`, human-reviewable by default.
Lead responder (60s first reply, auto-send opt-in) · quote drafting from price book only
(never invents prices) · job summarisation · inbox triage · follow-up copywriter ·
"ask your business" NL reporting via parameterised, tenant-scoped, whitelisted queries
(never raw model SQL to the DB). Prompt templates live in version-controlled files, not
the DB. Log prompt, model, tokens, latency on every call.

## 7. Differentiators to build deliberately
Zero-touch lead→cash · offline-first field app · speed-to-lead measured and shown on the
dashboard · quote intelligence (alert on second open) · true job costing (labour +
materials → gross margin per job) · compliance that just works (BAS export, compliant
tax invoices) · sub-second UI (LCP < 2s on 4G mobile).

## 8. Working method
Per phase: state phase + acceptance criteria → list files before writing → write full
code (no placeholders/TODOs) → write tests → give exact migration + verify commands →
report done / deferred / assumptions. Stop for review before the next phase.
