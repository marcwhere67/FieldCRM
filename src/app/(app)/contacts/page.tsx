import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { ContactsTable } from '@/components/contacts/contacts-table'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string; assigned?: string; archived?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  let query = supabase
    .from('contacts')
    .select(`
      id, first_name, last_name, email, phone, company_name,
      suburb, state, status, source, tags, lifetime_value,
      last_contacted_at, created_at, assigned_to, pipeline_stage_id,
      users!contacts_assigned_to_fkey(full_name),
      pipeline_stages(name, color)
    `, { count: 'exact' })
    .eq('org_id', profile!.org_id)
    .order('created_at', { ascending: false })

  // Hide archived contacts unless explicitly viewing the archive.
  if (params.archived === '1') query = query.not('archived_at', 'is', null)
  else query = query.is('archived_at', null)

  if (params.q) {
    const q = params.q
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
  }
  if (params.status) query = query.eq('status', params.status)
  if (params.source) query = query.eq('source', params.source)
  if (params.assigned) query = query.eq('assigned_to', params.assigned)

  // Cap the payload at the 500 most-recent to avoid an unbounded fetch.
  const { data: contacts, count } = await query.limit(500)

  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('org_id', profile!.org_id)
    .eq('is_active', true)

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('org_id', profile!.org_id)
    .order('created_at', { ascending: false })

  return (
    <ContactsTable
      contacts={contacts ?? []}
      teamMembers={teamMembers ?? []}
      campaigns={campaigns ?? []}
      userRole={profile!.role}
      filters={params}
      total={count ?? (contacts?.length ?? 0)}
    />
  )
}
