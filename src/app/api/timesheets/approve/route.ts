import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { timesheetId, approve } = await req.json()
    if (!timesheetId) return NextResponse.json({ ok: false }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, role')
      .eq('supabase_auth_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }

    const { error } = await supabase
      .from('timesheets')
      .update({
        approved: approve,
        approved_by: approve ? profile.id : null,
        approved_at: approve ? new Date().toISOString() : null,
      })
      .eq('id', timesheetId)

    if (error) return NextResponse.json({ ok: false }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
