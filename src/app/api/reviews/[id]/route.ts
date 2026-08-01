import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, parseBody, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'
import { zLongText, zNullableText } from '@/lib/validation/common'

// The manager writes a public response and/or moves the review status. Both
// optional; a body with just `response` stamps `responded_at`.
const reviewPatchSchema = z
  .object({
    response: zLongText(5000),
    status: zNullableText(50),
    responded_at: z.string().datetime({ offset: true }),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, { message: 'Nothing to update' })

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { id } = await params
  const parsed = await parseBody(req, reviewPatchSchema)
  if (!parsed.ok) return parsed.response

  const update: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }
  // Saving a response stamps responded_at unless the caller set it explicitly.
  if (parsed.data.response && !parsed.data.responded_at) {
    update.responded_at = new Date().toISOString()
  }

  // org_id scope added: don't rely on RLS alone for defence in depth.
  const { data, error } = await supabase
    .from('reviews')
    .update(update)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select('*, contacts(first_name, last_name)')
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { id } = await params
  const { error } = await supabase.from('reviews').delete().eq('id', id).eq('org_id', profile.org_id)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ success: true })
}
