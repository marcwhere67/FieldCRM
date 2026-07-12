import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCacheHeaders } from '@/lib/cache'

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, note_type } = await req.json()
  if (!content || !note_type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: job } = await supabase.from('jobs').select('org_id').eq('id', jobId).single()
  if (!job || job.org_id !== profile.org_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: note, error } = await supabase
    .from('job_notes')
    .insert({
      job_id: jobId,
      org_id: profile.org_id,
      note_type,
      content,
      created_by: profile.id, // app users.id — NOT the auth id (FK targets users)
      created_by_name: profile.full_name,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(note)
}

export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('org_id').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: notes } = await supabase
    .from('job_notes')
    .select('*')
    .eq('job_id', jobId)
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })

  return NextResponse.json(notes ?? [], { headers: getCacheHeaders('revalidate') })
}
