import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseBody, jsonError, friendlyDbError } from '@/lib/http'
import { zOptionalUuid } from '@/lib/validation/common'

const punchSchema = z.object({
  action: z.enum(['clock_in', 'clock_out'], { error: 'Invalid action' }),
  lat: z.number().finite().optional().nullable(),
  lng: z.number().finite().optional().nullable(),
  jobId: zOptionalUuid,
  timesheetId: zOptionalUuid,
})

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, punchSchema)
    if (!parsed.ok) return parsed.response
    const { action, lat, lng, jobId, timesheetId } = parsed.data

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('id, org_id')
      .eq('supabase_auth_id', user.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const now = new Date().toISOString()

    if (action === 'clock_in') {
      // Close any open session for this user first (safety net)
      const { data: openSession } = await supabase
        .from('timesheets')
        .select('id, clocked_in_at')
        .eq('user_id', profile.id)
        .is('clocked_out_at', null)
        .order('clocked_in_at', { ascending: false })
        .limit(1)
        .single()

      if (openSession) {
        const mins = Math.round((new Date(now).getTime() - new Date(openSession.clocked_in_at).getTime()) / 60000)
        await supabase
          .from('timesheets')
          .update({ clocked_out_at: now, total_minutes: mins })
          .eq('id', openSession.id)
      }

      const { data, error } = await supabase
        .from('timesheets')
        .insert({
          org_id: profile.org_id,
          user_id: profile.id,
          job_id: jobId ?? null,
          clocked_in_at: now,
          clock_in_lat: lat ?? null,
          clock_in_lng: lng ?? null,
        })
        .select('id')
        .single()

      if (error) return jsonError(friendlyDbError(error), 500)
      return NextResponse.json({ timesheetId: data.id })
    }

    if (action === 'clock_out') {
      // Find the open session — use timesheetId if provided, otherwise find latest open
      let sessionId = timesheetId as string | null

      if (!sessionId) {
        const { data: open } = await supabase
          .from('timesheets')
          .select('id, clocked_in_at')
          .eq('user_id', profile.id)
          .is('clocked_out_at', null)
          .order('clocked_in_at', { ascending: false })
          .limit(1)
          .single()
        sessionId = open?.id ?? null
      }

      if (!sessionId) {
        return NextResponse.json({ error: 'No active clock-in found' }, { status: 404 })
      }

      const { data: ts } = await supabase
        .from('timesheets')
        .select('clocked_in_at')
        .eq('id', sessionId)
        .eq('user_id', profile.id)
        .single()

      if (!ts) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 })

      const totalMinutes = Math.round(
        (new Date(now).getTime() - new Date(ts.clocked_in_at).getTime()) / 60000
      )

      const { data: updated, error } = await supabase
        .from('timesheets')
        .update({
          clocked_out_at: now,
          clock_out_lat: lat ?? null,
          clock_out_lng: lng ?? null,
          total_minutes: totalMinutes,
        })
        .eq('id', sessionId)
        .eq('user_id', profile.id)
        .select('id')

      if (error) return jsonError(friendlyDbError(error), 500)
      if (!updated || updated.length === 0) {
        return NextResponse.json({ error: 'Failed to save clock-out — try refreshing and clocking out again' }, { status: 500 })
      }

      return NextResponse.json({ totalMinutes, timesheetId: sessionId })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
