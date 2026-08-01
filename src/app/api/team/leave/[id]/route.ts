import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zNullableText, zDateOnly } from '@/lib/validation/common'

const leaveUpdateSchema = z.object({
  type: z.enum(['annual', 'sick', 'unpaid', 'other']).optional(),
  start_date: zDateOnly.optional(),
  end_date: zDateOnly.optional(),
  start_time: zNullableText(20).optional(),
  end_time: zNullableText(20).optional(),
  days: z.number().finite().min(0).max(366).optional(),
  reason: zNullableText(2000).optional(),
  status: z.enum(['pending', 'approved', 'declined']).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('org_id, role, id').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, leaveUpdateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  // Only admins/managers can approve/decline; anyone can update their own pending request
  const isManager = ['admin', 'manager'].includes(profile.role)
  const updatePayload = isManager
    ? { ...body, reviewed_by: profile.id, reviewed_at: new Date().toISOString() }
    : { reason: body.reason, start_date: body.start_date, end_date: body.end_date, days: body.days, type: body.type }

  const { data, error } = await supabase
    .from('leave_requests')
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('org_id').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('leave_requests').delete().eq('id', id).eq('org_id', profile.org_id)
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json({ ok: true })
}
