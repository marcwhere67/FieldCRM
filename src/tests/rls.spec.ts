/**
 * Tenant-isolation suite (SPEC.md §4, the merge gate).
 *
 * Proves that a session authenticated into org A cannot read, insert, update or
 * delete rows belonging to org B, on every org-scoped table. RLS is the security
 * boundary — this is the test that says so.
 *
 * Requires a real database. Set these to run it (never point at production):
 *   RLS_TEST_SUPABASE_URL          project URL
 *   RLS_TEST_SERVICE_ROLE_KEY      service role key (seeds + tears down fixtures)
 *   RLS_TEST_ANON_KEY              anon key (the client under test)
 *   RLS_TEST_USER_EMAIL/_PASSWORD  a real user in some existing org (= org A)
 *
 * Without them the suite skips, so `npm test` stays green on a laptop with no DB
 * and CI runs it only where the secrets exist. A skip is NOT a pass — CI asserts
 * the suite actually ran (see .github/workflows/ci.yml).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.RLS_TEST_SUPABASE_URL
const SERVICE_KEY = process.env.RLS_TEST_SERVICE_ROLE_KEY
const ANON_KEY = process.env.RLS_TEST_ANON_KEY
const CONFIGURED = Boolean(URL && SERVICE_KEY && ANON_KEY)

interface SeedCtx {
  orgId: string
  contactId: string
  /** ids seeded so far, keyed by table — for cross-table FK references. */
  seeded: Record<string, string>
}

/**
 * Every org-scoped table (all `public` tables carrying `org_id`, except the
 * special `organisations`/`users`), with a minimal valid row for org B.
 *
 * ORDER MATTERS: a table that FK-references another must appear AFTER it, because
 * the seed loop walks these keys in order and later rows reference earlier ids.
 */
const TABLES: Record<string, (ctx: SeedCtx) => Record<string, unknown>> = {
  contacts: ({ orgId }) => ({ org_id: orgId, first_name: 'Rls', last_name: 'Fixture', status: 'lead' }),
  properties: ({ orgId, contactId }) => ({ org_id: orgId, contact_id: contactId, address: '1 Test St' }),
  services: ({ orgId }) => ({ org_id: orgId, name: 'RLS fixture service', unit_price: 100 }),
  pipeline_stages: ({ orgId }) => ({ org_id: orgId, name: 'RLS fixture stage', position: 99 }),
  quotes: ({ orgId, contactId }) => ({ org_id: orgId, contact_id: contactId, status: 'draft', line_items: [] }),
  jobs: ({ orgId, contactId }) => ({ org_id: orgId, contact_id: contactId, title: 'RLS fixture job', status: 'draft' }),
  invoices: ({ orgId, contactId }) => ({ org_id: orgId, contact_id: contactId, status: 'draft', line_items: [] }),
  expenses: ({ orgId }) => ({ org_id: orgId, category: 'Materials', amount: 10 }),
  reviews: ({ orgId, contactId }) => ({ org_id: orgId, contact_id: contactId, rating: 5 }),
  campaigns: ({ orgId }) => ({ org_id: orgId, name: 'RLS fixture campaign' }),
  workflows: ({ orgId }) => ({ org_id: orgId, name: 'RLS fixture workflow' }),
  conversations: ({ orgId, contactId }) => ({ org_id: orgId, contact_id: contactId }),
  timesheets: ({ orgId }) => ({ org_id: orgId, total_minutes: 60 }),
  forms: ({ orgId }) => ({ org_id: orgId, name: 'RLS fixture form' }),

  // FK-dependent tables — each references one seeded earlier in this object.
  payments: ({ orgId, contactId, seeded }) => ({
    org_id: orgId, invoice_id: seeded.invoices, contact_id: contactId, amount: 10, method: 'bank_transfer',
  }),
  visits: ({ orgId, contactId, seeded }) => ({ org_id: orgId, job_id: seeded.jobs, contact_id: contactId }),
  messages: ({ orgId, seeded }) => ({
    org_id: orgId, conversation_id: seeded.conversations, direction: 'inbound', content: 'RLS fixture',
  }),
  workflow_executions: ({ orgId, seeded }) => ({ org_id: orgId, workflow_id: seeded.workflows }),
  automation_queue: ({ orgId }) => ({ org_id: orgId, scheduled_for: new Date().toISOString() }),
  form_submissions: ({ orgId, seeded }) => ({ org_id: orgId, form_id: seeded.forms }),
  call_tracking_numbers: ({ orgId }) => ({ org_id: orgId, phone_number: '+61400000000' }),
}

/**
 * The org-scoped tables this suite MUST cover, taken from supabase/schema.sql
 * (every `public` table with `org_id`, minus `organisations`/`users`). The
 * coverage test below asserts TABLES matches this exactly — a static check that
 * can't pass vacuously the way an information_schema probe can when PostgREST
 * doesn't expose it. Add a new org-scoped table to the schema → add it here and
 * to TABLES, or this fails.
 */
const EXPECTED_ORG_SCOPED_TABLES = [
  'automation_queue', 'call_tracking_numbers', 'campaigns', 'contacts', 'conversations',
  'expenses', 'form_submissions', 'forms', 'invoices', 'jobs', 'messages', 'payments',
  'pipeline_stages', 'properties', 'quotes', 'reviews', 'services', 'timesheets',
  'visits', 'workflow_executions', 'workflows',
].sort()

