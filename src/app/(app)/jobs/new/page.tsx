import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { NewJobForm } from '@/components/jobs/new-job-form'

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ contact_id?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const [{ data: contacts }, { data: teamMembers }, { count }] = await Promise.all([
    supabase.from('contacts').select('id, first_name, last_name, email, phone').eq('org_id', profile!.org_id).order('first_name'),
    supabase.from('users').select('id, full_name').eq('org_id', profile!.org_id).eq('is_active', true),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('org_id', profile!.org_id),
  ])

  const nextJobNumber = `J-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(3, '0')}`

  let properties: { id: string; address_line1: string; suburb: string; state: string; contact_id: string }[] = []
  if (params.contact_id) {
    const { data } = await supabase
      .from('properties')
      .select('id, address_line1, suburb, state, contact_id')
      .eq('org_id', profile!.org_id)
      .eq('contact_id', params.contact_id)
    properties = data ?? []
  }

  return (
    <NewJobForm
      orgId={profile!.org_id}
      contacts={contacts ?? []}
      teamMembers={teamMembers ?? []}
      nextJobNumber={nextJobNumber}
      initialContactId={params.contact_id}
      initialProperties={properties}
    />
  )
}
