import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zBoolish } from '@/lib/validation/common'

const progressSchema = z.object({
  completed: zBoolish,
})

export async function PATCH(req: Request, { params }: { params: Promise<{ jobId: string; stepId: string }> }) {
  const { jobId, stepId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('id, org_id, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase.from('jobs').select('org_id').eq('id', jobId).single()
  if (!job || job.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const parsed = await parseBody(req, progressSchema)
  if (!parsed.ok) return parsed.response
  const { completed } = parsed.data

  const { data, error } = await supabase
    .from('job_procedure_progress')
    .upsert({
      job_id: jobId,
      step_id: stepId,
      org_id: profile.org_id,
      completed,
      completed_by: completed ? profile.id : null,
      completed_at: completed ? new Date().toISOString() : null,
    }, { onConflict: 'job_id,step_id' })
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}
