'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ClockWidget } from './clock-widget'
import { formatMinutes } from '@/lib/format'
import { MapPin, Clock, Users, CheckCircle } from 'lucide-react'

const CrewMap = dynamic(() => import('./crew-map').then(m => m.CrewMap), { ssr: false })

interface User { id: string; full_name: string; avatar_url: string | null; role: string }
interface Session { id: string; user_id: string; clocked_in_at: string; clock_in_lat: number | null; clock_in_lng: number | null; clock_out_lat: number | null; clock_out_lng: number | null; jobs: { id: string; title: string } | { id: string; title: string }[] | null }
interface TodayEntry { id: string; user_id: string; clocked_in_at: string; clocked_out_at: string | null; total_minutes: number | null; clock_in_lat: number | null; clock_in_lng: number | null; jobs: { id: string; title: string } | { id: string; title: string }[] | null }
interface Props { users: User[]; activeSessions: Session[]; todayTimesheets: TodayEntry[]; currentUserId: string; myActiveTimesheet: { id: string; clocked_in_at: string } | null }

const C = {
  cream: '#F5F0EB', navy: '#2C3E50', sage: '#76A58F',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

const AVATAR_COLORS = [
  { bg: 'rgba(118,165,143,0.15)', color: '#5d8c76' },
  { bg: 'rgba(44,62,80,0.10)',    color: '#2C3E50' },
  { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb' },
]

function initials(u: { full_name: string }) {
  const p = u.full_name.split(' ')
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase()
}

function getJob(entry: Session | TodayEntry) {
  if (!entry.jobs) return null
  return Array.isArray(entry.jobs) ? entry.jobs[0] : entry.jobs
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0')
  return `${h < 12 ? h : h - 12 || 12}:${m}${h < 12 ? 'am' : 'pm'}`
}

export function FieldMap({ users, activeSessions, todayTimesheets, currentUserId, myActiveTimesheet }: Props) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  const activeMap     = new Map(activeSessions.map(s => [s.user_id, s]))
  const userMap       = new Map(users.map(u => [u.id, u]))
  const todayByUser   = new Map<string, TodayEntry[]>()
  for (const t of todayTimesheets) {
    const list = todayByUser.get(t.user_id) ?? []; list.push(t); todayByUser.set(t.user_id, list)
  }

  const clockedInCount = activeSessions.length
  const locatedCount   = activeSessions.filter(s => s.clock_in_lat).length
  const todayMinutes   = todayTimesheets.reduce((s, t) => s + (t.total_minutes ?? 0), 0)
  const mySession      = activeSessions.find(s => s.user_id === currentUserId)

  const locatedPins = activeSessions.filter(s => s.clock_in_lat && s.clock_in_lng).map(s => {
    const u = userMap.get(s.user_id)
    return { lat: s.clock_in_lat!, lng: s.clock_in_lng!, label: u ? initials(u) : '?', color: 'green' as const }
  })

  const STAT_CARDS = [
    { label: 'Clocked in now', value: clockedInCount, sub: `of ${users.length} crew`,    topColor: C.sage },
    { label: 'GPS located',    value: locatedCount,   sub: 'with coordinates',            topColor: '#2563eb' },
    { label: 'Hours today',    value: formatMinutes(todayMinutes), sub: 'across all crew', topColor: C.navy },
  ]

  return (
    <div style={{ padding: '0 0 32px' }}>
      <div style={{ backgroundColor: C.cream, borderBottom: `1px solid ${C.border}`, padding: '24px 32px' }}>
        <p style={{ color: C.sage, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>Operations</p>
        <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300, marginBottom: 4 }}>Field Map</h1>
        <p style={{ color: C.muted, fontSize: 13 }}>Live crew locations and clock-in status</p>
      </div>

      <div style={{ padding: '24px 32px' }} className="space-y-6">
        <ClockWidget
          activeTimesheet={myActiveTimesheet}
          jobId={mySession ? getJob(mySession)?.id : undefined}
          jobTitle={mySession ? getJob(mySession)?.title : undefined}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {STAT_CARDS.map(sc => (
            <div key={sc.label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `3px solid ${sc.topColor}`, padding: 16 }}>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>{sc.label}</p>
              <p style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>{sc.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }} className="lg:grid-cols-3-custom">
          {/* Map panel */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, overflow: 'hidden', minHeight: 340, gridColumn: 'span 2' }}>
            {locatedPins.length > 0 ? (
              <CrewMap pins={locatedPins} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '64px 24px', gap: 12 }}>
                <MapPin style={{ width: 32, height: 32, color: C.border }} />
                <p style={{ color: C.navy, fontSize: 14, fontWeight: 500 }}>No crew located yet</p>
                <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', maxWidth: 240 }}>
                  Crew members appear here when they clock in and allow location access
                </p>
              </div>
            )}
          </div>

          {/* Crew list */}
          <div style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users style={{ width: 13, height: 13, color: C.muted }} />
              <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }}>Crew status</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {users.map(u => {
                const session    = activeMap.get(u.id)
                const job        = session ? getJob(session) : null
                const todayLogs  = todayByUser.get(u.id) ?? []
                const todayMins  = todayLogs.reduce((s, t) => s + (t.total_minutes ?? 0), 0)
                const isSelected = selectedUser === u.id
                const av         = AVATAR_COLORS[u.full_name.charCodeAt(0) % AVATAR_COLORS.length]

                return (
                  <button key={u.id} onClick={() => setSelectedUser(isSelected ? null : u.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: isSelected ? C.cream : 'none', textAlign: 'left', cursor: 'pointer', border: 'none', borderBottom: `1px solid ${C.border}` }}
                    className="hover:bg-gray-50 transition-colors">
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 30, height: 30, backgroundColor: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>
                        {initials(u)}
                      </div>
                      <span style={{ position: 'absolute', bottom: -2, right: -2, width: 9, height: 9, borderRadius: '50%', border: '2px solid #fff', backgroundColor: session ? C.sage : C.border }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: C.navy, fontSize: 12, fontWeight: 500 }} className="truncate">{u.full_name}</p>
                      {session ? (
                        <>
                          <p style={{ color: C.sage, fontSize: 11 }}>Clocked in {formatTime(session.clocked_in_at)}</p>
                          {job && <p style={{ color: C.muted, fontSize: 11 }} className="truncate">{job.title}</p>}
                          <p style={{ color: session.clock_in_lat ? C.sage : C.muted, fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                            <MapPin style={{ width: 9, height: 9 }} />
                            {session.clock_in_lat ? 'GPS captured' : 'No GPS — location denied'}
                          </p>
                        </>
                      ) : (
                        <p style={{ color: C.muted, fontSize: 11 }}>{todayMins > 0 ? `${formatMinutes(todayMins)} today` : 'Not clocked in'}</p>
                      )}
                    </div>
                    {session && <Clock style={{ width: 11, height: 11, color: C.sage, flexShrink: 0, marginTop: 2 }} />}
                  </button>
                )
              })}
            </div>

            {selectedUser && (todayByUser.get(selectedUser) ?? []).length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 14px' }}>
                <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Today&apos;s log</p>
                <div className="space-y-2">
                  {(todayByUser.get(selectedUser) ?? []).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 11 }}>
                        <CheckCircle style={{ width: 11, height: 11, color: C.sage }} />
                        <span>{formatTime(t.clocked_in_at)}</span>
                        {t.clocked_out_at && <span>→ {formatTime(t.clocked_out_at)}</span>}
                      </div>
                      {t.total_minutes && <span style={{ color: C.navy, fontSize: 11, fontWeight: 500 }}>{formatMinutes(t.total_minutes)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
