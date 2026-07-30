'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, CalendarClock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { melbourneDateOnly } from '@/lib/format'
import { melbourneToUtcISO } from '@/lib/recurring'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB', fg: '#1C2A35',
  muted: '#8A9BA6', border: 'rgba(44,62,80,0.12)', serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}
const inp: React.CSSProperties = { backgroundColor: '#fff', border: `1px solid ${C.border}`, color: C.fg, fontSize: 13, height: 38, width: '100%', padding: '0 10px', outline: 'none' }
const label: React.CSSProperties = { color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6, display: 'block' }

// Split a stored UTC instant back into Melbourne date + HH:MM for the inputs.
function melbourneParts(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Australia/Melbourne', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso))
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  let hour = g('hour'); if (hour === '24') hour = '00'
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${hour}:${g('minute')}` }
}

export function ScheduleJobModal({ job, onClose }: {
  job: { id: string; title: string; status: string; scheduled_start: string | null; scheduled_end: string | null }
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const existing = job.scheduled_start ? melbourneParts(job.scheduled_start) : null
  const existingDuration = job.scheduled_start && job.scheduled_end
    ? Math.max(15, Math.round((new Date(job.scheduled_end).getTime() - new Date(job.scheduled_start).getTime()) / 60000))
    : 120

  const [date, setDate] = useState(existing?.date ?? melbourneDateOnly())
  const [time, setTime] = useState(existing?.time ?? '09:00')
  const [duration, setDuration] = useState(existingDuration)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!date) { toast.error('Pick a date'); return }
    setSaving(true)
    const startISO = melbourneToUtcISO(date, time || '09:00')
    const endISO = new Date(new Date(startISO).getTime() + (duration || 120) * 60000).toISOString()
    const patch: Record<string, unknown> = { scheduled_start: startISO, scheduled_end: endISO }
    // Putting a date on a draft job promotes it to scheduled; later statuses
    // (in_progress/completed/invoiced) are left alone — this is a reschedule.
    if (job.status === 'draft') patch.status = 'scheduled'

    const { error } = await supabase.from('jobs').update(patch).eq('id', job.id)
    setSaving(false)
    if (error) { toast.error('Failed to schedule job'); return }
    toast.success(job.scheduled_start ? 'Job rescheduled' : 'Job scheduled')
    onClose()
    router.refresh()
  }

  async function clearSchedule() {
    setSaving(true)
    const { error } = await supabase.from('jobs')
      .update({ scheduled_start: null, scheduled_end: null }).eq('id', job.id)
    setSaving(false)
    if (error) { toast.error('Failed to unschedule job'); return }
    toast.success('Moved back to unscheduled')
    onClose()
    router.refresh()
  }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(28,42,53,0.45)', zIndex: 60 }}
      className="flex items-center justify-center p-4">
      <div onClick={e => e.stopPropagation()}
        style={{ backgroundColor: C.cream, border: `1px solid ${C.border}`, width: '100%', maxWidth: 420 }}>
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 20px' }} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" style={{ color: C.sage }} />
            <div>
              <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 9, textTransform: 'uppercase' }}>
                {job.scheduled_start ? 'Reschedule' : 'Schedule'}
              </p>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 18, fontWeight: 300 }}>{job.title}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: C.muted }} className="hover:opacity-70"><X className="w-4 h-4" /></button>
        </div>

        <div style={{ padding: 20 }} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <span style={label}>Date</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </div>
          <div>
            <span style={label}>Start time</span>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inp} />
          </div>
          <div>
            <span style={label}>Duration (min)</span>
            <input type="number" min={15} step={15} value={duration}
              onChange={e => setDuration(Number(e.target.value) || 120)} style={inp} />
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, padding: '12px 20px' }} className="flex items-center justify-between">
          {job.scheduled_start ? (
            <button onClick={clearSchedule} disabled={saving}
              style={{ color: '#dc2626', fontSize: 11, letterSpacing: '0.08em' }}
              className="uppercase hover:opacity-70 disabled:opacity-40">Unschedule</button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={saving}
              style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', color: '#4A5A65', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="uppercase hover:opacity-80 disabled:opacity-40">Cancel</button>
            <button onClick={save} disabled={saving}
              style={{ backgroundColor: C.navy, color: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
              className="uppercase hover:opacity-80 disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
