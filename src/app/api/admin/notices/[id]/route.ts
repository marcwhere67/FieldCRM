import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText } from '@/lib/validation/common'

const noticeUpdateSchema = z.object({
  title: zRequiredText(200).optional(),
  content: zRequiredText(5000).optional(),
  pinned: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, noticeUpdateSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase.from('notices').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id).eq('org_id', profile.org_id).select('*, users!notices_created_by_fkey(full_name)').single()
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { error } = await supabase.from('notices').delete().eq('id', id).eq('org_id', profile.org_id)
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json({ success: true })
}
