/**
 * Tenant-isolation gate — LOCAL, zero-setup variant (SPEC.md §4).
 *
 * Runs the REAL RLS policies (supabase/rls-test-policies.sql, extracted from
 * p0_lockdown) against a real Postgres — PGlite (Postgres compiled to WASM) —
 * in-process. No Docker, no cloud project, no secrets. Runs in every `npm test`
 * and in CI, so tenant isolation is continuously proven, not assumed.
 *
 * How it emulates Supabase auth:
 *   - a stub `auth.uid()` reads a GUC we set per session
 *   - the `authenticated` role (non-owner, non-superuser) runs the "as a user"
 *     queries, so Postgres actually enforces RLS (the owner would bypass it)
 * The SECURITY DEFINER helpers (auth_user_org_id/role) behave exactly as in prod.
 *
 * Fixtures supply columns the base schema requires. Because this harness omits
 * p0_lockdown's numbering triggers (they'd need other migrations), quote/job/
 * invoice numbers are supplied explicitly, and are unique per call so the INSERT
 * isolation test is rejected by RLS — not by a unique-key clash with the seed.
 *
 * The hosted suite (rls.spec.ts) still exists to test the ACTUAL Supabase project
 * via GoTrue; this proves the policy logic with zero infrastructure.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

type Row = Record<string, unknown>
interface Ctx {
  org: string
  contact: string
  userId: string
  seeded: Record<string, string>
}

let seq = 0
const uniq = (p: string) => `${p}-${Date.now()}-${seq++}`

// Same 21 org-scoped tables as rls.spec.ts. Order matters: FK-dependent tables
// come after what they reference.
const TABLES: Record<string, (ctx: Ctx) => Row> = {
  contacts: ({ org }) => ({ org_id: org, first_name: 'Rls', last_name: 'B', status: 'lead' }),
  properties: ({ org, contact }) => ({ org_id: org, contact_id: contact, address_line1: '1 Test St', suburb: 'Richmond', state: 'VIC', postcode: '3121' }),
  services: ({ org }) => ({ org_id: org, name: 'svc', unit_price: 100 }),
  pipeline_stages: ({ org }) => ({ org_id: org, name: 'stage', position: 99 }),
  quotes: ({ org, contact }) => ({ org_id: org, contact_id: contact, quote_number: uniq('Q'), status: 'draft', line_items: JSON.stringify([]) }),
  jobs: ({ org, contact }) => ({ org_id: org, contact_id: contact, job_number: uniq('J'), title: 'job', status: 'draft' }),
  invoices: ({ org, contact }) => ({ org_id: org, contact_id: contact, invoice_number: uniq('INV'), status: 'draft', line_items: JSON.stringify([]) }),
  expenses: ({ org }) => ({ org_id: org, category: 'Materials', amount: 10 }),
  reviews: ({ org, contact }) => ({ org_id: org, contact_id: contact, platform: 'google', rating: 5 }),
  campaigns: ({ org }) => ({ org_id: org, name: 'camp', type: 'email' }),
  workflows: ({ org }) => ({ org_id: org, name: 'wf', trigger_type: 'manual' }),
  conversations: ({ org, contact }) => ({ org_id: org, contact_id: contact, channel: 'sms' }),
  timesheets: ({ org, userId }) => ({ org_id: org, user_id: userId, clocked_in_at: new Date().toISOString(), total_minutes: 60 }),
  forms: ({ org }) => ({ org_id: org, name: 'form', type: 'lead' }),
  payments: ({ org, contact, seeded }) => ({ org_id: org, invoice_id: seeded.invoices, contact_id: contact, amount: 10, method: 'bank_transfer' }),
  visits: ({ org, contact, seeded }) => ({ org_id: org, job_id: seeded.jobs, contact_id: contact }),
  messages: ({ org, seeded }) => ({ org_id: org, conversation_id: seeded.conversations, direction: 'inbound', content: 'hi' }),
  workflow_executions: ({ org, seeded }) => ({ org_id: org, workflow_id: seeded.workflows }),
  automation_queue: ({ org }) => ({ org_id: org, scheduled_for: new Date().toISOString() }),
  form_submissions: ({ org, seeded }) => ({ org_id: org, form_id: seeded.forms }),
  call_tracking_numbers: ({ org }) => ({ org_id: org, phone_number: uniq('+6140') }),
}

// Auth stubs + roles so Postgres enforces RLS exactly as Supabase does.
const PRELUDE = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;
do $$ begin
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
`

const GRANTS = `
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
`

function insertSql(table: string, row: Row): { text: string; values: unknown[] } {
  const keys = Object.keys(row)
  return {
    text: `insert into ${table} (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    values: keys.map((k) => row[k]),
  }
}

let db: PGlite
let orgB = ''
let contactB = ''
let contactA = ''
let userBId = ''
const seeded: Record<string, string> = {}

describe('RLS tenant isolation (local PGlite)', () => {
  beforeAll(async () => {
    db = new PGlite()
    const schema = readFileSync('supabase/schema.sql', 'utf8').replace(/create extension[^;]*uuid-ossp[^;]*;/gi, '')
    const policies = readFileSync('supabase/rls-test-policies.sql', 'utf8')
    await db.exec(PRELUDE)
    await db.exec(schema)
    await db.exec(policies)
    await db.exec(GRANTS)

    // Org A + its auth user + app user (the session under test).
    const authA = (await db.query<{ id: string }>(`insert into auth.users (email) values ('a@rls.test') returning id`)).rows[0].id
    // NB: base schema.sql has no `slug` column (migration-added), so seed name only.
    const oa = (await db.query<{ id: string }>(`insert into organisations (name) values ('Org A') returning id`)).rows[0].id
    await db.query(
      `insert into users (org_id, supabase_auth_id, email, full_name, role) values ($1,$2,'a@rls.test','User A','admin')`,
      [oa, authA],
    )
    contactA = (await db.query<{ id: string }>(
      `insert into contacts (org_id, first_name, last_name, status) values ($1,'Own','A','lead') returning id`,
      [oa],
    )).rows[0].id

    // Org B: the tenant that must stay invisible. Needs its own user for the
    // timesheets FK (user_id references users(id)).
    orgB = (await db.query<{ id: string }>(`insert into organisations (name) values ('Org B') returning id`)).rows[0].id
    const authB = (await db.query<{ id: string }>(`insert into auth.users (email) values ('b@rls.test') returning id`)).rows[0].id
    userBId = (await db.query<{ id: string }>(
      `insert into users (org_id, supabase_auth_id, email, full_name, role) values ($1,$2,'b@rls.test','User B','admin') returning id`,
      [orgB, authB],
    )).rows[0].id
    contactB = (await db.query<{ id: string }>(
      `insert into contacts (org_id, first_name, last_name, status) values ($1,'Org','B','lead') returning id`,
      [orgB],
    )).rows[0].id

    seeded.contacts = contactB
    for (const [table, build] of Object.entries(TABLES)) {
      if (table === 'contacts') continue
      const { text, values } = insertSql(table, build({ org: orgB, contact: contactB, userId: userBId, seeded }))
      seeded[table] = (await db.query<{ id: string }>(text, values)).rows[0].id
    }

    // Act as User A for every subsequent isolation query.
    await db.exec(`select set_config('app.current_user_id', '${authA}', false);`)
  }, 30_000) // PGlite boot + full schema/policy load + 21-table seed can exceed
             // vitest's 10s default hook timeout when other suites are running
             // in parallel and competing for CPU — this is slow, not hung.

  afterAll(async () => {
    await db?.close()
  }, 30_000)

  async function asUser<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
    await db.exec('set role authenticated')
    try {
      return await db.query<T>(text, values)
    } finally {
      await db.exec('reset role')
    }
  }

  // Positive control: without this, "isolation passes" could just mean the
  // policies deny everything. User A MUST see their own org's row.
  it('positive control: a user CAN see their own org rows', async () => {
    const { rows } = await asUser<{ id: string }>(`select id from contacts where id = $1`, [contactA])
    expect(rows.map((r) => r.id)).toEqual([contactA])
  })

  for (const table of Object.keys(TABLES)) {
    describe(table, () => {
      it('cannot SELECT org B rows', async () => {
        const { rows } = await asUser(`select id from ${table} where id = $1`, [seeded[table]])
        expect(rows).toEqual([])
      })

      it('cannot UPDATE org B rows', async () => {
        const res = await asUser(`update ${table} set org_id = org_id where id = $1`, [seeded[table]])
        expect(res.affectedRows ?? 0).toBe(0)
        const still = await db.query(`select id from ${table} where id = $1`, [seeded[table]])
        expect(still.rows.length).toBe(1)
      })

      it('cannot DELETE org B rows', async () => {
        const res = await asUser(`delete from ${table} where id = $1`, [seeded[table]])
        expect(res.affectedRows ?? 0).toBe(0)
        const still = await db.query(`select id from ${table} where id = $1`, [seeded[table]])
        expect(still.rows.length).toBe(1)
      })

      it('cannot INSERT a row into org B', async () => {
        const { text, values } = insertSql(table, TABLES[table]({ org: orgB, contact: contactB, userId: userBId, seeded }))
        await expect(asUser(text, values)).rejects.toThrow(/row-level security/i)
      })
    })
  }
})
