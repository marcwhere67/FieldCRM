import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zUuid, zOptionalUuid, zRequiredText, zNullableText, zMoneyInput, zLineItems, zDateOnly } from '@/lib/validation/common'

// Allowlist mirrors supabase/migrations/suppliers.sql purchase_orders table.
// po_number is minted client-side today; totals are carried on the PO (no DB
// trigger for POs), so they're validated as money but computed by the client.
const poSchema = z.object({
  supplier_id: zUuid,
  job_id: zOptionalUuid,
  po_number: zRequiredText(50),
  status: z.enum(['draft', 'sent', 'received', 'cancelled']).default('draft'),
  line_items: zLineItems.default([]),
  subtotal: zMoneyInput.default(0),
  tax: zMoneyInput.default(0),
  total: zMoneyInput.default(0),
  notes: zNullableText(1000),
  expected_date: zDateOnly.optional(),
})

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, poSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert({ ...parsed.data, org_id: profile.org_id })
    .select(`*, suppliers(id, name)`)
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}
