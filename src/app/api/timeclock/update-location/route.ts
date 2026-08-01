import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody } from '@/lib/http'
import { zUuid } from '@/lib/validation/common'

const updateLocationSchema = z.object({
  timesheetId: zUuid,
  lat: z.number().finite(),
  lng: z.number().finite(),
  field: z.enum(['clock_in', 'clock_out']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, updateLocationSchema)
    if (!parsed.ok) return NextResponse.json({ ok: false })
    const { timesheetId, lat, lng, field } = parsed.data

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
