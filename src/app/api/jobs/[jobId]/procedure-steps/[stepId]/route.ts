import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ jobId: string; stepId: string }> }) {
  const { jobId, stepId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('id, org_id, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase.from('jobs').select('org_id').eq('id', jobId).single()
  if (!job || job.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json() as { completed: boolean }
  const { data, error } = await supabase
    .from('job_procedure_progress')
    .upsert({
      job_id: jobId,
      step_id: stepId,
      org_id: profile.org_id,
      completed: body.completed,
      completed_by: body.completed ? profile.id : null,
      completed_at: body.completed ? new Date().toISOString() : null,
    }, { onConflict: 'job_id,step_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
