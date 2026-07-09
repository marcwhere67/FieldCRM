import { NextResponse } from 'next/server'
import { createClient, createServiceClient, getAppProfile } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getAppProfile(user.id)
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  try {
    // Connection status via service client (table is closed to browser clients).
    // Only non-secret columns are selected — tokens never leave the server.
    const { data: syncState } = await createServiceClient()
      .from('gmail_sync_state')
      .select('sync_status, last_sync_at, error_message')
      .eq('org_id', profile.org_id)
      .eq('user_id', profile.id)
      .maybeSingle()

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: emails, error } = await supabase
      .from('emails')
      .select(`
        *,
        email_contacts(
          contact:contacts(id, first_name, last_name, email)
        )
      `)
      .eq('org_id', profile.org_id)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({ connected: !!syncState, syncState: syncState ?? null, emails: emails ?? [] })
  } catch (error) {
    console.error('Fetch emails error:', error)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
}
