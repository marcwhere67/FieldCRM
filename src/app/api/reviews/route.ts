import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProfile, requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zRequiredText, zNullableText, zLongText, zOptionalUuid } from '@/lib/validation/common'

const reviewSchema = z.object({
  platform: zRequiredText(50),
  rating: z.number().int().min(1, 'Rating must be 1–5').max(5, 'Rating must be 1–5'),
  content: zLongText(5000).optional(),
  author_name: zNullableText(200),
  contact_id: zOptionalUuid,
  job_id: zOptionalUuid,
  // ISO timestamp; defaults to now when absent.
  received_at: z.string().datetime({ offset: true }).optional(),
})

export async function GET() {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { supabase } = auth.data

  const { data, error } = await supabase
    .from('reviews')
    .select('*, contacts(first_name, last_name)')
    .order('received_at', { ascending: false })
    .limit(500)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, reviewSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      org_id: profile.org_id,
      platform: body.platform,
      rating: body.rating,
      content: body.content ?? null,
      author_name: body.author_name,
      contact_id: body.contact_id,
      job_id: body.job_id,
      received_at: body.received_at ?? new Date().toISOString(),
    })
    .select('*, contacts(first_name, last_name)')
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data, { status: 201 })
}
