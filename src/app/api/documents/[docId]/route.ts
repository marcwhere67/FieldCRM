import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'client-documents'

// DELETE — remove a client document (admin/manager, org-scoped): storage object + row
export async function DELETE(_req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: doc } = await supabase
    .from('client_documents').select('file_path')
    .eq('id', docId).eq('org_id', profile.org_id).single()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createServiceClient()
  await admin.storage.from(BUCKET).remove([doc.file_path])

  const { error } = await supabase
    .from('client_documents').delete().eq('id', docId).eq('org_id', profile.org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
