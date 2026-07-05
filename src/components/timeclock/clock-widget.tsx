'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Clock, LogIn, LogOut, Loader2 } from 'lucide-react'
import { formatMinutes } from '@/lib/format'

interface Props {
  jobId?: string
  jobTitle?: string
  activeTimesheet?: { id: string; clocked_in_at: string } | null
}

const C = { navy: '#2C3E50', sage: '#76A58F', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)' }

function getGPS(timeout = 5000): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout }
    )
  })
}

export function ClockWidget({ jobId, jobTitle, activeTimesheet: initial }: Props) {
  const router = useRouter()
  const [active, setActive] = useState<{ id: string; clocked_in_at: string } | null>(initial ?? null)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) { setElapsed(0); return }
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(active.clocked_in_at).getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [active])

  async function clockIn() {
    setLoading(true)
    const res = await fetch('/api/timeclock/punch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clock_in', lat: null, lng: null, jobId }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to clock in'); setLoading(false); return }
    setActive({ id: data.timesheetId, clocked_in_at: new Date().toISOString() })
    toast.success('Clocked in')
    setLoading(false)
    router.refresh()
    getGPS(4000).then(gps => {
      if (gps) fetch('/api/timeclock/update-location', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheetId: data.timesheetId, lat: gps.lat, lng: gps.lng, field: 'clock_in' }),
      }).catch(() => {})
    })
  }

  async function clockOut() {
    if (!active) return
    setLoading(true)
    const res = await fetch('/api/timeclock/punch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clock_out', lat: null, lng: null, timesheetId: active.id }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to clock out'); setLoading(false); return }
    const mins = data.totalMinutes ?? 0
    toast.success(`Clocked out — ${mins > 0 ? formatMinutes(mins) : 'less than 1 min'} logged`)
    setActive(null); setLoading(false)
    router.refresh()
    getGPS(4000).then(gps => {
      if (gps && data.timesheetId) fetch('/api/timeclock/update-location', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheetId: data.timesheetId, lat: gps.lat, lng: gps.lng, field: 'clock_out' }),
      }).catch(() => {})
    })
  }

  const elapsedStr = (() => {
    const h = Math.floor(elapsed / 3600)
    const m = Math.floor((elapsed % 3600) / 60)
    const s = elapsed % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
  })()

  return (
    <div style={{ backgroundColor: '#fff', border: `1px solid ${active ? 'rgba(118,165,143,0.4)' : C.border}`, borderTop: `3px solid ${active ? C.sage : C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 36, height: 36, backgroundColor: active ? 'rgba(118,165,143,0.12)' : 'rgba(44,62,80,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Clock style={{ width: 16, height: 16, color: active ? C.sage : C.muted }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {active ? (
          <>
            <p style={{ color: C.sage, fontSize: 12, fontWeight: 500 }}>Clocked in{jobTitle ? ` · ${jobTitle}` : ''}</p>
            <p style={{ color: C.navy, fontSize: 20, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1.2 }}>{elapsedStr}</p>
          </>
        ) : (
          <>
            <p style={{ color: C.navy, fontSize: 13, fontWeight: 500 }}>Not clocked in</p>
            {jobTitle && <p style={{ color: C.muted, fontSize: 11 }} className="truncate">{jobTitle}</p>}
          </>
        )}
      </div>

      <button onClick={active ? clockOut : clockIn} disabled={loading}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 11, letterSpacing: '0.08em', backgroundColor: active ? '#dc2626' : C.sage, color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, flexShrink: 0 }}
        className="uppercase">
        {loading
          ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
          : active
            ? <><LogOut style={{ width: 13, height: 13 }} />Clock out</>
            : <><LogIn style={{ width: 13, height: 13 }} />Clock in</>
        }
      </button>
    </div>
  )
}
