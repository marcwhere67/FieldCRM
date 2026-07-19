import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Tables whose rows must be preserved (financial / job history). If a contact
// is referenced here, we archive rather than hard-delete.
const BLOCKING_TABLES = ['quotes', 'jobs', 'invoices', 'payments', 'visits', 'conversations'] as const

// Nullable references that would otherwise block a hard delete (RESTRICT FKs).
// For a pure lead we null these out first, then delete the contact.
const SOFT_REF_TABLES = ['reviews', 'workflow_executions', 'automation_queue', 'form_submissions'] as const

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No contacts selected' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, org_id, role')
      .eq('supabase_auth_id', user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })
    if (!['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only managers can delete contacts' }, { status: 403 })
    }

    const svc = createServiceClient()

    // Scope to caller's org so a forged id from another org can't be touched.
    const { data: owned } = await svc
      .from('contacts')
      .select('id')
      .eq('org_id', profile.org_id)
      .in('id', ids)
    const ownedIds = (owned ?? []).map(c => c.id)
    if (ownedIds.length === 0) {
      return NextResponse.json({ error: 'No matching contacts' }, { status: 404 })
    }

    // Partition into contacts with blocking history (archive) vs pure leads (delete).
    const toArchive = new Set<string>()
    for (const table of BLOCKING_TABLES) {
      const { data } = await svc.from(table).select('contact_id').in('contact_id', ownedIds)
      for (const row of data ?? []) toArchive.add(row.contact_id as string)
    }
    const toDelete = ownedIds.filter(id => !toArchive.has(id))

    let archived = 0
    let deleted = 0

    if (toArchive.size > 0) {
      const { error } = await svc
        .from('contacts')
        .update({ archived_at: new Date().toISOString() })
        .in('id', [...toArchive])
      if (error) return NextResponse.json({ error: `Archive failed: ${error.message}` }, { status: 500 })
      archived = toArchive.size
    }

    if (toDelete.length > 0) {
      // Clear nullable references that would block the delete, then remove the contact.
      // Cascade-configured tables (properties, documents, agreements, email links) self-clean.
      for (const table of SOFT_REF_TABLES) {
        await svc.from(table).update({ contact_id: null }).in('contact_id', toDelete)
      }
      await svc.from('jobs').update({ source_lead_id: null }).in('source_lead_id', toDelete)

      const { error } = await svc.from('contacts').delete().in('id', toDelete)
      if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 })
      deleted = toDelete.length
    }

    return NextResponse.json({ ok: true, deleted, archived })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 })
  }
}