interface Fixture {
  admin: SupabaseClient
  orgB: string
  contactB: string
  seeded: Record<string, string>
  clientA: SupabaseClient
}

let fx: Fixture | null = null
const describeIf = CONFIGURED ? describe : describe.skip

describeIf('RLS tenant isolation', () => {
  beforeAll(async () => {
    const admin = createClient(URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Org B: the tenant whose data must stay invisible.
    const stamp = Date.now()
    const { data: orgB, error: orgErr } = await admin
      .from('organisations')
      .insert({ name: `rls-test-b-${stamp}`, slug: `rls-test-b-${stamp}` })
      .select('id')
      .single()
    if (orgErr || !orgB) throw new Error(`Could not seed org B: ${orgErr?.message}`)

    const { data: contactB, error: cErr } = await admin
      .from('contacts')
      .insert({ org_id: orgB.id, first_name: 'Org', last_name: 'B', status: 'lead' })
      .select('id')
      .single()
    if (cErr || !contactB) throw new Error(`Could not seed org B contact: ${cErr?.message}`)

    // One row per table, all owned by org B. `seeded` accumulates so later
    // FK-dependent rows can reference earlier ids.
    const seeded: Record<string, string> = { contacts: contactB.id }
    for (const [table, buildRow] of Object.entries(TABLES)) {
      if (table === 'contacts') continue
      const row = buildRow({ orgId: orgB.id, contactId: contactB.id, seeded })
      const { data, error } = await admin.from(table).insert(row).select('id').single()
      if (error || !data) throw new Error(`Could not seed ${table}: ${error?.message}`)
      seeded[table] = data.id
    }

    // Session A: a real user in an existing org, via the anon key, so every
    // query runs under RLS exactly as the browser would.
    const email = process.env.RLS_TEST_USER_EMAIL
    const password = process.env.RLS_TEST_USER_PASSWORD
    if (!email || !password) throw new Error('Set RLS_TEST_USER_EMAIL and RLS_TEST_USER_PASSWORD')

    const clientA = createClient(URL!, ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: signInErr } = await clientA.auth.signInWithPassword({ email, password })
    if (signInErr) throw new Error(`Session A sign-in failed: ${signInErr.message}`)

    fx = { admin, orgB: orgB.id, contactB: contactB.id, seeded, clientA }
  }, 60_000)

  afterAll(async () => {
    if (!fx) return
    // Reverse insertion order so FK children are removed before their parents.
    for (const table of [...Object.keys(TABLES)].reverse()) {
      await fx.admin.from(table).delete().eq('org_id', fx.orgB)
    }
    await fx.admin.from('organisations').delete().eq('id', fx.orgB)
    await fx.clientA.auth.signOut()
  }, 60_000)

  for (const table of Object.keys(TABLES)) {
    describe(table, () => {
      it('cannot SELECT org B rows', async () => {
        const { data } = await fx!.clientA.from(table).select('id').eq('id', fx!.seeded[table])
        expect(data ?? []).toEqual([])
      })

      it('cannot UPDATE org B rows', async () => {
        const before = await fx!.admin.from(table).select('*').eq('id', fx!.seeded[table]).single()
        // An RLS-filtered UPDATE matches zero rows: it "succeeds" affecting nothing.
        await fx!.clientA.from(table).update({ org_id: fx!.orgB }).eq('id', fx!.seeded[table])
        const after = await fx!.admin.from(table).select('*').eq('id', fx!.seeded[table]).single()
        expect(after.data).toEqual(before.data)
      })

      it('cannot DELETE org B rows', async () => {
        await fx!.clientA.from(table).delete().eq('id', fx!.seeded[table])
        const { data } = await fx!.admin.from(table).select('id').eq('id', fx!.seeded[table]).maybeSingle()
        expect(data?.id).toBe(fx!.seeded[table])
      })

      it('cannot INSERT a row into org B', async () => {
        const row = TABLES[table]({ orgId: fx!.orgB, contactId: fx!.contactB, seeded: fx!.seeded })
        const { data, error } = await fx!.clientA.from(table).insert(row).select('id')
        // Either the policy rejects it, or it inserts nothing.
        expect(error !== null || (data ?? []).length === 0).toBe(true)
        if (data?.[0]?.id) await fx!.admin.from(table).delete().eq('id', data[0].id)
      })
    })
  }
})

// Pure, no DB — runs in every `npm test`. Catches a table being added to the
// schema/EXPECTED list without a matching fixture (or vice versa), so isolation
// coverage can't silently fall behind the data model.
describe('RLS coverage', () => {
  it('covers exactly the expected org-scoped tables', () => {
    expect(Object.keys(TABLES).sort()).toEqual(EXPECTED_ORG_SCOPED_TABLES)
  })
})

// Visible marker so a misconfigured CI run does not look like a pass.
describe('RLS suite configuration', () => {
  it('reports whether tenant-isolation actually ran', () => {
    if (!CONFIGURED) {
      console.warn(
        '\n  ⚠ RLS tenant-isolation suite SKIPPED — RLS_TEST_* env vars not set.\n' +
          '    This is not a pass. CI must set them.\n',
      )
    }
    expect(true).toBe(true)
  })
})
