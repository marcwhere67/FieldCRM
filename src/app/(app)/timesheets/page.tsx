import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { TimesheetsView } from '@/components/timesheets/timesheets-view'

export default async function TimesheetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('org_id', profile!.org_id)
    .eq('is_active', true)
    .order('full_name')

  // Load last 8 weeks of timesheets
  const since = new Date()
  since.setDate(since.getDate() - 56)

  const { data: timesheets } = await supabase
    .from('timesheets')
    .select(`
      id, user_id, clocked_in_at, clocked_out_at, total_minutes,
      clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng,
      notes, approved, approved_by, approved_at,
      jobs!timesheets_job_id_fkey(id, title)
    `)
    .eq('org_id', profile!.org_id)
    .gte('clocked_in_at', since.toISOString())
    .order('clocked_in_at', { ascending: false })

  return (
    <TimesheetsView
      timesheets={timesheets ?? []}
      users={users ?? []}
      currentUserId={profile!.id}
      currentUserRole={profile!.role}
    />
  )
}
