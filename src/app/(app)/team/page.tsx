import { redirect } from 'next/navigation'
import { createClient, getAppProfile } from '@/lib/supabase/server'
import { TeamView } from '@/components/team/team-view'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)
  if (!profile) return redirect('/login')

  const [{ data: members }, { data: leaveRequests }] = await Promise.all([
    supabase
      .from('users')
      .select(`
        id, full_name, email, role, phone, hourly_rate, is_active,
        employee_profiles(
          id, user_id, hire_date, job_title, department, employment_type,
          skills, certifications, emergency_contact_name,
          emergency_contact_phone, emergency_contact_relation, notes
        )
      `)
      .eq('org_id', profile!.org_id)
      .order('full_name'),
    supabase
      .from('leave_requests')
      .select('*')
      .eq('org_id', profile!.org_id)
      .order('created_at', { ascending: false }),
  ])

  // Flatten employee_profiles (join returns array)
  const normalised = (members ?? []).map(m => ({
    ...m,
    employee_profiles: Array.isArray(m.employee_profiles)
      ? (m.employee_profiles[0] ?? null)
      : m.employee_profiles,
  }))

  const isManager = ['admin', 'manager'].includes(profile!.role)

  return (
    <TeamView
      members={normalised}
      leaveRequests={leaveRequests ?? []}
      currentUserId={profile!.id}
      isManager={isManager}
    />
  )
}
