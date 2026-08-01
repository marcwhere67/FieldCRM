import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText, zNullableText } from '@/lib/validation/common'

const documentUpdateSchema = z.object({
  title: zRequiredText(200).optional(),
  category: zRequiredText(100).optional(),
  description: zNullableText(2000).optional(),
  url: zRequiredText(2000).optional(),
  file_type: zRequiredText(50).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = await parseBody(req, documentUpdateSchema)
  if (!parsed.ok) return parsed.response

  const { data, error } = await supabase.from('admin_documents').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id).select('*, users!admin_documents_created_by_fkey(full_name)').single()
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

  const { error } = await supabase.from('admin_documents').delete().eq('id', id)
  if (error) return jsonError(friendlyDbError(error), 500)
  return NextResponse.json({ success: true })
}
