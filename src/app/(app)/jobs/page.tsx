import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { JobsTable } from '@/components/jobs/jobs-table'

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; assigned?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  let query = supabase
    .from('jobs')
    .select(`
      id, job_number, title, status, job_type,
      scheduled_start, scheduled_end, assigned_users,
      contact_id, property_id,
      contacts!jobs_contact_id_fkey(first_name, last_name, phone),
      properties!jobs_property_id_fkey(address_line1, suburb, state)
    `, { count: 'exact' })
    .eq('org_id', profile!.org_id)
    .order('created_at', { ascending: false })

  if (params.status) query = query.eq('status', params.status)
  if (params.from) query = query.gte('scheduled_start', params.from)
  if (params.to) query = query.lte('scheduled_start', params.to)

  // Cap the payload at the 500 most-recent to avoid an unbounded fetch.
  const { data: jobs, count } = await query.limit(500)

  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('org_id', profile!.org_id)
    .eq('is_active', true)

  return (
    <JobsTable
      jobs={jobs ?? []}
      teamMembers={teamMembers ?? []}
      userRole={profile!.role}
      filters={params}
      total={count ?? (jobs?.length ?? 0)}
    />
  )
}
