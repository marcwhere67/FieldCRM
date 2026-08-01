import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText } from '@/lib/validation/common'

const sopUpdateSchema = z.object({
  title: zRequiredText(200).optional(),
  category: zRequiredText(100).optional(),
  content: zRequiredText(20000).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseBody(req, sopUpdateSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase.from('sops').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id).select('*, users!sops_created_by_fkey(full_name)').single()
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('sops').delete().eq('id', id)
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json({ success: true })
}
