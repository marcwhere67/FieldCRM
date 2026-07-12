import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase.from('jobs').select('org_id').eq('id', jobId).single()
  if (!job || job.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const timestamp = Date.now()
    // Strip anything path-hostile from the client-supplied filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `${timestamp}-${safeName}`
    const storagePath = `${profile.org_id}/${jobId}/${filename}`

    // The job-photos bucket is private with NO storage.objects policies, so
    // uploads must go through the service role — the user's client gets RLS-denied.
    // Safe here: we've already verified the user + that the job belongs to their org,
    // and the path is namespaced to their org. (Same pattern as client_documents.)
    const serviceClient = createServiceClient()
    const { error: uploadError } = await serviceClient.storage
      .from('job-photos')
      .upload(storagePath, file, { upsert: false, contentType: file.type || undefined })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    // Stored in the legacy public-URL shape; jobPhotoSrc() rewrites it to the
    // authenticated gateway (/api/storage/job-photos/*) on display.
    const { data: urlData } = serviceClient.storage
      .from('job-photos')
      .getPublicUrl(storagePath)

    const { data: note, error } = await supabase
      .from('job_notes')
      .insert({
        job_id: jobId,
        org_id: profile.org_id,
        note_type: 'photo',
        content: urlData.publicUrl,
        created_by: profile.id, // app users.id — NOT the auth id (FK targets users)
        created_by_name: profile.full_name,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(note)
  } catch (err) {
    console.error('[JOB PHOTO] Upload failed:', err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
