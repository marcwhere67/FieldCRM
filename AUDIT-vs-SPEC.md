# FieldCRM vs SPEC.md — gap audit (2026-07-31)

Method: read the actual tree — 99 API routes, 30 pages, 23 tables in `supabase/schema.sql`,
34 migrations, 5 test files. Every claim below is grepped, not remembered.

**Overall: ~55% of the spec. Strong on lifecycle and modules; weak on the engineering
bar (validation, cents, tests) and on the AU compliance moat.**

---

## A. Quality bar — 8 rules

| # | Rule | Status | Evidence |
|---|---|---|---|
| 1 | No `any` / `@ts-ignore` | 🟡 near | 13 `any`, 0 ts-ignore |
| 2 | Zod on every mutation | 🔴 **0%** | `zod` in deps; **0 of 99 routes import it**. Hand-rolled checks only |
| 3 | RLS per tenant | 🟢 done | `org_id` on 23 tables, role-tiered policies (p0_lockdown + 2026-07-26_rls_role_tiering) |
| 4 | Money in cents | 🔴 no | schema uses `numeric(12,2)` dollars throughout |
| 4b | timestamptz UTC → Melbourne | 🟢 done | `format.ts` Intl-pinned, DST-correct, tested |
| 5 | Paginated + indexed | 🟡 partial | `core_indexes.sql` applied; lists use a 500 safety cap, not real paging |
| 6 | Retrying/idempotent external clients | 🔴 no | Gmail/Twilio/Anthropic called raw. No outbound event table (only `outbound_messages`-ish per-feature logging). One exception: payment idempotency migration |
| 7 | Actionable errors | 🟡 partial | `monitor.ts`/`error_events` good; ~20 swallowed catches remain |
| 8 | Unit + RLS-integration + Playwright | 🔴 30% | 5 unit files (money/format/recurring/gmail/emails). **0 RLS tests, 0 Playwright, no CI** |

## B. Stack

| Spec | Reality |
|---|---|
| Next 14+ App Router, TS strict | 🟢 Next 16.2.9, RSC-first |
| Supabase + RLS | 🟢 |
| pg_cron / Edge Functions / durable queue | 🟡 Vercel cron (2 daily) + `automation_queue` (resumable). No Edge Functions, no pgvector |
| Auth: email + magic link + Google | 🟡 password + magic link; no Google sign-in |
| **Stripe** | 🔴 deliberately removed (fc8a1c5) — bank transfer only. SDK still in deps, 11 stale refs |
| Twilio | 🟡 wired (webhook, SMS, signature validation) but not live |
| **Resend** | 🔴 replaced by personal Gmail OAuth send. Junk-folder risk + ~500/day cap |
| **Google Maps (Places/Distance Matrix)** | 🔴 absent — Leaflet/OSM only. No travel-time slotting, no AU-restricted autocomplete |
| Anthropic server-side | 🟢 `lib/anthropic.ts`, 4 AI routes |
| Tailwind + shadcn | 🟢 |

## C. Australian moat — the biggest gap

| Requirement | Status |
|---|---|
| AUD, cents integers | 🔴 dollars as numeric |
| GST 10%, `tax_treatment` enum per line | 🔴 free `tax_rate` numeric, default 10, Salt Air runs 0. No treatment enum, no documented rounding rule (currently sums per-line tax then rounds) |
| **ABN modulus-89 validation** | 🔴 **none** — free-text field printed on PDFs |
| **Tax invoice compliance validator** | 🔴 **none** — only a cosmetic "Tax Invoice" title when tax>0. Nothing blocks a non-compliant send |
| Melbourne/DST | 🟢 done and tested |
| **Phone E.164 normalisation** | 🔴 none — free text |
| **AU address: state enum + postcode validation** | 🔴 free text `suburb/state/postcode` |
| **Public holidays table** | 🔴 none |
| **Xero/MYOB export + BAS summary** | 🔴 none |

## D. Data model conventions

