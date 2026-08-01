import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProfile, requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText, zNullableText, zLongText } from '@/lib/validation/common'

const campaignSchema = z.object({
  name: zRequiredText(200),
  type: zRequiredText(50),
  subject: zNullableText(300),
  content: zLongText(50_000).optional(),
  // Free-form audience filter object; kept permissive but bounded to an object.
  audience_filters: z.record(z.string(), z.unknown()).default({}),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
})

export async function GET() {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { supabase } = auth.data

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, campaignSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      org_id: profile.org_id,
      name: body.name,
      type: body.type,
      subject: body.subject,
      content: body.content ?? null,
      audience_filters: body.audience_filters,
      scheduled_at: body.scheduled_at ?? null,
      status: body.scheduled_at ? 'scheduled' : 'draft',
    })
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data, { status: 201 })
}
