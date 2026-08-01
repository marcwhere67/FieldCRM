import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zNullableText } from '@/lib/validation/common'

// Only these fields are editable; channel/category/key stay fixed after creation.
const templateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  subject: zNullableText(200).optional(),
  body: z.string().max(20000).optional(),
  is_active: z.boolean().optional(),
})

// PATCH — update a template (admin/manager only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, templateUpdateSchema)
  if (!parsed.ok) return parsed.response

  const patch: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.subject !== undefined) patch.subject = parsed.data.subject
  if (parsed.data.body !== undefined) patch.body = parsed.data.body
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active

  const { data, error } = await supabase
    .from('message_templates')
    .update(patch)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select()
    .single()
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

// DELETE — remove a template. System templates (with a template_key) can't be deleted,
// only edited, so the app always has copy to fall back on.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { data: existing } = await supabase
    .from('message_templates')
    .select('template_key')
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .single()
  if (existing?.template_key)
    return jsonError('System templates can be edited but not deleted', 400)

  const { error } = await supabase
    .from('message_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', profile.org_id)
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json({ ok: true })
}
