import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText, zNullableText, zOptionalUuid, zMoneyInput, zDateOnly } from '@/lib/validation/common'

const assetPatchSchema = z
  .object({
    name: zRequiredText(200),
    type: z.enum(['vehicle', 'tool', 'equipment', 'other']),
    serial_number: zNullableText(100),
    assigned_to: zOptionalUuid,
    purchase_date: zDateOnly,
    purchase_price: zMoneyInput,
    maintenance_due: zDateOnly,
    last_serviced: zDateOnly,
    notes: zNullableText(1000),
    status: z.enum(['active', 'maintenance', 'retired']),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { id } = await params
  const parsed = await parseBody(req, assetPatchSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('assets')
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
  const { error } = await supabase.from('assets').delete().eq('id', id).eq('org_id', profile.org_id)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ ok: true })
}
