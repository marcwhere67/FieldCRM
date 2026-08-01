import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zDateOnly, zNullableText, zRequiredText, zUuid } from '@/lib/validation/common'

const contractUpdateSchema = z.object({
  user_id: zUuid.optional(),
  title: zRequiredText(200).optional(),
  description: zNullableText(500).optional(),
  url: zRequiredText(2000).optional(),
  expires_at: z.union([zDateOnly, z.null()]).optional(),
  signed: z.boolean().optional(),
  signed_at: z.union([z.string(), z.null()]).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, contractUpdateSchema)
  if (!parsed.ok) return parsed.response

  const update: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }
  if (parsed.data.signed && !parsed.data.signed_at) update.signed_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('employee_contracts')
    .update(update)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select('*, users!employee_contracts_user_id_fkey(full_name, email, role)')
    .single()

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { error } = await supabase.from('employee_contracts').delete().eq('id', id).eq('org_id', profile.org_id)
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json({ success: true })
}
