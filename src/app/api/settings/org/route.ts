import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText, zNullableText } from '@/lib/validation/common'
import { zAbnOptional } from '@/lib/validation/abn'

// `abn` is checksum-validated (modulus-89) and stored in the canonical
// `12 345 678 901` form. An empty ABN is allowed — a tenant may not have one
// yet (SPEC.md §3 flags those for no-ABN withholding warnings on invoices).
const orgSchema = z.object({
  name: zRequiredText(200),
  abn: zAbnOptional,
  phone: zNullableText(40),
  email: zNullableText(200),
  address: zNullableText(300),
  default_payment_terms_days: z.number().int().min(0).max(365).optional(),
  timezone: zNullableText(64),
  bank_account_name: zNullableText(200),
  bank_bsb: zNullableText(10),
  bank_account_number: zNullableText(30),
  bank_payid: zNullableText(100),
  payment_instructions: zNullableText(1000),
  website: zNullableText(300),
  instagram_url: zNullableText(300),
})

export async function PATCH(req: Request) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, orgSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('organisations')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', profile.org_id)
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}
