import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText, zNullableText, zOptionalUuid, zMoneyInput, zDateOnly } from '@/lib/validation/common'

// Allowlist mirrors supabase/migrations/assets.sql — was insert({ ...body }).
const assetSchema = z.object({
  name: zRequiredText(200),
  type: z.enum(['vehicle', 'tool', 'equipment', 'other'], { error: 'Choose an asset type' }),
  serial_number: zNullableText(100),
  assigned_to: zOptionalUuid,
  purchase_date: zDateOnly.optional(),
  purchase_price: zMoneyInput.optional(),
  maintenance_due: zDateOnly.optional(),
  last_serviced: zDateOnly.optional(),
  notes: zNullableText(1000),
  status: z.enum(['active', 'maintenance', 'retired']).default('active'),
})

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, assetSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('assets')
    .insert({ ...parsed.data, org_id: profile.org_id })
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}
