import { createClient, getAppProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PayrollView } from '@/components/payroll/payroll-view'

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = await getAppProfile(user!.id)

  if (!profile || !['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  // Default to current month
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: members } = await supabase
    .from('users')
    .select(`
      id, full_name, email, role, hourly_rate,
      timesheets(
        id, clocked_in_at, clocked_out_at, total_minutes, job_id, approved,
        jobs!timesheets_job_id_fkey(title)
      )
    `)
    .eq('org_id', profile.org_id)
    .eq('is_active', true)
    .gte('timesheets.clocked_in_at', `${start}T00:00:00`)
    .lte('timesheets.clocked_in_at', `${end}T23:59:59`)
    .order('full_name')

  const normalised = (members ?? []).map(m => ({
    ...m,
    timesheets: (Array.isArray(m.timesheets) ? m.timesheets : []).map((t: Record<string, unknown>) => ({
      ...t,
      jobs: Array.isArray(t.jobs) ? (t.jobs[0] ?? null) : t.jobs,
    })),
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <PayrollView employees={normalised as any} periodStart={start} periodEnd={end} />
}
