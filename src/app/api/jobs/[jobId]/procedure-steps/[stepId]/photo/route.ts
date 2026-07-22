import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string; stepId: string }> }) {
  const { jobId, stepId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('id, org_id').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase.from('jobs').select('org_id').eq('id', jobId).single()
  if (!job || job.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${profile.org_id}/${jobId}/procedure-steps/${stepId}/${timestamp}-${safeName}`

    const serviceClient = createServiceClient()
    const { error: uploadError } = await serviceClient.storage
      .from('job-photos')
      .upload(storagePath, file, { upsert: false, contentType: file.type || undefined })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    const { data, error } = await supabase
      .from('job_procedure_progress')
      .upsert({
        job_id: jobId,
        step_id: stepId,
        org_id: profile.org_id,
        proof_photo_path: storagePath,
        completed: true,
        completed_by: profile.id,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'job_id,step_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[PROCEDURE STEP PROOF PHOTO] Upload failed:', err)
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
