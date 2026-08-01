import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireProfile, parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zUuid, zRequiredText } from '@/lib/validation/common'

// Hex colour like #6366f1 or #fff — pipeline stage swatch.
const zHexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Enter a hex colour like #6366f1')

const createSchema = z.object({
  name: zRequiredText(100),
  color: zHexColor.optional(),
  position: z.number().int().min(0).max(1000).optional(),
})

const patchSchema = z.object({
  stageId: zUuid,
  name: zRequiredText(100).optional(),
  color: zHexColor.optional(),
})

const deleteSchema = z.object({ stageId: zUuid })

export async function POST(req: Request) {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, createSchema)
  if (!parsed.ok) return parsed.response
  const { name, color, position } = parsed.data

  const { data: stage, error } = await supabase
    .from('pipeline_stages')
    .insert({ org_id: profile.org_id, name, color: color ?? '#6366f1', position: position ?? 0 })
    .select('id, name, position, color')
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ stage })
}

export async function PATCH(req: Request) {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, patchSchema)
  if (!parsed.ok) return parsed.response
  const { stageId, name, color } = parsed.data

  const { data: stage, error } = await supabase
    .from('pipeline_stages')
    .update({ name, color })
    .eq('id', stageId)
    .eq('org_id', profile.org_id)
    .select('id, name, position, color')
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ stage })
}

export async function DELETE(req: Request) {
  const auth = await requireProfile()
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const parsed = await parseBody(req, deleteSchema)
  if (!parsed.ok) return parsed.response
  const { stageId } = parsed.data

  // Unassign contacts in this stage first so the delete doesn't orphan them.
  await supabase
    .from('contacts')
    .update({ pipeline_stage_id: null })
    .eq('pipeline_stage_id', stageId)
    .eq('org_id', profile.org_id)

  const { error } = await supabase
    .from('pipeline_stages')
    .delete()
    .eq('id', stageId)
    .eq('org_id', profile.org_id)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ ok: true })
}
