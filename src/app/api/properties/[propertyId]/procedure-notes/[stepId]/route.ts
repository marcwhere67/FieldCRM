import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'

// Per-property note for a procedure step. Any org member (admin or tech) may set/clear.
async function authorise(propertyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase.from('users').select('id, org_id').eq('supabase_auth_id', user.id).single()
  if (!profile) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: property } = await supabase.from('properties').select('org_id').eq('id', propertyId).single()
  if (!property || property.org_id !== profile.org_id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  return { supabase, profile }
}

const noteSchema = z.object({
  note: z.string().optional(),
})

export async function PUT(req: Request, { params }: { params: Promise<{ propertyId: string; stepId: string }> }) {
  const { propertyId, stepId } = await params
  const auth = await authorise(propertyId)
  if (auth.error) return auth.error
  const { supabase, profile } = auth

  const parsed = await parseBody(req, noteSchema)
  if (!parsed.ok) return parsed.response
  const note = (parsed.data.note ?? '').trim()
  if (!note) return NextResponse.json({ error: 'Note is empty' }, { status: 400 })

  const { data, error } = await supabase
    .from('property_procedure_notes')
    .upsert({
      property_id: propertyId,
      step_id: stepId,
      org_id: profile.org_id,
      note,
      updated_by: profile.id,
    }, { onConflict: 'property_id,step_id' })
    .select()
    .single()

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ propertyId: string; stepId: string }> }) {
  const { propertyId, stepId } = await params
  const auth = await authorise(propertyId)
  if (auth.error) return auth.error
  const { supabase } = auth

  const { error } = await supabase
    .from('property_procedure_notes')
    .delete()
    .eq('property_id', propertyId)
    .eq('step_id', stepId)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ ok: true })
}
