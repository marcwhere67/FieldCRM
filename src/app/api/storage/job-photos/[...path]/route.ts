import { NextResponse } from 'next/server'
import { createClient, createServiceClient, getAppProfile } from '@/lib/supabase/server'

// Signed-URL gateway for the private job-photos bucket.
// Paths are `${org_id}/${job_id}/${filename}` — the first segment must match
// the requester's org, so photos are only visible to members of the owning org.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getAppProfile(user.id)
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!path?.length || path[0] !== profile.org_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createServiceClient()
  const { data: signed, error } = await admin.storage
    .from('job-photos')
    .createSignedUrl(path.join('/'), 300)

  if (error || !signed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.redirect(signed.signedUrl, {
    headers: { 'Cache-Control': 'private, max-age=240' },
  })
}
