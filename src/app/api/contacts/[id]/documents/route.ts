import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'client-documents'
const MAX_BYTES = 25 * 1024 * 1024
const CATEGORIES = ['contract', 'document', 'photo', 'report', 'other']

// GET — list a contact's documents (admin/manager only)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: contactId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('client_documents')
    .select('*, users:uploaded_by(full_name)')
    .eq('org_id', profile.org_id)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — upload a file for the contact (admin/manager only)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: contactId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Confirm the contact belongs to this org
  const { data: contact } = await supabase
    .from('contacts').select('id').eq('id', contactId).eq('org_id', profile.org_id).single()
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file')
  const title = (form.get('title') as string | null)?.trim()
  const category = (form.get('category') as string | null) ?? 'document'

  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'File is empty' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds 25 MB limit' }, { status: 400 })
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })

  // Path: {org}/{contact}/documents/{uuid}-{safe name} — org prefix keeps tenants isolated
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
  const path = `${profile.org_id}/${contactId}/documents/${crypto.randomUUID()}-${safeName}`

  const admin = createServiceClient()
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (uploadError) return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })

  const { data, error } = await supabase
    .from('client_documents')
    .insert({
      org_id: profile.org_id,
      contact_id: contactId,
      category,
      title: title || file.name,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: profile.id,
    })
    .select('*, users:uploaded_by(full_name)')
    .single()

  if (error) {
    // Roll back the orphaned upload so storage doesn't drift from the table
    await admin.storage.from(BUCKET).remove([path])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
