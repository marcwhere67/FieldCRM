import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProfile, parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText, zNullableText, zOptionalUuid } from '@/lib/validation/common'
import { zAuPhoneOptional } from '@/lib/validation/phone'

const leadSchema = z.object({
  firstName: zRequiredText(100),
  lastName: zNullableText(100),
  company: zNullableText(200),
  // Normalised to E.164 on write; empty is allowed.
  phone: zAuPhoneOptional,
  email: zNullableText(200),
  stageId: zOptionalUuid,
})

export async function POST(req: Request) {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, leadSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      org_id: profile.org_id,
      first_name: body.firstName,
      last_name: body.lastName ?? '',
      company_name: body.company,
      phone: body.phone,
      email: body.email,
      pipeline_stage_id: body.stageId,
    })
    .select('id, first_name, last_name, company_name, phone, email, pipeline_stage_id, created_at')
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ contact })
}
