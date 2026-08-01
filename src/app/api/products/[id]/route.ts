import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText, zNullableText, zMoneyInput } from '@/lib/validation/common'

// Every field optional (partial update), but each still validated. `active`
// alone is a valid body — that's the catalogue toggle.
const productPatchSchema = z
  .object({
    name: zRequiredText(200),
    description: zNullableText(1000),
    type: z.enum(['service', 'product']),
    unit_price: zMoneyInput,
    unit: zNullableText(50),
    category: zNullableText(100),
    active: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { id } = await params
  const parsed = await parseBody(req, productPatchSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('products')
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
  const { error } = await supabase.from('products').delete().eq('id', id).eq('org_id', profile.org_id)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ success: true })
}
