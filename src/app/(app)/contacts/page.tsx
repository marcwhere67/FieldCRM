import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { ContactsTable } from '@/components/contacts/contacts-table'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string; assigned?: string }>
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
    `)
    .eq('org_id', profile!.org_id)
    .order('created_at', { ascending: false })

  if (params.q) {
    const q = params.q
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
  }
  if (params.status) query = query.eq('status', params.status)
  if (params.source) query = query.eq('source', params.source)
  if (params.assigned) query = query.eq('assigned_to', params.assigned)

  const { data: contacts } = await query

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
    />
  )
}
