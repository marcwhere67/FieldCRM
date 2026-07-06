import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('org_id, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: job } = await supabase.from('jobs').select('org_id').eq('id', jobId).single()
  if (!job || job.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const timestamp = Date.now()
    const filename = `${timestamp}-${file.name}`
    const storagePath = `${profile.org_id}/${jobId}/${filename}`

    const { data, error: uploadError } = await supabase.storage
      .from('job-photos')
      .upload(storagePath, file, { upsert: false })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    const { data: urlData } = supabase.storage
      .from('job-photos')
      .getPublicUrl(storagePath)

    const { data: note, error } = await supabase
      .from('job_notes')
      .insert({
        job_id: jobId,
        org_id: profile.org_id,
        note_type: 'photo',
        content: urlData.publicUrl,
        created_by: user.id,
        created_by_name: profile.full_name,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(note)
  } catch (err) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
