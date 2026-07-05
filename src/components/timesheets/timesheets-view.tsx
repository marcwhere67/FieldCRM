'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, Clock, Download, MapPin, Users, LogOut } from 'lucide-react'
import { formatMinutes } from '@/lib/format'

const C = {
  navy: '#2C3E50', sage: '#76A58F', cream: '#F5F0EB',
  fg: '#1C2A35', muted: '#8A9BA6', border: 'rgba(44,62,80,0.09)',
  serif: "var(--font-cormorant,'Cormorant Garamond',Georgia,serif)",
}

interface Job { id: string; title: string }
interface Timesheet {
  id: string; user_id: string; clocked_in_at: string; clocked_out_at: string | null
  total_minutes: number | null; clock_in_lat: number | null; clock_in_lng: number | null
  clock_out_lat: number | null; clock_out_lng: number | null; notes: string | null
  approved: boolean; approved_by: string | null; approved_at: string | null
  jobs: Job | Job[] | null
}
interface User { id: string; full_name: string; role: string }
interface Props { timesheets: Timesheet[]; users: User[]; currentUserId: string; currentUserRole: string }

function startOfWeek(date: Date): Date {
  const d = new Date(date); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d
}
function formatDateLocal(iso: string) {
  const d = new Date(iso); const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}
