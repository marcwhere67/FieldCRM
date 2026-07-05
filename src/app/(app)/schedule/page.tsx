import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { ScheduleView } from '@/components/schedule/schedule-view'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const focusDate = params.date ? new Date(params.date) : new Date()
  const view = params.view ?? 'week'

  // For month view load the full month + padding; otherwise a 6-week window
  let windowStart: Date, windowEnd: Date
  if (view === 'month') {
    windowStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1)
    windowStart.setDate(windowStart.getDate() - 6) // pad for leading empty cells
    windowEnd = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 6)
  } else {
    const start = new Date(focusDate)
    start.setDate(start.getDate() - start.getDay())
    windowStart = new Date(start)
    windowStart.setDate(windowStart.getDate() - 7)
    windowEnd = new Date(start)
    windowEnd.setDate(windowEnd.getDate() + 35)
  }

  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      id, title, status, scheduled_start, scheduled_end,
      contacts!jobs_contact_id_fkey(id, first_name, last_name),
      properties!jobs_property_id_fkey(id, suburb, address_line1),
      job_assignments(user_id, users!job_assignments_user_id_fkey(id, full_name, avatar_url))
    `)
    .eq('org_id', profile!.org_id)
    .not('scheduled_start', 'is', null)
    .gte('scheduled_start', windowStart.toISOString())
    .lte('scheduled_start', windowEnd.toISOString())
    .order('scheduled_start')

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, role')
    .eq('org_id', profile!.org_id)
    .in('role', ['field', 'manager', 'admin'])
    .order('full_name')

  return (
    <ScheduleView
      jobs={jobs ?? []}
      users={users ?? []}
      orgId={profile!.org_id}
      initialDate={focusDate.toISOString().split('T')[0]}
      initialView={(params.view as 'month' | 'week' | 'day') ?? 'week'}
    />
  )
}
