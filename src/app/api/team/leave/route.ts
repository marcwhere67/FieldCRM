import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProfile, parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zDateOnly, zNullableText, zOptionalUuid } from '@/lib/validation/common'

const leaveRequestSchema = z.object({
  type: z.enum(['annual', 'sick', 'unpaid', 'other'], { error: 'Choose a valid leave type' }),
  start_date: zDateOnly,
  end_date: zDateOnly,
  start_time: z.union([z.string(), z.null()]).optional().transform((v) => v || null),
  end_time: z.union([z.string(), z.null()]).optional().transform((v) => v || null),
  days: z.number().finite().min(0),
  reason: zNullableText(2000),
  user_id: zOptionalUuid,
})

export async function POST(req: NextRequest) {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, leaveRequestSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('leave_requests')
    .insert({ ...parsed.data, org_id: profile.org_id, user_id: parsed.data.user_id ?? profile.id })
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}
