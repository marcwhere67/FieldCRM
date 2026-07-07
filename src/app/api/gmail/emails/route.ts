import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { profile } = await getAppProfile(supabase, user.id)
    if (!profile) throw new Error('Profile not found')

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get emails for this org
    const { data: emails, error } = await supabase
      .from('emails')
      .select(
        `*,
        email_contacts(
          contact:contacts(id, name, email)
        )`
      )
      .eq('org_id', profile.org_id)
      .order('received_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({ emails })
  } catch (error) {
    console.error('Fetch emails error:', error)
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 })
  }
}

async function getAppProfile(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return { profile }
}
