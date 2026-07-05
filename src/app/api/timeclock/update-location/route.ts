import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { timesheetId, lat, lng, field } = await req.json()
    if (!timesheetId || !lat || !lng) return NextResponse.json({ ok: false })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false })

    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ ok: false })

    const update = field === 'clock_in'
      ? { clock_in_lat: lat, clock_in_lng: lng }
      : { clock_out_lat: lat, clock_out_lng: lng }

    await supabase
      .from('timesheets')
      .update(update)
      .eq('id', timesheetId)
      .eq('user_id', profile.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
