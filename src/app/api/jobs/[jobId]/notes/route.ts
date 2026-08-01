import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getCacheHeaders } from '@/lib/cache'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zRequiredText } from '@/lib/validation/common'

const noteSchema = z.object({
  content: zRequiredText(5000),
  note_type: z.enum(['text', 'photo', 'signature']),
})

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, org_id, full_name').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, noteSchema)
  if (!parsed.ok) return parsed.response
  const { content, note_type } = parsed.data

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

  if (error) return jsonError(friendlyDbError(error), 400)
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
