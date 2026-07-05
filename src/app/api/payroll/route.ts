import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 })

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

  // Flatten joins
  const normalised = (members ?? []).map(m => ({
    ...m,
    timesheets: (Array.isArray(m.timesheets) ? m.timesheets : []).map((t: Record<string, unknown>) => ({
      ...t,
      jobs: Array.isArray(t.jobs) ? (t.jobs[0] ?? null) : t.jobs,
    })),
  }))

  return NextResponse.json(normalised)
}
