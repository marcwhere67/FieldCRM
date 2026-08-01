import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProfile, parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText, zNullableText } from '@/lib/validation/common'

// Any signed-in user may edit their own name/phone. The `.eq('supabase_auth_id')`
// scope means a user can only ever update their own row.
const profileSchema = z.object({
  full_name: zRequiredText(200).optional(),
  phone: zNullableText(40),
})

export async function PATCH(req: Request) {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { supabase, authUserId } = auth.data

  const parsed = await parseBody(req, profileSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase
    .from('users')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('supabase_auth_id', authUserId)
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}
