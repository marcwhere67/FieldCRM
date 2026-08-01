import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText, zNullableText, zBoolish } from '@/lib/validation/common'

const stepUpdateSchema = z.object({
  title: zRequiredText(200).optional(),
  area: z.string().trim().max(100).optional(),
  description: zNullableText(2000).optional(),
  is_required: zBoolish.optional(),
  order_index: z.number().int().nonnegative().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  const { stepId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseBody(req, stepUpdateSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('procedure_steps')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', stepId)
    .select()
    .single()
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  const { stepId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { count } = await supabase
    .from('job_procedure_progress')
    .select('id', { count: 'exact', head: true })
    .eq('step_id', stepId)

  if (count && count > 0) {
    // Referenced by job history — archive instead of hard-deleting so past job records stay intact.
    const { data, error } = await supabase.from('procedure_steps').update({ status: 'archived' }).eq('id', stepId).select().single()
    if (error) return jsonError(friendlyDbError(error), 500)
    return NextResponse.json({ archived: true, step: data })
  }

  const { error } = await supabase.from('procedure_steps').delete().eq('id', stepId)
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json({ success: true })
}
