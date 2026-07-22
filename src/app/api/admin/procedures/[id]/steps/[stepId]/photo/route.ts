import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  const { id, stepId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('id, org_id, role').eq('supabase_auth_id', user.id).single()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: procedure } = await supabase.from('cleaning_procedures').select('org_id').eq('id', id).single()
  if (!procedure || procedure.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${profile.org_id}/procedures/${id}/${stepId}/${timestamp}-${safeName}`

    // job-photos bucket is private with no storage.objects policies — uploads go
    // through the service role. Safe here: user is already verified admin/manager
    // and the procedure is confirmed to belong to their org. Same pattern as job photos.
    const serviceClient = createServiceClient()
    const { error: uploadError } = await serviceClient.storage
      .from('job-photos')
      .upload(storagePath, file, { upsert: true, contentType: file.type || undefined })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    const { data, error } = await supabase
      .from('procedure_steps')
      .update({ reference_photo_path: storagePath })
      .eq('id', stepId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[PROCEDURE STEP PHOTO] Upload failed:', err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
