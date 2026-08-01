import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText, zNullableText } from '@/lib/validation/common'

const supplierPatchSchema = z
  .object({
    name: zRequiredText(200),
    contact_name: zNullableText(200),
    email: zNullableText(200),
    phone: zNullableText(40),
    address: zNullableText(300),
    website: zNullableText(300),
    category: zNullableText(100),
    notes: zNullableText(1000),
    is_active: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { id } = await params
  const parsed = await parseBody(req, supplierPatchSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('suppliers')
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { id } = await params
  const { error } = await supabase.from('suppliers').delete().eq('id', id).eq('org_id', profile.org_id)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ ok: true })
}
