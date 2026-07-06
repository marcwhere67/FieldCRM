import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'client-documents'

// GET — redirect to a short-lived signed URL for the file (admin/manager, org-scoped)
export async function GET(_req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: doc } = await supabase
    .from('client_documents').select('file_path, file_name')
    .eq('id', docId).eq('org_id', profile.org_id).single()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createServiceClient()
  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.file_path, 60, { download: doc.file_name })
  if (error || !signed) return NextResponse.json({ error: 'Could not generate link' }, { status: 500 })

  return NextResponse.redirect(signed.signedUrl)
}
