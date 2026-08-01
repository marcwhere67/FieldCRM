import { NextResponse } from 'next/server'
import { requireRole, jsonError, friendlyDbError, MANAGER_ROLES } from '@/lib/http'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(MANAGER_ROLES)
  if (!auth.ok) return auth.response
  const { profile, supabase } = auth.data

  const { id } = await params
  // org_id scope added: don't rely on RLS alone for defence in depth.
  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('org_id', profile.org_id)

  if (error) return jsonError(friendlyDbError(error), 400)
  return NextResponse.json({ success: true })
}
