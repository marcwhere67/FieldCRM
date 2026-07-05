import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { FieldMap } from '@/components/timeclock/field-map'

export default async function FieldMapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  // All users in org
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, avatar_url, role')
    .eq('org_id', profile!.org_id)
    .eq('is_active', true)
    .order('first_name')

  // Latest open timesheet per user (clocked in, not yet out)
  const { data: activeSessions } = await supabase
    .from('timesheets')
    .select(`
      id, user_id, clocked_in_at, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng,
      jobs!timesheets_job_id_fkey(id, title)
    `)
    .eq('org_id', profile!.org_id)
    .is('clocked_out_at', null)
    .order('clocked_in_at', { ascending: false })

  // Today's completed timesheets
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data: todayTimesheets } = await supabase
    .from('timesheets')
    .select(`
      id, user_id, clocked_in_at, clocked_out_at, total_minutes,
      clock_in_lat, clock_in_lng,
      jobs!timesheets_job_id_fkey(id, title)
    `)
    .eq('org_id', profile!.org_id)
    .not('clocked_out_at', 'is', null)
    .gte('clocked_in_at', todayStart.toISOString())
    .order('clocked_in_at', { ascending: false })

  // Current user's active timesheet (for their own clock widget)
  const myActive = (activeSessions ?? []).find(s => s.user_id === profile!.id)

  return (
    <FieldMap
      users={users ?? []}
      activeSessions={activeSessions ?? []}
      todayTimesheets={todayTimesheets ?? []}
      currentUserId={profile!.id}
      myActiveTimesheet={myActive ? { id: myActive.id, clocked_in_at: myActive.clocked_in_at } : null}
    />
  )
}