function formatTime(iso: string) {
  const d = new Date(iso); const h = d.getHours(); const m = String(d.getMinutes()).padStart(2,'0')
  return `${h<12?h||12:h-12||12}:${m}${h<12?'am':'pm'}`
}
function weekLabel(weekStart: Date) {
  const end = new Date(weekStart); end.setDate(end.getDate()+6)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${weekStart.getDate()} ${months[weekStart.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`
}

export function TimesheetsView({ timesheets, users, currentUserId, currentUserRole }: Props) {
  const router = useRouter()
  const canApprove = currentUserRole === 'admin' || currentUserRole === 'manager'
  void currentUserId; void canApprove

  const [filterUser, setFilterUser] = useState<string>('all')
  const [filterApproval, setFilterApproval] = useState<string>('all')
  const [filterWeek, setFilterWeek] = useState<string>('all')
  const [approving, setApproving] = useState<Set<string>>(new Set())
  const [closingOut, setClosingOut] = useState<Set<string>>(new Set())

  const userMap = new Map(users.map(u => [u.id, u]))

  const weekOptions = useMemo(() => {
    const seen = new Map<string, Date>()
    for (const t of timesheets) {
      const ws = startOfWeek(new Date(t.clocked_in_at)); const key = ws.toISOString().split('T')[0]
      if (!seen.has(key)) seen.set(key, ws)
    }
    return Array.from(seen.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([key, date]) => ({ key, label: weekLabel(date) }))
  }, [timesheets])

  const filtered = useMemo(() => timesheets.filter(t => {
    if (filterUser !== 'all' && t.user_id !== filterUser) return false
    if (filterApproval === 'approved' && !t.approved) return false
    if (filterApproval === 'pending' && (t.approved || !t.clocked_out_at)) return false
    if (filterWeek !== 'all') { const ws = startOfWeek(new Date(t.clocked_in_at)).toISOString().split('T')[0]; if (ws !== filterWeek) return false }
    return true
  }), [timesheets, filterUser, filterApproval, filterWeek])

  const weeklySummary = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const t of filtered) {
      if (!t.total_minutes) continue
      const wk = startOfWeek(new Date(t.clocked_in_at)).toISOString().split('T')[0]
      if (!map.has(wk)) map.set(wk, new Map())
      const um = map.get(wk)!; um.set(t.user_id, (um.get(t.user_id) ?? 0) + t.total_minutes)
    }
    return map
  }, [filtered])

  async function toggleApprove(t: Timesheet) {
    setApproving(prev => new Set(prev).add(t.id))
    const res = await fetch('/api/timesheets/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timesheetId: t.id, approve: !t.approved }) })
    if (!res.ok) toast.error('Failed to update approval')
    else { toast.success(t.approved ? 'Approval removed' : 'Entry approved'); router.refresh() }
    setApproving(prev => { const s = new Set(prev); s.delete(t.id); return s })
  }

  async function forceClockOut(t: Timesheet) {
    setClosingOut(prev => new Set(prev).add(t.id))
    const res = await fetch('/api/timeclock/punch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clock_out', timesheetId: t.id, lat: null, lng: null }) })
    const data = await res.json()
    if (!res.ok) toast.error(data.error ?? 'Failed to clock out')
    else { toast.success('Session closed'); router.refresh() }
    setClosingOut(prev => { const s = new Set(prev); s.delete(t.id); return s })
  }

  function exportCSV() {
    const rows = [['Date','Employee','Job','Clock In','Clock Out','Total Hours','GPS In','GPS Out','Approved','Notes'],
      ...filtered.map(t => {
        const u = userMap.get(t.user_id); const job = t.jobs ? (Array.isArray(t.jobs) ? t.jobs[0] : t.jobs) : null
        const hrs = t.total_minutes ? (t.total_minutes / 60).toFixed(2) : ''
        return [formatDateLocal(t.clocked_in_at), u ? u.full_name : t.user_id, job?.title ?? '', formatTime(t.clocked_in_at), t.clocked_out_at ? formatTime(t.clocked_out_at) : 'Active', hrs, t.clock_in_lat ? `${t.clock_in_lat},${t.clock_in_lng}` : '', t.clock_out_lat ? `${t.clock_out_lat},${t.clock_out_lng}` : '', t.approved ? 'Yes' : 'No', t.notes ?? '']
      })]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `timesheets-${new Date().toISOString().split('T')[0]}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const totalMins = filtered.reduce((s, t) => s + (t.total_minutes ?? 0), 0)
  const pendingCount = filtered.filter(t => !t.approved && t.clocked_out_at).length
  const activeCount = filtered.filter(t => !t.clocked_out_at).length

  const byWeek = useMemo(() => {
    const map = new Map<string, { label: string; entries: Timesheet[] }>()
    for (const t of filtered) {
      const ws = startOfWeek(new Date(t.clocked_in_at)); const key = ws.toISOString().split('T')[0]
      if (!map.has(key)) map.set(key, { label: weekLabel(ws), entries: [] })
      map.get(key)!.entries.push(t)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const selSt: React.CSSProperties = { backgroundColor: '#fff', border: `1px solid rgba(44,62,80,0.15)`, borderRadius: 0, color: C.fg, fontSize: 12, padding: '7px 10px', outline: 'none', cursor: 'pointer' }

  return (
    <div className="space-y-5 -mx-6 -mt-6">
      {/* Page header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: C.cream, padding: '24px 24px 16px' }} className="flex items-center justify-between">
        <div>
          <p style={{ color: C.sage, letterSpacing: '0.2em', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>Field</p>
          <h1 style={{ fontFamily: C.serif, color: C.navy, fontSize: 28, fontWeight: 300 }}>Timesheets</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Clock-in records, approvals and hours</p>
        </div>
        <button onClick={exportCSV}
          style={{ border: `1px solid ${C.border}`, color: '#4A5A65', backgroundColor: '#fff', padding: '7px 14px', fontSize: 11, letterSpacing: '0.08em' }}
          className="inline-flex items-center gap-1.5 uppercase hover:opacity-80 transition-opacity">
          <Download style={{ width: 13, height: 13 }} />Export CSV
        </button>
      </div>

      <div className="px-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Hours', value: formatMinutes(totalMins), sub: `${filtered.length} entries`, accent: C.sage },
            { label: 'Awaiting Approval', value: String(pendingCount), sub: 'completed entries', accent: '#b45309' },
            { label: 'Clocked In', value: String(activeCount), sub: 'active sessions', accent: C.navy },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: '#fff', border: `1px solid ${C.border}`, borderTop: `2px solid ${card.accent}`, padding: 16 }}>
              <p style={{ color: C.muted, fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>{card.label}</p>
              <p style={{ fontFamily: C.serif, color: card.accent, fontSize: 24, fontWeight: 300 }}>{card.value}</p>
              <p style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={selSt}>
            <option value="all">All crew</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)} style={selSt}>
            <option value="all">All weeks</option>
            {weekOptions.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
          </select>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {[['all','All'],['pending','Pending'],['approved','Approved']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterApproval(val)}
                style={{ padding: '7px 12px', fontSize: 11, letterSpacing: '0.05em', cursor: 'pointer',
                  backgroundColor: filterApproval === val ? C.navy : '#fff', color: filterApproval === val ? '#fff' : C.muted }}
                className="hover:opacity-80 transition-opacity">{label}</button>
            ))}
          </div>
        </div>

        {/* Table by week */}
        {byWeek.length === 0 ? (
          <div style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', padding: '64px 24px', textAlign: 'center' }}>
            <Clock style={{ width: 28, height: 28, color: 'rgba(44,62,80,0.15)', margin: '0 auto 12px' }} />
            <p style={{ color: C.muted, fontSize: 13 }}>No timesheet entries found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {byWeek.map(([weekKey, { label, entries }]) => {
              const weekMins = entries.reduce((s, t) => s + (t.total_minutes ?? 0), 0)
              const weekSummary = weeklySummary.get(weekKey)
              return (
                <div key={weekKey} style={{ border: `1px solid ${C.border}`, backgroundColor: '#fff', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: C.cream, borderBottom: `1px solid ${C.border}`, padding: '10px 16px' }} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <p style={{ color: C.navy, fontWeight: 500, fontSize: 13 }}>{label}</p>
                      <span style={{ color: C.muted, fontSize: 11 }}>{entries.length} entries</span>
                    </div>
                    <p style={{ color: '#4A5A65', fontSize: 12 }}>{formatMinutes(weekMins)} total</p>
                  </div>
                  {weekSummary && weekSummary.size > 1 && (
                    <div style={{ borderBottom: `1px solid ${C.border}`, padding: '8px 16px' }} className="flex flex-wrap gap-4">
                      {Array.from(weekSummary.entries()).map(([uid, mins]) => {
                        const u = userMap.get(uid); if (!u) return null
                        return (
                          <div key={uid} className="flex items-center gap-2" style={{ fontSize: 11 }}>
                            <Users style={{ width: 11, height: 11, color: C.muted }} />
                            <span style={{ color: C.muted }}>{u.full_name}</span>
                            <span style={{ color: '#4A5A65', fontWeight: 500 }}>{formatMinutes(mins)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          {['Employee','Date','Job','Clock In','Clock Out','Duration','GPS','Status',''].map((h, i) => (
                            <th key={i} style={{ padding: '8px 14px', textAlign: 'left', color: C.muted, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((t, i) => {
                          const u = userMap.get(t.user_id)
                          const job = t.jobs ? (Array.isArray(t.jobs) ? t.jobs[0] : t.jobs) : null
                          const isActive = !t.clocked_out_at
                          return (
                            <tr key={t.id} style={{ borderBottom: `1px solid rgba(44,62,80,0.05)`, backgroundColor: i % 2 === 0 ? '#fff' : '#FAFAF8' }}
                              className="hover:bg-[rgba(44,62,80,0.02)] transition-colors">
                              <td style={{ padding: '10px 14px', color: C.navy, fontWeight: 500 }}>{u ? u.full_name : '—'}</td>
                              <td style={{ padding: '10px 14px', color: C.muted, whiteSpace: 'nowrap' }}>{formatDateLocal(t.clocked_in_at)}</td>
                              <td style={{ padding: '10px 14px', color: job ? '#4A5A65' : 'rgba(44,62,80,0.3)' }}>{job ? job.title : '—'}</td>
                              <td style={{ padding: '10px 14px', color: '#4A5A65', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                {formatTime(t.clocked_in_at)}
                                {t.clock_in_lat && <MapPin style={{ width: 10, height: 10, color: C.sage, display: 'inline', marginLeft: 4 }} />}
                              </td>
                              <td style={{ padding: '10px 14px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                {isActive ? <span style={{ color: C.sage }}>Active</span> : <span style={{ color: '#4A5A65' }}>{formatTime(t.clocked_out_at!)}</span>}
                                {t.clock_out_lat && <MapPin style={{ width: 10, height: 10, color: C.sage, display: 'inline', marginLeft: 4 }} />}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {isActive ? <span style={{ color: C.muted }}>—</span> : t.total_minutes ? <span style={{ color: C.fg }}>{formatMinutes(t.total_minutes)}</span> : <span style={{ color: 'rgba(44,62,80,0.25)' }}>&lt;1 min</span>}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {(t.clock_in_lat || t.clock_out_lat) ? <span style={{ color: C.sage }}>Captured</span> : <span style={{ color: 'rgba(44,62,80,0.2)' }}>None</span>}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {isActive ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', backgroundColor: 'rgba(118,165,143,0.1)', color: C.sage, fontSize: 10, letterSpacing: '0.06em' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.sage, animation: 'pulse 1.5s infinite', display: 'inline-block' }} />Active
                                  </span>
                                ) : t.approved ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', backgroundColor: 'rgba(37,99,235,0.07)', color: '#2563eb', fontSize: 10, letterSpacing: '0.06em' }}>
                                    <CheckCircle style={{ width: 10, height: 10 }} />Approved
                                  </span>
                                ) : (
                                  <span style={{ padding: '3px 8px', backgroundColor: 'rgba(180,83,9,0.07)', color: '#b45309', fontSize: 10, letterSpacing: '0.06em' }}>Pending</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                <div className="flex items-center gap-2">
                                  {isActive && (
                                    <button onClick={() => forceClockOut(t)} disabled={closingOut.has(t.id)}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 11, border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer' }}
                                      className="hover:text-[#dc2626] hover:border-[rgba(220,38,38,0.3)] transition-colors disabled:opacity-40">
                                      <LogOut style={{ width: 11, height: 11 }} />{closingOut.has(t.id) ? '…' : 'Close'}
                                    </button>
                                  )}
                                  {!isActive && (
                                    <button onClick={() => toggleApprove(t)} disabled={approving.has(t.id)}
                                      style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                                        border: `1px solid ${t.approved ? C.border : 'rgba(118,165,143,0.3)'}`,
                                        color: t.approved ? C.muted : C.sage }}
                                      className="hover:opacity-70 transition-opacity disabled:opacity-40">
                                      {approving.has(t.id) ? '…' : t.approved ? 'Unapprove' : 'Approve'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
