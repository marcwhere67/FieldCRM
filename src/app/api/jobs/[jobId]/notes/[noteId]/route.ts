import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: Request, { params }: { params: Promise<{ jobId: string; noteId: string }> }) {
  const { jobId, noteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('org_id').eq('supabase_auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: note } = await supabase
    .from('job_notes')
    .select('*')
    .eq('id', noteId)
    .eq('job_id', jobId)
    .eq('org_id', profile.org_id)
    .single()

  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete photo from storage if it's a photo
  if (note.note_type === 'photo' && note.content) {
    try {
      const url = new URL(note.content)
      const path = url.pathname.split('/storage/v1/object/public/job-photos/')[1]
      if (path) {
        await supabase.storage.from('job-photos').remove([path])
      }
    } catch (err) {
      // Ignore storage deletion errors
    }
  }

  const { error } = await supabase.from('job_notes').delete().eq('id', noteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