| Convention | Status |
|---|---|
| tenant key on every table | 🟢 (`org_id`, not `tenant_id`) |
| `created_at/updated_at` | 🟢 |
| `created_by` | 🟡 inconsistent |
| **`deleted_at` soft delete** | 🔴 0 occurrences (only `contacts.archived_at`) |
| **Postgres enums for status** | 🔴 0 — all text + CHECK constraints |
| **`audit_log`** | 🔴 absent |
| Single shared pricing module | 🟡 `lib/money.ts` exists + DB triggers authoritative, but PDF/email paths don't all route through it |
| Indexes on FK/tenant | 🟢 |

## E. Modules present vs spec

🟢 Built: auth/roles, contacts+properties, intake→pipeline, price book (`products`),
quoting (builder, PDF, public accept, deposits, scope-of-work), scheduling, invoicing,
manual payments+receipts, automation engine (resumable), Gmail inbox, reviews page,
reporting/finances, **job costing (real differentiator, shipped)**, recurring agreements,
settings, admin hub, timesheets/payroll, assets, suppliers, purchase orders.

🟡 Partial: field app (PWA configured, GPS clock-in, photos, notes — **no offline queue**);
messaging (email real, SMS stubbed, campaign send is a placeholder that doesn't email);
reviews (no negative-sentiment intercept, no timing engine).

🔴 Missing: client portal (disabled 2026-07-12), platform/SaaS billing, self-serve
onboarding, lead capture beyond one web form (no Facebook Lead Ads, no call tracking use),
deals/quote_versions/checklists-as-modelled, `quote_events` view-tracking with IP.

## F. Differentiators

| Differentiator | Status |
|---|---|
| True job costing (margin/job) | 🟢 shipped |
| Compliance that just works | 🔴 the weakest area — see §C |
| Offline-first field app | 🔴 no offline queue |
| **Speed-to-lead metric on dashboard** | 🔴 not measured |
| **Quote intelligence (2nd-open alert)** | 🔴 no view tracking at all |
| Zero-touch lead→cash | 🟡 lead→cash chain works end-to-end but needs human keystrokes at 3 points |
| Sub-second UI | ❓ never measured |

---

## Ranked plan to close the gap

**P0 — the engineering bar (do before any new feature)** — 🚧 phase P0-1 landed 2026-07-31
1. 🟡 Zod boundary — infrastructure done (`src/lib/http.ts`, `src/lib/validation/common.ts`),
   applied to **23 of 99 routes**. Done: products (+[id]), expenses (+[id]),
   invoices/[id]/payment, invoices/[id]/send, quotes/[id]/send, jobs/[jobId]/invoice,
   pipeline lead/move/stage, assets (+[id]), suppliers (+[id]), reviews (+[id]),
   purchase-orders, campaigns, contacts/delete, timesheets/approve, settings org/profile.
   ~46 body-parsing routes remain (admin/*, ai/*, inbox/*, intake, timeclock, team/*,
   agreements, automations). Pattern is fixed; remaining work is mechanical.
   Bonus fixes along the way: mass-assignment (`insert({...body})`) closed on
   products/assets/suppliers/PO; missing `org_id` scoping added to reviews/[id] +
   expenses/[id] DELETE (was RLS-only); raw driver errors replaced with `friendlyDbError`.
2. ✅ RLS tenant-isolation gate — **DONE and GREEN, enforced with zero setup.**
   `src/tests/rls-local.spec.ts` loads the real schema + real policies
   (`supabase/rls-test-policies.sql`, extracted from p0_lockdown) into **PGlite**
   (Postgres-in-WASM, in-process) and runs **21 tables × SELECT/UPDATE/DELETE/INSERT +
   a positive control = 85 assertions**, all passing. Emulates Supabase auth via a stub
   `auth.uid()` + the non-owner `authenticated` role, so Postgres genuinely enforces RLS.
   **Mutation-proven both ways**: a mis-scoped `USING(true)` fails the SELECT test (leak);
   a missing policy fails the positive control (deny-all). Runs in every `npm test` and in
   CI — no Docker, no cloud, no secrets. The hosted-Supabase suite (`src/tests/rls.spec.ts`,
   84 assertions) remains as an optional CI job that runs against a real project when
   `RLS_TEST_*` secrets exist (see `docs/rls-gate-setup.md`), skipping cleanly otherwise.
3. 🟢 CI added (`.github/workflows/ci.yml`): typecheck + lint ratchet + tests, plus a
   separate tenant-isolation gate job.

**P1 — the AU moat (this is what makes it sellable beyond Salt Air)**
4. ✅ ABN modulus-89 validator + formatter — DONE (`src/lib/validation/abn.ts`,
   12 tests inc. one-digit-off rejection). Wired into `settings/org` (`zAbnOptional`).
   Still owed: surface the no-ABN withholding warning on invoices (folds into P1-5).
5. ✅ Tax-invoice compliance validator — DONE (`src/lib/validation/tax-invoice.ts`,
   15 tests). Blocks sending a GST invoice >$82.50 that's missing supplier name/ABN/
   issue date/described line item, and requires buyer identity at ≥$1,000. GST without
   a valid ABN is blocked; a plain (tax=0) invoice with no ABN warns about no-ABN
   withholding (non-blocking). Wired into `invoices/[id]/send` (422 + `blockingIssues`);
   client surfaces the block as a toast and shows warnings on success. Salt Air's tax=0
   flow is unaffected.
6. `tax_treatment` enum per line + documented rounding rule on the tax line.
7. 🟡 Phone E.164 normaliser — DONE (`src/lib/validation/phone.ts`, 13 tests; mobile,
   landline, 13/1300/1800, missing-trunk-0). Wired into `pipeline/lead` (strict via
   `zAuPhoneOptional`) and public `intake` (lenient: normalise-if-possible, else keep
   raw so a real lead is never dropped). AU state enum + postcode primitives exist
   (`zAuState`/`zPostcode`) but aren't yet enforced on an address write — no structured
   address field is captured yet (intake stores a single `address_line1` string).
8. ✅ Xero/MYOB CSV export + BAS GST summary — DONE. `src/lib/export/csv.ts`
   (RFC-4180 quoting + spreadsheet formula-injection defusing) and
   `src/lib/export/accounting.ts` (Xero sales rows, MYOB sales rows, BAS G1/1A/
   G11/1B/net GST). 25 tests. Route `GET /api/export?type=xero-invoices|myob-invoices|bas
   &from=&to=` (manager-only, Zod-validated params, streams CSV with no-store).
   BAS is accrual basis, labelled (DECISIONS D-006). Verified end-to-end via tsx:
   injection defused, commas quoted, GST/tax-free split correct, BAS reconciles.
   **UI shipped**: `src/components/finances/accounting-export.tsx` — a card on the
   Finances page (manager-only, matching the auth) with From/To dates + This month/
   Last month/This FY presets and Xero/MYOB/BAS download buttons (fetch→blob→download,
   toasts actionable errors). Verified: finances page compiles, `/api/export` returns
   401+actionable JSON unauth, no console errors, prod build clean.

**P2 — differentiators**
9. `quote_events` view tracking + second-open alert.
10. Speed-to-lead measurement + dashboard tile.
11. Offline queue in the field PWA (IndexedDB outbox + sync on reconnect).

**P3 — infrastructure debt**
12. Cents migration (large, breaking — schedule deliberately; DB triggers, PDFs, money.ts, tests all move together).
13. Email off personal Gmail → Resend on verified domain (fixes junk + send cap).
14. Postgres enums + `deleted_at` + `audit_log`.
15. Retry/idempotency wrapper + outbound event table for all external calls.
16. Playwright: lead→quote→job→invoice→payment happy path.

**Deliberate deviations (not gaps — decided, keep)**
- No Stripe: bank transfer only until the tenant asks. Remove the dead SDK + 11 refs.
- Leaflet/OSM instead of Google Maps: zero API cost; revisit when travel-time routing is built.
- Client portal disabled, not deleted.
- Salt Air is not GST-registered, so GST work is future-proofing, not current billing.
